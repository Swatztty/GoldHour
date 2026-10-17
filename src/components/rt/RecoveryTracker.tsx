"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Region } from "@/lib/regions";
import { regionOf } from "@/lib/regions";
import type { Report } from "@/lib/rt/types";

export const REF_FIELDS = (r: Region) => [
  { id: "hotline", label: r.hotline ? `${r.hotline.name} reference` : "Hotline reference" },
  { id: "bank", label: "Bank case number" },
  { id: "police", label: r.refName ? r.refName.replace(/^./, (c) => c.toUpperCase()) : "Police report number" },
];

export function loadRefs(id: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(`gh.refs.${id}`) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

interface FollowUp {
  id: string;
  day: number;
  title: string;
  detail: string;
}

function followUps(r: Report): FollowUp[] {
  const reg = regionOf(r.country);
  const bank = r.victimBank || "your bank";
  return [
    { id: "f-bank-ref", day: 0, title: `Get a case number from ${bank}`, detail: "Write it below. Every later call goes faster with it." },
    { id: "f-official", day: 1, title: reg.portal ? `File the official report (${reg.portal.name})` : "File a police report", detail: "Police reports let banks act on the receiving account. Attach this case file." },
    { id: "f-bank-follow", day: 3, title: `Follow up with ${bank}`, detail: "Ask whether a recall was attempted and whether any money was held." },
    { id: "f-police-follow", day: 7, title: "Check your police report status", detail: "Ask for the investigating officer’s name and contact." },
    { id: "f-outcome", day: 30, title: `Ask ${bank} for the outcome in writing`, detail: "You may need it for disputes, insurance or a complaint to the regulator." },
  ];
}

function ics(r: Report, items: FollowUp[]): string {
  const start = new Date(r.createdAt);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ev = items.map((f) => {
    const d = new Date(start.getTime() + f.day * 86400000);
    d.setHours(10, 0, 0, 0);
    const end = new Date(d.getTime() + 30 * 60000);
    return [
      "BEGIN:VEVENT",
      `UID:${r.id}-${f.id}@golden-hour`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(d)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:Scam follow-up: ${f.title}`,
      `DESCRIPTION:${f.detail} Golden Hour report ${r.id}.`,
      "BEGIN:VALARM",
      "TRIGGER:-PT0M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${f.title}`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Golden Hour//Follow-ups//EN", ...ev, "END:VCALENDAR"].join("\r\n");
}

export function RecoveryTracker({ report }: { report: Report }) {
  const region = regionOf(report.country);
  const items = followUps(report);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string[]>([]);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setRefs(loadRefs(report.id));
      try {
        setDone(JSON.parse(localStorage.getItem(`gh.follow.${report.id}`) || "[]") as string[]);
      } catch {
        /* none */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [report.id]);

  function setRef(k: string, v: string) {
    const next = { ...refs, [k]: v };
    setRefs(next);
    try {
      localStorage.setItem(`gh.refs.${report.id}`, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }
  function toggle(id: string) {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    try {
      localStorage.setItem(`gh.follow.${report.id}`, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }
  function download() {
    const blob = new Blob([ics(report, items.filter((f) => !done.includes(f.id)))], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `golden-hour-follow-ups-${report.id}.ics`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const created = new Date(report.createdAt).getTime();
  const daysSince = Math.floor((now - created) / 86400000);

  return (
    <section aria-labelledby="track-h" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="track-h" className="t-h2">
            Recovery tracker
          </h2>
          <p className="mt-1 max-w-2xl text-muted">Most people give up after the first day. Keep your reference numbers here and follow up on time. Saved only on this device.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rt-btn rt-btn-line" onClick={download}>
            Add reminders to my calendar
          </button>
          <Link href={`/r/${report.id}/case`} className="rt-btn rt-btn-ink">
            Case file (PDF)
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {REF_FIELDS(region).map((f) => (
          <div key={f.id}>
            <label htmlFor={`ref-${f.id}`} className="rt-label">
              {f.label}
            </label>
            <input id={`ref-${f.id}`} className="rt-input mt-1.5 w-full tabular" value={refs[f.id] ?? ""} onChange={(e) => setRef(f.id, e.target.value)} placeholder="Add when you get it" autoComplete="off" />
          </div>
        ))}
      </div>

      <ol className="relative mt-6 space-y-3 border-l-2 border-line pl-6">
        {items.map((f) => {
          const isDone = done.includes(f.id);
          const status = isDone ? "Done" : f.day < daysSince ? "Overdue" : f.day === daysSince ? "Due today" : `In ${f.day - daysSince} day${f.day - daysSince === 1 ? "" : "s"}`;
          const chip = isDone ? "bg-ok-soft text-ok" : status === "Overdue" ? "bg-red-soft text-red" : status === "Due today" ? "bg-gold-soft text-gold-ink" : "bg-surface text-muted";
          return (
            <li key={f.id} className="relative">
              <span className={`absolute -left-[1.95rem] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-paper ${isDone ? "bg-ok" : "bg-line-strong"}`} aria-hidden="true" />
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line p-4">
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${isDone ? "text-muted line-through" : ""}`}>{f.title}</p>
                  <p className="t-small text-muted">{f.detail}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 t-small font-semibold ${chip}`}>{status}</span>
                <button type="button" className="rt-btn rt-btn-line !min-h-10" aria-pressed={isDone} onClick={() => toggle(f.id)}>
                  {isDone ? "Undo" : "Mark done"}
                  <span className="sr-only">: {f.title}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
