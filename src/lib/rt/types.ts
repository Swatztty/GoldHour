import type { CountryCode } from "../regions";
import type { PaymentMethod, ScamType } from "../types";

export type ReceiverKind = "account" | "payid";
export type ContactKind = "phone" | "handle" | "url" | "email";

export interface Receiver {
  kind: ReceiverKind;
  /** account number, UPI ID, PayNow/PayID/PromptPay proxy, wallet number */
  value: string;
  bank?: string;
  name?: string;
}

export interface ScammerContact {
  kind: ContactKind;
  value: string;
  /** WhatsApp, Telegram, LINE, phone call, SMS… */
  app?: string;
}

/** What the voice assistant collects. Every field is optional until submit. */
export interface ReportDraft {
  country: CountryCode;
  city?: string;
  /** the person's own words, any language */
  story?: string;
  /** short plain-English summary for official reports */
  summaryEnglish?: string;
  scamType?: ScamType;
  amount?: number;
  currency?: string;
  /** how long ago the first payment was made */
  minutesAgo?: number;
  method?: PaymentMethod;
  receivers: Receiver[];
  contacts: ScammerContact[];
  victimBank?: string;
  /** transaction reference from the bank SMS or app (UTR, Ref No, Transaction ID): the first thing a bank asks for */
  txnRef?: string;
  /** a line the scammer said, as close to verbatim as possible */
  scriptQuote?: string;
  /** language the person used, e.g. "Malay" */
  language?: string;
  /** seconds from starting the conversation to sending the report (measured, for impact stats) */
  secondsToReport?: number;
  /** how the report was made */
  channel?: "voice" | "guided" | "screenshot";
}

export interface LinkMatch {
  kind: "receiver" | "contact" | "script";
  value: string;
  otherReports: number;
  countries: string[];
}

export interface Report extends ReportDraft {
  id: string;
  createdAt: string;
  ring: string;
  ringName: string;
  usd: number;
  x: number;
  y: number;
  matches: LinkMatch[];
  /** receivers that now meet the freeze threshold */
  freezeNow: string[];
}

// ---------- network payload for the console ----------

export interface NetEntity {
  id: string;
  key: string;
  kind: "account" | "payid" | "phone" | "handle";
  label: string;
  where: string;
  country: string;
  x: number;
  y: number;
}

export interface NetReport {
  id: string;
  ring: string;
  city: string;
  country: string;
  x: number;
  y: number;
  minutesAgo: number;
  amount: number;
  currency: string;
  usd: number;
  paidTo: string[];
  contactedBy: string[];
  script: string;
  /** reported through the voice assistant (not seed data) */
  live?: boolean;
}

export interface NetRing {
  id: string;
  name: string;
  pattern: string;
  evidence: { kind: "account" | "contact" | "script"; text: string; victims: number }[];
}

export interface Impact {
  reports: number;
  countries: number;
  /** accounts that reached the freeze threshold (3+ victims in 3 hours) */
  flaggedAccounts: number;
  /** US$ paid into flagged accounts in the last 3 hours */
  moneyAtRisk: number;
  /** reports linked to at least one report from another country */
  crossBorder: number;
  /** reports made through the app (not seed data) */
  liveReports: number;
  /** median seconds to report, over app reports that measured it */
  medianSeconds?: number;
  measured: number;
}

export interface Network {
  rings: NetRing[];
  entities: NetEntity[];
  reports: NetReport[];
  generatedAt: string;
  impact?: Impact;
}
