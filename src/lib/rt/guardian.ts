"use client";

import { useSyncExternalStore } from "react";

/**
 * Family guardian: one trusted person, stored only on this device. When the person reports a scam,
 * a check comes back high risk, or the call shield warns, Golden Hour prepares an alert for them.
 * In demo mode nothing is sent; the alert is shown on screen instead.
 */
export interface Guardian {
  name: string;
  relation: string;
  phone: string;
  onReport: boolean;
  onCheck: boolean;
  onShield: boolean;
}

export type GuardianEvent = "report" | "check" | "shield" | "test";

export interface GuardianAlert {
  to: Guardian;
  kind: GuardianEvent;
  message: string;
}

const KEY = "gh.guardian";
const EVT = "gh-guardian";
const ALERT = "gh-guardian-alert";

let cache: Guardian | null | undefined;

function read(): Guardian | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Guardian) : null;
  } catch {
    return null;
  }
}

export function getGuardian(): Guardian | null {
  if (cache === undefined) cache = read();
  return cache;
}

export function saveGuardian(g: Guardian | null) {
  try {
    if (g) localStorage.setItem(KEY, JSON.stringify(g));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  cache = g;
  window.dispatchEvent(new Event(EVT));
}

export function useGuardian(): Guardian | null {
  return useSyncExternalStore(
    (cb) => {
      const on = () => {
        cache = read();
        cb();
      };
      window.addEventListener(EVT, on);
      window.addEventListener("storage", on);
      return () => {
        window.removeEventListener(EVT, on);
        window.removeEventListener("storage", on);
      };
    },
    getGuardian,
    () => null,
  );
}

/** Prepare and announce an alert for the guardian, if one is set up for this kind of event. */
export function alertGuardian(kind: GuardianEvent, detail: string) {
  const g = getGuardian();
  if (!g) return;
  if ((kind === "report" && !g.onReport) || (kind === "check" && !g.onCheck) || (kind === "shield" && !g.onShield)) return;
  const lead =
    kind === "report"
      ? "has just reported a scam on Golden Hour"
      : kind === "check"
        ? "checked a message on Golden Hour and it looks like a scam"
        : kind === "shield"
          ? "may be on a scam call right now (Golden Hour call shield)"
          : "added you as their Golden Hour family guardian";
  const message = `Golden Hour: your ${g.relation || "family member"} ${lead}. ${detail} Please call them now. Never ask them for codes or passwords.`.replace(/\s+/g, " ");
  window.dispatchEvent(new CustomEvent<GuardianAlert>(ALERT, { detail: { to: g, kind, message } }));
}

export function onGuardianAlert(cb: (a: GuardianAlert) => void) {
  const h = (e: Event) => cb((e as CustomEvent<GuardianAlert>).detail);
  window.addEventListener(ALERT, h);
  return () => window.removeEventListener(ALERT, h);
}
