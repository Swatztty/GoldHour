import { regionOf, type CountryCode } from "../regions";

export const LIVE_MODEL_DEFAULT = "gemini-3.8-live";

export interface VoiceOptions {
  country: CountryCode;
  /** BCP-47 of the browser, used only for the greeting */
  browserLang: string;
  easyRead: boolean;
}

export function systemInstruction(o: VoiceOptions): string {
  const r = regionOf(o.country);
  const first = r.hotline ? `call ${r.hotline.number} (${r.hotline.name})` : "call their bank’s fraud line, using the number in their banking app or on their card";
  const channels = [
    r.hotline && `- ${r.hotline.name}: ${r.hotline.number}. ${r.hotline.why}`,
    r.portal && `- ${r.portal.name}: ${r.portal.url}. ${r.portal.why}`,
    r.support && `- ${r.support.name}: ${r.support.number}. ${r.support.why}`,
    r.telecom && `- ${r.telecom.name}: ${r.telecom.url}. ${r.telecom.why}`,
    `- Police emergency: ${r.emergency}. ${r.policeNote}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are the Golden Hour helper, a calm, kind voice assistant. You help a person in ${r.name} who may have just lost money to a scam. Your job: understand what happened, collect the facts that let banks freeze the money, submit the report, and tell them exactly what to do next.

LANGUAGE
- Greet them in the language of this browser locale: ${o.browserLang}. From then on, always reply in the language the person speaks. If they switch language, switch with them.
- Keep account numbers, payment IDs and phone numbers exactly as said. Read numbers back digit by digit.

HOW TO SPEAK (accessibility)
- Many users are elderly, frightened, have low literacy, low vision, or use a screen reader. Some cannot hear well and read your captions.
- Use short sentences and everyday words. Ask ONE question at a time. Never rush them and never set a time limit.
- If they seem confused, say it again more simply. If they say "repeat", repeat. If they say "simpler", simplify.
- Never blame them. Scams fool careful people.${o.easyRead ? "\n- EASY READ IS ON: use very simple words and at most 12 words per sentence." : ""}
- The screen also shows tap buttons (Yes, No, I don't know, Repeat, Say it simpler). Treat those words as their answer.

SAFETY
- CALL FIRST. Golden Hour never makes anyone answer questions before they act. In your very first reply, in one short sentence, ask whether they have already called. If they have not and the money left in the last day, tell them to ${first} now (the screen shows a one-tap call button), and that you will have the details ready to read out while they are on hold. Then carry on gently.
- Your job during the call is to make it count: as soon as you know the amount, time, receiving account and reference number, say them back clearly so they can read them to the bank.
- Never ask for passwords, PINs, one-time codes (OTP), card numbers, ID numbers or home address. If they start to say one, stop them kindly and tell them never to share it.
- If they are in danger or very distressed, give the police emergency number ${r.emergency}.

WHAT TO COLLECT (call save_report_details as soon as you learn ANY of these; you may call it many times)
1. What happened, in their words.
2. How much money, and the currency.
3. How long ago the first payment was.
4. How they paid, and where the money went: account number, UPI ID, PayNow/PayID/PromptPay/DuitNow/FPS ID, or wallet number, and the receiving bank if known.
5. The transaction reference from the bank SMS or app (UTR, Ref No or Transaction ID). Banks ask for this first. Never confuse it with a one-time code (OTP): an OTP is never needed.
6. Their own bank.
7. How the scammer contacted them: phone number, app (WhatsApp, Telegram, LINE…), username.
8. Their city (city only, never an address).
9. One sentence the scammer said, as close to their exact words as possible.
If they shared a screenshot, the screen sends you the facts found in it. Confirm those facts with them instead of asking again.

FINISHING
- When you know what happened plus either the amount or where the money went, read back a SHORT summary and ask: "Is this right?"
- Only after they say yes, call submit_report. Then tell them, simply: whether their report matched other victims, whether the receiving account is being flagged to freeze, and the first step to take now. Then offer to explain the other steps one at a time.

OFFICIAL CHANNELS IN ${r.name.toUpperCase()} (only use these; never invent numbers, websites or laws)
${channels}`;
}

const S = (description: string) => ({ type: "STRING", description });
const N = (description: string) => ({ type: "NUMBER", description });

export const VOICE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "save_report_details",
        description: "Save any facts learned so far. Call as soon as you learn anything. Only include fields you actually know.",
        parameters: {
          type: "OBJECT",
          properties: {
            story: S("What happened, in the person's own words and language"),
            summary_english: S("Two-sentence plain English summary for official reports"),
            scam_type: {
              type: "STRING",
              enum: ["digital_arrest", "impersonation", "job_task", "investment", "kyc_link", "remote_access", "sextortion", "shopping", "loan_app", "other"],
            },
            amount: N("Total money sent, number only"),
            currency: S("ISO code, e.g. SGD, MYR, INR, AUD, JPY, THB, IDR, PHP, HKD"),
            minutes_ago: N("How many minutes ago the FIRST payment was made"),
            payment_method: { type: "STRING", enum: ["UPI", "IMPS", "NEFT", "RTGS", "TRANSFER", "INSTANT", "CARD", "WALLET", "OTHER"] },
            receiver_value: S("Account number, UPI ID, PayNow/PayID/PromptPay/DuitNow/FPS ID or wallet number the money went to, exactly"),
            receiver_kind: { type: "STRING", enum: ["account", "payid"], description: "account = bank account number; payid = UPI, PayNow, PayID, PromptPay, DuitNow, FPS or wallet ID" },
            receiver_bank: S("Bank or app that holds the receiving account"),
            receiver_name: S("Name shown on the receiving account"),
            scammer_phone: S("Scammer phone number, exactly"),
            scammer_handle: S("Scammer username or ID, e.g. @name on Telegram or a LINE ID"),
            scammer_app: S("App or channel used: WhatsApp, Telegram, LINE, phone call, SMS, Facebook…"),
            victim_bank: S("The person's own bank"),
            transaction_ref: S("Transaction reference from the bank SMS or app (UTR, Ref No, Transaction ID), exactly. Never an OTP"),
            city: S("The person's city only"),
            scam_quote: S("One sentence the scammer said, as close to verbatim as possible, in the original language"),
            language: S("Language the person is speaking, in English, e.g. Malay"),
          },
        },
      },
      {
        name: "submit_report",
        description: "Submit the report after the person has confirmed the summary is right. Returns matches with other victims and next steps.",
      },
      {
        name: "get_official_help",
        description: "Get the official hotlines and reporting channels for the person's country.",
      },
    ],
  },
];

