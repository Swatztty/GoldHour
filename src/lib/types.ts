import type { CountryCode, Lang } from "./regions";
export type { CountryCode, Lang };

export type PaymentMethod = "UPI" | "IMPS" | "NEFT" | "RTGS" | "TRANSFER" | "INSTANT" | "CARD" | "WALLET" | "OTHER";

export interface Transaction {
  id: string;
  amount: number;
  /** ISO 8601 with offset, e.g. 2026-10-15T14:12:00+05:30 */
  datetime?: string;
  method: PaymentMethod;
  fromBank?: string;
  fromAccount?: string;
  toVpa?: string;
  toAccount?: string;
  toIfsc?: string;
  /** receiving bank as named in the evidence */
  toBank?: string;
  toName?: string;
  /** UTR / RRN / transaction reference */
  reference?: string;
}

export interface SuspectIdentifiers {
  phones: string[];
  upiIds: string[];
  accounts: string[];
  urls: string[];
  names: string[];
  apps: string[];
  emails: string[];
}

export type ScamType =
  | "digital_arrest"
  | "impersonation"
  | "job_task"
  | "investment"
  | "kyc_link"
  | "remote_access"
  | "sextortion"
  | "shopping"
  | "loan_app"
  | "other";

export interface Extraction {
  /** ISO 4217, e.g. INR, SGD */
  currency: string;
  scamType: ScamType;
  scamLabel: string;
  summary: string;
  victimBank?: string;
  victimAccount?: string;
  /** true when the victim did not approve the debit themselves */
  unauthorized: boolean;
  transactions: Transaction[];
  suspect: SuspectIdentifiers;
  redFlags: string[];
  missingInfo: string[];
  confidence: number;
}

export interface Beneficiary {
  key: string;
  identifier: string;
  kind: "vpa" | "account";
  bank?: string;
  app?: string;
  ifsc?: string;
  name?: string;
  total: number;
  txnIds: string[];
  priorReports: number;
}

export type Urgency = "critical" | "high" | "standard";

export interface Investigation {
  firstTxnAt?: string;
  lastTxnAt?: string;
  totalLost: number;
  urgency: Urgency;
  beneficiaries: Beneficiary[];
  agentNotes: string;
  ncrpCategory: string;
  ncrpSubCategory: string;
}

export interface Drafting {
  /** First-person, formal description of what happened (English, for official forms) */
  narrative: string;
  /** What to say on the first call (hotline or bank), in the chosen language */
  callScript: string;
  /** Short reassurance + priorities, chosen language */
  guidance: string[];
  /** Plain-language explanation of the scam, chosen language */
  whatHappened: string;
}

export interface Victim {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  ackNumber: string;
}

export type AgentEventKind = "stage" | "tool" | "result" | "note" | "error" | "done";

export interface AgentEvent {
  t: number;
  kind: AgentEventKind;
  label: string;
  detail?: string;
}

export interface CaseRecord {
  id: string;
  createdAt: string;
  ownerUid?: string;
  country: CountryCode;
  lang: Lang;
  source: "gemini" | "offline";
  sampleId?: string;
  model?: string;
  extraction: Extraction;
  investigation: Investigation;
  drafting: Drafting;
  victim: Victim;
  stepsDone: string[];
  evidence: { name: string; path?: string }[];
  agentLog: AgentEvent[];
}

export interface AnalyzeInput {
  text: string;
  images: { name: string; mimeType: string; data: string }[];
  lang: Lang;
  country: CountryCode;
  sampleId?: string;
  victim?: Partial<Victim>;
}

export type StreamMessage =
  | { type: "event"; event: AgentEvent }
  | { type: "case"; case: CaseRecord }
  | { type: "error"; message: string };
