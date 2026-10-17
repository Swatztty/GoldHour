import type { ContactKind, ReportDraft } from "./types";

/** Offline understanding of short spoken or typed answers, used when the AI service isn't available. */

const NONE = /\b(don'?t know|do not know|not sure|no idea|skip|none|no)\b/i;

const CURRENCY_WORDS: [RegExp, string][] = [
  [/(₹|\brs\.?|\binr\b|rupee)/i, "INR"],
  [/(s\$|\bsgd\b|singapore dollar)/i, "SGD"],
  [/(a\$|\baud\b|australian dollar)/i, "AUD"],
  [/(hk\$|\bhkd\b|hong kong dollar)/i, "HKD"],
  [/(\brm\b|\bmyr\b|ringgit)/i, "MYR"],
  [/(\brp\.?|\bidr\b|rupiah)/i, "IDR"],
  [/(₱|\bphp\b|peso)/i, "PHP"],
  [/(฿|\bthb\b|baht|บาท)/i, "THB"],
  [/(¥|円|\bjpy\b|\byen\b)/i, "JPY"],
  [/(us\$|\busd\b|us dollar)/i, "USD"],
];

export function parseAmount(text: string): { amount?: number; currency?: string } {
  const currency = CURRENCY_WORDS.find(([re]) => re.test(text))?.[1];
  const m = text.match(/(\d[\d,.\s]*\d|\d)\s*(k|thousand|lakhs?|million|m|crores?|万)?/i);
  if (!m) return { currency };
  let n = Number(m[1].replace(/[\s,]/g, "").replace(/\.(?=\d{3}(\D|$))/g, ""));
  const unit = m[2]?.toLowerCase();
  if (unit === "k" || unit === "thousand") n *= 1e3;
  else if (unit?.startsWith("lakh")) n *= 1e5;
  else if (unit === "million" || unit === "m") n *= 1e6;
  else if (unit?.startsWith("crore")) n *= 1e7;
  else if (unit === "万") n *= 1e4;
  return Number.isFinite(n) && n > 0 ? { amount: n, currency } : { currency };
}

export function parseWhen(text: string): number | undefined {
  const t = text.toLowerCase();
  if (/just now|right now|few minutes|a minute/.test(t)) return 5;
  if (/half an hour/.test(t)) return 30;
  const mins = t.match(/(\d+)\s*(min|minute)/);
  if (mins) return Number(mins[1]);
  const hrs = t.match(/(\d+)\s*(hr|hour)/);
  if (hrs) return Number(hrs[1]) * 60;
  if (/an hour|one hour|within an hour/.test(t)) return 60;
  if (/this morning/.test(t)) return 240;
  if (/today|earlier/.test(t)) return 180;
  if (/yesterday/.test(t)) return 1440;
  const days = t.match(/(\d+)\s*day/);
  if (days) return Number(days[1]) * 1440;
  if (/week/.test(t)) return 7 * 1440;
  return undefined;
}

export function parseReceivers(text: string): ReportDraft["receivers"] {
  if (NONE.test(text) && !/\d{5,}|@/.test(text)) return [];
  const out: ReportDraft["receivers"] = [];
  for (const v of text.match(/\b[a-z0-9._-]{2,}@[a-z]{2,}\b/gi) ?? []) out.push({ kind: "payid", value: v });
  const uen = text.match(/\b(?:uen\s*)?\d{8,9}[a-z]\b/i)?.[0];
  if (uen) out.push({ kind: "payid", value: uen.toUpperCase() });
  const rest = text.replace(/\b[a-z0-9._-]{2,}@[a-z]{2,}\b/gi, " ");
  for (const d of rest.match(/\d[\d\s-]{5,}\d/g) ?? []) {
    const digits = d.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 20) continue;
    const isProxy = /pay ?now|pay ?id|promptpay|duitnow|fps|gcash|maya|wallet|mobile number|phone number/i.test(text) && digits.length <= 12;
    out.push({ kind: isProxy ? "payid" : "account", value: d.trim() });
  }
  const bank = text.match(/\b(maybank|cimb|public bank|rhb|ocbc|dbs|posb|uob|hsbc|citibank|standard chartered|westpac|nab|anz|commonwealth|commbank|kasikorn|kbank|bangkok bank|scb|krungthai|bca|bni|bri|mandiri|bdo|bpi|metrobank|gcash|maya|sbi|hdfc|icici|axis|kotak|mizuho|mufg|smbc|rakuten|japan post|yucho)\b/i)?.[0];
  return out.map((r) => ({ ...r, bank }));
}

export function parseContacts(text: string): ReportDraft["contacts"] {
  if (NONE.test(text) && !/\d{6,}|@/.test(text)) return [];
  const app = text.match(/\b(whatsapp|telegram|line|facebook|messenger|instagram|wechat|viber|signal|sms|text message|phone call|call)\b/i)?.[0];
  const out: { kind: ContactKind; value: string; app?: string }[] = [];
  for (const p of text.match(/\+?\d[\d\s()-]{6,}\d/g) ?? []) out.push({ kind: "phone", value: p.trim(), app });
  for (const h of text.match(/@[a-z0-9._]{3,}/gi) ?? []) out.push({ kind: "handle", value: h, app });
  if (!out.length && app) out.push({ kind: "handle", value: `unknown ${app} account`, app });
  return out;
}

/** A transaction reference: "UTR 412345678901", "Ref No. AB12CD34", a 12-digit UPI reference… */
export function parseRef(text: string, loose = false): string | undefined {
  const labelled = text.match(/\b(?:utr|rrn|ref(?:erence)?(?:\s*(?:no|number|id))?|txn(?:\s*id)?|transaction\s*(?:id|no|number|ref(?:erence)?)?)\s*[:#.-]?\s*(?:is\s+)?([A-Z0-9][A-Z0-9-]{5,29})\b/i);
  if (labelled && /\d/.test(labelled[1])) return labelled[1].toUpperCase();
  if (!loose) return undefined;
  const any = text.match(/\b([A-Z0-9]{8,22})\b/i);
  if (any && /\d{4}/.test(any[1])) return any[1].toUpperCase();
  const utr = text.replace(/(?<=\d)[\s-](?=\d)/g, "").match(/(?<![\d+])(\d{12})(?!\d)/);
  return utr ? utr[1] : undefined;
}

export function isNone(text: string): boolean {
  return NONE.test(text);
}
