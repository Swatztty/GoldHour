"use client";

import { useSyncExternalStore } from "react";

/**
 * Demo mode is ON unless the server explicitly says otherwise, so a call or email can never
 * reach a real hotline, bank or person by accident while the app is being judged or tested.
 */
let demo = true;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  fetch("/api/config", { cache: "no-store" })
    .then((r) => r.json())
    .then((c: { demoMode?: boolean }) => {
      demo = c.demoMode !== false;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      /* stay in demo mode */
    });
}

export function useDemoMode(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      load();
      return () => listeners.delete(cb);
    },
    () => demo,
    () => true,
  );
}

export function isDemo(): boolean {
  load();
  return demo;
}
