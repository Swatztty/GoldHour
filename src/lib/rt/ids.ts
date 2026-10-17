/**
 * Normalising payment identifiers so the same account matches however a victim wrote or said it:
 * "5642-1187-0093", "5642 1187 0093" and "564211870093" are one account;
 * "+60 11-2847 3391" and "011 2847 3391" are one phone.
 */

export type IdKind = "account" | "payid" | "phone" | "handle" | "url" | "email";

const lastDigits = (s: string, n: number) => s.replace(/\D/g, "").slice(-n);

export function normId(kind: IdKind, raw: string): string {
  const v = raw.trim();
  switch (kind) {
    case "account": {
      const alnum = v.replace(/^(a\/?c|acct?|account)\s*(no\.?)?/i, "").replace(/[^a-z0-9]/gi, "");
      return /[a-z]/i.test(alnum) ? alnum.toUpperCase() : alnum;
    }
    case "payid": {
      const s = v.replace(/^(payid|paynow|promptpay|duitnow|fps|uen|upi|gcash|maya)[:\s]*/i, "").trim();
      if (s.includes("@")) return s.toLowerCase();
      const digits = s.replace(/\D/g, "");
      if (digits.length >= 8 && digits.length === s.replace(/[\s-]/g, "").length) return lastDigits(digits, 9);
      return s.replace(/[^a-z0-9]/gi, "").toUpperCase();
    }
    case "phone":
      return lastDigits(v, 9);
    case "handle":
      return v.replace(/^@/, "").toLowerCase();
    case "url":
      return v.replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
    case "email":
      return v.toLowerCase();
  }
}

export function idKey(kind: IdKind, raw: string): string {
  const k = kind === "payid" && !raw.includes("@") && /^\D*\d[\d\s-]{7,}$/.test(raw) ? "phoneish" : kind;
  const group = k === "phoneish" || kind === "phone" ? "num" : kind;
  return `${group}:${normId(kind, raw)}`;
}
