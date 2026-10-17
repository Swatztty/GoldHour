"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { formatMoney } from "@/lib/investigate";
import { setCountry, useCountry } from "@/lib/region-store";
import { firstCall, regionOf, type CountryCode } from "@/lib/regions";
import {
  applyOffline,
  nextStep,
  type Quick,
  type Step,
  type StepId,
} from "@/lib/rt/guided";
import { compressImage } from "@/lib/rt/image";
import type { LiveVoice, VoiceState } from "@/lib/rt/live-voice";
import { buildPlan } from "@/lib/rt/plan";
import { usePrefs } from "@/lib/rt/prefs";
import {
  canRecognise,
  guessLang,
  listen,
  speak,
  stopSpeaking,
} from "@/lib/rt/speech";
import type { Report, ReportDraft } from "@/lib/rt/types";
import { draftReady, missingFields } from "@/lib/rt/validate";
import type { PaymentMethod, ScamType } from "@/lib/types";
import { HomeCards } from "./HomeCards";
import { useT } from "@/lib/rt/i18n";
import { alertGuardian } from "@/lib/rt/guardian";
import { rememberReport } from "@/lib/rt/myreports";
import { GoldenTimer } from "./GoldenTimer";
import { PhoneIcon } from "./RtHeader";
import { CallFirstBar, CallReady } from "./CallReady";
import { parseRef } from "@/lib/rt/parse";

interface Line {
  id: number;
  role: "assistant" | "user" | "system";
  text: string;
  final: boolean;
}

const emptyDraft = (country: CountryCode): ReportDraft => ({
  country,
  receivers: [],
  contacts: [],
});

function merge(d: ReportDraft, p: Partial<ReportDraft>): ReportDraft {
  const next: ReportDraft = { ...d };
  for (const [k, v] of Object.entries(p) as [keyof ReportDraft, unknown][]) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "receivers" || k === "contacts") continue;
    (next as unknown as Record<string, unknown>)[k] = v;
  }
  const seen = new Set(
    d.receivers.map((r) => r.value.replace(/\W/g, "").toLowerCase()),
  );
  next.receivers = [
    ...d.receivers,
    ...(p.receivers ?? []).filter(
      (r) => r.value && !seen.has(r.value.replace(/\W/g, "").toLowerCase()),
    ),
  ];
  const seenC = new Set(
    d.contacts.map((c) => c.value.replace(/\W/g, "").toLowerCase()),
  );
  next.contacts = [
    ...d.contacts,
    ...(p.contacts ?? []).filter(
      (c) => c.value && !seenC.has(c.value.replace(/\W/g, "").toLowerCase()),
    ),
  ];
  return next;
}

/** Map the voice assistant's tool arguments to report fields. */
function fromToolArgs(a: Record<string, unknown>): Partial<ReportDraft> {
  const s = (k: string) =>
    typeof a[k] === "string" && (a[k] as string).trim()
      ? (a[k] as string).trim()
      : undefined;
  const n = (k: string) =>
    typeof a[k] === "number" && Number.isFinite(a[k])
      ? (a[k] as number)
      : undefined;
  const p: Partial<ReportDraft> = {
    story: s("story"),
    summaryEnglish: s("summary_english"),
    scamType: s("scam_type") as ScamType | undefined,
    amount: n("amount"),
    currency: s("currency")?.toUpperCase(),
    minutesAgo: n("minutes_ago"),
    method: s("payment_method") as PaymentMethod | undefined,
    victimBank: s("victim_bank"),
    txnRef: s("transaction_ref"),
    city: s("city"),
    scriptQuote: s("scam_quote"),
    language: s("language"),
    receivers: [],
    contacts: [],
  };
  if (s("receiver_value"))
    p.receivers = [
      {
        kind: s("receiver_kind") === "payid" ? "payid" : "account",
        value: s("receiver_value")!,
        bank: s("receiver_bank"),
        name: s("receiver_name"),
      },
    ];
  if (s("scammer_phone"))
    p.contacts!.push({
      kind: "phone",
      value: s("scammer_phone")!,
      app: s("scammer_app"),
    });
  if (s("scammer_handle"))
    p.contacts!.push({
      kind: "handle",
      value: s("scammer_handle")!,
      app: s("scammer_app"),
    });
  return p;
}

/** A soft tone that tells blind users it's their turn to speak. */
function cue() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.2);
    o.onended = () => ctx.close();
  } catch {
    /* audio unavailable */
  }
}

const STATUS: Record<VoiceState | "guided-listening" | "guided-idle", string> =
  {
    idle: "Tap to start talking",
    connecting: "Connecting…",
    listening: "Listening. Talk now. Tap to pause",
    muted: "Paused. Tap to talk",
    thinking: "Thinking…",
    speaking: "Golden Hour is speaking. Tap to interrupt",
    error: "Something went wrong",
    "guided-listening": "Listening. Tap when you have finished",
    "guided-idle": "Tap to answer by voice",
  };

