import { bankFromIfsc } from "../banks";
import { formatMoney, sortedTimes } from "../investigate";
import type { Extraction } from "../types";
import type { ReportDraft } from "./types";

/** Turn facts read from screenshots into fields of the voice report. */
export function draftFromExtraction(ex: Extraction): Partial<ReportDraft> {
  const first = sortedTimes(ex.transactions)[0];
  const minutesAgo = first ? Math.max(0, Math.round((Date.now() - Date.parse(first)) / 60000)) : undefined;
  return {
    summaryEnglish: ex.summary,
    scamType: ex.scamType,
    amount: ex.transactions.reduce((s, t) => s + t.amount, 0) || undefined,
    currency: ex.currency,
    minutesAgo,
    method: ex.transactions[0]?.method,
    victimBank: ex.victimBank,
    txnRef: ex.transactions.find((t) => t.reference)?.reference,
    receivers: ex.transactions
      .filter((t) => t.toVpa || t.toAccount)
      .map((t) =>
        t.toVpa
          ? { kind: "payid" as const, value: t.toVpa, bank: t.toBank, name: t.toName }
          : { kind: "account" as const, value: t.toAccount!, bank: t.toBank ?? bankFromIfsc(t.toIfsc), name: t.toName },
      ),
    contacts: [
      ...ex.suspect.phones.map((p) => ({ kind: "phone" as const, value: p, app: ex.suspect.apps[0] })),
      ...ex.suspect.names.filter((n) => n.startsWith("@")).map((h) => ({ kind: "handle" as const, value: h, app: ex.suspect.apps[0] })),
    ],
  };
}

/** One paragraph the voice assistant can read and confirm with the person. */
export function extractionNote(ex: Extraction): string {
  const pays = ex.transactions
    .map((t) => `${formatMoney(t.amount, ex.currency)} to ${t.toVpa ?? t.toAccount ?? "an unknown receiver"}${t.toBank ? ` (${t.toBank})` : ""}${t.reference ? `, reference ${t.reference}` : ""}`)
    .join("; ");
  return [
    `The person shared screenshots. Facts found: ${ex.scamLabel}. ${ex.summary}`,
    pays ? `Payments: ${pays}.` : "No payments were visible.",
    ex.victimBank ? `Their bank: ${ex.victimBank}.` : "",
    ex.suspect.phones.length ? `Scammer phone: ${ex.suspect.phones.join(", ")}.` : "",
    "These are already saved. Briefly confirm them with the person, then ask only for what is still missing.",
  ]
    .filter(Boolean)
    .join(" ");
}
