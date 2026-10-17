import { formatMoney, formatWhen } from "./investigate";
import { LANG_NAMES, type Region } from "./regions";
import type { Drafting, Extraction, Investigation, Lang, ScamType } from "./types";

export { LANG_NAMES };

/** Offline guidance. Gemini writes tailored guidance in any language; these cover English, Hindi and Tamil. */
export function guidanceFor(region: Region, lang: Lang): string[] {
  const first = region.hotline ? region.hotline.number : null;
  if (lang === "hi")
    return [
      first
        ? `सबसे पहले ${first} पर कॉल करें। जल्दी शिकायत करने से पैसा आगे जाने से पहले रोके जाने की संभावना सबसे ज़्यादा होती है।`
        : "सबसे पहले अपने बैंक को कॉल करें। जल्दी शिकायत करने से पैसा रोके जाने की संभावना सबसे ज़्यादा होती है।",
      "कोई भी चैट, SMS या कॉल लॉग डिलीट न करें। ये आपके सबूत हैं।",
      "पैसा वापस दिलाने के नाम पर फीस माँगने वाले को कभी भुगतान न करें। यह दूसरा धोखा है।",
      "अगर आपने PIN या पासवर्ड बताया हो, या कॉल करने वाले के कहने पर कोई ऐप इंस्टॉल किया हो, तो उन्हें अभी बदलें।",
    ];
  if (lang === "ta")
    return [
      first
        ? `முதலில் ${first}-ஐ அழைக்கவும். விரைவாகப் புகார் அளித்தால், பணம் வேறு இடத்திற்கு நகரும் முன் முடக்கப்படும் வாய்ப்பு அதிகம்.`
        : "முதலில் உங்கள் வங்கியை அழைக்கவும். விரைவாகப் புகார் அளித்தால், பணம் முடக்கப்படும் வாய்ப்பு அதிகம்.",
      "எந்த உரையாடல்கள், SMS அல்லது அழைப்புப் பதிவுகளையும் நீக்க வேண்டாம். அவையே உங்கள் சான்றுகள்.",
      "கட்டணம் வாங்கிக்கொண்டு பணத்தை மீட்டுத் தருவதாகச் சொல்பவர்களுக்கு ஒருபோதும் பணம் செலுத்த வேண்டாம். அதுவும் ஒரு மோசடிதான்.",
      "PIN அல்லது கடவுச்சொற்களைப் பகிர்ந்திருந்தாலோ, அழைத்தவர் சொன்ன செயலியை நிறுவியிருந்தாலோ, உடனே அவற்றை மாற்றவும்.",
    ];
  return [
    first
      ? `Call ${first} first. Reporting quickly gives the best chance of the money being frozen before it moves on.`
      : "Call your bank first. Reporting quickly gives the best chance of the money being frozen before it moves on.",
    "Don’t delete any chats, messages or call logs. They are your evidence.",
    "Never pay anyone who promises to recover your money for a fee. That is a second scam.",
    "If you shared a PIN, password or one-time code, or installed an app the caller asked for, change your passwords now.",
  ];
}

const OPENINGS: Record<ScamType, string> = {
  digital_arrest:
    "I was contacted by people claiming to be police or government officers. They told me I was involved in a crime and pressured me to transfer money to “verify” or “protect” my funds.",
  impersonation: "I was contacted by a person pretending to be someone I trust, such as my bank or a government agency, who persuaded me to send money.",
  job_task:
    "I was offered a part-time online job involving simple tasks. After small initial payouts, I was asked to pay increasing amounts to unlock my earnings and withdraw them.",
  investment:
    "I was persuaded to invest through a platform promising high returns. When I tried to withdraw, I was asked to pay more and could not get my money back.",
  kyc_link:
    "I received a message saying my account or service would be blocked unless I updated my details through a link. After I followed the instructions, money was taken from my account.",
  remote_access: "A person posing as customer support asked me to install a screen-sharing app. After that, money was taken from my account.",
  sextortion: "I was threatened with the release of private content unless I paid money.",
  shopping: "I paid for goods or a delivery through a seller who turned out to be fraudulent.",
  loan_app: "I was harassed and threatened by a loan app and made to pay amounts I did not owe.",
  other: "I was deceived online into transferring money.",
};

