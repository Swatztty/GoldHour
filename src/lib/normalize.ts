import type { Extraction, PaymentMethod, ScamType, SuspectIdentifiers, Transaction } from "./types";

const SCAM_TYPES: ScamType[] = [
  "digital_arrest",
  "impersonation",
  "job_task",
  "investment",
  "kyc_link",
  "remote_access",
  "sextortion",
  "shopping",
  "loan_app",
  "other",
];
const METHODS: PaymentMethod[] = ["UPI", "IMPS", "NEFT", "RTGS", "TRANSFER", "INSTANT", "CARD", "WALLET", "OTHER"];

export const SCAM_LABELS: Record<ScamType, string> = {
  digital_arrest: "Fake police or “digital arrest” scam",
  impersonation: "Impersonation scam",
  job_task: "Part-time job / task scam",
  investment: "Fake investment or trading scam",
  kyc_link: "Fake KYC or bill-payment link",
  remote_access: "Screen-sharing / remote access scam",
  sextortion: "Sextortion / blackmail",
  shopping: "Fake shopping or delivery scam",
  loan_app: "Fake loan app",
  other: "Online financial fraud",
};

const str = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s && s.toLowerCase() !== "null" && s.toLowerCase() !== "unknown" ? s : undefined;
};

const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map(str).filter((x): x is string => !!x))] : [];

export function normalizePhone(p: string): string {
  const digits = p.replace(/[^\d+]/g, "");
  const m = digits.match(/^\+?91([6-9]\d{9})$/);
  if (m && digits.length >= 12) return `+91 ${m[1].slice(0, 5)} ${m[1].slice(5)}`;
  return p.trim().replace(/\s+/g, " ");
}

/** UPI IDs and emails are case-insensitive; UENs and wallet IDs keep their case. */
function lowerIfEmail(v?: string): string | undefined {
  return v && v.includes("@") ? v.toLowerCase() : v;
}

