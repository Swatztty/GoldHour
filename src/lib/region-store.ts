"use client";

import { useSyncExternalStore } from "react";
import { detectCountry, REGIONS, type CountryCode } from "./regions";

const KEY = "gh.country";
const EVT = "gh-country-change";

function read(): CountryCode {
  try {
    const v = localStorage.getItem(KEY);
    if (v && v in REGIONS) return v as CountryCode;
  } catch {
    /* storage unavailable */
  }
  return detectCountry();
}

let cached: CountryCode | null = null;

function snapshot(): CountryCode {
  if (!cached) cached = read();
  return cached;
}

function subscribe(cb: () => void) {
  const on = () => {
    cached = read();
    cb();
  };
  window.addEventListener(EVT, on);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener(EVT, on);
    window.removeEventListener("storage", on);
  };
}

export function setCountry(c: CountryCode) {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    /* storage unavailable */
  }
  cached = c;
  window.dispatchEvent(new Event(EVT));
}

/** Selected country; null during server render and hydration. */
export function useCountry(): CountryCode | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