function beneficiaryList(inv: Investigation, currency: string): string {
  if (!inv.beneficiaries.length) return "accounts not yet identified";
  return inv.beneficiaries.map((b) => `${b.identifier}${b.bank ? ` (${b.bank})` : ""} – ${formatMoney(b.total, currency)}`).join("; ");
}

function refs(ex: Extraction): string {
  const r = ex.transactions.map((t) => t.reference).filter(Boolean);
  return r.length ? r.join(", ") : "—";
}

export function offlineNarrative(ex: Extraction, inv: Investigation, region: Region): string {
  const n = ex.transactions.length;
  const first = formatWhen(inv.firstTxnAt, region.timeZone);
  const last = formatWhen(inv.lastTxnAt, region.timeZone);
  const span = n > 1 && inv.firstTxnAt !== inv.lastTxnAt ? `between ${first} and ${last}` : `on ${first}`;
  const contacts = [...ex.suspect.phones, ...ex.suspect.urls, ...ex.suspect.emails];
  return [
    OPENINGS[ex.scamType],
    `In total I lost ${formatMoney(inv.totalLost, ex.currency)} in ${n} transaction${n === 1 ? "" : "s"} ${span}. The money was sent to: ${beneficiaryList(inv, ex.currency)}.`,
    contacts.length ? `The suspects contacted me using: ${contacts.join(", ")}.` : "",
    "I did not receive anything in return. I request that the receiving accounts be frozen immediately, the money be returned to me, and action be taken against the people responsible.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function offlineCallScript(ex: Extraction, inv: Investigation, lang: Lang, region: Region): string {
  const n = ex.transactions.length;
  const total = formatMoney(inv.totalLost, ex.currency);
  const time = formatWhen(inv.firstTxnAt, region.timeZone);
  const list = beneficiaryList(inv, ex.currency);
  const r = refs(ex);
  const bank = ex.victimBank ?? "[your bank]";
  if (lang === "hi")
    return `नमस्ते, मुझे ऑनलाइन वित्तीय धोखाधड़ी की शिकायत दर्ज करनी है। ${n} लेन-देन में मेरे कुल ${total} गए हैं। पहला भुगतान ${time} पर हुआ था। पैसा इन खातों में गया: ${list}। लेन-देन संदर्भ संख्या: ${r}। मेरा बैंक ${bank} है। कृपया मेरी शिकायत दर्ज करें और पैसे पाने वाले खातों पर रोक लगवाएँ। कृपया मुझे शिकायत संख्या दें।`;
  if (lang === "ta")
    return `வணக்கம், நான் ஒரு ஆன்லைன் நிதி மோசடி குறித்து புகார் அளிக்க விரும்புகிறேன். ${n} பரிவர்த்தனைகளில் மொத்தம் ${total} இழந்துள்ளேன். முதல் பணம் ${time} அன்று அனுப்பப்பட்டது. பணம் இந்தக் கணக்குகளுக்குச் சென்றது: ${list}. பரிவர்த்தனை குறிப்பு எண்கள்: ${r}. என் வங்கி ${bank}. தயவுசெய்து என் புகாரைப் பதிவு செய்து, பணம் பெற்ற கணக்குகளை முடக்கவும். புகார் எண்ணை எனக்குத் தாருங்கள்.`;
  const toBank = !region.hotline;
  return toBank
    ? `Hello, I’m a customer and I’ve just been scammed. Please stop any further payments from my account and try to recall these transfers. I lost ${total} in ${n} transaction${n === 1 ? "" : "s"}, the first at ${time}. The money went to: ${list}. The reference numbers are: ${r}. Please give me a case or reference number.`
    : `Hello, I want to report a scam. I lost ${total} in ${n} transaction${n === 1 ? "" : "s"}. The first payment was at ${time}. The money went to: ${list}. The reference numbers are: ${r}. My bank is ${bank}. Please register my report and put a hold on the receiving accounts, and give me a reference number.`;
}

export function offlineDrafting(ex: Extraction, inv: Investigation, lang: Lang, region: Region): Drafting {
  return {
    narrative: offlineNarrative(ex, inv, region),
    callScript: offlineCallScript(ex, inv, lang, region),
    guidance: guidanceFor(region, lang),
    whatHappened: `${ex.scamLabel}. ${ex.summary}`,
  };
}
