/**
 * Country configuration for JAPAC.
 * Every number and URL here was checked against an official government source (see README "Sources").
 * When a country has no single anti-scam hotline, the victim's bank is the first call.
 */

export type CountryCode = "IN" | "SG" | "AU" | "JP" | "MY" | "ID" | "PH" | "TH" | "HK" | "XX";

export type Lang = "en" | "hi" | "ta" | "zh" | "zh-HK" | "ms" | "id" | "ja" | "th" | "fil";

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  hi: "हिन्दी",
  ta: "தமிழ்",
  zh: "简体中文",
  "zh-HK": "繁體中文",
  ms: "Bahasa Melayu",
  id: "Bahasa Indonesia",
  ja: "日本語",
  th: "ไทย",
  fil: "Filipino",
};

export interface Hotline {
  number: string;
  name: string;
  /** what calling achieves */
  why: string;
}

export interface Region {
  code: CountryCode;
  name: string;
  currency: string;
  locale: string;
  timeZone: string;
  languages: Lang[];
  /** payment rails, used to steer the model */
  rails: string;
  /** first call; undefined means "call your bank" is step 1 */
  hotline?: Hotline;
  /** where to get help after the bank, when the bank is step 1 */
  support?: Hotline;
  portal?: { name: string; url: string; why: string; isPoliceReport: boolean };
  telecom?: { name: string; url: string; why: string };
  emergency: string;
  /** what the official reference is called (acknowledgement no., police report no.) */
  refName: string;
  /** customer protection note for unauthorised debits; omitted where we can't cite one precisely */
  unauthorizedNote?: string;
  policeNote: string;
}

