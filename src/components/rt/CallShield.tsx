"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCountry } from "@/lib/region-store";
import { regionOf } from "@/lib/regions";
import { ruleFlags, type Flag } from "@/lib/rt/check-rules";
import { alertGuardian } from "@/lib/rt/guardian";
import { canRecognise, guessLang, listenContinuous, speak, stopSpeaking } from "@/lib/rt/speech";
import { PhoneIcon } from "./RtHeader";

/** A sample scam call, for trying the shield without a real call. Fictional. */
const SAMPLE_CALL = [
  "Hello, am I speaking with the account holder?",
  "This is the fraud department. We noticed unusual activity on your account today.",
  "For your protection, your account will be blocked within the hour.",
  "You need to move your money to a safe account that we have opened for you.",
  "I will send a verification code to your phone. Please read the code to me.",
  "And please don’t tell anyone about this call, it is a confidential investigation.",
];

export function CallShield() {
  const country = useCountry() ?? "XX";
  const region = regionOf(country);
  const line = region.hotline ?? region.support;
  const [mode, setMode] = useState<"idle" | "listening" | "sample">("idle");
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const stopRef = useRef<() => void>(() => {});
  const timers = useRef<number[]>([]);
  const warned = useRef(new Set<string>());
  const alerted = useRef(false);

  const flags: Flag[] = useMemo(() => ruleFlags(`${text} ${interim}`), [text, interim]);
  const severe = flags.some((f) => f.severe) || flags.length >= 2;
  const level = !flags.length ? "calm" : severe ? "danger" : "careful";

  // Vibrate and alert the family guardian the first time each warning appears
  useEffect(() => {
    if (mode === "idle") return;
    const fresh = flags.filter((f) => !warned.current.has(f.id));
    if (!fresh.length) return;
    fresh.forEach((f) => warned.current.add(f.id));
    try {
      if (severe && navigator.userActivation?.hasBeenActive) navigator.vibrate?.([250, 120, 250]);
    } catch {
      /* not supported */
    }
    if (severe && !alerted.current) {
      alerted.current = true;
      alertGuardian("shield", `The call included: ${flags.map((f) => f.title.toLowerCase()).join("; ")}.`);
    }
  }, [flags, severe, mode]);

  useEffect(
    () => () => {
      stopRef.current();
      timers.current.forEach((x) => window.clearTimeout(x));
      stopSpeaking();
    },
    [],
  );

  function reset() {
    stopRef.current();
    timers.current.forEach((x) => window.clearTimeout(x));
    timers.current = [];
    stopSpeaking();
    warned.current.clear();
    alerted.current = false;
    setText("");
    setInterim("");
    setError("");
  }

  function startListening() {
    reset();
    if (!canRecognise()) {
      setError("Listening isn’t available in this browser. Try Chrome on Android, or use the sample call.");
      return;
    }
    setMode("listening");
    stopRef.current = listenContinuous(
      navigator.language || "en",
      (all, now) => {
        setText(all);
        setInterim(now);
      },
      () => {
        setError("The microphone was blocked. Allow it in your browser settings, then try again.");
        setMode("idle");
      },
    );
  }

  function playSample() {
    reset();
    setMode("sample");
    let at = 600;
    SAMPLE_CALL.forEach((l, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setText((x) => `${x} ${l}`.trim());
          speak(l, "en");
          if (i === SAMPLE_CALL.length - 1) timers.current.push(window.setTimeout(() => setMode("idle"), 4000));
        }, at),
      );
      at += 3200;
    });
  }

  function stop() {
    reset();
    setMode("idle");
  }

  const tone =
    level === "danger" ? "bg-red text-paper" : level === "careful" ? "bg-gold text-[#10151c]" : "bg-ok-soft text-ink";

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 lg:pt-12">
      <p className="rt-pill rt-rise">On a call right now?</p>
      <h1 className="t-h1 rt-rise mt-4" style={{ animationDelay: "60ms" }}>
        Call shield: a second pair of ears
      </h1>
      <p className="t-lead rt-rise mt-3" style={{ animationDelay: "120ms" }}>
        Put the call on speaker and tap Start. Golden Hour listens for scam tricks, like a “safe account”, a request for a code, or a demand for secrecy, and warns you straight away.
      </p>

      <div className="rt-rise mt-6 flex flex-wrap gap-2" style={{ animationDelay: "180ms" }}>
        {mode === "idle" ? (
          <>
            <button type="button" className="rt-btn rt-btn-ink rt-btn-lg" onClick={startListening}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
              Start listening
            </button>
            <button type="button" className="rt-btn rt-btn-line rt-btn-lg" onClick={playSample}>
              Try a sample scam call
            </button>
          </>
        ) : (
          <button type="button" className="rt-btn rt-btn-line rt-btn-lg" onClick={stop}>
            Stop
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl border border-red bg-red-soft px-4 py-3 font-semibold">
          {error}
        </p>
      )}

      {(mode !== "idle" || text) && (
        <section aria-labelledby="shield-status" className="mt-6 overflow-hidden rounded-3xl border border-line">
          <div className={`flex items-center gap-3 px-5 py-4 transition-colors duration-300 ${tone} ${level === "danger" ? "rt-alert-flash" : ""}`} role="alert" aria-live="assertive">
            {mode !== "idle" && level === "calm" && <span className="h-3 w-3 animate-pulse rounded-full bg-ok" aria-hidden="true" />}
            <h2 id="shield-status" className="t-h3 !font-bold">
              {level === "danger"
                ? "This sounds like a scam. Hang up now."
                : level === "careful"
                  ? "Be careful: a warning sign was heard."
                  : mode !== "idle"
                    ? "Listening. No warning signs yet."
                    : "No warning signs were heard."}
            </h2>
          </div>
          {flags.length > 0 && (
            <ul className="space-y-3 px-5 py-4">
              {flags.map((f) => (
                <li key={f.id} className="rt-pop flex gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${f.severe ? "bg-red" : "bg-gold"}`} aria-hidden="true" />
                  <span>
                    <span className="block font-semibold">{f.title}</span>
                    <span className="block text-muted">{f.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {level === "danger" && line && (
            <div className="border-t border-line px-5 py-4">
              <a href={`tel:${line.number.replace(/[^\d]/g, "")}`} className="rt-btn rt-btn-red">
                <PhoneIcon />
                After you hang up, call {line.number}
              </a>
            </div>
          )}
          <div className="border-t border-line bg-surface px-5 py-4">
            <h3 className="t-small font-semibold text-muted">What was heard</h3>
            <p className="relative mt-1 max-h-48 overflow-y-auto text-[1.0625rem] leading-relaxed" lang={guessLang(text)} tabIndex={0} aria-label="What was heard">
              {text || <span className="text-muted">Nothing yet.</span>} <span className="text-muted">{interim}</span>
            </p>
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Speaker on", "Put the call on speaker so the phone’s microphone can hear the caller."],
          ["Nothing is recorded", "Words are turned into text by your browser and checked on this device. Golden Hour doesn’t save or send them."],
          ["You decide", "Golden Hour only warns. Hanging up is always allowed, and always safe."],
        ].map(([h, b]) => (
          <div key={h} className="rounded-2xl bg-surface p-4">
            <p className="font-semibold">{h}</p>
            <p className="mt-1 t-small text-muted">{b}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 t-small text-muted">
        Browser speech recognition may send audio to the browser maker’s speech service. A phone can’t share call audio with a website directly, which is why speaker mode is needed.
      </p>
    </div>
  );
}
