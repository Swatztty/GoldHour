"use client";

import { useSyncExternalStore } from "react";

/**
 * Accessibility preferences. Stored on this device only and applied as data attributes on <html>,
 * so every page (and the CSS) can respond to them.
 */
export interface Prefs {
  /** 100, 125, 150 or 200 percent */
  textSize: 100 | 125 | 150 | 200;
  contrast: "standard" | "high";
  /** shorter sentences, simpler words, one thing at a time */
  easyRead: boolean;
  /** "voice": the assistant speaks; "screenreader": your screen reader reads replies */
  replies: "voice" | "screenreader" | "text";
  captions: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  textSize: 100,
  contrast: "standard",
  easyRead: false,
  replies: "voice",
  captions: true,
  reduceMotion: false,
};

const KEY = "rt.prefs.v1";
const EVT = "rt-prefs";
let cache: Prefs | null = null;

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_PREFS;
}

export function applyPrefs(p: Prefs) {
  const el = document.documentElement;
  el.dataset.text = String(p.textSize);
  el.dataset.contrast = p.contrast;
  el.dataset.easy = p.easyRead ? "1" : "0";
  el.dataset.motion = p.reduceMotion ? "reduce" : "auto";
}

function snapshot(): Prefs {
  if (!cache) cache = read();
  return cache;
}

function subscribe(cb: () => void) {
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
}

export function setPrefs(patch: Partial<Prefs>) {
  const next = { ...snapshot(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: still apply for this visit */
  }
  cache = next;
  applyPrefs(next);
  window.dispatchEvent(new Event(EVT));
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PREFS);
}

/** Inline script for <head>: applies saved preferences before first paint (no flash of small text). */
export const PREFS_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("${KEY}")||"{}");var e=document.documentElement;e.dataset.text=String(p.textSize||100);e.dataset.contrast=p.contrast||"standard";e.dataset.easy=p.easyRead?"1":"0";e.dataset.motion=p.reduceMotion?"reduce":"auto";}catch(_){}})();`;
