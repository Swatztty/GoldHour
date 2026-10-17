"use client";

import { useSyncExternalStore } from "react";

/** App-wide UI state shared by the header, the bottom tab bar and the tour. */
export interface UiState {
  settings: boolean;
  tour: boolean;
}

let state: UiState = { settings: false, tour: false };
const listeners = new Set<() => void>();

export function setUi(patch: Partial<UiState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const SERVER: UiState = { settings: false, tour: false };

export function useUi(): UiState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => SERVER,
  );
}

export const TOUR_SEEN_KEY = "rt.tour.v1";

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    /* private mode */
  }
}
