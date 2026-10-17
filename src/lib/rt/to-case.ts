import { offlineNarrative } from "../drafting";
import { buildInvestigation } from "../investigate";
import { SCAM_LABELS } from "../normalize";
import { regionOf } from "../regions";
import type { CaseRecord, Extraction, PaymentMethod, Transaction, Victim } from "../types";
import type { Report } from "./types";

/**
 * Adapts a voice report to the shape the letter builder uses, so every country's report,
 * bank letters and police complaint come from the same tested templates.
 */
export function reportToCase(r: Report, victim: Victim): CaseRecord {
  const region = regionOf(r.country);
  const paidAt = new Date(Date.parse(r.createdAt) - (r.minutesAgo ?? 0) * 60000).toISOString();
  const method: PaymentMethod = r.method ?? (r.country === "IN" && r.receivers.some((x) => x.value.includes("@")) ? "UPI" : r.receivers.some((x) => x.kind === "payid") ? "INSTANT" : "TRANSFER");
  const single = r.receivers.length <= 1;
  const transactions: Transaction[] = (r.receivers.length ? r.receivers : [{ kind: "account" as const, value: "", bank: undefined, name: undefined }]).map((rc, i) => ({
    id: `t${i + 1}`,
    amount: single ? r.amount ?? 0 : 0,
    datetime: paidAt,
    method,
    fromBank: r.victimBank,
    toVpa: rc.kind === "payid" ? rc.value : undefined,
    toAccount: rc.kind === "account" && rc.value ? rc.value : undefined,
    toBank: rc.bank,
    toName: rc.name,
  }));
  const scamType = r.scamType ?? "other";
  const ex: Extraction = {
    currency: r.currency ?? region.currency,
    scamType,
    scamLabel: SCAM_LABELS[scamType],
    summary: r.summaryEnglish ?? r.story ?? "",
    victimBank: r.victimBank,
    unauthorized: scamType === "remote_access",
    transactions: transactions.filter((t) => t.toVpa || t.toAccount || t.amount),
    suspect: {
      phones: r.contacts.filter((c) => c.kind === "phone").map((c) => c.value),
      upiIds: r.receivers.filter((x) => x.kind === "payid").map((x) => x.value),
      accounts: r.receivers.filter((x) => x.kind === "account").map((x) => x.value),
      urls: r.contacts.filter((c) => c.kind === "url").map((c) => c.value),
      names: r.contacts.filter((c) => c.kind === "handle").map((c) => c.value),
      apps: [...new Set(r.contacts.map((c) => c.app).filter((a): a is string => !!a))],
      emails: r.contacts.filter((c) => c.kind === "email").map((c) => c.value),
    },
    redFlags: [],
    missingInfo: [],
    confidence: 0.8,
  };
  const inv = buildInvestigation(ex, {}, "");
  inv.totalLost = r.amount ?? inv.totalLost;
  const own = r.story && r.story !== r.summaryEnglish ? ` In my own words: “${r.story}”` : "";
  const quote = r.scriptQuote ? ` The scammer told me: “${r.scriptQuote}”.` : "";
  return {
    id: r.id,
    createdAt: r.createdAt,
    country: r.country,
    lang: "en",
    source: "gemini",
    extraction: ex,
    investigation: inv,
    drafting: { narrative: `${offlineNarrative(ex, inv, region)}${quote}${own}`, callScript: "", guidance: [], whatHappened: ex.summary },
    victim,
    stepsDone: [],
    evidence: [],
    agentLog: [],
  };
}
