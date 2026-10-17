import type { CountryCode } from "../regions";

/**
 * Scam types that national police and anti-scam centres in each country publicly warn about,
 * with one practical way to spot each. Kept short so it can be read aloud.
 */
export interface ScamAlert {
  name: string;
  /** native-language name, shown when helpful */
  local?: string;
  lang?: string;
  spot: string;
  /** sample message for "Check before you pay" */
  sample: string;
}

const GENERAL: ScamAlert[] = [
  {
    name: "Fake police or officials",
    spot: "Officials never ask you to move money or stay on a video call.",
    sample: "This is the police. Your bank account is linked to money laundering. Transfer your savings to a safe account today for checking. Do not tell anyone.",
  },
  {
    name: "Paid task jobs",
    spot: "A job that asks you to pay a deposit to unlock earnings is a scam.",
    sample: "Part-time job, earn $150 a day rating hotels. Pay a small deposit to unlock VIP tasks. Contact @priya_hr_tasks on Telegram.",
  },
  {
    name: "Investment groups",
    spot: "Guaranteed returns and “VIP mentors” on WhatsApp or Telegram are always fake.",
    sample: "Join our VIP investment group. Guaranteed 30% return in one week with our trading mentor. Deposit USDT to start.",
  },
];

export const ALERTS: Record<CountryCode, ScamAlert[]> = {
  SG: [
    {
      name: "Government official impersonation",
      spot: "MAS and the police never ask you to transfer money to “assist investigations”.",
      sample: "This is the Singapore Police Force. Your account is involved in money laundering. Transfer funds to the MAS safety account immediately for verification. Do not tell anyone.",
    },
    GENERAL[1],
    {
      name: "Phishing for bank logins",
      spot: "Banks don’t send links by SMS. Type the address yourself.",
      sample: "DBS: Your account will be suspended within 24 hours. Verify your details at dbs-secure-verify.xyz",
    },
  ],
  MY: [
    {
      name: "Macau scam (fake police or bank)",
      local: "Penipuan Macau",
      lang: "ms",
      spot: "A call about a crime or a parcel in your name, then a “safe account”, is always a scam.",
      sample: "Ini Polis Diraja Malaysia. Akaun anda terlibat dalam pengubahan wang haram. Pindahkan wang ke akaun keselamatan segera. Jangan beritahu sesiapa.",
    },
    {
      name: "Parcel and courier scams",
      spot: "Couriers never ask for fees through links in text messages.",
      sample: "Your parcel is held at customs. Pay RM 3.50 clearance fee to release your parcel: bit.ly/pos-my-parcel",
    },
    GENERAL[2],
  ],
  TH: [
    {
      name: "Call-centre gangs posing as police or DSI",
      local: "แก๊งคอลเซ็นเตอร์",
      lang: "th",
      spot: "Police never ask you to transfer money “for checking”.",
      sample: "ตำรวจแจ้งว่าบัญชีของคุณเกี่ยวข้องกับการฟอกเงิน โอนเข้าบัญชีปลอดภัยเพื่อตรวจสอบด่วน อย่าบอกใคร",
    },
    {
      name: "Fake loan apps",
      spot: "A loan that asks for a fee before paying out is a scam.",
      sample: "Instant loan approved 50,000 baht. Pay processing fee 1,500 baht to release your funds. Install this app: loan-fast.apk",
    },
    {
      name: "Remote-access apps",
      spot: "Never install an app a caller asks you to. It lets them control your bank app.",
      sample: "This is your bank. To protect your account please install AnyDesk and share your screen with our officer.",
    },
  ],
  PH: [
    {
      name: "E-wallet phishing texts",
      spot: "GCash and Maya never send links asking you to log in or share your MPIN or OTP.",
      sample: "GCash: Your account is restricted. Verify now to avoid suspension: gcash-verify.online and enter your MPIN and OTP.",
    },
    GENERAL[1],
    {
      name: "Online selling and fake buyers",
      spot: "A buyer who asks you to click a link to “receive payment” is a scammer.",
      sample: "Hi I already paid for your item. Click this link to receive the payment and enter your OTP.",
    },
  ],
  ID: [
    {
      name: "Fake wedding invitations and APK files",
      local: "Undangan .apk palsu",
      lang: "id",
      spot: "Never open an .apk file sent on WhatsApp. It can take over your phone.",
      sample: "Assalamualaikum, ini undangan pernikahan kami. Silakan buka file undangan-digital.apk",
    },
    {
      name: "Illegal online loans",
      local: "Pinjol ilegal",
      lang: "id",
      spot: "Check that a lender is registered with OJK before you share anything.",
      sample: "Pinjaman cepat cair 10 juta tanpa jaminan. Bayar biaya administrasi dulu untuk pencairan.",
    },
    GENERAL[1],
  ],
  IN: [
    {
      name: "“Digital arrest”",
      spot: "No police or CBI officer arrests anyone over a video call or asks for money.",
      sample: "This is CBI. A parcel with drugs was sent in your name. You are under digital arrest. Stay on the video call and transfer money for verification. Do not tell your family.",
    },
    {
      name: "Task and part-time job scams",
      local: "घर बैठे कमाई",
      lang: "hi",
      spot: "If you have to pay to get your earnings, it’s a scam.",
      sample: "Part time job, ghar baithe earn ₹3000 daily. Like YouTube videos. Pay ₹2000 for VIP task to unlock withdrawal. UPI task.reward88@ybl",
    },
    {
      name: "KYC update messages",
      spot: "Banks never send links to update KYC or PAN by SMS or WhatsApp.",
      sample: "Dear customer your SBI account will be blocked today. Update your KYC immediately: sbi-kyc-update.info",
    },
  ],
  JP: [
    {
      name: "Fake police calls",
      local: "ニセ警察詐欺",
      lang: "ja",
      spot: "Police never ask you, on LINE or a video call, to move your money.",
      sample: "警察です。あなたの口座が犯罪に使われています。資産を保全口座に移してください。誰にも話さないでください。",
    },
    {
      name: "“It’s me” family scams",
      local: "オレオレ詐欺",
      lang: "ja",
      spot: "Call your relative on the number you already have before sending anything.",
      sample: "俺だけど、携帯を失くして新しい番号になった。至急お金が必要なんだ。",
    },
    GENERAL[2],
  ],
  AU: [
    {
      name: "Bank impersonation and “safe accounts”",
      spot: "Your bank will never ask you to move money to keep it safe.",
      sample: "Westpac: Suspicious login detected. Call our fraud team on 02 8188 5521. You will need to move funds to a safe account immediately.",
    },
    {
      name: "“Hi Mum” texts",
      spot: "Call your child on their old number before you send money.",
      sample: "Hi Mum, I lost my phone, this is my new number. Can you pay a bill for me urgently? I'll pay you back.",
    },
    GENERAL[2],
  ],
  HK: [
    {
      name: "Fake officials",
      local: "假冒官員",
      lang: "zh-HK",
      spot: "Officials never ask you to transfer money into a “safe” account.",
      sample: "I am from the Mainland public security bureau. Your identity was used for money laundering. Transfer your funds to the safe account for verification. Keep this secret.",
    },
    {
      name: "Online shopping scams",
      spot: "Pay through the platform, never by direct transfer to a stranger.",
      sample: "Concert tickets at half price, limited today only. Pay by FPS to this number first.",
    },
    GENERAL[2],
  ],
  XX: GENERAL,
};
