/**
 * Offline lookup tables used by the agent's tools.
 * UPI handles identify the PSP bank that issued the VPA; IFSC prefixes identify the bank.
 * These identify the bank to contact; they are not a guarantee of where funds now sit.
 */

interface HandleInfo {
  bank: string;
  app?: string;
}

const UPI_HANDLES: Record<string, HandleInfo> = {
  okaxis: { bank: "Axis Bank", app: "Google Pay" },
  okhdfcbank: { bank: "HDFC Bank", app: "Google Pay" },
  okicici: { bank: "ICICI Bank", app: "Google Pay" },
  oksbi: { bank: "State Bank of India", app: "Google Pay" },
  okbizaxis: { bank: "Axis Bank", app: "Google Pay for Business" },
  ybl: { bank: "Yes Bank", app: "PhonePe" },
  ibl: { bank: "ICICI Bank", app: "PhonePe" },
  axl: { bank: "Axis Bank", app: "PhonePe" },
  paytm: { bank: "Paytm Payments Bank", app: "Paytm" },
  ptyes: { bank: "Yes Bank", app: "Paytm" },
  ptaxis: { bank: "Axis Bank", app: "Paytm" },
  pthdfc: { bank: "HDFC Bank", app: "Paytm" },
  ptsbi: { bank: "State Bank of India", app: "Paytm" },
  apl: { bank: "Axis Bank", app: "Amazon Pay" },
  yapl: { bank: "Yes Bank", app: "Amazon Pay" },
  rapl: { bank: "RBL Bank", app: "Amazon Pay" },
  waaxis: { bank: "Axis Bank", app: "WhatsApp Pay" },
  wahdfcbank: { bank: "HDFC Bank", app: "WhatsApp Pay" },
  waicici: { bank: "ICICI Bank", app: "WhatsApp Pay" },
  wasbi: { bank: "State Bank of India", app: "WhatsApp Pay" },
  axisb: { bank: "Axis Bank", app: "CRED" },
  freecharge: { bank: "Axis Bank", app: "Freecharge" },
  jupiteraxis: { bank: "Axis Bank", app: "Jupiter" },
  upi: { bank: "Bank linked via BHIM (check the transaction details)", app: "BHIM" },
  axisbank: { bank: "Axis Bank" },
  axis: { bank: "Axis Bank" },
  hdfcbank: { bank: "HDFC Bank" },
  hdfcbankjd: { bank: "HDFC Bank" },
  icici: { bank: "ICICI Bank" },
  sbi: { bank: "State Bank of India" },
  kotak: { bank: "Kotak Mahindra Bank" },
  kmbl: { bank: "Kotak Mahindra Bank" },
  pnb: { bank: "Punjab National Bank" },
  barodampay: { bank: "Bank of Baroda" },
  federal: { bank: "Federal Bank" },
  fbl: { bank: "Federal Bank" },
  idfcbank: { bank: "IDFC FIRST Bank" },
  idfcfirst: { bank: "IDFC FIRST Bank" },
  indus: { bank: "IndusInd Bank" },
  yesbank: { bank: "Yes Bank" },
  aubank: { bank: "AU Small Finance Bank" },
  cnrb: { bank: "Canara Bank" },
  unionbankofindia: { bank: "Union Bank of India" },
  unionbank: { bank: "Union Bank of India" },
  boi: { bank: "Bank of India" },
  iob: { bank: "Indian Overseas Bank" },
  indianbank: { bank: "Indian Bank" },
  airtel: { bank: "Airtel Payments Bank", app: "Airtel Thanks" },
  jio: { bank: "Jio Payments Bank" },
  rbl: { bank: "RBL Bank" },
  dbs: { bank: "DBS Bank India" },
  equitas: { bank: "Equitas Small Finance Bank" },
  ujjivan: { bank: "Ujjivan Small Finance Bank" },
  fino: { bank: "Fino Payments Bank" },
  postbank: { bank: "India Post Payments Bank" },
  cub: { bank: "City Union Bank" },
  tmb: { bank: "Tamilnad Mercantile Bank" },
  kvb: { bank: "Karur Vysya Bank" },
  sib: { bank: "South Indian Bank" },
};

const IFSC_PREFIX: Record<string, string> = {
  SBIN: "State Bank of India",
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
  BKID: "Bank of India",
  IOBA: "Indian Overseas Bank",
  IDIB: "Indian Bank",
  MAHB: "Bank of Maharashtra",
  YESB: "Yes Bank",
  IDFB: "IDFC FIRST Bank",
  INDB: "IndusInd Bank",
  FDRL: "Federal Bank",
  AUBL: "AU Small Finance Bank",
  PYTM: "Paytm Payments Bank",
  AIRP: "Airtel Payments Bank",
  RATN: "RBL Bank",
  KARB: "Karnataka Bank",
  CIUB: "City Union Bank",
  TMBL: "Tamilnad Mercantile Bank",
  KVBL: "Karur Vysya Bank",
  SIBL: "South Indian Bank",
  DCBL: "DCB Bank",
  BDBL: "Bandhan Bank",
  ESFB: "Equitas Small Finance Bank",
  UJVN: "Ujjivan Small Finance Bank",
  JIOP: "Jio Payments Bank",
  FINO: "Fino Payments Bank",
  IPOS: "India Post Payments Bank",
  CSBK: "CSB Bank",
  DLXB: "Dhanlaxmi Bank",
  UCBA: "UCO Bank",
  PSIB: "Punjab & Sind Bank",
  CBIN: "Central Bank of India",
};

export interface Resolution {
  identifier: string;
  kind: "vpa" | "ifsc" | "account" | "unknown";
  bank?: string;
  app?: string;
  confidence: "high" | "medium" | "low";
  note: string;
}

const VPA_RE = /^[a-z0-9._-]{2,256}@[a-z]{2,64}$/i;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function resolveIdentifier(raw: string): Resolution {
  const identifier = raw.trim();
  if (VPA_RE.test(identifier)) {
    const handle = identifier.split("@")[1].toLowerCase();
    const info = UPI_HANDLES[handle];
    if (info) {
      return {
        identifier,
        kind: "vpa",
        bank: info.bank,
        app: info.app,
        confidence: info.bank.startsWith("Bank linked") ? "low" : "high",
        note: `UPI handle @${handle} is issued by ${info.bank}${info.app ? ` (used by ${info.app})` : ""}.`,
      };
    }
    return {
      identifier,
      kind: "vpa",
      confidence: "low",
      note: `UPI handle @${handle} is not in the offline table. The bank name appears in the payer's transaction details.`,
    };
  }
  const upper = identifier.toUpperCase();
  if (IFSC_RE.test(upper)) {
    const bank = IFSC_PREFIX[upper.slice(0, 4)];
    return {
      identifier: upper,
      kind: "ifsc",
      bank,
      confidence: bank ? "high" : "low",
      note: bank ? `IFSC ${upper} belongs to ${bank}.` : `IFSC prefix ${upper.slice(0, 4)} is not in the offline table.`,
    };
  }
  if (/^[0-9X*]{6,20}$/i.test(identifier.replace(/\s/g, ""))) {
    return {
      identifier,
      kind: "account",
      confidence: "low",
      note: "Bank account number. The bank is identified by the IFSC code shown with it.",
    };
  }
  return { identifier, kind: "unknown", confidence: "low", note: "Not a UPI ID, IFSC or account number." };
}

export function bankFromIfsc(ifsc?: string): string | undefined {
  if (!ifsc) return undefined;
  return IFSC_PREFIX[ifsc.toUpperCase().slice(0, 4)];
}
