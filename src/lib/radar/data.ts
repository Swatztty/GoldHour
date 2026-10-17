/**
 * Demo network for the Golden Hour console. Every person, account, number and amount here is fictional.
 * Coordinates are [longitude, latitude].
 */

export type EntityKind = "account" | "phone" | "handle" | "payid";

export interface Entity {
  id: string;
  kind: EntityKind;
  label: string;
  /** bank, app or network */
  where: string;
  country: string;
  at: [number, number];
}

export interface Report {
  id: string;
  ring: string;
  city: string;
  country: string;
  at: [number, number];
  minutesAgo: number;
  amount: number;
  currency: string;
  usd: number;
  /** entity ids this report paid or was contacted from */
  paidTo: string[];
  contactedBy: string[];
  /** a line from the scam script, as the victim reported it */
  script: string;
}

export interface Evidence {
  kind: "account" | "contact" | "script";
  text: string;
  victims: number;
}

export interface Ring {
  id: string;
  name: string;
  /** what the scam is, one line */
  pattern: string;
  evidence: Evidence[];
}

export const RINGS: Ring[] = [
  {
    id: "r1",
    name: "Fake officials",
    pattern: "Callers pose as police or the central bank and move savings into a “safety account”.",
    evidence: [
      { kind: "account", text: "Maybank account 5642 1187 0093 received money from victims in Singapore, Malaysia and Thailand", victims: 4 },
      { kind: "contact", text: "The same caller, +60 11-2847 3391, phoned victims in Malaysia and Singapore", victims: 3 },
      {
        kind: "script",
        text: "Gemini matched the same script in English, Malay and Thai: “transfer to the safety account for verification, it will be returned in 24 hours”",
        victims: 6,
      },
    ],
  },
  {
    id: "r2",
    name: "Paid task jobs",
    pattern: "Recruiters offer paid review tasks, then demand growing deposits to unlock earnings.",
    evidence: [
      { kind: "contact", text: "One Telegram recruiter, @priya_hr_tasks, approached victims in India, the Philippines and Indonesia", victims: 5 },
      { kind: "account", text: "BCA account 8830 2241 77 collected the final “tax clearance” payments", victims: 3 },
      { kind: "script", text: "Same reward ladder in every chat: ₹150, ₱150, Rp 50.000 for the first three tasks", victims: 6 },
    ],
  },
  {
    id: "r3",
    name: "Bank “safe account”",
    pattern: "Texts spoofed into the bank’s own thread send victims to a fake fraud team.",
    evidence: [
      { kind: "contact", text: "The same callback number, 02 8188 5521, appears in every text", victims: 4 },
      { kind: "account", text: "PayID 0412 555 019 received transfers from Sydney, Brisbane and Perth", victims: 3 },
    ],
  },
  {
    id: "r4",
    name: "ニセ警察 (fake police)",
    pattern: "LINE callers pose as Tokyo police and move savings to “asset protection” accounts.",
    evidence: [
      { kind: "account", text: "Rakuten Bank account 7254018 received money from Tokyo and Osaka", victims: 3 },
      { kind: "script", text: "Gemini matched “保全口座” (asset protection account) across all three chats", victims: 3 },
    ],
  },
];