export const REGIONS: Record<CountryCode, Region> = {
  IN: {
    code: "IN",
    name: "India",
    currency: "INR",
    locale: "en-IN",
    timeZone: "Asia/Kolkata",
    languages: ["en", "hi", "ta"],
    rails: "UPI (VPAs like name@okaxis), IMPS, NEFT, RTGS, cards",
    hotline: { number: "1930", name: "National Cyber Crime Helpline", why: "The fastest way to put a hold on the money. Read out the script below." },
    portal: {
      name: "cybercrime.gov.in",
      url: "https://cybercrime.gov.in",
      why: "You’ll get an acknowledgement number that banks and police ask for. Copy each field into the portal.",
      isPoliceReport: false,
    },
    telecom: { name: "Sanchar Saathi (Chakshu)", url: "https://sancharsaathi.gov.in", why: "Flags the scammer’s number so it can be investigated and blocked." },
    emergency: "112",
    refName: "Cybercrime portal acknowledgement number",
    unauthorizedNote:
      "For payments you didn’t approve, reporting to your bank within 3 working days limits your liability under RBI rules.",
    policeNote: "Print this and take it, with your evidence, to the cyber crime police station or your nearest police station.",
  },
  SG: {
    code: "SG",
    name: "Singapore",
    currency: "SGD",
    locale: "en-SG",
    timeZone: "Asia/Singapore",
    languages: ["en", "zh", "ms", "ta"],
    rails: "PayNow (mobile number, NRIC or UEN), FAST, GIRO, cards",
    hotline: {
      number: "1799",
      name: "ScamShield Helpline",
      why: "Available 24/7. It can connect you straight to your bank to stop further transfers.",
    },
    portal: {
      name: "Singapore Police online report",
      url: "https://eservices1.police.gov.sg/phub/eservices/landingpage/police-report",
      why: "Lodge a police report online. Your bank and the police will use the report number.",
      isPoliceReport: true,
    },
    telecom: { name: "ScamShield app", url: "https://www.scamshield.gov.sg", why: "Report the scam messages and numbers so others are protected." },
    emergency: "999",
    refName: "Police report number",
    policeNote: "Call 999 if you need urgent police help.",
  },
  AU: {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    locale: "en-AU",
    timeZone: "Australia/Sydney",
    languages: ["en", "zh"],
    rails: "Osko/NPP, PayID (mobile, email or ABN), BSB and account number, BPAY, cards",
    support: { number: "1800 595 160", name: "IDCARE", why: "Free national support service that helps you make a recovery plan." },
    portal: {
      name: "ReportCyber",
      url: "https://www.cyber.gov.au/report-and-recover/report",
      why: "This is your official police report. Keep the reference number for your bank.",
      isPoliceReport: true,
    },
    telecom: { name: "Scamwatch", url: "https://www.scamwatch.gov.au/report-a-scam", why: "Report the scam so it can be disrupted and others warned." },
    emergency: "000",
    refName: "ReportCyber reference number",
    policeNote: "Call 000 in an emergency.",
  },
  JP: {
    code: "JP",
    name: "Japan",
    currency: "JPY",
    locale: "ja-JP",
    timeZone: "Asia/Tokyo",
    languages: ["ja", "en"],
    rails: "bank transfer (振込: bank, branch, 普通/当座, 7-digit account, katakana name), PayPay and other QR wallets, cards",
    hotline: { number: "110", name: "the police", why: "Report the fraud to the police right away. Tell them it is 特殊詐欺 (special fraud)." },
    emergency: "110",
    refName: "Police report number (受理番号)",
    policeNote: "For advice that isn’t urgent you can also call the police consultation line #9110.",
  },
  MY: {
    code: "MY",
    name: "Malaysia",
    currency: "MYR",
    locale: "en-MY",
    timeZone: "Asia/Kuala_Lumpur",
    languages: ["ms", "en", "zh", "ta"],
    rails: "DuitNow (mobile, IC or account), IBG/Instant Transfer, e-wallets, cards",
    hotline: {
      number: "997",
      name: "National Scam Response Centre (NSRC)",
      why: "Open 24 hours. Call within 24 hours so the receiving accounts can be blocked.",
    },
    emergency: "999",
    refName: "Police report number",
    policeNote: "Lodge a police report at the nearest police station.",
  },
  ID: {
    code: "ID",
    name: "Indonesia",
    currency: "IDR",
    locale: "id-ID",
    timeZone: "Asia/Jakarta",
    languages: ["id", "en"],
    rails: "BI-FAST, transfer antar bank, QRIS, e-wallets (GoPay, OVO, DANA), virtual accounts",
    hotline: { number: "157", name: "OJK contact centre", why: "Report the scam so the Indonesia Anti-Scam Centre can work with banks to block the funds." },
    portal: {
      name: "Indonesia Anti-Scam Centre (IASC)",
      url: "https://iasc.ojk.go.id",
      why: "File the report with screenshots and transfer proof. Keep your ticket number.",
      isPoliceReport: false,
    },
    emergency: "110",
    refName: "IASC ticket number",
    policeNote: "You can also report to your nearest police station.",
  },
  PH: {
    code: "PH",
    name: "Philippines",
    currency: "PHP",
    locale: "en-PH",
    timeZone: "Asia/Manila",
    languages: ["en", "fil"],
    rails: "InstaPay, PESONet, GCash, Maya, bank transfer",
    hotline: {
      number: "1326",
      name: "Inter-Agency Response Center (I-ARC)",
      why: "24/7 government scam hotline that coordinates with police and banks.",
    },
    emergency: "911",
    refName: "I-ARC or police report reference",
    policeNote: "You can also report to the PNP Anti-Cybercrime Group or your nearest police station.",
  },
  TH: {
    code: "TH",
    name: "Thailand",
    currency: "THB",
    locale: "th-TH",
    timeZone: "Asia/Bangkok",
    languages: ["th", "en"],
    rails: "PromptPay (mobile or ID), bank transfer, e-wallets, cards",
    hotline: {
      number: "1441",
      name: "Anti Online Scam Operation Center (AOC 1441)",
      why: "Press 1 to report and request suspension of the receiving accounts.",
    },
    portal: {
      name: "Thai Police Online",
      url: "https://www.thaipoliceonline.com",
      why: "File the online police report. You must meet an investigator within 7 days.",
      isPoliceReport: true,
    },
    emergency: "191",
    refName: "Police Case ID",
    policeNote: "Meet the investigator at your chosen police station within 7 days.",
  },
  HK: {
    code: "HK",
    name: "Hong Kong",
    currency: "HKD",
    locale: "en-HK",
    timeZone: "Asia/Hong_Kong",
    languages: ["zh-HK", "en"],
    rails: "FPS (mobile, email or FPS ID), bank transfer, e-wallets, cards",
    support: { number: "18222", name: "Anti-Scam Helpline", why: "24-hour police advice line for scam victims." },
    emergency: "999",
    refName: "Police report number",
    policeNote: "Report at your nearest police station, or call 999 if it is urgent.",
  },
  XX: {
    code: "XX",
    name: "Another country",
    currency: "USD",
    locale: "en",
    timeZone: "UTC",
    languages: ["en"],
    rails: "bank transfer, instant payments, e-wallets, cards",
    emergency: "your local emergency number",
    refName: "Police report number",
    policeNote: "Report to your local police.",
  },
};

export const REGION_LIST: Region[] = ["IN", "SG", "AU", "JP", "MY", "ID", "PH", "TH", "HK", "XX"].map((c) => REGIONS[c as CountryCode]);

export function regionOf(code?: string): Region {
  return REGIONS[(code as CountryCode) ?? "IN"] ?? REGIONS.IN;
}

const TZ_TO_COUNTRY: Record<string, CountryCode> = {
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Kuching": "MY",
  "Asia/Jakarta": "ID",
  "Asia/Makassar": "ID",
  "Asia/Jayapura": "ID",
  "Asia/Pontianak": "ID",
  "Asia/Manila": "PH",
  "Asia/Bangkok": "TH",
  "Asia/Hong_Kong": "HK",
};

export function detectCountry(): CountryCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.startsWith("Australia/")) return "AU";
    return TZ_TO_COUNTRY[tz] ?? "SG";
  } catch {
    return "SG";
  }
}

/** First call for this country: a national hotline, or the victim's bank. */
export function firstCall(r: Region): { label: string; href?: string; number?: string } {
  return r.hotline ? { label: `Call ${r.hotline.number}`, href: `tel:${r.hotline.number.replace(/[^\d#+]/g, "")}`, number: r.hotline.number } : { label: "Call your bank" };
}
