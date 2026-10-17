"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { regionOf, type CountryCode } from "@/lib/regions";
import { ALERTS } from "@/lib/rt/alerts";
import { guessLang } from "@/lib/rt/speech";
import { setUi } from "@/lib/rt/ui";
import { SAMPLES } from "@/lib/samples";
import { InstallApp } from "./InstallApp";
import { useT, useUiLang } from "@/lib/rt/i18n";

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The three things under the hero: check before paying, scams going around, and the demo. */
export function HomeCards({
  country,
  onSample,
  onPlay,
}: {
  country: CountryCode;
  onSample: (id: string, country: CountryCode) => void;
  onPlay: () => void;
}) {
  const t = useT();
  const uiLang = useUiLang();
  const router = useRouter();
  const [q, setQ] = useState("");
  const region = regionOf(country);
  const alerts = ALERTS[country];
  const where = country === "XX" ? "Asia-Pacific" : region.name;

  return (
    <>
    <section lang="en" aria-labelledby="why-h" className="rt-rise mt-12 rounded-3xl border border-line bg-paper/70 px-5 py-4 lg:mt-14" style={{ animationDelay: "240ms" }}>
      <h2 id="why-h" className="sr-only">
        Why this matters
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {[
          ["S$1.1 billion", "lost to scams in Singapore in 2024", "Singapore Police Force, via Malay Mail", "https://www.malaymail.com/news/singapore/2025/02/25/singapore-sees-record-surge-in-cybercrime-s11b-lost-to-scams-in-2024/167930"],
          ["A$2 billion", "reported lost to scams in Australia in 2024", "National Anti-Scam Centre (Scamwatch)", "https://www.scamwatch.gov.au/about-us/news-and-alerts/australians-better-protected-as-reported-scam-losses-fell-by-almost-26-per-cent"],
          ["₹22,845 crore", "lost to cyber fraud in India in 2024", "Ministry of Home Affairs, via Scroll", "https://scroll.in/latest/1084796/indians-lost-rs-22845-crore-to-cyber-fraud-in-2024-a-206-rise-from-previous-year-centre"],
        ].map(([v, l, src, href]) => (
          <li key={v} className="flex items-baseline gap-3 sm:block">
            <p className="rt-display shrink-0 text-[1.6rem] font-bold leading-tight text-gold-ink tabular">{v}</p>
            <p className="t-small">
              {l}.{" "}
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-muted underline underline-offset-2">
                {src}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          </li>
        ))}
      </ul>
    </section>
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      {/* Check before you pay */}
      <section aria-labelledby="hc-check-h" className="rt-card rt-card-hover rt-rise flex min-w-0 flex-col p-5 sm:p-6" style={{ animationDelay: "260ms" }} data-tour="check">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-ok-soft text-ok" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3Z" />
            <path d="m8.5 12 2.5 2.5 4.5-5" />
          </svg>
        </span>
        <h2 id="hc-check-h" className="t-h3 mt-3 !font-bold">
          {t("cardCheckTitle")}
        </h2>
        <p className="mt-1 text-muted">{t("cardCheckBody")}</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/check?q=${encodeURIComponent(q.trim())}` : "/check");
          }}
        >
          <label htmlFor="hc-q" className="sr-only">
            Message, number or account to check
          </label>
          <input id="hc-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. +60 11-2847 3391" className="rt-input min-w-0 flex-1 !min-h-11" />
          <button type="submit" className="rt-btn rt-btn-ink shrink-0">
            {t("checkBtn")}
          </button>
        </form>
        <p lang="en" className="mt-4 t-small font-semibold text-muted">We look for</p>
        <ul lang="en" className="mt-1.5 flex flex-wrap gap-1.5 t-small">
          {["Numbers other victims reported", "Fake police and banks", "“Safe account” requests", "Requests for codes", "Risky links and apps"].map((t) => (
            <li key={t} className="rounded-full bg-surface px-2.5 py-1">
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* Scams going around */}
      <section aria-labelledby="hc-alerts-h" className="rt-card rt-card-hover rt-rise min-w-0 p-5 sm:p-6" style={{ animationDelay: "320ms" }} data-tour="alerts">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-soft text-red" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4m0 3.5v.01" />
            </svg>
          </span>
        </div>
        <h2 id="hc-alerts-h" className="t-h3 mt-3 !font-bold">
          {t("cardAlertsTitle")} {where}
        </h2>
        <ul lang="en" className="mt-2 divide-y divide-line">
          {alerts.map((a, i) => (
            <li key={a.name}>
              <details className="group py-2" open={i === 0}>
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 font-semibold [&::-webkit-details-marker]:hidden">
                  <span>
                    {a.name}
                    {a.local && (
                      <span className="rt-sys ml-1.5 font-normal text-muted" lang={a.lang}>
                        {a.local}
                      </span>
                    )}
                  </span>
                  <span className="text-muted transition-transform duration-200 group-open:rotate-90">
                    <Arrow />
                  </span>
                </summary>
                <p className="pb-1 text-muted">{a.spot}</p>
                <a href={`/check?q=${encodeURIComponent(a.sample)}`} lang={uiLang} className="inline-flex min-h-10 items-center t-small font-semibold underline underline-offset-4">
                  {t("seeExample")}
                </a>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {/* Demo */}
      <section aria-labelledby="hc-demo-h" className="rt-rise min-w-0 rounded-3xl bg-ink p-5 text-paper sm:p-6" style={{ animationDelay: "380ms" }} data-tour="samples">
        <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-gold">{t("demoEyebrow")}</p>
        <h2 id="hc-demo-h" className="t-h3 mt-1 !font-bold">
          {t("demoTitle")}
        </h2>
        <p lang="en" className="mt-1 t-small opacity-80">A sample victim reports by voice, gets the golden-hour countdown, and the report lands on the scam network with a freeze alert. Nobody real is contacted.</p>
        <div className="mt-3 grid gap-2">
          <button type="button" className="rt-btn !border-gold !bg-gold !text-[#10151c]" onClick={onPlay} data-tour="play-demo">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M6 4.5v11l9-5.5-9-5.5Z" />
            </svg>
            {t("playDemo")}
          </button>
          <button type="button" className="rt-btn !border-white/30 !bg-transparent !text-paper hover:!border-gold" onClick={() => setUi({ tour: true })}>
            {t("takeTour")}
          </button>
        </div>
        <p className="mt-4 t-small font-semibold opacity-80">{t("orPick")}</p>
        <ul className="mt-1.5 grid grid-cols-[minmax(0,1fr)] gap-1.5">
          {SAMPLES.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSample(s.id, s.country)}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-white/15 px-3 py-1.5 text-left transition-colors hover:border-gold hover:bg-white/5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] leading-tight opacity-75">{regionOf(s.country).name}</span>
                  <span className={`block font-semibold leading-snug ${guessLang(s.title) ? "rt-sys" : ""}`} lang={guessLang(s.title)}>
                    {s.title}
                  </span>
                </span>
                <Arrow />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div className="lg:col-span-3">
        <InstallApp />
      </div>
    </div>
    </>
  );
}