function amount(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.abs(v);
  if (typeof v === "string") {
    const cleaned = /^\D*\d{1,3}(\.\d{3})+(,\d{1,2})?\D*$/.test(v.trim()) ? v.replace(/\./g, "").replace(",", ".") : v;
    const n = Number(cleaned.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function iso(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : s;
}

export function normalizeExtraction(raw: unknown, defaultCurrency = "INR"): Extraction {
  const r = (raw ?? {}) as Record<string, unknown>;
  const scamType = SCAM_TYPES.includes(r.scamType as ScamType) ? (r.scamType as ScamType) : "other";
  const txRaw = Array.isArray(r.transactions) ? (r.transactions as Record<string, unknown>[]) : [];
  const seen = new Set<string>();
  const transactions: Transaction[] = [];
  txRaw.forEach((t) => {
    const amt = amount(t.amount);
    if (!amt) return;
    const method = METHODS.includes(String(t.method).toUpperCase() as PaymentMethod)
      ? (String(t.method).toUpperCase() as PaymentMethod)
      : "OTHER";
    const reference = str(t.reference);
    const datetime = iso(t.datetime);
    const dedupeKey = reference ? `ref:${reference}` : `amt:${amt}|${datetime ?? ""}|${str(t.toVpa) ?? str(t.toAccount) ?? ""}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    transactions.push({
      id: `t${transactions.length + 1}`,
      amount: amt,
      datetime,
      method,
      fromBank: str(t.fromBank),
      fromAccount: str(t.fromAccount),
      toVpa: lowerIfEmail(str(t.toVpa)),
      toAccount: str(t.toAccount)?.replace(/\s/g, ""),
      toIfsc: str(t.toIfsc)?.toUpperCase(),
      toBank: str(t.toBank),
      toName: str(t.toName),
      reference,
    });
  });
  transactions.sort((a, b) => (Date.parse(a.datetime ?? "") || 0) - (Date.parse(b.datetime ?? "") || 0));
  transactions.forEach((t, i) => (t.id = `t${i + 1}`));

  const s = (r.suspect ?? {}) as Record<string, unknown>;
  const suspect: SuspectIdentifiers = {
    phones: [...new Set(strArr(s.phones).map(normalizePhone))],
    upiIds: [...new Set([...strArr(s.upiIds), ...transactions.map((t) => t.toVpa).filter((x): x is string => !!x)].map((u) => lowerIfEmail(u)!))],
    accounts: [...new Set([...strArr(s.accounts), ...transactions.map((t) => t.toAccount).filter((x): x is string => !!x)])],
    urls: strArr(s.urls),
    names: strArr(s.names),
    apps: strArr(s.apps),
    emails: strArr(s.emails),
  };

  const confidence = typeof r.confidence === "number" ? Math.min(1, Math.max(0, r.confidence)) : 0.6;
  const cur = str(r.currency)?.toUpperCase();
  return {
    currency: cur && /^[A-Z]{3}$/.test(cur) ? cur : defaultCurrency,
    scamType,
    scamLabel: str(r.scamLabel) ?? SCAM_LABELS[scamType],
    summary: str(r.summary) ?? "Money was sent to people who appear to be scammers.",
    victimBank: str(r.victimBank),
    victimAccount: str(r.victimAccount),
    unauthorized: r.unauthorized === true,
    transactions,
    suspect,
    redFlags: strArr(r.redFlags).slice(0, 8),
    missingInfo: strArr(r.missingInfo).slice(0, 6),
    confidence,
  };
}

/**
 * Rule-based extraction used when Gemini is unreachable. It reads the pasted text only,
 * so it is less complete than the model, but it keeps the app working.
 */
export function offlineExtract(text: string, nowIso: string, currency = "INR"): Extraction {
  const t = text.replace(/ /g, " ");
  const lower = t.toLowerCase();
  const vpas = [...new Set((t.match(/\b[a-z0-9._-]{2,}@[a-z]{2,}\b/gi) ?? []).filter((v) => !/\.(com|in|org|net)$/i.test(v)))];
  const emails = [...new Set(t.match(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g) ?? [])];
  const phones = [...new Set((t.match(/(?:\+\d{1,3}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,4}[\s-]?\d{3,5}\b/g) ?? []).filter((p) => p.replace(/\D/g, "").length >= 8 && p.replace(/\D/g, "").length <= 13 && !/^\d{11,}$/.test(p)).map(normalizePhone))];
  const urls = [...new Set(t.match(/\b(?:https?:\/\/|www\.)[^\s)]+|\b[a-z0-9-]+\.(?:xyz|top|site|online|shop|live|click|link|in|com)\/[^\s)]*/gi) ?? [])];

  const transactions: Record<string, unknown>[] = [];
  const lines = t.split(/\n+/);
  for (const line of lines) {
    const m = line.match(/(?:rs\.?|inr|₹|s\$|sgd|a\$|aud|hk\$|hkd|rm|myr|rp\.?|idr|₱|php|฿|thb|baht|¥|jpy|usd|\$)\s*([\d,.]+)/i) ?? line.match(/([\d,]+)\s*円/);
    if (!m) continue;
    if (!/debit|paid|sent|transfer|deducted|withdrawn|振込|送金|dikirim|transfer|โอน/i.test(line)) continue;
    const ref = line.match(/(?:utr|ref(?:erence)?|rrn|txn(?: id)?)[\s.:no#-]*([A-Z0-9]{8,22})/i)?.[1];
    const vpa = line.match(/\b[a-z0-9._-]{2,}@[a-z]{2,}\b/i)?.[0];
    const acc = line.match(/a\/?c\s*(?:no\.?)?\s*([0-9X*]{6,18})/i)?.[1];
    const ifsc = line.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/)?.[0];
    const method = /upi|vpa|@/i.test(line) ? "UPI" : /imps/i.test(line) ? "IMPS" : /neft/i.test(line) ? "NEFT" : /card/i.test(line) ? "CARD" : "OTHER";
    transactions.push({
      amount: m[1],
      method,
      reference: ref,
      toVpa: vpa,
      toAccount: vpa ? undefined : ifsc ? acc : undefined,
      toIfsc: ifsc,
      datetime: nowIso,
    });
  }

  const scamType: ScamType = /cbi|police|customs|arrest|narcotics|parcel|fedex|courier|warrant/.test(lower)
    ? "digital_arrest"
    : /task|part[- ]time|like.*video|review.*hotel|telegram/.test(lower)
      ? "job_task"
      : /kyc|electricity|bill|blocked|pan card|update your/.test(lower)
        ? "kyc_link"
        : /anydesk|teamviewer|screen ?share|quicksupport/.test(lower)
          ? "remote_access"
          : /invest|trading|ipo|stock|crypto|returns/.test(lower)
            ? "investment"
            : "other";

  return normalizeExtraction({
    currency,
    scamType,
    summary: "Extracted from your pasted messages with the offline reader. Check each detail before filing.",
    transactions,
    suspect: { phones, upiIds: vpas, urls, emails, accounts: [], names: [], apps: [] },
    redFlags: [],
    missingInfo: transactions.length
      ? ["Exact time of each payment (the offline reader uses the current time)"]
      : ["No debit messages found. Paste the bank SMS that shows the money leaving your account."],
    confidence: 0.4,
    unauthorized: false,
    victimBank: undefined,
  });
}