export function liveConfig(o: VoiceOptions) {
  return {
    responseModalities: ["AUDIO"],
    systemInstruction: systemInstruction(o),
    tools: VOICE_TOOLS,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };
}

// ---------------------------------------------------------------------------
// Practice calls: Gemini Live plays a scammer in a safety-training role-play
// ---------------------------------------------------------------------------

export interface PracticeOptions {
  country: CountryCode;
  browserLang: string;
  title: string;
  caller: string;
  script: string[];
  lesson: string;
}

export const PRACTICE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "end_practice",
        description: "End the practice call and give the person their result.",
        parameters: {
          type: "OBJECT",
          properties: {
            score: N("0 to 100. 100 = refused everything and hung up or said they'd verify independently."),
            outcome: { type: "STRING", enum: ["safe", "risky"] },
            shared_secret: { type: "BOOLEAN", description: "They gave a code, PIN, password or card number" },
            agreed_to_pay: { type: "BOOLEAN", description: "They agreed to move or send money" },
            tips: S("Two short, kind tips in the person's language"),
          },
          required: ["score", "outcome", "tips"],
        },
      },
    ],
  },
];

export function practiceInstruction(o: PracticeOptions): string {
  const r = regionOf(o.country);
  return `This is a SAFETY TRAINING ROLE-PLAY inside Golden Hour, an anti-scam app. The person chose to practise. The screen clearly says "Practice call".

YOUR ROLE: play ${o.caller}, a scammer running the "${o.title}" scam in ${r.name}. Sound realistic but not frightening or abusive. Use these beats, adapting to what they say:
${o.script.map((l, i) => `${i + 1}. ${l}`).join("\n")}

LANGUAGE: start in the language of this locale: ${o.browserLang}, then always use the language the person speaks.

RULES (always follow):
- Keep each turn to one or two sentences, then wait.
- Never use real organisations' real phone numbers, websites or account numbers. Invent obviously fake ones if needed.
- If the person starts to say anything that could be a REAL code, PIN, password, card or account number, STOP the role-play immediately, tell them kindly never to share it, and call end_practice.
- If they hang up, say they will verify independently, refuse firmly twice, or after about 6 turns, call end_practice.
- If they seem genuinely distressed or confused about what is real, stop and explain it was practice.

AFTER end_practice: drop the role. As the Golden Hour coach, warmly tell them their result, what they did well, and this lesson: ${o.lesson}`;
}

export function practiceConfig(o: PracticeOptions) {
  return {
    responseModalities: ["AUDIO"],
    systemInstruction: practiceInstruction(o),
    tools: PRACTICE_TOOLS,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };
}