export const ENTITIES: Entity[] = [
  // r1
  { id: "e-maybank", kind: "account", label: "5642 1187 0093", where: "Maybank", country: "Malaysia", at: [102.6, 4.4] },
  { id: "e-ocbc", kind: "account", label: "601-482917-001", where: "OCBC", country: "Singapore", at: [104.9, 0.4] },
  { id: "e-ph-my", kind: "phone", label: "+60 11-2847 3391", where: "Mobile", country: "Malaysia", at: [101.0, 1.6] },
  { id: "e-kbank", kind: "account", label: "042-8-77301-9", where: "Kasikornbank", country: "Thailand", at: [101.8, 14.9] },
  // r2
  { id: "e-tg", kind: "handle", label: "@priya_hr_tasks", where: "Telegram", country: "Unknown", at: [96.0, 8.5] },
  { id: "e-bca", kind: "account", label: "8830 2241 77", where: "BCA", country: "Indonesia", at: [108.6, -4.6] },
  { id: "e-gcash", kind: "payid", label: "0917 482 1190", where: "GCash", country: "Philippines", at: [122.6, 13.0] },
  { id: "e-upi", kind: "payid", label: "task.reward88@ybl", where: "UPI, Yes Bank", country: "India", at: [75.2, 16.2] },
  // r3
  { id: "e-au-ph", kind: "phone", label: "02 8188 5521", where: "Mobile", country: "Australia", at: [149.0, -30.4] },
  { id: "e-payid", kind: "payid", label: "0412 555 019", where: "PayID, Westpac", country: "Australia", at: [138.5, -31.0] },
  // r4
  { id: "e-rakuten", kind: "account", label: "7254018", where: "Rakuten Bank", country: "Japan", at: [137.2, 36.9] },
  { id: "e-line", kind: "handle", label: "keishicho.sato", where: "LINE", country: "Japan", at: [140.8, 37.8] },
];

