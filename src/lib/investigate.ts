import { bankFromIfsc, resolveIdentifier } from "./banks";
import type { Beneficiary, Extraction, Investigation, Transaction, Urgency } from "./types";

export const GOLDEN_MINUTES = 60;

export function minutesSince(iso?: string, now = Date.now()): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return Math.max(0, Math.round((now - t) / 60000));
}

export function urgencyFor(minutes?: number): Urgency {
  if (minutes === undefined) return "critical";
  if (minutes <= GOLDEN_MINUTES) return "critical";
  if (minutes <= 72 * 60) return "high";
  return "standard";
}

export function sortedTimes(txns: Transaction[]): string[] {
  return txns
    .map((t) => t.datetime)
    .filter((d): d is string => !!d && !Number.isNaN(Date.parse(d)))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
}

export function ncrpCategoryFor(ex: Extraction): { category: string; sub: string } {
  // India's National Cyber Crime Reporting Portal categories
  const methods = new Set(ex.transactions.map((t) => t.method));
  let sub = "UPI Related Frauds";
  if (methods.has("CARD")) sub = "Debit/Credit Card Fraud/Sim Swap Fraud";
  else if (methods.has("WALLET")) sub = "E-Wallet Related Fraud";
  else if (!methods.has("UPI") && (methods.has("IMPS") || methods.has("NEFT") || methods.has("RTGS")))
    sub = "Internet Banking Related Fraud";
  return { category: "Online Financial Fraud", sub };
}

export function beneficiaryKey(t: Transaction): string | undefined {
  if (t.toVpa) return `vpa:${t.toVpa.toLowerCase()}`;
  if (t.toAccount) return `acc:${(t.toBank ?? t.toIfsc ?? "").toLowerCase()}:${t.toAccount.replace(/\s/g, "")}`;
  return undefined;
}

export function buildInvestigation(
  ex: Extraction,
  priorReports: Record<string, number>,
  agentNotes: string,
  now = Date.now(),
): Investigation {
  const map = new Map<string, Beneficiary>();
  for (const t of ex.transactions) {
    const key = beneficiaryKey(t);
    if (!key) continue;
    let b = map.get(key);
    if (!b) {
      const isVpa = key.startsWith("vpa:");
      const identifier = isVpa ? t.toVpa! : t.toAccount!;
      const res = isVpa ? resolveIdentifier(identifier) : undefined;
      b = {
        key,
        identifier,
        kind: isVpa ? "vpa" : "account",
        bank: t.toBank ?? (isVpa ? res?.bank : bankFromIfsc(t.toIfsc)),
        app: res?.app,
        ifsc: t.toIfsc,
        name: t.toName,
        total: 0,
        txnIds: [],
        priorReports: priorReports[identifier.toLowerCase()] ?? 0,
      };
      map.set(key, b);
    }
    b.total += t.amount;
    b.txnIds.push(t.id);
    if (!b.name && t.toName) b.name = t.toName;
  }
  const times = sortedTimes(ex.transactions);
  const firstTxnAt = times[0];
  const lastTxnAt = times[times.length - 1];
  const { category, sub } = ncrpCategoryFor(ex);
  return {
    firstTxnAt,
    lastTxnAt,
    totalLost: ex.transactions.reduce((s, t) => s + (t.amount || 0), 0),
    urgency: urgencyFor(minutesSince(firstTxnAt, now)),
    beneficiaries: [...map.values()].sort((a, b) => b.total - a.total),
    agentNotes,
    ncrpCategory: category,
    ncrpSubCategory: sub,
  };
}

const SYMBOL: Record<string, string> = {
  INR: "₹",
  SGD: "S$",
  AUD: "A$",
  JPY: "¥",
  MYR: "RM ",
  IDR: "Rp ",
  PHP: "₱",
  THB: "฿",
  HKD: "HK$",
  USD: "US$",
};

/** Unambiguous across JAPAC: S$ vs A$ vs HK$. Indian grouping for rupees. */
export function formatMoney(n: number, currency = "INR"): string {
  const decimals = currency === "JPY" || currency === "IDR" || Number.isInteger(n) ? 0 : 2;
  const num = new Intl.NumberFormat(currency === "INR" ? "en-IN" : currency === "IDR" ? "id-ID" : "en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
  const sym = SYMBOL[currency];
  return sym ? `${sym}${num}` : `${currency} ${num}`;
}

/** @deprecated use formatMoney */
export const formatINR = (n: number) => formatMoney(n, "INR");

export function formatWhen(iso: string | undefined, timeZone = "Asia/Kolkata", withDate = true): string {
  if (!iso) return "Time not found";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    ...(withDate ? { day: "numeric", month: "short", year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** @deprecated use formatWhen */
export const formatIST = (iso?: string, withDate = true) => formatWhen(iso, "Asia/Kolkata", withDate);
