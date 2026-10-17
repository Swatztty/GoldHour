"use client";

/** Reports made on this device, so people can come back to their plan and follow-ups. */
export interface MyReport {
  id: string;
  createdAt: string;
  country: string;
  amount?: number;
  currency?: string;
  title: string;
}

const KEY = "gh.myreports";

export function listMyReports(): MyReport[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as MyReport[];
  } catch {
    return [];
  }
}

export function rememberReport(r: MyReport) {
  try {
    const list = [r, ...listMyReports().filter((x) => x.id !== r.id)].slice(0, 30);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}
