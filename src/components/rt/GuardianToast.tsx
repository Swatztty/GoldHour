"use client";

import { useEffect, useState } from "react";
import { type GuardianAlert, onGuardianAlert } from "@/lib/rt/guardian";
import { useDemoMode } from "@/lib/rt/demo";

/**
 * Shows the alert prepared for the family guardian. In the live service the person can send it as a
 * text message (they always confirm). In demo mode the message is only shown, never sent.
 */
export function GuardianToast() {
  const [alert, setAlert] = useState<GuardianAlert | null>(null);
  const demo = useDemoMode();

  useEffect(() => onGuardianAlert(setAlert), []);

  if (!alert)
    return <div className="sr-only" role="status" aria-live="polite" />;
  const sms = `sms:${alert.to.phone.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(alert.message)}`;

  return (
    <div className="rt-toast no-print" role="status" aria-live="polite">
      <div className="rt-pop rounded-3xl border border-line bg-paper p-4 shadow-[0_24px_60px_-24px_rgb(16_21_28/0.55)] sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-ink" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3" />
              <path d="M3.5 19c.7-3.2 2.9-5 5.5-5s4.8 1.8 5.5 5M17 7.5c1.3 0 2.5 1 2.5 2.4 0 2-2.5 3.6-2.5 3.6s-2.5-1.6-2.5-3.6c0-1.4 1.2-2.4 2.5-2.4Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {demo ? `Alert for ${alert.to.name} (demo: not sent)` : `Let ${alert.to.name} know?`}
            </p>
            <p className="mt-1 t-small text-muted">{alert.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!demo && (
                <a href={sms} className="rt-btn rt-btn-ink !min-h-10">
                  Send text to {alert.to.name}
                </a>
              )}
              <button type="button" className="rt-btn rt-btn-line !min-h-10" onClick={() => setAlert(null)}>
                {demo ? "OK" : "Not now"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