export const REPORTS: Report[] = [
  // r1, fake officials
  { id: "p1", ring: "r1", city: "Singapore", country: "Singapore", at: [103.82, 1.35], minutesAgo: 41, amount: 24500, currency: "SGD", usd: 18900, paidTo: ["e-ocbc", "e-maybank"], contactedBy: ["e-ph-my"], script: "Transfer to the MAS safety account for verification." },
  { id: "p2", ring: "r1", city: "Kuala Lumpur", country: "Malaysia", at: [101.69, 3.14], minutesAgo: 66, amount: 58000, currency: "MYR", usd: 13200, paidTo: ["e-maybank"], contactedBy: ["e-ph-my"], script: "Pindahkan ke akaun keselamatan untuk pengesahan." },
  { id: "p3", ring: "r1", city: "Penang", country: "Malaysia", at: [100.33, 5.41], minutesAgo: 95, amount: 31000, currency: "MYR", usd: 7000, paidTo: ["e-maybank"], contactedBy: ["e-ph-my"], script: "Akaun keselamatan, wang dipulangkan dalam 24 jam." },
  { id: "p4", ring: "r1", city: "Bangkok", country: "Thailand", at: [100.5, 13.75], minutesAgo: 128, amount: 410000, currency: "THB", usd: 12100, paidTo: ["e-kbank", "e-maybank"], contactedBy: [], script: "โอนเข้าบัญชีปลอดภัยเพื่อตรวจสอบ" },
  { id: "p5", ring: "r1", city: "Hong Kong", country: "Hong Kong", at: [114.17, 22.32], minutesAgo: 180, amount: 96000, currency: "HKD", usd: 12300, paidTo: ["e-ocbc"], contactedBy: [], script: "Move your savings to the safety account for checking." },
  { id: "p6", ring: "r1", city: "Kota Kinabalu", country: "Malaysia", at: [116.07, 5.98], minutesAgo: 230, amount: 27500, currency: "MYR", usd: 6300, paidTo: ["e-ocbc"], contactedBy: [], script: "It will be returned within 24 hours after verification." },
  // r2, task jobs
  { id: "q1", ring: "r2", city: "Mumbai", country: "India", at: [72.88, 19.08], minutesAgo: 52, amount: 50200, currency: "INR", usd: 600, paidTo: ["e-upi"], contactedBy: ["e-tg"], script: "VIP merchant task: pay ₹2,000, get ₹2,800 back." },
  { id: "q2", ring: "r2", city: "Bengaluru", country: "India", at: [77.59, 12.97], minutesAgo: 140, amount: 212000, currency: "INR", usd: 2540, paidTo: ["e-upi", "e-bca"], contactedBy: ["e-tg"], script: "Pay tax clearance to release your withdrawal." },
  { id: "q3", ring: "r2", city: "Manila", country: "Philippines", at: [120.98, 14.6], minutesAgo: 75, amount: 86000, currency: "PHP", usd: 1500, paidTo: ["e-gcash"], contactedBy: ["e-tg"], script: "Rate 3 hotels, earn ₱150 each." },
  { id: "q4", ring: "r2", city: "Cebu", country: "Philippines", at: [123.89, 10.32], minutesAgo: 210, amount: 42000, currency: "PHP", usd: 730, paidTo: ["e-gcash", "e-bca"], contactedBy: ["e-tg"], script: "Your account is frozen, pay to unlock." },
  { id: "q5", ring: "r2", city: "Jakarta", country: "Indonesia", at: [106.85, -6.21], minutesAgo: 33, amount: 38500000, currency: "IDR", usd: 2350, paidTo: ["e-bca"], contactedBy: ["e-tg"], script: "Bayar pajak untuk mencairkan saldo Anda." },
  // r3, safe account
  { id: "s1", ring: "r3", city: "Sydney", country: "Australia", at: [151.21, -33.87], minutesAgo: 47, amount: 34300, currency: "AUD", usd: 22600, paidTo: ["e-payid"], contactedBy: ["e-au-ph"], script: "Move your money to a safe account while we stop the hackers." },
  { id: "s2", ring: "r3", city: "Brisbane", country: "Australia", at: [153.03, -27.47], minutesAgo: 118, amount: 19800, currency: "AUD", usd: 13000, paidTo: ["e-payid"], contactedBy: ["e-au-ph"], script: "Your account is compromised, use the safe account." },
  { id: "s3", ring: "r3", city: "Perth", country: "Australia", at: [115.86, -31.95], minutesAgo: 260, amount: 12400, currency: "AUD", usd: 8200, paidTo: ["e-payid"], contactedBy: ["e-au-ph"], script: "Fraud team: transfer to the protected account." },
  { id: "s4", ring: "r3", city: "Melbourne", country: "Australia", at: [144.96, -37.81], minutesAgo: 300, amount: 6100, currency: "AUD", usd: 4000, paidTo: [], contactedBy: ["e-au-ph"], script: "Call our fraud team on the number in this text." },
  // r4, Japan
  { id: "j1", ring: "r4", city: "Tokyo", country: "Japan", at: [139.69, 35.69], minutesAgo: 28, amount: 2450000, currency: "JPY", usd: 16300, paidTo: ["e-rakuten"], contactedBy: ["e-line"], script: "資産を保全口座に移してください。" },
  { id: "j2", ring: "r4", city: "Osaka", country: "Japan", at: [135.5, 34.69], minutesAgo: 155, amount: 1200000, currency: "JPY", usd: 8000, paidTo: ["e-rakuten"], contactedBy: ["e-line"], script: "保全口座に振り込めば、確認後に返金します。" },
  { id: "j3", ring: "r4", city: "Nagoya", country: "Japan", at: [136.91, 35.18], minutesAgo: 240, amount: 800000, currency: "JPY", usd: 5300, paidTo: ["e-rakuten"], contactedBy: ["e-line"], script: "誰にも話さないでください。保全口座へ。" },
];

/** The report a judge triggers with “Run live demo”. */
export const INCOMING: Report = {
  id: "live1",
  ring: "r1",
  city: "Melaka",
  country: "Malaysia",
  at: [102.25, 2.19],
  minutesAgo: 0,
  amount: 22000,
  currency: "MYR",
  usd: 5000,
  paidTo: ["e-maybank"],
  contactedBy: ["e-ph-my"],
  script: "Pindahkan simpanan ke akaun keselamatan Bank Negara.",
};

export const COUNTRY_LABELS: { name: string; at: [number, number] }[] = [
  { name: "India", at: [78.5, 22.5] },
  { name: "Thailand", at: [101.0, 16.6] },
  { name: "Malaysia", at: [113.8, 3.4] },
  { name: "Singapore", at: [104.2, 2.6] },
  { name: "Indonesia", at: [115.0, -1.8] },
  { name: "Philippines", at: [124.6, 16.5] },
  { name: "Hong Kong", at: [115.2, 23.7] },
  { name: "Japan", at: [138.0, 39.6] },
  { name: "Australia", at: [133.0, -24.0] },
];
