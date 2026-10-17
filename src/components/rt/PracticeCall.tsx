"use client";

import { useEffect, useRef, useState } from "react";
import { useCountry } from "@/lib/region-store";
import type { LiveVoice, VoiceState } from "@/lib/rt/live-voice";
import { judge, SCENARIOS, scenarioFor, type PracticeChoice, type Scenario } from "@/lib/rt/practice";
import { canRecognise, listen, speak, stopSpeaking } from "@/lib/rt/speech";
import { usePrefs } from "@/lib/rt/prefs";

type Phase = "pick" | "ringing" | "call" | "done";
interface Said {
  who: "caller" | "you" | "coach";
  text: string;
  safe?: boolean;
}

function PhoneGlyph({ className = "h-7 w-7", down = false }: { className?: string; down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} ${down ? "rotate-[135deg]" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}

export function PracticeCall() {
  const prefs = usePrefs();
  const country = useCountry() ?? "XX";
  const [sc, setSc] = useState<Scenario | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [turn, setTurn] = useState(0);
  const [log, setLog] = useState<Said[]>([]);
  const [feedback, setFeedback] = useState<{ safe: boolean; why: string; ends?: boolean } | null>(null);
  const [safeCount, setSafeCount] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [mistakes, setMistakes] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [listening, setListening] = useState(false);
  const [liveOk, setLiveOk] = useState(false);
  const [live, setLive] = useState(false);
  const [vstate, setVstate] = useState<VoiceState>("idle");
  const [liveResult, setLiveResult] = useState<{ score: number; tips: string } | null>(null);
  const voice = useRef<LiveVoice | null>(null);
  const answering = useRef(false);
  const stopRec = useRef<() => void>(() => {});
  const logEnd = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);

  const suggested = scenarioFor(country);

  useEffect(() => () => {
    stopSpeaking();
    stopRec.current();
    voice.current?.close();
  }, []);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest", behavior: prefs.reduceMotion ? "auto" : "smooth" });
  }, [log, feedback, prefs.reduceMotion]);
  useEffect(() => {
    const raf = requestAnimationFrame(() => headRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Find out once whether live AI voice is available for practice
  useEffect(() => {
    let off = false;
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((c: { liveVoice?: boolean }) => !off && setLiveOk(!!c.liveVoice))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  function callerSays(text: string) {
    setLog((l) => [...l, { who: "caller", text }]);
    if (prefs.replies === "voice") speak(text, "en");
  }

  function begin(s: Scenario, withLive: boolean) {
    setSc(s);
    setLive(withLive);
    setTurn(0);
    setLog([]);
    setFeedback(null);
    setSafeCount(0);
    setAnswered(0);
    setMistakes([]);
    setLiveResult(null);
    answering.current = false;
    voice.current?.close();
    voice.current = null;
    stopSpeaking();
    setPhase("ringing");
  }

  async function answerCall() {
    if (!sc || answering.current) return;
    answering.current = true;
    setPhase("call");
    if (live) {
      await startLive(sc);
      return;
    }
    callerSays(sc.turns[0].line);
  }

  function decline() {
    setLog([{ who: "coach", text: "You didn’t answer an unknown caller. That’s a perfectly safe choice." }]);
    setSafeCount(1);
    setAnswered(1);
    setPhase("done");
  }

  function finish() {
    stopSpeaking();
    stopRec.current();
    voice.current?.close();
    voice.current = null;
    setPhase("done");
  }

  function choose(c: PracticeChoice, said = c.label) {
    if (!sc || feedback) return;
    stopSpeaking();
    setLog((l) => [...l, { who: "you", text: said, safe: c.safe }]);
    setAnswered((n) => n + 1);
    if (c.safe) setSafeCount((n) => n + 1);
    else setMistakes((m) => [...m, c.why]);
    setFeedback({ safe: c.safe, why: c.why, ends: c.ends || turn >= sc.turns.length - 1 });
  }

  function next() {
    if (!sc || !feedback) return;
    if (feedback.ends) {
      setFeedback(null);
      finish();
      return;
    }
    const n = turn + 1;
    setTurn(n);
    setFeedback(null);
    callerSays(sc.turns[n].line);
  }

  function freeAnswer(text: string) {
    if (!sc || !text.trim()) return;
    if (live) {
      setLog((l) => [...l, { who: "you", text }]);
      voice.current?.sendText(text);
      return;
    }
    const v = judge(text);
    const turnChoices = sc.turns[turn].choices;
    if (v === "unclear") {
      setLog((l) => [...l, { who: "you", text }, { who: "coach", text: "Try a clear answer: say no, hang up, or say you’ll check yourself." }]);
      return;
    }
    const pick = v === "safe" ? turnChoices.find((c) => c.safe && c.ends) ?? turnChoices.find((c) => c.safe)! : turnChoices.find((c) => !c.safe)!;
    choose(pick, text);
  }

  function dictate() {
    if (listening) return stopRec.current();
    if (!canRecognise()) return;
    stopSpeaking();
    setListening(true);
    stopRec.current = listen(
      navigator.language || "en",
      (text, final) => {
        setTyped(text);
        if (final) {
          setTyped("");
          freeAnswer(text);
        }
      },
      () => setListening(false),
    );
  }

  async function startLive(s: Scenario) {
    try {
      const res = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "practice", scenario: s.id, country, browserLang: navigator.language }),
      });
      const j = await res.json();
      if (j.mode !== "live") throw new Error("guided");
      // Loaded only when live voice starts, so the home page stays light
      const { LiveVoice } = await import("@/lib/rt/live-voice");
      const v = new LiveVoice(j.token, j.model, j.config, {
        onState: setVstate,
        onCaption: (role, text, final) => {
          if (!final) return;
          setLog((l) => [...l, { who: role === "assistant" ? "caller" : "you", text }]);
        },
        onLevel: () => {},
        onTool: async (name, args) => {
          if (name === "end_practice") {
            const score = Math.max(0, Math.min(100, Number(args.score) || 0));
            setLiveResult({ score, tips: String(args.tips ?? "") });
            // Let the closing feedback play, then end the voice connection so nothing keeps running
            window.setTimeout(() => {
              if (voice.current === v) finish();
            }, 9000);
          }
          return { ok: true };
        },
        onError: () => {},
        onClose: () => {
          // Ended by Gemini, a time limit, or leaving the page: end the call here too
          if (voice.current === v) finish();
        },
      });
      voice.current = v;
      await v.start(true, "(The practice call has just been answered. Start the role-play with your first line.)");
    } catch {
      setLive(false);
      callerSays(s.turns[0].line);
    }
  }

  const score = liveResult ? liveResult.score : answered ? Math.round((safeCount / answered) * 100) : 0;
  const badge = score >= 80 ? "Scam-proof!" : score >= 50 ? "Nearly there" : "Let’s practise again";

  async function share() {
    const text = `I scored ${score}/100 on a Golden Hour practice scam call (${sc?.title}). Can you beat it? Practise saying no before a real scammer calls.`;
    const url = `${window.location.origin}/practice`;
    try {
      if (navigator.share) await navigator.share({ title: "Golden Hour practice call", text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {
      /* closed */
    }
  }

  // ---------- views ----------

  if (phase === "pick")
    return (
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:pt-12">
        <p className="rt-pill rt-rise">Practice, not a real call</p>
        <h1 ref={headRef} tabIndex={-1} className="t-h1 rt-rise mt-4 outline-none" style={{ animationDelay: "60ms" }}>
          Practice call: learn to say no
        </h1>
        <p className="t-lead rt-rise mt-3 max-w-2xl" style={{ animationDelay: "120ms" }}>
          A pretend scammer calls you. Practise what to say, get instant feedback and a score. Great for parents and grandparents: try it together.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((s, i) => (
            <li key={s.id} className="rt-rise" style={{ animationDelay: `${160 + i * 60}ms` }}>
              <div className={`rt-card rt-card-hover flex h-full flex-col p-5 ${s.id === suggested.id ? "!border-gold" : ""}`}>
                {s.id === suggested.id && <p className="rt-pill !py-0.5 self-start text-[0.75rem]">Common where you are</p>}
                <h2 className="t-h3 mt-2 !font-bold">{s.title}</h2>
                <p className="mt-1 flex-1 text-muted">{s.blurb}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="rt-btn rt-btn-ink" onClick={() => begin(s, false)}>
                    Start practice
                  </button>
                  {liveOk && (
                    <button type="button" className="rt-btn rt-btn-line" onClick={() => begin(s, true)}>
                      With live AI voice
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 t-small text-muted">
          Everything here is fictional. Never share a real code, PIN, password or card number, even in practice.
          {!liveOk && " With a Gemini key on the server, the caller is a live AI voice that answers whatever you say, in your language."}
        </p>
      </div>
    );

  if (phase === "ringing" && sc)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-10 text-center">
        <p className="rounded-full bg-gold px-3 py-1 text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-[#10151c]">Practice call</p>
        <div className="rt-ring-phone mt-10 grid h-28 w-28 place-items-center rounded-full bg-surface text-ink" aria-hidden="true">
          <PhoneGlyph className="h-12 w-12" />
        </div>
        <h1 ref={headRef} tabIndex={-1} className="t-h1 mt-6 outline-none">
          {sc.caller}
        </h1>
        <p className="mt-1 text-muted">Unknown number · calling…</p>
        <div className="mt-10 flex w-full justify-center gap-10">
          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={decline} className="grid h-16 w-16 place-items-center rounded-full bg-red text-paper" aria-label="Decline the call">
              <PhoneGlyph down />
            </button>
            <span className="t-small font-semibold" aria-hidden="true">
              Decline
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={answerCall} className="grid h-16 w-16 place-items-center rounded-full bg-ok text-paper" aria-label="Answer the call">
              <PhoneGlyph />
            </button>
            <span className="t-small font-semibold" aria-hidden="true">
              Answer
            </span>
          </div>
        </div>
        <button type="button" className="rt-btn rt-btn-ghost mt-8 underline underline-offset-4" onClick={() => setPhase("pick")}>
          Choose a different call
        </button>
      </div>
    );

  if (phase === "call" && sc) {
    const choices = live ? [] : sc.turns[turn].choices;
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-paper">
          <div>
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.1em] text-gold">Practice call</p>
            <h1 ref={headRef} tabIndex={-1} className="font-semibold outline-none">
              {sc.caller}
              {live && <span className="ml-2 t-small opacity-75">{vstate === "speaking" ? "speaking…" : vstate === "listening" ? "listening" : ""}</span>}
            </h1>
          </div>
          <button type="button" onClick={() => (live ? finish() : choose(sc.turns[turn].choices.find((c) => c.ends && c.label === "Hang up") ?? { label: "Hang up", safe: true, ends: true, why: "Hanging up is always allowed." }))} className="rt-btn rt-btn-red !min-h-10">
            <PhoneGlyph className="h-5 w-5" down />
            Hang up
          </button>
        </div>
        <div role="log" aria-live="polite" aria-label="Practice call" className="mt-5 space-y-3">
          {log.map((l, i) => (
            <div key={i} className={l.who === "you" ? "flex justify-end" : ""}>
              <div
                className={`rt-pop max-w-[88%] rounded-3xl px-4 py-3 ${
                  l.who === "caller" ? "rounded-tl-md bg-surface" : l.who === "you" ? "rounded-tr-md bg-ink text-paper" : "border border-dashed border-line-strong t-small text-muted"
                }`}
              >
                <span className="mb-0.5 block t-small font-semibold opacity-80">{l.who === "caller" ? sc.caller : l.who === "you" ? "You" : "Coach"}</span>
                {l.text}
              </div>
            </div>
          ))}
          {feedback && (
            <div className={`rt-pop rounded-2xl border-2 px-4 py-3 ${feedback.safe ? "border-ok bg-ok-soft" : "border-red bg-red-soft"}`} role="status">
              <p className="font-bold">{feedback.safe ? "Safe choice" : "Risky: a scammer would win here"}</p>
              <p className="mt-0.5">{feedback.why}</p>
              <button type="button" className="rt-btn rt-btn-ink mt-3 !min-h-10" onClick={next}>
                {feedback.ends ? "See my score" : "Continue the call"}
              </button>
            </div>
          )}
          <div ref={logEnd} />
        </div>

        {!feedback && (
          <div className="mt-5 rounded-3xl border border-line bg-paper p-3">
            {choices.length > 0 && (
              <>
                <p className="px-1 t-small font-semibold text-muted">What do you say?</p>
                <ul className="mt-2 grid gap-2">
                  {choices.map((c) => (
                    <li key={c.label}>
                      <button type="button" className="rt-card-btn" onClick={() => choose(c)}>
                        {c.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                freeAnswer(typed);
                setTyped("");
              }}
            >
              <label htmlFor="practice-say" className="sr-only">
                Or say it in your own words
              </label>
              <input id="practice-say" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or answer in your own words" className="rt-input min-w-0 flex-1" />
              {canRecognise() && !live && (
                <button type="button" onClick={dictate} className={`rt-btn rt-btn-icon ${listening ? "rt-btn-red" : "rt-btn-line"}`} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Answer by voice"}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                </button>
              )}
              <button type="submit" className="rt-btn rt-btn-ink" disabled={!typed.trim()}>
                Say
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  // done
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 text-center sm:px-6">
      <p className="rt-pill rt-rise">Practice complete</p>
      <div
        className="rt-pop mx-auto mt-6 h-40 w-40 rounded-full p-[10px] shadow-[0_20px_50px_-30px_rgb(194_128_0/0.9)]"
        style={{ background: `conic-gradient(var(--rt-gold) ${score * 3.6}deg, var(--rt-gold-soft) 0)` }}
        aria-hidden="true"
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-paper">
        <div>
          <p className="rt-display text-[3.2rem] font-extrabold leading-none tabular">{score}</p>
          <p className="t-small text-muted">out of 100</p>
        </div>
        </div>
      </div>
      <p className="sr-only">Score: {score} out of 100.</p>
      <h1 ref={headRef} tabIndex={-1} className="t-h1 mt-5 outline-none">
        {badge}
      </h1>
      <p className="t-lead mx-auto mt-2 max-w-xl">{liveResult?.tips || sc?.lesson}</p>
      {mistakes.length > 0 && (
        <div className="mx-auto mt-6 max-w-xl rounded-3xl bg-surface p-5 text-left">
          <h2 className="font-semibold">Remember for next time</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            {mistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {sc && (
          <button type="button" className="rt-btn rt-btn-ink" onClick={() => begin(sc, live)}>
            Try again
          </button>
        )}
        <button type="button" className="rt-btn rt-btn-line" onClick={() => setPhase("pick")}>
          Another scam
        </button>
        <button type="button" className="rt-btn rt-btn-line" onClick={share}>
          Challenge your family
        </button>
      </div>
    </div>
  );
}
