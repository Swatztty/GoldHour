"use client";

import { useEffect, useState } from "react";

/**
 * The golden hour: how much of the first 60 minutes after the payment is left.
 * The visible clock ticks every 15 seconds; screen readers get a calm, static sentence
 * so they aren't interrupted by every tick.
 */
export function GoldenTimer({
  minutesAgo,
  since,
  compact = false,
}: {
  /** minutes since the first payment, when the person told us */
  minutesAgo: number;
  /** when minutesAgo was measured (ISO); defaults to now */
  since?: string;
  compact?: boolean;
}) {
  const [start] = useState(() => Date.now());
  const [base] = useState(() => {
    const t = since ? Date.parse(since) : NaN;
    return Number.isNaN(t) ? minutesAgo : minutesAgo + Math.max(0, (Date.now() - t) / 60000);
  });
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(t);
  }, []);

  const elapsed = base + (now - start) / 60000;
  const left = Math.max(0, Math.round(60 - elapsed));
  const inHour = elapsed < 60;
  const frac = Math.min(1, Math.max(0, elapsed / 60));

  // Ring: the gold arc shrinks as the hour runs out
  const r = 15;
  const c = 2 * Math.PI * r;
  const label = inHour
    ? `${left} minute${left === 1 ? "" : "s"} left in the golden hour`
    : "The first hour has passed";
  const sub = inHour
    ? "Money is easiest to stop now. Call first, then finish the report."
    : "Still act now: money can often be frozen for days, and every report helps stop the next payment.";

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl ${inHour ? "bg-gold-soft" : "bg-surface"} ${compact ? "px-3 py-2" : "px-4 py-3"}`}
    >
      <svg viewBox="0 0 36 36" className={`${compact ? "h-9 w-9" : "h-11 w-11"} shrink-0 -rotate-90`} aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--rt-line)" strokeWidth="4" />
        {inHour && (
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="var(--rt-gold)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * frac}
            className="transition-[stroke-dashoffset] duration-700"
          />
        )}
      </svg>
      <div className="min-w-0">
        <p className="font-semibold leading-snug">
          {inHour ? (
            <>
              <span className="tabular text-gold-ink">{left} min</span> left in the golden hour
            </>
          ) : (
            label
          )}
        </p>
        {!compact && <p className="t-small text-muted">{sub}</p>}
        <span className="sr-only">{compact ? sub : ""}</span>
      </div>
    </div>
  );
}
