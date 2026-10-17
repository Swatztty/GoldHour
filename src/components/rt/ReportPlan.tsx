"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildDocuments, docAsText } from "@/lib/documents";
import { formatMoney } from "@/lib/investigate";
import { regionOf } from "@/lib/regions";
import { buildPlan } from "@/lib/rt/plan";
import { usePrefs } from "@/lib/rt/prefs";
import { speak, stopSpeaking } from "@/lib/rt/speech";
import { reportToCase } from "@/lib/rt/to-case";
import type { Report } from "@/lib/rt/types";
import type { Victim } from "@/lib/types";
import { PhoneIcon } from "./RtHeader";
import { RecoveryTracker } from "./RecoveryTracker";
import { GoldenTimer } from "./GoldenTimer";

const EMPTY: Victim = { name: "", phone: "", email: "", address: "", city: "", ackNumber: "" };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rt-btn rt-btn-line"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* clipboard blocked */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}

export function ReportPlan() {
  const { id } = useParams<{ id: string }>();
  const prefs = usePrefs();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [victim, setVictim] = useState<Victim>(EMPTY);
  const [done, setDone] = useState<string[]>([]);
  const [doc, setDoc] = useState(0);
  const [reading, setReading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = load<Report | null>(`rt.report.${id}`, null);
      try {
        const res = await fetch(`/api/reports/${id}`, { cache: "no-store" });
        if (res.ok) {
          const r = (await res.json()) as Report;
          if (!cancelled) setReport(r);
        } else if (local) {
          if (!cancelled) setReport(local);
        } else if (!cancelled) setError("This report link isn’t valid, or the report was made on another device.");
      } catch {
        if (!cancelled) {
          if (local) setReport(local);
          else setError("You’re offline and this report isn’t saved on this device.");
        }
      }
      if (!cancelled) {
        setVictim(load<Victim>("rt.victim", EMPTY));
        setDone(load<string[]>(`rt.done.${id}`, []));
      }
    })();
    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, [id]);

  const plan = useMemo(() => (report ? buildPlan(report.country, report.victimBank, report.contacts.length > 0, report.scamType === "remote_access") : []), [report]);
  const docs = useMemo(() => (report ? buildDocuments(reportToCase(report, victim), victim) : []), [report, victim]);

  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="t-h1">Report not found</h1>
        <p className="mt-3 text-lg">{error}</p>
        <Link href="/" className="rt-btn rt-btn-ink mt-6">
          Report a scam
        </Link>
      </div>
    );
  if (!report)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" aria-busy="true">
        <p className="text-lg">Opening your report…</p>
      </div>
    );

  const r = report;
  const region = regionOf(r.country);
  const others = Math.max(0, ...r.matches.map((m) => m.otherReports));
  const countries = [...new Set(r.matches.flatMap((m) => m.countries))];

  function toggle(stepId: string) {
    const next = done.includes(stepId) ? done.filter((d) => d !== stepId) : [...done, stepId];
    setDone(next);
    save(`rt.done.${id}`, next);
  }
  function setV(k: keyof Victim, v: string) {
    const next = { ...victim, [k]: v };
    setVictim(next);
    save("rt.victim", next);
  }
  function readAloud(key: string, text: string) {
    if (reading === key) {
      stopSpeaking();
      setReading(null);
      return;
    }
    setReading(key);
    speak(text, "en", () => setReading(null));
  }

  const d = docs[Math.min(doc, docs.length - 1)];
  const docText = d ? docAsText(d) : "";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 lg:pt-12">
      <p className="rt-eyebrow">
        {region.name}, report {r.id}
      </p>
      <h1 className="t-h1 mt-1">Your action plan</h1>
      <p className="t-lead mt-4 max-w-2xl !text-ink">
        {r.amount ? `${formatMoney(r.amount, r.currency ?? region.currency)} reported. ` : ""}
        {others ? `Linked to ${others} other report${others === 1 ? "" : "s"}${countries.length ? ` in ${countries.join(", ")}` : ""}.` : "Your report starts a new pattern that will help protect others."}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {r.minutesAgo !== undefined && (
          <div className="min-w-0 flex-1">
            <GoldenTimer minutesAgo={r.minutesAgo} since={r.createdAt} compact />
          </div>
        )}
        <Link href={`/r/${r.id}/case`} className="rt-btn rt-btn-line">
          Case file for police and bank
        </Link>
      </div>
      {r.freezeNow.length > 0 && (
        <p className="mt-5 rounded-2xl bg-red-soft px-5 py-4 font-semibold">
          {r.freezeNow.join(" and ")} is flagged for banks to freeze: it received money from 3 or more victims in the last 3 hours.
        </p>
      )}

      <section aria-labelledby="steps-h" className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="steps-h" className="t-h2">
            Do these in order
          </h2>
          <p className="tabular t-small font-semibold text-muted">
            {done.filter((x) => plan.some((p) => p.id === x)).length} of {plan.length} done
          </p>
        </div>
        <ol className="mt-4 space-y-4">
          {(prefs.easyRead ? plan.filter((p) => !done.includes(p.id)).slice(0, 1) : plan).map((p) => {
            const n = plan.indexOf(p) + 1;
            const isDone = done.includes(p.id);
            return (
              <li key={p.id} className={`rounded-3xl border p-5 sm:p-6 ${isDone ? "border-line bg-surface" : "border-line-strong"}`}>
                <div className="flex items-start gap-4">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold tabular ${isDone ? "bg-ok text-paper" : "bg-ink text-paper"}`} aria-hidden="true">
                    {isDone ? "✓" : n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className={`t-h3 pt-1.5 ${isDone ? "text-muted line-through decoration-1" : ""}`}>
                      <span className="sr-only">Step {n}: </span>
                      {p.title}
                      {isDone && <span className="sr-only"> (done)</span>}
                    </h3>
                    <p className="mt-1 text-muted">{p.why}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {p.action && (
                        <a href={p.action.href} target={p.action.external ? "_blank" : undefined} rel={p.action.external ? "noopener noreferrer" : undefined} className={`rt-btn ${n === 1 && !isDone ? "rt-btn-red" : "rt-btn-ink"}`}>
                          {p.action.href.startsWith("tel:") && <PhoneIcon />}
                          {p.action.label}
                          {p.action.external && <span className="sr-only"> (opens in a new tab)</span>}
                        </a>
                      )}
                      <button type="button" className="rt-btn rt-btn-line" aria-pressed={reading === p.id} onClick={() => readAloud(p.id, `${p.title}. ${p.why}`)}>
                        {reading === p.id ? "Stop reading" : "Read aloud"}
                      </button>
                      <button type="button" className="rt-btn rt-btn-line" aria-pressed={isDone} onClick={() => toggle(p.id)}>
                        {isDone ? "Mark as not done" : "Mark as done"}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {prefs.easyRead && plan.some((p) => !done.includes(p.id)) && <p className="mt-3 text-muted">Easy read is on, so you see one step at a time.</p>}
      </section>

      <RecoveryTracker report={r} />

      <section aria-labelledby="details-h" className="mt-14">
        <h2 id="details-h" className="t-h2">
          Letters, ready to send
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Add your details once and every letter fills in. Your details stay on this device and are never sent to Golden Hour.
        </p>
        <div className="mt-5 grid gap-4 rounded-3xl bg-surface p-5 sm:grid-cols-2 sm:p-6">
          {(
            [
              ["name", "Full name", "name"],
              ["phone", "Mobile number", "tel"],
              ["address", "Address", "street-address"],
              ["city", "City", "address-level2"],
              ["email", "Email (optional)", "email"],
              ["ackNumber", region.refName, "off"],
            ] as [keyof Victim, string, string][]
          ).map(([k, label, ac]) => (
            <label key={k} className="block">
              <span className="rt-label">{label}</span>
              <input value={victim[k]} autoComplete={ac} onChange={(e) => setV(k, e.target.value)} className="rt-input" />
            </label>
          ))}
        </div>

        {d && (
          <div className="mt-6">
            <div role="tablist" aria-label="Letters" className="flex flex-wrap gap-2">
              {docs.map((x, i) => (
                <button key={x.id} role="tab" id={`tab-${x.id}`} aria-selected={i === doc} aria-controls="letter" onClick={() => setDoc(i)} className={`rt-btn ${i === doc ? "rt-btn-ink" : "rt-btn-line"}`}>
                  {x.title}
                </button>
              ))}
            </div>
            <div id="letter" role="tabpanel" aria-labelledby={`tab-${d.id}`} className="mt-4 rounded-3xl border border-line p-5 sm:p-7">
              <p className="t-small text-muted">To: {d.to}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Copy text={docText} label={d.fields ? "Copy all fields" : "Copy letter"} />
                {d.channel === "email" && (
                  <a className="rt-btn rt-btn-line" href={`mailto:?subject=${encodeURIComponent(d.subject ?? d.title)}&body=${encodeURIComponent(d.body)}`}>
                    Open in email app
                  </a>
                )}
                <button type="button" className="rt-btn rt-btn-line" aria-pressed={reading === d.id} onClick={() => readAloud(d.id, docText)}>
                  {reading === d.id ? "Stop reading" : "Read aloud"}
                </button>
                <button type="button" className="rt-btn rt-btn-line" onClick={() => window.print()}>
                  Print
                </button>
              </div>
              {d.fields ? (
                <dl className="mt-5 space-y-4">
                  {d.fields.map((f) => (
                    <div key={f.label}>
                      <dt className="flex min-h-11 items-center justify-between gap-3 font-semibold">
                        {f.label}
                        <Copy text={f.value} />
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-surface px-4 py-3">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="mt-5 whitespace-pre-wrap break-words rounded-xl bg-surface px-4 py-4 leading-relaxed">
                  {d.subject && <p className="mb-3 font-semibold">Subject: {d.subject}</p>}
                  {d.body}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="no-print mt-12 flex flex-wrap gap-3">
        <Copy text={typeof window !== "undefined" ? window.location.href : ""} label="Copy link to share with family" />
        <Link href="/" className="rt-btn rt-btn-line">
          Report another scam
        </Link>
      </div>

      <div className="print-only">
        {docs.map((x) => (
          <div key={x.id} className="print-page">
            <h2>{x.title}</h2>
            <p>To: {x.to}</p>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{docAsText(x)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
