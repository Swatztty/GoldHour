/**
 * Sample cases for demo mode, one per country. Everything here is fictional: the people,
 * phone numbers, payment IDs and account numbers are invented so judges can test without a real scam.
 * The screenshots in /public/samples are rendered from these same transcripts (scripts/render_samples.py).
 */
import type { CountryCode, Lang } from "./regions";

export interface SampleCase {
  id: string;
  country: CountryCode;
  title: string;
  blurb: string;
  /** language the sample is best shown in */
  lang: Lang;
  images: { src: string; alt: string }[];
  /** minutes before "now" that the first payment happened, used to keep the clock live */
  firstOffsetMin: number;
  transcript: string;
  cached: Record<string, unknown>;
}

export const SAMPLES: SampleCase[] = [
  {
    id: "sg-official",
    country: "SG",
    title: "Fake police officer",
    blurb: "A caller posing as Singapore Police moved S$24,500 into a “safety account”.",
    lang: "en",
    firstOffsetMin: 22,
    images: [
      { src: "/samples/sg-official-chat.png", alt: "WhatsApp chat with a fake police inspector" },
      { src: "/samples/sg-official-bank.png", alt: "Two bank transfer alerts" },
    ],
    transcript: `WhatsApp chat with "Insp. Daniel Koh (SPF)" (+65 8734 2190)
This is Inspector Koh from the Singapore Police Force. Your bank account is linked to a money laundering case, ref CAD/2026/88412.
To clear your name, transfer your savings to the MAS safety account for verification. It will be returned within 24 hours. Do not tell your family, this is confidential.
Account: OCBC 601-482917-001, name LX Global Trading Pte Ltd
Second part by PayNow to UEN 202498765K
Me: Done. Please check.

SMS from DBS:
DBS: You have sent SGD 18,000.00 via FAST to LX GLOBAL TRADING PTE LTD (OCBC 601-482917-001) on 15 Oct 14:06. Ref FT26288143022.
DBS: You have sent SGD 6,500.00 via PayNow to UEN 202498765K (KH SOLUTIONS) on 15 Oct 14:28. Ref PN26288151877.`,
    cached: {
      currency: "SGD",
      scamType: "digital_arrest",
      scamLabel: "Government official impersonation scam",
      summary:
        "Someone posing as a Singapore Police inspector said your account was linked to money laundering and made you move your savings to a fake “MAS safety account”.",
      victimBank: "DBS Bank",
      unauthorized: false,
      transactions: [
        {
          amount: 18000,
          datetime: "2026-10-15T14:06:00+08:00",
          method: "INSTANT",
          fromBank: "DBS Bank",
          toAccount: "601-482917-001",
          toBank: "OCBC Bank",
          toName: "LX Global Trading Pte Ltd",
          reference: "FT26288143022",
        },
        {
          amount: 6500,
          datetime: "2026-10-15T14:28:00+08:00",
          method: "INSTANT",
          fromBank: "DBS Bank",
          toVpa: "UEN 202498765K",
          toName: "KH Solutions",
          reference: "PN26288151877",
        },
      ],
      suspect: {
        phones: ["+65 8734 2190"],
        upiIds: ["UEN 202498765K"],
        accounts: ["601-482917-001"],
        urls: [],
        names: ["Insp. Daniel Koh (SPF)", "LX Global Trading Pte Ltd", "KH Solutions"],
        apps: ["WhatsApp"],
        emails: [],
      },
      redFlags: [
        "Police and MAS never ask you to transfer money to “verify” it or to a “safety account”.",
        "Government officials don’t contact you on WhatsApp about criminal cases.",
        "Being told to keep it secret from your family is a pressure tactic.",
        "The “MAS account” belongs to a private company at an ordinary bank.",
      ],
      missingInfo: [],
      confidence: 0.93,
    },
  },
  {
    id: "au-safe-account",
    country: "AU",
    title: "“Safe account” bank scam",
    blurb: "A fake bank fraud team talked a customer into moving A$34,300 to a “safe account”.",
    lang: "en",
    firstOffsetMin: 35,
    images: [
      { src: "/samples/au-safe-account-sms.png", alt: "Fake bank security SMS" },
      { src: "/samples/au-safe-account-bank.png", alt: "Two payment confirmations" },
    ],
    transcript: `SMS from "NAB" (in the same thread as real bank messages):
NAB: A new device in Perth has logged in to your account. If this was not you, call our fraud team on 02 8188 5521.
Me: I called. They said hackers are in my account and I must move my money to a safe account.

NAB payment confirmations:
Transfer successful. $24,500.00 to M NGUYEN, BSB 033-201, Account 4417 2290. Description: SAFE ACCT. Receipt N1015-77210443. 15 Oct 2026 10:42am
Osko payment sent. $9,800.00 to PayID 0412 555 019 (J PATEL). Receipt N1015-77213108. 15 Oct 2026 11:05am`,
    cached: {
      currency: "AUD",
      scamType: "impersonation",
      scamLabel: "Bank impersonation “safe account” scam",
      summary:
        "A text that looked like it came from your bank sent you to a fake fraud team, who convinced you to move your savings to a “safe account” they control.",
      victimBank: "NAB",
      unauthorized: false,
      transactions: [
        {
          amount: 24500,
          datetime: "2026-10-15T10:42:00+11:00",
          method: "TRANSFER",
          fromBank: "NAB",
          toAccount: "4417 2290",
          toIfsc: "033-201",
          toBank: "Westpac",
          toName: "M Nguyen",
          reference: "N1015-77210443",
        },
        {
          amount: 9800,
          datetime: "2026-10-15T11:05:00+11:00",
          method: "INSTANT",
          fromBank: "NAB",
          toVpa: "PayID 0412 555 019",
          toName: "J Patel",
          reference: "N1015-77213108",
        },
      ],
      suspect: {
        phones: ["02 8188 5521", "0412 555 019"],
        upiIds: ["PayID 0412 555 019"],
        accounts: ["033-201 4417 2290"],
        urls: [],
        names: ["Fake NAB fraud team", "M Nguyen", "J Patel"],
        apps: ["SMS"],
        emails: [],
      },
      redFlags: [
        "Banks never ask you to move money to a “safe account”.",
        "Scammers can make texts appear in the same thread as your real bank’s messages.",
        "The “fraud team” number came from the text itself, not from your card or the bank’s website.",
      ],
      missingInfo: [],
      confidence: 0.91,
    },
  },
  {
    id: "jp-fake-police",
    country: "JP",
    title: "ニセ警察詐欺 (fake police, Japanese)",
    blurb: "Japanese-language chat and bank alerts: ¥2.45 million sent to “asset protection” accounts.",
    lang: "ja",
    firstOffsetMin: 14,
    images: [
      { src: "/samples/jp-fake-police-chat.png", alt: "LINE chat in Japanese with a fake police officer" },
      { src: "/samples/jp-fake-police-bank.png", alt: "Two Japanese bank transfer notifications" },
    ],
    transcript: `LINE chat with "警視庁 捜査二課 佐藤" (03-6812-4470)
警視庁捜査二課の佐藤です。あなたの口座がマネーロンダリング事件に使われています。
逮捕を避けるため、資産を保全口座に移してください。確認後すぐに返金されます。このことは誰にも話さないでください。
振込先：みずほ銀行 新宿支店 普通 3812274 名義 カ）ホゼンカンリ
2回目：楽天銀行 第一営業支店 普通 7254018 名義 タナカ ケンジ
Me: 振り込みました。

三井住友銀行 notifications:
【三井住友銀行】お振込を受け付けました。振込先：みずほ銀行 新宿支店 普通 3812274 カ）ホゼンカンリ 金額：1,800,000円 受付番号：20261015-0047721 10月15日 13:52
【三井住友銀行】お振込を受け付けました。振込先：楽天銀行 第一営業支店 普通 7254018 タナカ ケンジ 金額：650,000円 受付番号：20261015-0051308 10月15日 14:20`,
    cached: {
      currency: "JPY",
      scamType: "digital_arrest",
      scamLabel: "Fake police scam (ニセ警察詐欺)",
      summary:
        "Someone posing as a Tokyo Metropolitan Police detective claimed your account was used for money laundering and made you transfer your savings to “asset protection” accounts.",
      victimBank: "SMBC (三井住友銀行)",
      unauthorized: false,
      transactions: [
        {
          amount: 1800000,
          datetime: "2026-10-15T13:52:00+09:00",
          method: "TRANSFER",
          fromBank: "SMBC (三井住友銀行)",
          toAccount: "3812274",
          toBank: "Mizuho Bank, Shinjuku branch (みずほ銀行 新宿支店)",
          toName: "カ）ホゼンカンリ",
          reference: "20261015-0047721",
        },
        {
          amount: 650000,
          datetime: "2026-10-15T14:20:00+09:00",
          method: "TRANSFER",
          fromBank: "SMBC (三井住友銀行)",
          toAccount: "7254018",
          toBank: "Rakuten Bank, Daiichi Eigyo branch (楽天銀行 第一営業支店)",
          toName: "タナカ ケンジ",
          reference: "20261015-0051308",
        },
      ],
      suspect: {
        phones: ["03-6812-4470"],
        upiIds: [],
        accounts: ["3812274", "7254018"],
        urls: [],
        names: ["警視庁 捜査二課 佐藤 (fake)", "カ）ホゼンカンリ", "タナカ ケンジ"],
        apps: ["LINE"],
        emails: [],
      },
      redFlags: [
        "Japanese police never contact you on LINE or ask you to transfer money.",
        "There is no such thing as a police “asset protection account” (保全口座).",
        "Being told not to tell anyone is a classic pressure tactic.",
        "The money went to personal and company accounts at ordinary banks.",
      ],
      missingInfo: [],
      confidence: 0.92,
    },
  },
  {
    id: "in-digital-arrest",
    country: "IN",
    title: "“Digital arrest”",
    blurb: "A caller posing as Mumbai Cyber Crime made a retiree move ₹1.5 lakh to “verify” it.",
    lang: "en",
    firstOffsetMin: 18,
    images: [
      { src: "/samples/digital-arrest-chat.png", alt: "WhatsApp chat with a fake cyber crime officer" },
      { src: "/samples/digital-arrest-sms.png", alt: "Two bank debit SMS messages" },
    ],
    transcript: `WhatsApp chat with "Insp. R. Sharma – Mumbai Cyber Cell" (+91 98201 44716)
This is Mumbai Cyber Crime Branch. A courier parcel booked on your Aadhaar contains 5 passports and MDMA. FIR No. MH/CYB/2219/2026 is registered against you.
You are under digital arrest. Do not disconnect the video call or inform anyone. This is a matter of national security.
To prove your funds are legal, transfer your savings to the RBI verification account. Amount will be refunded within 2 hours after verification.
Account name: VERIFICATION SERVICES, A/c 50200087345521, IFSC HDFC0004127
Second part send by UPI: rbi.verify.cell@okaxis
Me: Done sir. Please don't arrest me.

SMS from SBI:
Dear Customer, your A/c XX4821 is debited by Rs.95,000.00 on 15-Oct-26 02:12 PM by IMPS to A/c 50200087345521 (HDFC0004127) VERIFICATION SERVICES. IMPS Ref No 628814402917. If not done by you, report immediately.
Dear Customer, your A/c XX4821 is debited by Rs.54,998.00 on 15-Oct-26 02:31 PM via UPI to rbi.verify.cell@okaxis. UPI Ref 628815093364.`,
    cached: {
      currency: "INR",
      scamType: "digital_arrest",
      scamLabel: "Fake police or “digital arrest” scam",
      summary:
        "Someone posing as a Mumbai Cyber Crime officer claimed a parcel in your name held drugs and fake passports, kept you on a video call, and made you transfer your savings to a fake “RBI verification” account.",
      victimBank: "State Bank of India",
      victimAccount: "XX4821",
      unauthorized: false,
      transactions: [
        {
          amount: 95000,
          datetime: "2026-10-15T14:12:00+05:30",
          method: "IMPS",
          fromBank: "State Bank of India",
          fromAccount: "XX4821",
          toAccount: "50200087345521",
          toIfsc: "HDFC0004127",
          toName: "VERIFICATION SERVICES",
          reference: "628814402917",
        },
        {
          amount: 54998,
          datetime: "2026-10-15T14:31:00+05:30",
          method: "UPI",
          fromBank: "State Bank of India",
          fromAccount: "XX4821",
          toVpa: "rbi.verify.cell@okaxis",
          reference: "628815093364",
        },
      ],
      suspect: {
        phones: ["+91 98201 44716"],
        upiIds: ["rbi.verify.cell@okaxis"],
        accounts: ["50200087345521"],
        urls: [],
        names: ["Insp. R. Sharma", "VERIFICATION SERVICES"],
        apps: ["WhatsApp"],
        emails: [],
      },
      redFlags: [
        "Real police never arrest anyone over a video call. “Digital arrest” does not exist in Indian law.",
        "No government agency asks you to transfer money to “verify” it.",
        "You were told not to tell anyone and not to hang up, which is a pressure tactic.",
        "The “RBI account” is a private account at an ordinary bank branch.",
      ],
      missingInfo: [],
      confidence: 0.94,
    },
  },
];

export function getSample(id?: string): SampleCase | undefined {
  return SAMPLES.find((s) => s.id === id);
}
