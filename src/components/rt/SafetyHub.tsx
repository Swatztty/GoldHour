"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/investigate";
import { regionOf, type CountryCode } from "@/lib/regions";
import { useGuardian } from "@/lib/rt/guardian";
import { useT, type Key } from "@/lib/rt/i18n";
import { listMyReports, type MyReport } from "@/lib/rt/myreports";

const TOOLS: { href: string; title: Key; body: Key; tone: string; icon: string }[] = [
  { href: "/practice", title: "practiceTitle", body: "practiceBody", tone: "bg-gold-soft text-gold-ink", icon: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" },
  { href: "/shield", title: "shieldTitle", body: "shieldBody", tone: "bg-ok-soft text-ok", icon: "M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3ZM12 8v4m0 3.5v.01" },
  { href: "/family", title: "familyTitle", body: "familyBody", tone: "bg-red-soft text-red", icon: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.5 8c.7-3.2 2.9-5 5.5-5s4.8 1.8 5.5 5M17 7.5c1.3 0 2.5 1 2.5 2.4 0 2-2.5 3.6-2.5 3.6s-2.5-1.6-2.5-3.6c0-1.4 1.2-2.4 2.5-2.4Z" },
];

export function SafetyHub() {
  const t = useT();
  const guardian = useGuardian();
  const [mine, setMine] = useState<MyReport[]>([]);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMine(listMyReports()));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:pt-12">
      <h1 className="t-h1 rt-rise max-w-3xl">{t("safetyH1")}</h1>
      <p className="t-lead rt-rise mt-3 max-w-2xl" style={{ animationDelay: "60ms" }}>
        {t("safetyLead")}
      </p>
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {TOOLS.map((x, i) => (
          <li key={x.href} className="rt-rise" style={{ animationDelay: `${120 + i * 60}ms` }}>
            <Link href={x.href} className="rt-card rt-card-hover flex h-full flex-col p-5 sm:p-6">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${x.tone}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={x.icon} />
                </svg>
              </span>
              <span className="t-h3 mt-4 !font-bold">{t(x.title)}</span>
              <span className="mt-1 flex-1 text-muted">{t(x.body)}</span>
              {x.href === "/family" && guardian && <span className="mt-3 t-small font-semibold text-ok">✓ {guardian.name} is your guardian</span>}
              <span className="mt-4 inline-flex items-center gap-1 font-semibold">
                {t("open")}
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="mine-h" className="rt-rise mt-10" style={{ animationDelay: "320ms" }}>
        <h2 id="mine-h" className="t-h2">
          {t("trackerTitle")}
        </h2>
        <p className="mt-1 text-muted">{t("trackerBody")}</p>
        {mine.length ? (
          <ul className="mt-4 divide-y divide-line rounded-3xl border border-line">
            {mine.map((r) => (
              <li key={r.id}>
                <Link href={`/r/${r.id}`} className="flex min-h-16 items-center gap-4 px-5 py-3 hover:bg-surface">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {r.title}
                      {r.amount ? ` · ${formatMoney(r.amount, r.currency ?? regionOf(r.country as CountryCode).currency)}` : ""}
                    </span>
                    <span className="block t-small text-muted">
                      {regionOf(r.country as CountryCode).name} · {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </span>
                  <span className="t-small font-semibold">Plan and follow-ups</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-3xl border border-dashed border-line-strong px-5 py-6 text-muted">
            Reports you make on this device appear here, with reference numbers and follow-up reminders.{" "}
            <Link href="/" className="font-semibold text-ink underline underline-offset-4">
              Report a scam
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
