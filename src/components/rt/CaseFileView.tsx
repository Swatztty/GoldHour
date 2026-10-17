"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { CaseFile } from "@/app/api/casefile/route";
import { formatMoney } from "@/lib/investigate";
import { regionOf } from "@/lib/regions";
import type { Report } from "@/lib/rt/types";
import type { Victim } from "@/lib/types";
import { loadRefs, REF_FIELDS } from "./RecoveryTracker";

function loadLocal<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const fmt = (iso: string, tz: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(d);
};

export function CaseFileView() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [cf, setCf] = useState<CaseFile | null>(null);
  const [error, setError] = useState("");
  const [victim, setVictim] = useState<Victim | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});

  useEffect(() => {
    let off = false;
    (async () => {
      const local = loadLocal<Report>(`rt.report.${id}`);
      let r: Report | null = null;
      try {
        const res = await fetch(`/api/reports/${id}`, { cache: "no-store" });
        r = res.ok ? ((await res.json()) as Report) : local;
      } catch {
        r = local;
      }
      if (off) return;
      if (!r) return setError("This report isn’t available on this device.");
      setReport(r);
      setVictim(loadLocal<Victim>("rt.victim"));
      setRefs(loadRefs(id));
      try {
        const res = await fetch("/api/casefile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, report: r }) });
        const j = await res.json();
        if (!off && res.ok) setCf(j as CaseFile);
      } catch {
        /* the facts table still prints */
      }
    })();
    return () => {
      off = true;
    };
  }, [id]);

  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="t-h1">Case file not available</h1>
        <p className="mt-3">{error}</p>
      </div>
    );
  if (!report)
    return (
      <p className="mx-auto max-w-3xl px-4 py-12 text-lg" aria-busy="true">
        Preparing your case file…
      </p>
    );

  const r = report;
  const region = regionOf(r.country);
  const tz = region.timeZone;
  const facts: [string, string][] = [
    ["Report ID", r.id],
    ["Reported", fmt(r.createdAt, tz)],
    ["Country / city", `${region.name}${r.city ? `, ${r.city}` : ""}`],
    ["Amount lost", r.amount ? formatMoney(r.amount, r.currency ?? region.currency) : "Not confirmed"],
    ["First payment", r.minutesAgo !== undefined ? `About ${Math.round(r.minutesAgo)} minutes before the report` : "Not confirmed"],
    ["Payment method", r.method ?? "Not stated"],
    ["Money sent to", r.receivers.map((x) => `${x.value}${x.bank ? ` (${x.bank})` : ""}${x.name ? `, name shown: ${x.name}` : ""}`).join("; ") || "Not known"],
    ["Transaction reference", r.txnRef ?? "Not given"],
    ["Scammer contact", r.contacts.map((c) => `${c.value}${c.app ? ` via ${c.app}` : ""}`).join("; ") || "Not known"],
    ["Victim’s bank", r.victimBank ?? "Not stated"],
    ["Scam pattern", r.ringName || "Not matched"],
    ["Language used", r.language ?? "Not recorded"],
  ];

  return (
    <article className="rt-casefile mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
      <div className="no-print mb-6 flex flex-wrap gap-2">
        <button type="button" className="rt-btn rt-btn-ink" onClick={() => window.print()}>
          Print or save as PDF
        </button>
        <Link href={`/r/${r.id}`} className="rt-btn rt-btn-line">
          Back to your plan
        </Link>
      </div>

      <header className="border-b-2 border-ink pb-4">
        <p className="t-small font-semibold uppercase tracking-[0.12em] text-muted">Golden Hour · scam case file</p>
        <h1 className="t-h1 mt-1">Report {r.id}</h1>
        <p className="mt-1 text-muted">Prepared {fmt(new Date().toISOString(), tz)} for the police and the bank’s fraud team.</p>
      </header>

      {victim && (victim.name || victim.phone) && (
        <section className="mt-6" aria-labelledby="cf-victim">
          <h2 id="cf-victim" className="t-h3 !font-bold">
            Reported by
          </h2>
          <p>
            {victim.name}
            {victim.phone ? ` · ${victim.phone}` : ""}
            {victim.email ? ` · ${victim.email}` : ""}
          </p>
        </section>
      )}

      <section className="mt-6" aria-labelledby="cf-sum">
        <h2 id="cf-sum" className="t-h3 !font-bold">
          Summary
        </h2>
        <p className="mt-1 leading-relaxed">{cf?.summary ?? "Writing the summary…"}</p>
        {cf && <p className="no-print mt-1 t-small text-muted">{cf.source === "gemini" ? "Summary written by Gemini from the report, in English." : "Summary generated from the report fields."}</p>}
      </section>

      <section className="mt-6" aria-labelledby="cf-facts">
        <h2 id="cf-facts" className="t-h3 !font-bold">
          Key facts
        </h2>
        <table className="mt-2 w-full border-collapse text-left">
          <tbody>
            {facts.map(([k, v]) => (
              <tr key={k} className="border-b border-line align-top">
                <th scope="row" className="w-44 py-2 pr-4 font-semibold">
                  {k}
                </th>
                <td className="py-2 tabular">{v}</td>
              </tr>
            ))}
            {REF_FIELDS(region).map(
              (f) =>
                refs[f.id] && (
                  <tr key={f.id} className="border-b border-line align-top">
                    <th scope="row" className="w-44 py-2 pr-4 font-semibold">
                      {f.label}
                    </th>
                    <td className="py-2 tabular">{refs[f.id]}</td>
                  </tr>
                ),
            )}
          </tbody>
        </table>
      </section>

      {r.scriptQuote && (
        <section className="mt-6" aria-labelledby="cf-quote">
          <h2 id="cf-quote" className="t-h3 !font-bold">
            What the scammer said
          </h2>
          <blockquote className="mt-1 border-l-4 border-gold pl-4 italic">“{r.scriptQuote}”</blockquote>
          {cf?.scriptEnglish && cf.scriptEnglish !== r.scriptQuote && <p className="mt-1 text-muted">English: “{cf.scriptEnglish}”</p>}
        </section>
      )}

      {r.matches.length > 0 && (
        <section className="mt-6" aria-labelledby="cf-links">
          <h2 id="cf-links" className="t-h3 !font-bold">
            Links to other reports
          </h2>
          <ul className="mt-1 list-disc pl-5">
            {r.matches.map((m) => (
              <li key={m.kind + m.value}>
                {m.kind === "script" ? "Same scam script" : m.value}: {m.otherReports} other report{m.otherReports === 1 ? "" : "s"}
                {m.countries.length ? ` (${m.countries.join(", ")})` : ""}
              </li>
            ))}
          </ul>
          {r.freezeNow.length > 0 && <p className="mt-2 font-semibold">Flagged for freezing: {r.freezeNow.join(", ")} (3 or more victims within 3 hours).</p>}
        </section>
      )}

      {cf && (
        <>
          <section className="mt-6" aria-labelledby="cf-time">
            <h2 id="cf-time" className="t-h3 !font-bold">
              Timeline
            </h2>
            <ol className="mt-1 space-y-1">
              {cf.timeline.map((x, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-40 shrink-0 tabular text-muted">{fmt(x.when, tz)}</span>
                  <span>{x.what}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="mt-6" aria-labelledby="cf-req">
            <h2 id="cf-req" className="t-h3 !font-bold">
              Requested actions
            </h2>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              {cf.requests.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
          </section>
        </>
      )}

      <footer className="mt-10 border-t border-line pt-4 t-small text-muted">
        Prepared with Golden Hour from the victim’s own report. Facts are as reported and have not been verified by Golden Hour. Reference: {r.id}.
      </footer>
    </article>
  );
}