function ReportCard({
  draft,
  prefix,
  fields,
  ready,
  busy,
  onSend,
  minutesAgo,
}: {
  draft: ReportDraft;
  prefix: string;
  fields: { label: string; value?: string }[];
  ready: boolean;
  busy: boolean;
  onSend: () => void;
  minutesAgo?: number;
}) {
  const filled = fields.filter((f) => f.value).length;
  return (
    <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${prefix}-report-h`} className="t-h2">
          Your report
        </h2>
        <p className="tabular t-small font-semibold text-muted">
          {filled} of {fields.length}
        </p>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-ok transition-all"
          style={{ width: `${(filled / fields.length) * 100}%` }}
        />
      </div>
      {minutesAgo !== undefined && (
        <div className="mt-4">
          <GoldenTimer key={minutesAgo} minutesAgo={minutesAgo} compact />
        </div>
      )}
      <div className="mt-4">
        <CallReady draft={draft} />
      </div>
      <p className="mt-4 t-small text-muted">
        Your report fills in as you talk. To change something, just say it.
      </p>
      <dl className="mt-3 divide-y divide-line">
        {fields.map((f) => (
          <div key={f.label} className="py-2.5 pl-8">
            <dt className="relative font-semibold">
              <span className="absolute -left-8 top-0.5" aria-hidden="true">
                {f.value ? (
                  <svg
                    viewBox="0 0 20 20"
                    className="h-5 w-5 text-ok"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M4 10.5l4 4 8-9" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 20 20"
                    className="h-5 w-5 text-line-strong"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="10" cy="10" r="7" />
                  </svg>
                )}
              </span>
              {f.label}
            </dt>
            <dd
              className={`break-words ${f.value ? "" : "text-muted"}`}
              lang={f.value ? guessLang(f.value) : undefined}
            >
              {f.value
                ? f.value.length > 160
                  ? `${f.value.slice(0, 160)}…`
                  : f.value
                : "Not yet"}
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onSend}
        disabled={!ready || busy}
        className="rt-btn rt-btn-red rt-btn-lg mt-4 w-full"
      >
        Send report
      </button>
      {!ready && (
        <p className="mt-2 t-small text-muted">
          You can send once we know what happened, and the amount or where the
          money went.
        </p>
      )}
      <p className="mt-4 border-t border-line pt-4 t-small text-muted">
        We never ask for PINs, passwords, one-time codes or your address.
      </p>
    </div>
  );
}

const ico = (d: string, extra?: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
    {extra}
  </svg>
);

const HOW = [
  {
    tk: "how1" as const,
    sk: "how1s" as const,
    title: "Tell us what happened",
    short: "Speak, type or share a screenshot.",
    body: "Speak, type or share a screenshot, in any language. Golden Hour asks one simple question at a time and never asks for a PIN or password.",
    icon: ico("M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3"),
  },
  {
    tk: "how2" as const,
    sk: "how2s" as const,
    title: "Act fast, with help",
    short: "Who to call first, plus ready letters.",
    body: "Golden Hour tells you who to call first in your country, then hands you a ready-made plan and letters for your bank and the police.",
    icon: ico("M13 2 4 14h7l-1 8 9-12h-7l1-8Z"),
  },
  {
    tk: "how3" as const,
    sk: "how3s" as const,
    title: "Stop the next victim",
    short: "Linked reports get accounts frozen.",
    body: "Your report is linked to others who paid the same account. When enough victims match, banks get an alert to freeze it.",
    icon: ico(
      "M6.6 16.4C10 9 14 13 17.4 7.6",
      <>
        <circle cx="5" cy="18" r="2.2" />
        <circle cx="19" cy="6" r="2.2" />
      </>,
    ),
  },
];

export function Reporter() {
  const prefs = usePrefs();
  const t = useT();
  const countryPick = useCountry();
  const country: CountryCode = countryPick ?? "XX";
  const region = regionOf(country);

  const [phase, setPhase] = useState<"start" | "talking">("start");
  const [mode, setMode] = useState<"live" | "guided" | null>(null);
  const [vstate, setVstate] = useState<
    VoiceState | "guided-listening" | "guided-idle"
  >("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState<ReportDraft>(() => emptyDraft(country));
  const [step, setStep] = useState<Step | null>(null);
  const [typed, setTyped] = useState("");
  // the person has called (or said they already had): stop interrupting with "call now"
  const [called, setCalled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<Report | null>(null);
  const [level, setLevel] = useState(0);
  const [announce, setAnnounce] = useState("");

  const live = useRef<LiveVoice | null>(null);
  const liveSpoke = useRef(false);
  // Guards so a double tap, a restart mid-connection or the assistant asking twice can never
  // open two voice sessions or send the same report twice
  const liveGen = useRef(0);
  const startingLive = useRef(false);
  const listeningNow = useRef(false);
  const submitting = useRef<Promise<Report | null> | null>(null);
  const submitted = useRef<Report | null>(null);
  const lastAnswer = useRef({ text: "", at: 0 });
  const answering = useRef(false);
  const stopRec = useRef<() => void>(() => {});
  const draftRef = useRef(draft);
  const doneRef = useRef(new Set<StepId>());
  const markCalled = useCallback(() => {
    setCalled(true);
    doneRef.current.add("urgent");
  }, []);
  const lineId = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLTextAreaElement>(null);
  const logEnd = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const [sheet, setSheet] = useState(false);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // Update the ref synchronously so the next question sees the new answer straight away
  const setD = useCallback((fn: (d: ReportDraft) => ReportDraft) => {
    const n = fn(draftRef.current);
    draftRef.current = n;
    setDraft(n);
  }, []);

  const focusType = useCallback(() => {
    window.setTimeout(() => typeRef.current?.focus(), 80);
  }, []);

  // keep the draft's country in step with the picker until the report is sent
  useEffect(() => {
    if (!result)
      setD((d) => ({
        ...d,
        country,
        currency: d.currency ?? regionOf(country).currency,
      }));
  }, [country, result, setD]);

  // Keep the newest message in view just above the message bar, but only while the person is
  // following along at the end: if they scroll back to reread, nothing moves under them.
  const followEnd = useRef(true);
  const reduceMotion = prefs.reduceMotion;
  const gapToEnd = useCallback(() => {
    const end = logEnd.current;
    if (!end) return 0;
    const visibleBottom =
      composerRef.current?.getBoundingClientRect().top ?? window.innerHeight;
    return end.getBoundingClientRect().top - visibleBottom + 16;
  }, []);
  const scrollToEnd = useCallback(
    (smooth: boolean) => {
      const gap = gapToEnd();
      if (Math.abs(gap) > 4)
        window.scrollTo({
          top: window.scrollY + gap,
          behavior: smooth && !reduceMotion ? "smooth" : "auto",
        });
    },
    [gapToEnd, reduceMotion],
  );

  useEffect(() => {
    if (phase !== "talking") return;
    const onScroll = () => {
      followEnd.current = gapToEnd() < 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // The message bar grows and shrinks (quick answers, typing), so re-align when it does
    const ro = new ResizeObserver(() => {
      if (followEnd.current) scrollToEnd(false);
    });
    if (composerRef.current) ro.observe(composerRef.current);
    return () => {
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [phase, gapToEnd, scrollToEnd]);

  useEffect(() => {
    if (phase !== "talking" || !lines.length) return;
    if (lines[lines.length - 1].role === "user") followEnd.current = true;
    if (!followEnd.current) return;
    const raf = requestAnimationFrame(() => scrollToEnd(true));
    return () => cancelAnimationFrame(raf);
  }, [lines, phase, scrollToEnd]);

  // Measure how long reporting takes (shown as an impact figure on the network page)
  const startedAt = useRef<number | null>(null);
  const usedScreenshot = useRef(false);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
    if (phase === "talking" && startedAt.current === null) startedAt.current = Date.now();
    if (phase === "start") {
      startedAt.current = null;
      usedScreenshot.current = false;
    }
  }, [phase, mode]);

  // Entering the conversation: start at the top of the screen, not halfway down the old page
  useEffect(() => {
    if (phase === "talking") window.scrollTo({ top: 0 });
  }, [phase]);
  // Leaving the page ends the voice session, including one that is still connecting
  useEffect(
    () => () => {
      liveGen.current++;
      live.current?.close();
      live.current = null;
      stopRec.current();
      stopSpeaking();
    },
    [],
  );
  useEffect(() => {
    if (live.current) live.current.speakAloud = prefs.replies === "voice";
  }, [prefs.replies]);

  const caption = useCallback(
    (role: Line["role"], text: string, final: boolean) => {
      setLines((ls) => {
        const last = ls[ls.length - 1];
        if (last && last.role === role && !last.final)
          return [...ls.slice(0, -1), { ...last, text, final }];
        return [...ls, { id: ++lineId.current, role, text, final }];
      });
    },
    [],
  );

  // ---------- guided mode ----------

  const say = useCallback(
    (text: string) => {
      caption("assistant", text, true);
      if (prefsRef.current.replies === "voice")
        speak(text, navigator.language || "en");
    },
    [caption],
  );

  const advance = useCallback(() => {
    const s = nextStep(
      draftRef.current,
      doneRef.current,
      prefsRef.current.easyRead,
    );
    setStep(s);
    if (s) say(s.say);
  }, [say]);

  const startGuided = useCallback(
    (why?: string) => {
      setMode("guided");
      setPhase("talking");
      setVstate("guided-idle");
      if (why) setNotice(why);
      advance();
    },
    [advance],
  );

  // ---------- submit ----------

  const submit = useCallback(async (): Promise<Report | null> => {
    if (submitted.current) return submitted.current;
    if (submitting.current) return submitting.current;
    async function submitOnce(): Promise<Report | null> {
      const d = draftRef.current;
      if (!draftReady(d)) {
        setNotice(
          "Before sending, tell us what happened and either how much was sent or where it went.",
        );
        return null;
      }
      setBusy("Sending your report and checking it against other reports…");
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...d,
            secondsToReport: startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : undefined,
            channel: modeRef.current === "live" ? "voice" : usedScreenshot.current ? "screenshot" : "guided",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const r = data as Report;
        setResult(r);
        try {
          localStorage.setItem(`rt.report.${r.id}`, JSON.stringify(r));
          rememberReport({
            id: r.id,
            createdAt: r.createdAt,
            country: r.country,
            amount: r.amount,
            currency: r.currency,
            title: r.ringName || "Scam report",
          });
          new BroadcastChannel("golden-hour").postMessage({
            type: "report",
            id: r.id,
          });
        } catch {
          /* optional */
        }
        setAnnounce("Your report has been sent.");
        alertGuardian(
          "report",
          `${r.amount ? `${formatMoney(r.amount, r.currency ?? regionOf(r.country).currency)} was sent to scammers. ` : ""}They have been told to call ${regionOf(r.country).hotline?.number ?? "their bank"} first.`,
        );
        setTimeout(() => resultRef.current?.focus(), 50);
        return r;
      } catch (e) {
        setNotice(
          (e as Error).message || "The report could not be sent. Try again.",
        );
        return null;
      } finally {
        setBusy(null);
      }
    }
    const run = submitOnce();
    submitting.current = run;
    const r = await run;
    submitting.current = null;
    if (r) submitted.current = r;
    return r;
  }, []);

  function resultSentence(r: Report): string {
    const hard = r.matches.filter((m) => m.kind !== "script");
    const others = Math.max(0, ...r.matches.map((m) => m.otherReports));
    const countries = [...new Set(r.matches.flatMap((m) => m.countries))];
    const link = others
      ? `Your report matches ${others} other report${others === 1 ? "" : "s"}${countries.length ? ` in ${countries.join(", ")}` : ""}${hard.length ? `, through ${hard.map((m) => m.value).join(" and ")}` : ", because the scam was the same"}.`
      : "This looks like a new scam. Your report will help protect the next person.";
    const freeze = r.freezeNow.length
      ? ` The account ${r.freezeNow.join(" and ")} is now flagged so banks can freeze it.`
      : "";
    const first = buildPlan(r.country, r.victimBank)[0];
    return `${link}${freeze} Now: ${first.title}.`;
  }

  // ---------- live mode ----------

  const onTool = useCallback(
    async (
      name: string,
      args: Record<string, unknown>,
    ): Promise<Record<string, unknown>> => {
      if (name === "save_report_details") {
        setD((d) => merge(d, fromToolArgs(args)));
        await new Promise((r) => setTimeout(r, 0));
        return { saved: true, still_missing: missingFields(draftRef.current) };
      }
      if (name === "submit_report") {
        const r = await submit();
        if (!r)
          return {
            submitted: false,
            reason: "Not enough details yet",
            still_missing: missingFields(draftRef.current),
          };
        const plan = buildPlan(
          r.country,
          r.victimBank,
          r.contacts.length > 0,
          r.scamType === "remote_access",
        );
        return {
          submitted: true,
          linked_to_other_reports: r.matches.map((m) => ({
            by: m.kind,
            value: m.value,
            other_reports: m.otherReports,
            countries: m.countries,
          })),
          accounts_flagged_to_freeze: r.freezeNow,
          steps: plan.map((p) => `${p.title}: ${p.why}`),
          tell_the_person: resultSentence(r),
        };
      }
      if (name === "get_official_help") {
        return {
          country: region.name,
          steps: buildPlan(country).map((p) => `${p.title}: ${p.why}`),
        };
      }
      return { error: "unknown tool" };
    },
    [country, region.name, setD, submit],
  );

  async function startLive() {
    if (startingLive.current || live.current) return;
    startingLive.current = true;
    const gen = ++liveGen.current;
    try {
      await startLiveInner(gen);
    } finally {
      startingLive.current = false;
    }
  }

  async function startLiveInner(gen: number) {
    const stale = () => gen !== liveGen.current;
    liveSpoke.current = false;
    setPhase("talking");
    setVstate("connecting");
    setNotice(null);
    let session: {
      mode: string;
      token?: string;
      model?: string;
      config?: Record<string, unknown>;
      reason?: string;
    };
    try {
      const res = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country,
          browserLang: navigator.language || "en",
          easyRead: prefs.easyRead,
        }),
      });
      session = await res.json();
    } catch {
      session = { mode: "guided", reason: "Couldn’t reach the voice service." };
    }
    if (stale()) return;
    if (session.mode !== "live" || !session.token) {
      startGuided();
      return;
    }
    // Loaded only when live voice starts, so the home page stays light
    const { LiveVoice } = await import("@/lib/rt/live-voice");
    if (stale()) return;
    const v = new LiveVoice(session.token, session.model!, session.config!, {
      onState: (s) => {
        setVstate(s);
        if (s === "listening") {
          setAnnounce("Your turn to talk.");
          if (prefsRef.current.replies !== "text") cue();
          navigator.vibrate?.(40);
        }
      },
      onCaption: (role, text, final) => {
        if (role === "assistant") liveSpoke.current = true;
        caption(role, text, final);
      },
      onLevel: setLevel,
      onTool,
      onError: (m) =>
        setNotice(`${m} You can keep going by tapping or typing.`),
      onClose: (reason, code) => {
        // An old session (from before a restart) closing must not touch the current one
        if (live.current !== v || stale()) return;
        live.current = null;
        if (reason === "idle" || reason === "limit" || reason === "hidden") {
          setVstate("idle");
          setNotice(
            reason === "idle"
              ? "Voice paused because it was quiet for 2 minutes. Tap the microphone to carry on, or tap and type."
              : reason === "limit"
                ? "Voice paused after 10 minutes. Tap the microphone to carry on; your report is kept."
                : "Voice paused while you were away. Tap the microphone to carry on.",
          );
          return;
        }
        // Closed before the assistant ever spoke: live voice isn't working on this setup,
        // so carry on straight away in guided mode instead of leaving the person stuck.
        if (!liveSpoke.current) {
          console.warn("[live] closed before first reply", code, reason);
          setMode("guided");
          startGuided(
            `Live voice couldn’t start${reason ? ` (${reason.slice(0, 140)})` : ""}. You can still talk using the microphone button, or tap and type.`,
          );
          return;
        }
        setVstate("idle");
        setNotice(
          "The voice connection ended. Tap the button to reconnect, or carry on by tapping and typing.",
        );
      },
    });
    v.speakAloud = prefs.replies === "voice";
    live.current = v;
    setMode("live");
    try {
      await v.start(true);
      if (stale()) {
        v.close();
        return;
      }
    } catch (e) {
      const denied =
        (e as Error).name === "NotAllowedError" ||
        (e as Error).name === "NotFoundError";
      if (denied) {
        try {
          await v.start(false);
          focusType();
          setNotice(
            "The microphone isn’t available, so you can tap or type your answers. Golden Hour will still reply.",
          );
          return;
        } catch {
          /* fall through */
        }
      }
      v.close();
      live.current = null;
      startGuided(
        "Live voice couldn’t start on this device. You can still talk, tap or type.",
      );
    }
  }

  // ---------- answers ----------

  const answer = useCallback(
    async (text: string, display?: string) => {
      const t = text.trim();
      if (!t) return;
      // The same answer twice in a row within 2 seconds (double tap, Enter plus click,
      // speech result fired twice) is sent once
      const now = Date.now();
      if (lastAnswer.current.text === t && now - lastAnswer.current.at < 2000) return;
      lastAnswer.current = { text: t, at: now };
      // In guided mode, wait for one answer to be understood before taking the next
      if (mode !== "live" && answering.current) return;
      caption("user", display ?? t, true);
      if (mode === "live" && live.current) {
        live.current.sendText(t);
        return;
      }
      if (mode === "live") {
        // Voice has ended: carry on with on-screen questions instead of dropping the answer
        setMode("guided");
        startGuided("Voice has ended, so the questions continue on screen. Tap the microphone to answer by voice.");
        return;
      }
      let s = step;
      if (!s) return;
      // An info step (like "call now") needs no answer: if the person tells us something else,
      // treat it as the answer to the next real question instead of losing it
      if (s.info) {
        if (/call/i.test(t)) markCalled();
        doneRef.current.add(s.id);
        if (s.quick.some((q) => (q.value ?? q.label).toLowerCase() === t.toLowerCase())) {
          advance();
          return;
        }
        const nx = nextStep(draftRef.current, doneRef.current, prefsRef.current.easyRead);
        if (!nx) return;
        s = nx;
        setStep(nx);
      }
      stopSpeaking();
      answering.current = true;
      try {
        if (s.id === "confirm") {
          if (/^yes/i.test(t)) {
            doneRef.current.add("confirm");
            const r = await submit();
            if (r) say(resultSentence(r));
            return;
          }
          say("Tell me what to change, and I’ll fix it.");
          setStep({ id: "story", say: "", quick: [] });
          doneRef.current.delete("confirm");
          return;
        }
        let patch: Partial<ReportDraft> = applyOffline(s.id, t, draftRef.current);
        if (!draftRef.current.txnRef && !patch.txnRef) {
          const ref = parseRef(t);
          if (ref) patch.txnRef = ref;
        }
        if (
          !s.info &&
          t.length > 2 &&
          !/^(skip|i don.?t know|don't know|ok, carry on|i.ve called, carry on|i.ll call after this)$/i.test(t)
        ) {
          try {
            const res = await fetch("/api/interpret", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: t,
                question: s.say,
                country: draftRef.current.country,
              }),
            });
            const data = await res.json();
            if (data.fields && !data.offline) {
              const f = data.fields as Partial<ReportDraft>;
              patch = {
                ...patch,
                ...f,
                receivers: [...(patch.receivers ?? []), ...(f.receivers ?? [])],
                contacts: [...(patch.contacts ?? []), ...(f.contacts ?? [])],
              };
              if (s.id === "story")
                patch.story = [draftRef.current.story, t]
                  .filter(Boolean)
                  .join(" ");
            }
          } catch {
            /* offline parser already ran */
          }
        }
        setD((d) => merge(d, patch));
        await new Promise((r) => setTimeout(r, 0));
        doneRef.current.add(s.id);
        // skip questions the answer already covered
        const d = draftRef.current;
        if (d.minutesAgo !== undefined) doneRef.current.add("when");
        if (d.amount) doneRef.current.add("amount");
        if (d.receivers.length) doneRef.current.add("receiver");
        if (d.txnRef) doneRef.current.add("ref");
        if (d.victimBank) doneRef.current.add("bank");
        if (d.contacts.length) doneRef.current.add("contact");
        if (d.city) doneRef.current.add("city");
        advance();
      } finally {
        answering.current = false;
      }
    },
    [advance, caption, markCalled, mode, say, setD, startGuided, step, submit],
  );

  // ---------- one-click demo: a sample victim reports, then the network shows the match ----------

  const router = useRouter();
  const answerRef = useRef(answer);
  const stepRef = useRef(step);
  const resultRef2 = useRef(result);
  useEffect(() => {
    answerRef.current = answer;
    stepRef.current = step;
    resultRef2.current = result;
  });
  const autoplay = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [goNetwork, setGoNetwork] = useState<number | null>(null);

  const DEMO_SCRIPT: Record<string, string> = {
    story:
      "Someone called on WhatsApp saying he was from the police. He said my account was used for money laundering and I had to move my savings to a safety account for checking.",
    when: "About 10 minutes ago",
    urgent: "I’ve called, carry on",
    amount: "RM 22,000",
    receiver: "Maybank account 5642-1187-0093",
    ref: "Reference number MBB2610167781",
    bank: "CIMB",
    contact: "WhatsApp call from +60 11-2847 3391",
    city: "Melaka",
    confirm: "Yes, send it",
  };

  const playDemo = useCallback(async () => {
    if (autoplay.current) return;
    autoplay.current = true;
    setPlaying(true);
    setCountry("MY");
    await new Promise((r) => setTimeout(r, 150));
    startGuided();
    window.scrollTo({ top: 0 });
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const answered = new Set<string>();
    const until = Date.now() + 120000;
    while (autoplay.current && !resultRef2.current && Date.now() < until) {
      await wait(250);
      const st = stepRef.current;
      if (!st || answered.has(st.id)) continue;
      // let the question be read (or heard) before answering
      await wait(900);
      for (let i = 0; i < 30 && typeof window !== "undefined" && window.speechSynthesis?.speaking; i++) await wait(250);
      if (!autoplay.current) break;
      const text = DEMO_SCRIPT[st.id] ?? st.quick?.[0]?.value ?? st.quick?.[0]?.label ?? "I don’t know";
      // type it into the message bar, like a person would
      for (let i = 1; i <= text.length; i += Math.max(1, Math.round(text.length / 18))) {
        setTyped(text.slice(0, i));
        await wait(28);
      }
      setTyped("");
      answered.add(st.id);
      await answerRef.current(text);
    }
    autoplay.current = false;
    setPlaying(false);
    if (resultRef2.current) setGoNetwork(6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startGuided]);

  // After the demo report is sent, count down and open the scam network focused on it
  useEffect(() => {
    if (goNetwork === null || !result) return;
    if (goNetwork <= 0) {
      router.push(`/network?focus=${encodeURIComponent(result.id)}`);
      return;
    }
    const t = window.setTimeout(() => setGoNetwork((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [goNetwork, result, router]);

  function stopDemo() {
    autoplay.current = false;
    setPlaying(false);
    setGoNetwork(null);
  }

  // Arriving with ?play=1 (from the network page or a shared link) starts the demo
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("play") !== "1") return;
    window.history.replaceState(null, "", window.location.pathname);
    const t = window.setTimeout(() => void playDemo(), 500);
    return () => window.clearTimeout(t);
  }, [playDemo]);

  // ---------- talk button ----------

  async function onTalk() {
    if (vstate === "connecting" || vstate === "thinking") return;
    if (phase === "start") {
      await startLive();
      return;
    }
    if (mode === "live" && live.current) {
      if (vstate === "speaking") live.current.interrupt();
      else await live.current.setMic(vstate !== "listening");
      return;
    }
    if (mode === "live" && !live.current) {
      await startLive();
      return;
    }
    // guided
    if (vstate === "guided-listening" || listeningNow.current) {
      stopRec.current();
      return;
    }
    if (!canRecognise()) {
      setNotice(
        "Voice input isn’t supported in this browser. You can tap an answer or type instead.",
      );
      focusType();
      return;
    }
    stopSpeaking();
    listeningNow.current = true;
    setVstate("guided-listening");
    if (prefs.replies !== "text") cue();
    stopRec.current = listen(
      navigator.language || "en",
      (text, final) => {
        caption("user", text, final);
        if (final) {
          setLines((ls) =>
            ls.filter(
              (l) => !(l.role === "user" && l.text === text && l.final),
            ),
          );
          answer(text);
        }
      },
      (err) => {
        listeningNow.current = false;
        setVstate("guided-idle");
        if (err === "not-allowed" || err === "service-not-allowed") {
          focusType();
          setNotice(
            "The microphone isn’t allowed. You can tap an answer or type instead.",
          );
        }
      },
    );
  }

  // ---------- screenshots and samples ----------

  async function readEvidence(body: Record<string, unknown>) {
    usedScreenshot.current = true;
    setBusy("Reading your screenshot…");
    setNotice(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.country && data.country !== country)
        setCountry(data.country as CountryCode);
      setD((d) =>
        merge(
          { ...d, country: (data.country as CountryCode) ?? d.country },
          data.draft as Partial<ReportDraft>,
        ),
      );
      await new Promise((r) => setTimeout(r, 0));
      const d = draftRef.current;
      if (mode === "live" && live.current) {
        live.current.sendText(`(Screen message: ${data.note})`);
      } else {
        if (d.story || d.summaryEnglish) doneRef.current.add("story");
        (["when", "amount", "receiver", "ref", "bank", "contact"] as StepId[]).forEach(
          (id) => {
            if (id === "ref" && !d.txnRef) return;
            if (id === "when" && d.minutesAgo === undefined) return;
            if (id === "amount" && !d.amount) return;
            if (id === "receiver" && !d.receivers.length) return;
            if (id === "bank" && !d.victimBank) return;
            if (id === "contact" && !d.contacts.length) return;
            doneRef.current.add(id);
          },
        );
        caption(
          "system",
          "Screenshot read. The details found are now in your report.",
          true,
        );
        if (phase === "start") {
          setMode("guided");
          setPhase("talking");
          setVstate("guided-idle");
        }
        advance();
      }
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      const images = await Promise.all(
        [...files]
          .filter((f) => f.type.startsWith("image/"))
          .slice(0, 6)
          .map((f) => compressImage(f)),
      );
      if (!images.length) {
        setNotice(
          "That file isn’t a picture. Choose a screenshot (PNG or JPG).",
        );
        return;
      }
      await readEvidence({ images, country });
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  /** End the live voice session now (the person tapped End voice) */
  function endVoice() {
    liveGen.current++;
    live.current?.close();
    live.current = null;
    stopSpeaking();
    setVstate("idle");
    setNotice("Voice ended. Tap the microphone to start again, or carry on by tapping and typing.");
  }

  function restart() {
    liveGen.current++;
    live.current?.close();
    live.current = null;
    submitted.current = null;
    submitting.current = null;
    listeningNow.current = false;
    stopRec.current();
    stopSpeaking();
    doneRef.current = new Set();
    setCalled(false);
    setLines([]);
    setResult(null);
    setStep(null);
    setMode(null);
    setPhase("start");
    setVstate("idle");
    setNotice(null);
    const d = emptyDraft(country);
    draftRef.current = d;
    setDraft(d);
  }

  // ---------- view ----------

  useEffect(() => {
    const d = sheetRef.current;
    if (!d) return;
    if (sheet && !d.open) d.showModal();
    if (!sheet && d.open) d.close();
  }, [sheet]);

  const quick: Quick[] =
    mode === "live"
      ? [
          { label: "Yes" },
          { label: "No" },
          { label: "I don’t know", value: "I don't know" },
          { label: "Repeat that", value: "Please repeat that." },
          {
            label: "Say it more simply",
            value: "Please say that more simply.",
          },
        ]
      : (step?.quick ?? []);

  const talkState =
    vstate === "guided-listening"
      ? "listening"
      : vstate === "guided-idle"
        ? "idle"
        : vstate;
  const statusText =
    phase === "start" ? t("tapToTalk") : STATUS[vstate];
  const showLog = prefs.captions || prefs.replies !== "voice";
  const fields = [
    { label: "What happened", value: draft.story || draft.summaryEnglish },
    {
      label: "Money sent",
      value: draft.amount
        ? formatMoney(draft.amount, draft.currency ?? region.currency)
        : undefined,
    },
    {
      label: "When",
      value:
        draft.minutesAgo !== undefined
          ? draft.minutesAgo < 90
            ? `About ${Math.max(1, Math.round(draft.minutesAgo))} minutes ago`
            : draft.minutesAgo < 1440
              ? `About ${Math.round(draft.minutesAgo / 60)} hours ago`
              : `About ${Math.round(draft.minutesAgo / 1440)} days ago`
          : undefined,
    },
    {
      label: "Money went to",
      value:
        draft.receivers
          .map((r) => `${r.value}${r.bank ? ` (${r.bank})` : ""}`)
          .join(", ") || undefined,
    },
    { label: "Transaction ref", value: draft.txnRef },
    { label: "Your bank", value: draft.victimBank },
    {
      label: "Scammer contact",
      value:
        draft.contacts
          .map((c) => (c.app ? `${c.app}: ${c.value}` : c.value))
          .join(", ") || undefined,
    },
    { label: "Your city", value: draft.city },
  ];
  const filled = fields.filter((f) => f.value).length;
  const ready = draftReady(draft);
  const plan = result
    ? buildPlan(
        result.country,
        result.victimBank,
        result.contacts.length > 0,
        result.scamType === "remote_access",
      )
    : [];

  function sendTyped() {
    if (!typed.trim()) return;
    answer(typed);
    setTyped("");
    if (typeRef.current) typeRef.current.style.height = "";
  }

  function micIcon(cls: string) {
    return talkState === "speaking" ? (
      <svg
        viewBox="0 0 24 24"
        className={cls}
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="6" y="6" width="12" height="12" rx="2" />
      </svg>
    ) : (
      <svg
        viewBox="0 0 24 24"
        className={cls}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <rect
          x="9"
          y="3"
          width="6"
          height="11"
          rx="3"
          fill={talkState === "listening" ? "currentColor" : "none"}
        />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
      </svg>
    );
  }

  async function sendFromCard(onSent?: () => void) {
    const r = await submit();
    if (r) onSent?.();
  }

  return (
    <div
      className={`mx-auto grid max-w-6xl gap-x-10 gap-y-8 px-4 pt-8 sm:px-6 lg:pt-12 ${phase === "start" && !result ? "" : "lg:grid-cols-[minmax(0,1fr)_23rem]"}`}
    >
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      {/* Conversation */}
      <section aria-labelledby="talk-h" className="min-w-0">
        {phase === "start" ? (
          <>
            <div className="grid items-center gap-x-12 gap-y-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="text-center lg:col-start-1 lg:row-start-1 lg:self-end lg:text-left">
                <p className="rt-pill rt-rise">
                  <span className="relative flex h-2 w-2" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                  </span>
                  {t("heroPill")}
                </p>
                <h1 id="talk-h" className="t-display rt-rise mx-auto mt-4 max-w-[15ch] lg:mx-0" style={{ animationDelay: "70ms" }}>
                  {t("heroA")} <span className="rt-highlight">{t("heroB")}</span>
                </h1>
                <p className="t-lead rt-rise mx-auto mt-4 max-w-xl text-pretty lg:mx-0" style={{ animationDelay: "140ms" }}>
                  {t("heroLead")}
                </p>
                {(() => {
                  const call = firstCall(region);
                  return (
                    <div className="rt-rise mt-6 flex flex-col items-center gap-1.5 lg:items-start" style={{ animationDelay: "180ms" }} data-tour="call-first">
                      {call.href ? (
                        <a href={call.href} className="rt-btn rt-btn-red rt-btn-lg">
                          <PhoneIcon />
                          {call.label} now
                        </a>
                      ) : (
                        <p className="rounded-2xl bg-red-soft px-4 py-3 font-semibold">Call your bank’s fraud line now</p>
                      )}
                      <p className="t-small text-muted">
                        {region.hotline
                          ? `${region.hotline.name}. Call first, then come back here.`
                          : "Use the number on your card or in your banking app, never one from a search result or a message."}
                      </p>
                    </div>
                  );
                })()}
              </div>

              <div className="rt-rise flex flex-col items-center lg:col-start-2 lg:row-span-2 lg:row-start-1" style={{ animationDelay: "120ms" }}>
                <div className="relative flex w-full max-w-sm flex-col items-center rounded-[2rem] border border-line bg-paper/80 px-6 pb-6 pt-6 text-center shadow-[0_30px_60px_-40px_rgb(16_21_28/0.45)] backdrop-blur">
                  <p className="mb-5 t-small font-semibold text-muted">Already called, or on hold? Tell us what happened.</p>
                  <button
                    type="button"
                    onClick={onTalk}
                    data-state={talkState}
                    data-tour="talk"
                    className="rt-talk rt-talk-gold"
                    aria-label={statusText}
                    aria-disabled={vstate === "connecting" || vstate === "thinking"}
                  >
                    <span className="rt-talk-ring" aria-hidden="true" />
                    {micIcon("h-12 w-12")}
                  </button>
                  <p className="t-h3 mt-7" aria-hidden="true">
                    {statusText}
                  </p>
                  <p className="mt-0.5 t-small text-muted">{t("anyLanguage")}</p>
                  <ul className="rt-sys mt-4 flex flex-wrap justify-center gap-1.5" aria-label="Some of the languages you can use">
                    {[
                      ["en", "English"],
                      ["ms", "Melayu"],
                      ["zh", "中文"],
                      ["ta", "தமிழ்"],
                      ["hi", "हिन्दी"],
                      ["th", "ไทย"],
                      ["ja", "日本語"],
                      ["fil", "Filipino"],
                    ].map(([l, n]) => (
                      <li key={l} lang={l} className="rounded-full bg-surface px-2.5 py-0.5 text-[0.8125rem] text-muted">
                        {n}
                      </li>
                    ))}
                    <li className="px-1 py-0.5 text-[0.8125rem] text-muted">+ 90 more</li>
                  </ul>
                </div>
              </div>

              <div className="rt-rise lg:col-start-1 lg:row-start-2 lg:self-start" style={{ animationDelay: "200ms" }}>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start" data-tour="alternatives">
                  <button
                    type="button"
                    className="rt-btn rt-btn-line"
                    onClick={() => {
                      startGuided();
                      focusType();
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="3" y="6" width="18" height="12" rx="2.5" />
                      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" strokeLinecap="round" />
                    </svg>
                    {t("typeInstead")}
                  </button>
                  <button type="button" className="rt-btn rt-btn-line" onClick={() => fileRef.current?.click()}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="3" />
                      <circle cx="9" cy="10" r="1.6" />
                      <path d="M21 15l-5-5-8 9" strokeLinejoin="round" />
                    </svg>
                    {t("screenshotStart")}
                  </button>
                </div>
                <ol className="mt-7 grid gap-3 text-left sm:grid-cols-3" data-tour="how" aria-label="How it works">
                  {HOW.map((h, n) => (
                    <li key={h.title} className="flex gap-3 sm:block">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-ink" aria-hidden="true">
                        {h.icon}
                      </span>
                      <span className="block sm:mt-2">
                        <span className="block font-semibold leading-snug">
                          <span className="sr-only">Step {n + 1}: </span>
                          {t(h.tk)}
                        </span>
                        <span className="block t-small text-muted">{t(h.sk)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <details className="mt-6 rounded-2xl border border-line bg-surface px-5 py-4 text-left">
                  <summary className="cursor-pointer font-semibold">Why not just call my bank?</summary>
                  <div className="mt-2 space-y-2 t-small leading-relaxed">
                    <p>You should, right away. That’s why the call button comes first. Golden Hour is what makes that call work:</p>
                    <ul className="list-disc space-y-1.5 pl-5">
                      <li>
                        <strong>The right number.</strong> In a panic, people lose minutes searching, and scammers plant fake “helpline” numbers in search results. We give the official one.
                      </li>
                      <li>
                        <strong>The answers they’ll ask for.</strong> The amount, the time, the account the money went to, and the transaction reference. We pick them out of your words or a screenshot of your bank SMS, and show them ready to read out.
                      </li>
                      <li>
                        <strong>More than one call.</strong> One victim’s call rarely freezes a scammer’s account. Golden Hour links your report to other victims who paid the same account and flags it for freezing when three or more match, then prepares the official report and reminds you to follow up.
                      </li>
                    </ul>
                  </div>
                </details>
              </div>
            </div>

            <HomeCards country={country} onSample={(id, c) => readEvidence({ sampleId: id, country: c })} onPlay={() => void playDemo()} />
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 id="talk-h" className="t-h3">
              Report a scam
            </h1>
            {draft.minutesAgo !== undefined && !result && (
              <div className="order-last w-full lg:hidden">
                <GoldenTimer key={draft.minutesAgo} minutesAgo={draft.minutesAgo} compact />
              </div>
            )}
            {!result && (
              <button
                type="button"
                className="rt-btn rt-btn-ghost !min-h-10 underline underline-offset-4"
                onClick={restart}
              >
                Start again
              </button>
            )}
          </div>
        )}

        {(playing || goNetwork !== null) && (
          <div role="status" className="rt-pop mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-paper">
            <p className="flex items-center gap-2 font-semibold">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-gold" aria-hidden="true" />
              {goNetwork !== null
                ? `Report sent. Opening the scam network in ${goNetwork}…`
                : "Demo playing: a sample victim in Malaysia is reporting a fake police scam."}
            </p>
            <div className="flex gap-2">
              {goNetwork !== null && result && (
                <Link href={`/network?focus=${encodeURIComponent(result.id)}`} className="rt-btn !min-h-10 !border-gold !bg-gold !text-[#10151c]">
                  Open now
                </Link>
              )}
              <button type="button" onClick={stopDemo} className="rt-btn !min-h-10 !border-white/30 !bg-transparent !text-paper">
                Stop demo
              </button>
            </div>
          </div>
        )}

        {notice && (
          <p
            role="status"
            className="mt-5 rounded-2xl border border-line-strong bg-surface px-5 py-4"
          >
            {notice}
          </p>
        )}

        {phase === "talking" && !called && !result && <CallFirstBar draft={draft} onCalled={markCalled} />}

        {phase === "talking" && showLog && (
          <div
            role="log"
            aria-live={prefs.replies === "voice" ? "off" : "polite"}
            aria-label="Conversation"
            className="mt-4 min-h-[30svh] space-y-3"
          >
            {lines.map((l) => (
              <div
                key={l.id}
                className={l.role === "user" ? "flex justify-end" : ""}
              >
                <div
                  className={`max-w-[min(40rem,88%)] rounded-3xl px-4 py-3 sm:px-5 ${
                    l.role === "assistant"
                      ? "rounded-tl-md bg-surface text-[1.125rem] leading-relaxed"
                      : l.role === "user"
                        ? "rounded-tr-md bg-ink text-[1.0625rem] text-paper"
                        : "border border-dashed border-line-strong t-small text-muted"
                  } ${l.final ? "" : "opacity-75"}`}
                >
                  <span className="mb-0.5 block t-small font-semibold opacity-80">
                    {l.role === "assistant"
                      ? "Golden Hour"
                      : l.role === "user"
                        ? "You"
                        : "Note"}
                  </span>
                  <span lang={guessLang(l.text) ?? (mode === "guided" ? "en" : undefined)}>{l.text}</span>
                </div>
              </div>
            ))}
            <div ref={logEnd} />
          </div>
        )}
        {phase === "talking" && !showLog && (
          <div ref={logEnd} className="min-h-[20svh]" />
        )}

        {busy && (
          <p role="status" className="mt-5 flex items-center gap-3 t-h3">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent"
              aria-hidden="true"
            />
            {busy}
          </p>
        )}

        {/* Message bar: always reachable above the tab bar */}
        {phase === "talking" && !result && (draft.amount || draft.receivers.length > 0) && (
          <div className="mt-4 lg:hidden">
            <CallReady draft={draft} />
          </div>
        )}

        {phase === "talking" && !result && (
          <div
            ref={composerRef}
            className="rt-composer -mx-4 mt-5 border-t border-line bg-paper px-4 pb-3 pt-2.5 sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-6 lg:rounded-3xl lg:border lg:px-4 lg:shadow-[0_10px_30px_-18px_rgb(0_0_0/0.35)]"
          >
            <div className="flex min-h-9 items-center justify-between gap-3">
              <p
                className="flex min-w-0 items-center gap-2 t-small font-semibold"
                aria-hidden="true"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${talkState === "listening" ? "animate-pulse bg-red" : talkState === "speaking" ? "bg-ink" : "bg-line-strong"}`}
                />
                <span className="truncate">{statusText}</span>
              </p>
              {mode === "live" && vstate !== "idle" && (
                <button
                  type="button"
                  onClick={endVoice}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-red px-3 t-small font-semibold text-red"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 rotate-[135deg]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                  </svg>
                  End voice
                </button>
              )}
              <button
                type="button"
                onClick={() => setSheet(true)}
                aria-haspopup="dialog"
                className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-line-strong px-3 t-small font-semibold lg:hidden"
              >
                Your report
                <span
                  className="h-1.5 w-10 overflow-hidden rounded-full bg-line"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-ok"
                    style={{ width: `${(filled / fields.length) * 100}%` }}
                  />
                </span>
                <span className="tabular">
                  {filled}/{fields.length}
                </span>
              </button>
            </div>

            {quick.length > 0 && (
              <ul
                aria-label="Quick answers"
                className="rt-scroll-x -mx-4 mt-1.5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
              >
                {quick.map((q) => (
                  <li key={q.label} className="shrink-0">
                    <button
                      type="button"
                      className="rt-btn rt-btn-line !min-h-10 whitespace-nowrap !px-4"
                      onClick={() => answer(q.value ?? q.label, q.label)}
                    >
                      {q.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="mt-2 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendTyped();
              }}
            >
              <button
                type="button"
                className="rt-btn rt-btn-line rt-btn-icon shrink-0"
                onClick={() => fileRef.current?.click()}
                aria-label="Add a screenshot"
                title="Add a screenshot"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <circle cx="9" cy="10" r="1.6" />
                  <path d="M21 15l-5-5-8 9" strokeLinejoin="round" />
                </svg>
              </button>
              <textarea
                id="typed"
                ref={typeRef}
                rows={1}
                value={typed}
                aria-label="Type your answer, in any language"
                aria-describedby="typed-hint"
                placeholder="Type here if you prefer"
                onChange={(e) => {
                  setTyped(e.target.value);
                  e.target.style.height = "";
                  e.target.style.height = `${Math.min(e.target.scrollHeight + 3, 160)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendTyped();
                  }
                }}
                className="rt-input min-w-0 flex-1 resize-none !rounded-[1.4rem] !py-2.5"
              />
              {typed.trim() && (
                <button
                  type="submit"
                  className="rt-btn rt-btn-ink rt-btn-icon shrink-0"
                  aria-label="Send"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12h13M13 6l6 6-6 6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={onTalk}
                data-state={talkState}
                className="rt-talk rt-talk-sm"
                aria-label={statusText}
                aria-disabled={vstate === "connecting" || vstate === "thinking"}
              >
                <span
                  className="rt-talk-ring"
                  style={{
                    transform:
                      talkState === "listening"
                        ? `scale(${1 + Math.min(0.25, level * 4)})`
                        : undefined,
                  }}
                  aria-hidden="true"
                />
                {micIcon("")}
              </button>
            </form>
            <p
              id="typed-hint"
              className={`mt-1.5 t-small text-muted ${typed ? "" : "sr-only"}`}
            >
              Never type a PIN, password or one-time code.
            </p>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />

      </section>

      {/* Report so far (desktop) / result (all sizes) */}
      <aside
        aria-labelledby={result ? "report-h" : "side-report-h"}
        className={`h-fit lg:sticky lg:top-24 ${result ? "" : phase === "start" ? "hidden" : "hidden lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:rounded-3xl"}`}
        data-tour="report"
      >
        {!result ? (
          <ReportCard
            draft={draft}
            prefix="side"
            fields={fields}
            ready={ready}
            busy={!!busy}
            onSend={() => sendFromCard()}
            minutesAgo={draft.minutesAgo}
          />
        ) : (
          <div className="rounded-3xl border-2 border-ink bg-paper p-5 sm:p-6">
            <h2 id="report-h" ref={resultRef} tabIndex={-1} className="t-h2">
              Report sent
            </h2>
            {result.minutesAgo !== undefined && (
              <div className="mt-3">
                <GoldenTimer minutesAgo={result.minutesAgo} since={result.createdAt} />
              </div>
            )}
            <p className="mt-3 leading-relaxed">
              {resultSentence(result).replace(/ Now:.*$/, "")}
            </p>
            {result.freezeNow.length > 0 && (
              <p className="mt-3 rounded-xl bg-red-soft px-4 py-3 font-semibold">
                {result.freezeNow.join(" and ")} has been paid by 3 or more
                victims in the last 3 hours. It’s flagged for banks to freeze.
              </p>
            )}
            <h3 className="t-h3 mt-6">Do this now</h3>
            <ol className="mt-2 space-y-4">
              {plan.slice(0, prefs.easyRead ? 1 : 3).map((p, i) => (
                <li key={p.id} className="flex gap-3">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-bold text-paper tabular"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{p.title}</p>
                    <p className="text-muted">{p.why}</p>
                    {p.action && (
                      <a
                        href={p.action.href}
                        target={p.action.external ? "_blank" : undefined}
                        rel={
                          p.action.external ? "noopener noreferrer" : undefined
                        }
                        className={`rt-btn mt-2 ${i === 0 ? "rt-btn-red" : "rt-btn-line"}`}
                      >
                        {p.action.href.startsWith("tel:") && <PhoneIcon />}
                        {p.action.label}
                        {p.action.external && (
                          <span className="sr-only"> (opens in a new tab)</span>
                        )}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 grid gap-2">
              <Link
                href={`/r/${result.id}`}
                className="rt-btn rt-btn-ink w-full"
              >
                See all steps and letters
              </Link>
              <Link href="/network" className="rt-btn rt-btn-line w-full">
                See it on the scam network
              </Link>
              <button
                type="button"
                onClick={restart}
                className="rt-btn rt-btn-ghost w-full underline underline-offset-4"
              >
                Report another scam
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Phones and tablets: the report opens as a sheet from the message bar */}
      <dialog
        ref={sheetRef}
        onClose={() => setSheet(false)}
        aria-labelledby="sheet-report-h"
        className="rt-sheet bg-paper p-0 text-ink backdrop:bg-black/50 lg:hidden"
      >
        <div className="sticky top-0 z-10 flex justify-between bg-paper px-4 pb-1 pt-3">
          <span
            className="mx-auto mt-0.5 h-1.5 w-10 rounded-full bg-line"
            aria-hidden="true"
          />
        </div>
        <div className="px-3 pb-4">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setSheet(false)}
              className="rt-btn rt-btn-line"
            >
              Close
            </button>
          </div>
          {sheet && (
            <ReportCard
              draft={draft}
              prefix="sheet"
              fields={fields}
              ready={ready}
              busy={!!busy}
              onSend={() => sendFromCard(() => setSheet(false))}
              minutesAgo={draft.minutesAgo}
            />
          )}
        </div>
      </dialog>
    </div>
  );
}
