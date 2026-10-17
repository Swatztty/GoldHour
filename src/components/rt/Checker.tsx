"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CheckResult } from "@/app/api/check/route";
import { useCountry } from "@/lib/region-store";
import { regionOf } from "@/lib/regions";
import { ALERTS } from "@/lib/rt/alerts";
import { canRecognise, guessLang, listen, speak, stopSpeaking } from "@/lib/rt/speech";
import { PhoneIcon } from "./RtHeader";
import { alertGuardian } from "@/lib/rt/guardian";
import { useT, type Key } from "@/lib/rt/i18n";

const RISK_KEY: Record<"high" | "medium" | "low", Key> = { high: "riskHigh", medium: "riskMedium", low: "riskLow" };

const RISK = {
  high: { label: "High risk", tone: "bg-red text-paper", box: "border-red", icon: "M12 8v5m0 3.5v.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" },
  medium: { label: "Be careful", tone: "bg-gold text-[#10151c]", box: "border-gold", icon: "M12 8v5m0 3.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" },
  low: { label: "No warning signs found", tone: "bg-ok text-paper", box: "border-ok", icon: "M5 12.5l4.5 4.5L19 7.5" },
} as const;

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Checker() {
  const t = useT();
  const country = useCountry() ?? "XX";
  const region = regionOf(country);
  const line = region.hotline ?? region.support;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<CheckResult | null>(null);
  const [copied, setCopied] = useState(false);
  const stopRec = useRef<() => void>(() => {});
  const resultRef = useRef<HTMLHeadingElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // Arriving from the home page with something to check: /check?q=...
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    // ?q= from the home page; ?text=&url=&title= when a message is shared into the installed app
    const q = sp.get("q") || [sp.get("title"), sp.get("text"), sp.get("url")].filter(Boolean).join("\n");
    if (q) {
      const raf = requestAnimationFrame(() => {
        setText(q);
        void run(q);
      });
      return () => cancelAnimationFrame(raf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => stopRec.current(), []);

  async function run(input = text) {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError("");
    setRes(null);
    stopSpeaking();
    try {
      const r = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: input, country }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "The check didn’t work. Try again.");
      setRes(j as CheckResult);
      if ((j as CheckResult).risk === "high") alertGuardian("check", `The check said: “${(j as CheckResult).verdict}”`);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (e) {
      setError(e instanceof Error ? e.message : "The check didn’t work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function dictate() {
    if (listening) {
      stopRec.current();
      return;
    }
    if (!canRecognise()) {
      setError("Voice input isn’t available in this browser. You can paste or type instead.");
      return;
    }
    setError("");
    setListening(true);
    stopRec.current = listen(
      navigator.language || "en",
      (t) => setText(t),
      () => setListening(false),
    );
  }

  function readAloud() {
    if (!res) return;
    const parts = [res.verdict, ...res.flags.map((f) => `${f.title}. ${f.detail}`), ...res.advice];
    speak(parts.join(". "), navigator.language || "en");
  }

  const warning = res
    ? `Scam warning from Golden Hour: ${res.verdict}${res.hits[0] ? ` (${res.hits[0].value})` : ""}. ${res.flags[0]?.detail ?? ""} Never share codes or move money because someone tells you to.`
    : "";

  async function warnFamily() {
    try {
      if (navigator.share) await navigator.share({ title: "Scam warning", text: warning });
      else {
        await navigator.clipboard.writeText(warning);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* the person closed the share sheet */
    }
  }

  const examples = ALERTS[country].slice(0, 2).map((a) => ({ label: a.name, text: a.sample, lang: a.lang }));

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 lg:pt-12">
      <p className="rt-pill rt-rise">
        <Icon d="M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3Z" className="h-4 w-4" />
        {t("checkPill")}
      </p>
      <h1 className="t-h1 rt-rise mt-4" style={{ animationDelay: "60ms" }}>
        {t("checkH1")}
      </h1>
      <p className="t-lead rt-rise mt-3" style={{ animationDelay: "120ms" }}>
        {t("checkLead")}
      </p>

      <form
        className="rt-rise mt-6 rounded-3xl border border-line bg-surface p-3 sm:p-4"
        style={{ animationDelay: "180ms" }}
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label htmlFor="check-text" className="sr-only">
          Message, number, account or link to check
        </label>
        <textarea
          id="check-text"
          ref={boxRef}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("checkPlaceholder")}
          className="rt-input w-full resize-y !bg-paper"
          lang={guessLang(text)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="submit" className="rt-btn rt-btn-ink rt-btn-lg flex-1 sm:flex-none" disabled={!text.trim() || busy} aria-describedby={busy ? "check-busy" : undefined}>
            {busy ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-paper border-t-transparent" aria-hidden="true" />
            ) : (
              <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4" />
            )}
            {t("checkIt")}
          </button>
          <button type="button" onClick={dictate} className={`rt-btn rt-btn-lg ${listening ? "rt-btn-red" : "rt-btn-line"}`} aria-pressed={listening}>
            <Icon d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3" />
            {listening ? t("stop") : t("sayIt")}
          </button>
          {text && (
            <button
              type="button"
              className="rt-btn rt-btn-ghost underline underline-offset-4"
              onClick={() => {
                setText("");
                setRes(null);
                boxRef.current?.focus();
              }}
            >
              {t("clear")}
            </button>
          )}
        </div>
        <p id="check-busy" className="sr-only" aria-live="polite">
          {busy ? "Checking…" : ""}
        </p>
      </form>

      {!res && !busy && (
        <div className="rt-rise mt-6" style={{ animationDelay: "240ms" }}>
          <p className="rt-eyebrow">
            {t("tryExample")}: {region.code === "XX" ? "Asia-Pacific" : region.name}
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {examples.map((x) => (
              <li key={x.label}>
                <button
                  type="button"
                  className="rt-card-btn"
                  onClick={() => {
                    setText(x.text);
                    void run(x.text);
                  }}
                >
                  <span className="block font-semibold">{x.label}</span>
                  <span className="mt-0.5 line-clamp-2 block t-small text-muted" lang={x.lang ?? guessLang(x.text)}>
                    {x.text}
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="rt-card-btn"
                onClick={() => {
                  setText("+60 11-2847 3391");
                  void run("+60 11-2847 3391");
                }}
              >
                <span className="block font-semibold">A number that called you</span>
                <span className="mt-0.5 block t-small text-muted tabular">+60 11-2847 3391</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="rt-card-btn"
                onClick={() => {
                  setText("Can we meet for lunch tomorrow at 1?");
                  void run("Can we meet for lunch tomorrow at 1?");
                }}
              >
                <span className="block font-semibold">An ordinary message</span>
                <span className="mt-0.5 block t-small text-muted">Can we meet for lunch tomorrow at 1?</span>
              </button>
            </li>
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-5 rounded-2xl border border-red bg-red-soft px-4 py-3 font-semibold">
          {error}
        </p>
      )}

      {res && (
        <section aria-labelledby="check-result-h" className={`rt-pop mt-6 overflow-hidden rounded-3xl border-2 ${RISK[res.risk].box} bg-paper`}>
          <div className={`flex items-center gap-3 px-5 py-4 ${RISK[res.risk].tone}`}>
            <Icon d={RISK[res.risk].icon} className="h-7 w-7 shrink-0" />
            <div>
              <p className="text-[0.8125rem] font-bold uppercase tracking-[0.1em]">{t(RISK_KEY[res.risk])}</p>
              <h2 id="check-result-h" ref={resultRef} tabIndex={-1} className="t-h3 !font-bold outline-none">
                {res.verdict}
              </h2>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            {res.hits.length > 0 && (
              <>
                <h3 className="font-semibold">{t("foundInNetwork")}</h3>
                <ul className="mt-2 space-y-2">
                  {res.hits.map((h) => (
                    <li key={h.value} className="rounded-2xl bg-red-soft px-4 py-3">
                      <p className="font-semibold tabular">
                        {h.value} <span className="font-normal text-muted">· {h.where}</span>
                      </p>
                      <p className="t-small">
                        Named in {h.victims} report{h.victims === 1 ? "" : "s"} ({h.ring}), most recently {h.lastMinutesAgo < 90 ? `${h.lastMinutesAgo} minutes` : `${Math.round(h.lastMinutesAgo / 60)} hours`} ago.
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {res.flags.length > 0 && (
              <>
                <h3 className={`font-semibold ${res.hits.length ? "mt-5" : ""}`}>{t("warningSigns")}</h3>
                <ul className="mt-2 space-y-3">
                  {res.flags.map((f) => (
                    <li key={f.id} className="flex gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${f.severe ? "bg-red" : "bg-gold"}`} aria-hidden="true" />
                      <span>
                        <span className="block font-semibold">{f.title}</span>
                        <span className="block text-muted">{f.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3 className="mt-5 font-semibold">{t("whatToDo")}</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              {res.advice.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {res.risk !== "low" && line && (
                <a href={`tel:${line.number.replace(/[^\d]/g, "")}`} className="rt-btn rt-btn-red">
                  <PhoneIcon />
                  {t("alreadyPaid")} {line.number}
                </a>
              )}
              {res.risk !== "low" && (
                <Link href="/" className="rt-btn rt-btn-ink">
                  {t("reportThis")}
                </Link>
              )}
              <button type="button" onClick={warnFamily} className="rt-btn rt-btn-line">
                <Icon d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
                {copied ? "Warning copied" : t("warnFamily")}
              </button>
              <button type="button" onClick={readAloud} className="rt-btn rt-btn-line">
                <Icon d="M11 5 6 9H3v6h3l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
                {t("readAloud")}
              </button>
            </div>
            <p className="mt-4 t-small text-muted">
              {res.source === "gemini" ? "Checked with Gemini and the Golden Hour scam network." : "Checked against the Golden Hour scam network and common scam patterns."} A check can miss new scams. If in doubt, don’t pay.
            </p>
          </div>
        </section>
      )}
      <p className="sr-only" aria-live="polite">
        {copied ? "Warning copied. Paste it into a message to your family." : ""}
      </p>
    </div>
  );
}
