/**
 * "Check before you pay": warning signs that show up in scam messages across Asia-Pacific.
 * Patterns cover English plus common phrases in Malay/Indonesian, Hindi, Tagalog, Thai, Chinese and Japanese.
 * These are shared by the server (as a fallback when Gemini isn't available) and by tests.
 */

export type Risk = "high" | "medium" | "low";

export interface Flag {
  id: string;
  title: string;
  detail: string;
  /** a flag that on its own makes the message high risk */
  severe?: boolean;
}

interface Rule extends Flag {
  re: RegExp;
}

const RULES: Rule[] = [
  {
    id: "secret-code",
    title: "Asks for a code, PIN or password",
    detail: "No bank, police or company ever needs your one-time code, PIN or password. Anyone who asks is trying to take your money.",
    severe: true,
    re: /\b(otp|one[- ]time (pass)?code|pin\b|cvv|password|verification code|tac\b|kod tac|kode otp|รหัส\s?otp|認証コード|暗証番号|验证码|密码)/i,
  },
  {
    id: "safe-account",
    title: "Tells you to move money to a “safe” account",
    detail: "Real banks and police never ask you to move money to keep it safe. This is the most common way savings are stolen.",
    severe: true,
    re: /(safe(ty)?|secure|protected|holding|verification) account|akaun (keselamatan|selamat)|rekening (aman|penampungan)|บัญชีปลอดภัย|保全口座|安全账户|安全帳戶|सुरक्षित खाते/i,
  },
  {
    id: "authority",
    title: "Claims to be police, a court or a government agency",
    detail: "Officials do not call or message you to demand payment, and they never arrest anyone over a video call.",
    severe: false,
    re: /\b(police|polis|polisi|court|warrant|arrest|cbi|ed officer|customs|narcotics|money laundering|interpol|central bank|bank negara|rbi|mas\b|ojk|dsi|igp)\b|digital arrest|ditangkap|गिरफ्तार|पुलिस|ตำรวจ|警察|検察|公安|海关/i,
  },
  {
    id: "urgency",
    title: "Puts you under time pressure",
    detail: "“Act now or your account will be blocked” is designed to stop you thinking or checking with someone.",
    re: /\b(urgent|immediately|within (24|48) hours|today only|last chance|final notice|account (will be )?(blocked|suspended|frozen)|segera|sekarang juga|turant)\b|तुरंत|ด่วน|至急|立即|马上/i,
  },
  {
    id: "secrecy",
    title: "Tells you to keep it secret",
    detail: "Scammers isolate people. If someone says not to tell your family or bank, stop and tell them.",
    severe: true,
    re: /(don'?t|do not|never) tell (anyone|your (family|bank))|keep (this|it) (secret|confidential)|jangan beritahu|किसी को मत बताना|อย่าบอกใคร|誰にも(話さ|言わ)ない|不要告诉/i,
  },
  {
    id: "remote",
    title: "Asks you to install an app or share your screen",
    detail: "Apps like AnyDesk or TeamViewer, or an unknown .apk file, let scammers control your phone and bank app.",
    severe: true,
    re: /\b(anydesk|teamviewer|rustdesk|quicksupport|screen ?share|install (this|the) app|\.apk)\b/i,
  },
  {
    id: "task-job",
    title: "Easy money for simple tasks",
    detail: "Paid “like, review or rate” jobs that later ask you to deposit money are task scams. Real jobs never ask you to pay.",
    re: /\b(part[- ]time|work from home|daily (income|salary)|earn (rs|₹|rm|₱|\$)?\s?\d+|commission|like (videos|and subscribe)|rate (hotels|products)|review tasks?|task (job|reward))\b|kerja sampingan|ghar baithe|घर बैठे/i,
  },
  {
    id: "investment",
    title: "Promises guaranteed or very high returns",
    detail: "No real investment guarantees profit. Celebrity endorsements and “VIP groups” are usually fake.",
    re: /\b(guaranteed (return|profit)|double your money|\d{2,3}% (return|profit)|crypto|usdt|forex signal|vip (group|investment)|trading mentor)\b|pelaburan|投資|投资/i,
  },
  {
    id: "pay-to-receive",
    title: "Asks you to pay to receive money",
    detail: "Fees, taxes or deposits to unlock a prize, loan, refund or parcel are a classic trick.",
    re: /\b(processing fee|clearance (fee|tax)|unlock (your )?(earnings|withdrawal)|release (your )?(funds|parcel)|customs (fee|duty)|you (have )?won|lucky draw|prize|lottery|refund fee)\b|bayar (pajak|cukai)|手数料/i,
  },
  {
    id: "gift-card",
    title: "Wants payment in gift cards or crypto",
    detail: "Gift cards, crypto and cash deposits can't be traced or reversed, which is why scammers ask for them.",
    severe: true,
    re: /\b(gift ?cards?|google play cards?|steam cards?|itunes|bitcoin|btc|usdt|crypto wallet|bitcoin atm)\b|電子マネー|プリペイドカード/i,
  },
  {
    id: "link",
    title: "Contains a link",
    detail: "Don’t open links in unexpected messages. Type your bank’s address yourself or use its official app.",
    re: /(https?:\/\/|www\.|\b(bit\.ly|tinyurl|t\.co|cutt\.ly|rb\.gy|is\.gd)\/)|\b[a-z0-9-]+\.(xyz|top|info|online|site|click|shop|live|vip|icu)\b/i,
  },
  {
    id: "kyc",
    title: "Says your account needs updating or verifying",
    detail: "“Update your KYC” or “verify your account” messages lead to fake bank pages that steal your login.",
    re: /\b(kyc|update (your )?(details|account|pan)|verify your (account|identity)|account (has been )?(locked|restricted)|e-?kyc)\b/i,
  },
  {
    id: "family",
    title: "A “family member” with a new number needs money",
    detail: "“Hi Mum, I lost my phone” scams are common. Call the person on their old number before you send anything.",
    re: /\b(hi (mum|mom|dad|ma|pa)|new number|lost my phone|changed my number)\b|オレオレ|俺だけど/i,
  },
];

export function ruleFlags(text: string): Flag[] {
  return RULES.filter((r) => r.re.test(text)).map(({ re: _re, ...f }) => {
    void _re;
    return f;
  });
}

export function riskFrom(flags: Flag[], networkHits: number): Risk {
  if (networkHits > 0) return "high";
  if (flags.some((f) => f.severe) || flags.length >= 2) return "high";
  if (flags.length === 1) return "medium";
  return "low";
}

/** Phone numbers, account numbers, payment IDs, handles and links found in free text. */
export function findIdentifiers(text: string): { kind: "number" | "payid" | "handle" | "url" | "email"; value: string }[] {
  const out: { kind: "number" | "payid" | "handle" | "url" | "email"; value: string }[] = [];
  const seen = new Set<string>();
  const push = (kind: (typeof out)[number]["kind"], value: string) => {
    const v = value.trim().replace(/[.,;:)]+$/, "");
    const k = `${kind}:${v.toLowerCase()}`;
    if (v && !seen.has(k)) {
      seen.add(k);
      out.push({ kind, value: v });
    }
  };
  for (const m of text.matchAll(/https?:\/\/\S+|www\.\S+/gi)) push("url", m[0]);
  for (const m of text.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) push("email", m[0]);
  for (const m of text.matchAll(/(?<![\w@])[\w.-]{2,}@[a-z]{2,}(?![\w.])/gi)) if (!/\.[a-z]{2,}$/i.test(m[0])) push("payid", m[0]);
  for (const m of text.matchAll(/(?<![\w])@[a-z0-9_.]{3,}/gi)) push("handle", m[0]);
  for (const m of text.matchAll(/\+?\d[\d\s-]{5,}\d/g)) {
    if (m[0].replace(/\D/g, "").length >= 6) push("number", m[0]);
  }
  // A bare handle or ID typed on its own, e.g. "keishicho.sato"
  const bare = text.trim();
  if (!out.length && /^[a-z][a-z0-9_.]{3,}$/i.test(bare)) push("handle", bare);
  return out.slice(0, 8);
}
