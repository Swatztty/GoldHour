import { REGIONS, type CountryCode } from "../regions";
import type { PaymentMethod, ScamType } from "../types";
import type { ContactKind, ReceiverKind, ReportDraft } from "./types";

const SCAMS: ScamType[] = ["digital_arrest", "impersonation", "job_task", "investment", "kyc_link", "remote_access", "sextortion", "shopping", "loan_app", "other"];
const METHODS: PaymentMethod[] = ["UPI", "IMPS", "NEFT", "RTGS", "TRANSFER", "INSTANT", "CARD", "WALLET", "OTHER"];

const str = (v: unknown, max = 400): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, max);
  return s ? s : undefined;
};
const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 && n < 1e13 ? n : undefined;
};

/** Never store secrets a victim might say aloud by mistake. */
export function looksSensitive(s: string): boolean {
  return /\b(otp|one[- ]time|pin|password|passcode|cvv|cvc)\b/i.test(s) || /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(s);
}

export function cleanDraft(raw: unknown): ReportDraft {
  const b = (raw ?? {}) as Record<string, unknown>;
  const country = typeof b.country === "string" && b.country in REGIONS ? (b.country as CountryCode) : "XX";
  const receivers = (Array.isArray(b.receivers) ? b.receivers : [])
    .slice(0, 8)
    .map((r) => r as Record<string, unknown>)
    .map((r) => ({
      kind: (r.kind === "payid" ? "payid" : "account") as ReceiverKind,
      value: str(r.value, 80) ?? "",
      bank: str(r.bank, 80),
      name: str(r.name, 80),
    }))
    .filter((r) => r.value && !/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(r.value));
  const contacts = (Array.isArray(b.contacts) ? b.contacts : [])
    .slice(0, 8)
    .map((r) => r as Record<string, unknown>)
    .map((r) => ({
      kind: (["phone", "handle", "url", "email"].includes(String(r.kind)) ? r.kind : "phone") as ContactKind,
      value: str(r.value, 120) ?? "",
      app: str(r.app, 40),
    }))
    .filter((r) => r.value);
  const story = str(b.story, 4000);
  return {
    country,
    city: str(b.city, 60),
    story: story && looksSensitive(story) ? story.replace(/\b\d{4,}\b/g, "••••") : story,
    summaryEnglish: str(b.summaryEnglish, 1200),
    scamType: SCAMS.includes(b.scamType as ScamType) ? (b.scamType as ScamType) : undefined,
    amount: num(b.amount),
    currency: typeof b.currency === "string" && /^[A-Z]{3}$/.test(b.currency) ? b.currency : undefined,
    minutesAgo: num(b.minutesAgo),
    method: METHODS.includes(b.method as PaymentMethod) ? (b.method as PaymentMethod) : undefined,
    receivers,
    contacts,
    victimBank: str(b.victimBank, 80),
    txnRef: (() => {
      const v = str(b.txnRef, 40);
      return v && /^[A-Za-z0-9 ./-]{4,40}$/.test(v) ? v : undefined;
    })(),
    scriptQuote: str(b.scriptQuote, 400),
    language: str(b.language, 40),
    secondsToReport: (() => {
      const n = num(b.secondsToReport);
      return n && n > 5 && n < 6 * 3600 ? Math.round(n) : undefined;
    })(),
    channel: b.channel === "voice" || b.channel === "guided" || b.channel === "screenshot" ? b.channel : undefined,
  };
}

/** Enough to be useful: what happened, plus money or a receiving account. */
export function draftReady(d: ReportDraft): boolean {
  return !!(d.story || d.summaryEnglish) && (!!d.amount || d.receivers.length > 0);
}

export function missingFields(d: ReportDraft): string[] {
  const m: string[] = [];
  if (!d.story && !d.summaryEnglish) m.push("what happened");
  if (!d.amount) m.push("how much money was sent");
  if (d.minutesAgo === undefined) m.push("how long ago the first payment was");
  if (!d.receivers.length) m.push("the account, payment ID or phone number the money went to");
  if (!d.victimBank) m.push("the person’s own bank");
  if (!d.contacts.length) m.push("the scammer’s phone number, app or username");
  if (!d.city) m.push("their city");
  return m;
}
