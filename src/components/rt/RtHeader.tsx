"use client";

import Link from "next/link";
import { setCountry, useCountry } from "@/lib/region-store";
import { REGION_LIST, regionOf, type CountryCode } from "@/lib/regions";
import { useDemoMode } from "@/lib/rt/demo";
import { setUi, useUi } from "@/lib/rt/ui";
import { type Key, UI_LANGS, setUiLang, useT, useUiLang, type UiLang } from "@/lib/rt/i18n";
import { AccessibilityDialog } from "./AccessibilityDialog";
import { Tour } from "./Tour";

/**
 * Golden Hour mark: a golden clock whose first segment is filled in, the first hour after a scam,
 * when the money can still be stopped.
 */
export const MARK = {
  wedge: "M16 16V6.2A9.8 9.8 0 0 1 24.5 11.1Z",
  hands: "M16 16V9.6M16 16l4.4 2.6",
};

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--rt-gold)" />
      <circle cx="16" cy="16" r="10.6" fill="var(--rt-paper)" />
      <path d={MARK.wedge} fill="var(--rt-gold)" />
      <g className="rt-logo-hands">
        <path
          d={MARK.hands}
          fill="none"
          stroke="var(--rt-ink)"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
      </g>
      <circle cx="16" cy="16" r="1.7" fill="var(--rt-ink)" />
    </svg>
  );
}

/** Logo plus name, used in the header. */
export function Wordmark() {
  const t = useT();
  return (
    <span className="flex items-center gap-2.5">
      <Logo className="rt-logo h-9 w-9" />
      <span className="flex flex-col">
        <span className="rt-display whitespace-nowrap text-[1.45rem] font-extrabold leading-[0.95] tracking-tight">
          Golden <span className="text-gold-ink">Hour</span>
        </span>
        <span className="hidden text-[0.6875rem] font-semibold uppercase leading-tight tracking-[0.12em] text-muted xl:block">
          {t("tagline")}
        </span>
      </span>
    </span>
  );
}

export function PhoneIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AccessIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="4.5" r="2" />
      <path
        d="M4 8.5l8 1.5 8-1.5M12 10v5m0 0l-3.5 6M12 15l3.5 6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Chevron({
  className = "rt-select-chevron",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path
        d="M3.5 6l4.5 4.5L12.5 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CountrySelect({
  id = "country",
  className = "",
}: {
  id?: string;
  className?: string;
}) {
  const country = useCountry();
  const t = useT();
  return (
    <div className={`rt-select ${className}`} data-tour="country">
      <label htmlFor={id} className="sr-only">
        {t("country")}
      </label>
      <svg
        viewBox="0 0 20 20"
        className="rt-select-icon"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="7.5" />
        <path d="M2.5 10h15M10 2.5c2.2 2.3 2.2 12.7 0 15M10 2.5c-2.2 2.3-2.2 12.7 0 15" />
      </svg>
      <select
        id={id}
        value={country ?? ""}
        onChange={(e) => setCountry(e.target.value as CountryCode)}
        className="w-full"
      >
        {!country && <option value="">Country</option>}
        {REGION_LIST.map((r) => (
          <option key={r.code} value={r.code}>
            {r.name}
          </option>
        ))}
      </select>
      <Chevron />
    </div>
  );
}

export function HelpIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path
        d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
    </svg>
  );
}

function ReportIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

function NetworkIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="5" cy="18" r="2.2" />
      <circle cx="19" cy="6" r="2.2" />
      <circle cx="17" cy="18" r="2.2" />
      <path
        d="M6.8 16.6C10 9 14 13 17.4 7.6M7.2 18h7.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LanguageSelect({ id, className = "" }: { id: string; className?: string }) {
  const lang = useUiLang();
  const t = useT();
  return (
    <div className={`rt-select ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t("language")} (Language)
      </label>
      <svg viewBox="0 0 20 20" className="rt-select-icon" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 4.5h8M6.5 3v1.5M4 4.5c.6 2.6 2.4 4.6 5 5.6M9 4.5c-.6 2.8-2.6 5.2-6 6.3M10.5 17l3.3-8 3.2 8M11.6 14.5h4.4" />
      </svg>
      <select id={id} value={lang} onChange={(e) => setUiLang(e.target.value as UiLang)} className="w-full">
        {UI_LANGS.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
      <Chevron />
    </div>
  );
}

const NAV: { href: string; key: Page; label: Key; short: Key; tour: string }[] = [
  { href: "/", key: "report", label: "navReport", short: "tabReport", tour: "report-nav" },
  { href: "/check", key: "check", label: "navCheck", short: "tabCheck", tour: "check-nav" },
  { href: "/safety", key: "safety", label: "navSafety", short: "navSafety", tour: "safety-nav" },
  { href: "/network", key: "network", label: "navNetwork", short: "tabNetwork", tour: "network" },
];

type Page = "report" | "check" | "safety" | "network" | "accessibility";

function useHotline() {
  const country = useCountry();
  const r = country ? regionOf(country) : null;
  return r?.hotline ?? r?.support ?? null;
}

export function RtHeader({ current }: { current?: Page }) {
  const { settings } = useUi();
  const demo = useDemoMode();
  const line = useHotline();
  const t = useT();
  const tourable = current === "report" || current === "network";

  return (
    <>
      {demo && (
        <aside aria-label="Demo notice" className="no-print border-b border-line bg-surface px-4 py-1.5 text-center t-small text-muted">
          <span className="mr-1.5 inline-block rounded-full bg-ink px-2 py-px text-[0.75rem] font-bold tracking-wide text-paper">DEMO</span>
          {t("demoStrip")}{" "}
          {tourable && (
            <button type="button" onClick={() => setUi({ tour: true })} className="inline-flex min-h-6 items-center font-semibold text-ink underline underline-offset-4">
              {t("howItWorks")}
            </button>
          )}
        </aside>
      )}
      <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 xl:grid xl:grid-cols-[1fr_auto_1fr]">
          <Link href="/" className="flex min-h-11 items-center justify-self-start rounded-md">
            <Wordmark />
            <span className="sr-only">, home</span>
          </Link>

          <nav aria-label="Main" className="hidden lg:ml-2 lg:block xl:ml-0">
            <ul className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
              {NAV.map((n) => (
                <li key={n.key}>
                  <Link
                    href={n.href}
                    data-tour={n.tour}
                    aria-current={current === n.key ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-full px-4 font-semibold transition-colors duration-200 ${current === n.key ? "bg-ink text-paper shadow-sm" : "text-muted hover:bg-paper hover:text-ink"}`}
                  >
                    <span className="2xl:hidden">{t(n.short)}</span>
                    <span className="hidden 2xl:inline">{t(n.label)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2 justify-self-end">
            <CountrySelect id={`country-${current ?? "x"}`} className="w-[9.75rem] sm:w-[11rem] lg:w-[9.5rem] xl:w-[11rem]" />
            <div className="hidden xl:block">
              <LanguageSelect id={`lang-${current ?? "x"}`} className="w-[9rem]" />
            </div>
            <button
              type="button"
              onClick={() => setUi({ settings: true })}
              data-tour="settings"
              className="rt-btn rt-btn-line rt-btn-icon !hidden lg:!inline-flex"
              aria-haspopup="dialog"
              aria-label={`${t("accessibility")} & ${t("language")}`}
              title={`${t("accessibility")} & ${t("language")}`}
            >
              <AccessIcon />
            </button>
            {line && (
              <a href={`tel:${line.number.replace(/[^\d]/g, "")}`} data-tour="call" className="rt-btn rt-btn-red !hidden lg:!inline-flex" title={line.name}>
                <PhoneIcon />
                <span className="tabular whitespace-nowrap">
                  {t("call")} {line.number}
                </span>
              </a>
            )}
          </div>
        </div>
        <AccessibilityDialog open={settings} onClose={() => setUi({ settings: false })} />
      </header>
      {tourable && <Tour page={current} />}
    </>
  );
}

function CheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

function SafetyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.7-3.2 2.9-5 5.5-5s4.8 1.8 5.5 5" />
      <path d="M17 7.5c1.3 0 2.5 1 2.5 2.4 0 2-2.5 3.6-2.5 3.6s-2.5-1.6-2.5-3.6c0-1.4 1.2-2.4 2.5-2.4Z" />
    </svg>
  );
}

/** App-style tab bar for phones and tablets. Render it after the page content so it comes last in reading order. */
export function BottomNav({ current }: { current?: Page }) {
  const line = useHotline();
  const t = useT();
  const icon = (k: Page) =>
    k === "report" ? <ReportIcon /> : k === "check" ? <CheckIcon /> : k === "safety" ? <SafetyIcon /> : <NetworkIcon />;
  const tab = (n: (typeof NAV)[number]) => (
    <li key={n.key}>
      <Link href={n.href} data-tour={n.tour} aria-current={current === n.key ? "page" : undefined} className="rt-tab">
        <span className="rt-tab-icon">{icon(n.key)}</span>
        {n.key === "safety" ? t("tabSafety") : t(n.short)}
      </Link>
    </li>
  );
  return (
    <nav aria-label="App" className="rt-tabbar no-print lg:hidden">
      <ul className="mx-auto grid h-[var(--rt-tabbar)] max-w-2xl grid-cols-6">
        {tab(NAV[0])}
        {tab(NAV[1])}
        <li>
          {line ? (
            <a href={`tel:${line.number.replace(/[^\d]/g, "")}`} data-tour="call" className="rt-tab rt-tab-call" title={line.name}>
              <span className="rt-tab-icon">
                <PhoneIcon className="h-6 w-6" />
              </span>
              <span className="tabular">{line.number.length > 6 ? t("tabCall") : `${t("tabCall")} ${line.number}`}</span>
            </a>
          ) : (
            <span className="rt-tab opacity-60">
              <span className="rt-tab-icon">
                <PhoneIcon className="h-6 w-6" />
              </span>
              {t("tabCall")}
            </span>
          )}
        </li>
        {tab(NAV[2])}
        {tab(NAV[3])}
        <li>
          <button type="button" onClick={() => setUi({ settings: true })} data-tour="settings" className="rt-tab w-full" aria-haspopup="dialog">
            <span className="rt-tab-icon">
              <AccessIcon className="h-6 w-6" />
            </span>
            {t("settings")}
          </button>
        </li>
      </ul>
    </nav>
  );
}
