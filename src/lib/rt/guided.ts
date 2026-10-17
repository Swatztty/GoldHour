import { formatMoney } from "../investigate";
import { regionOf, type CountryCode } from "../regions";
import type { ScamType } from "../types";
import { isNone, parseAmount, parseContacts, parseReceivers, parseRef, parseWhen } from "./parse";
import type { ReportDraft } from "./types";

/**
 * Guided mode: the same conversation as live voice, as a fixed list of simple questions.
 * Used when live voice is unavailable. Answers can be spoken, tapped or typed.
 */

export type StepId = "story" | "when" | "urgent" | "amount" | "receiver" | "ref" | "bank" | "contact" | "city" | "confirm";

export interface Quick {
  label: string;
  /** what the tap means; defaults to the label */
  value?: string;
}

export interface Step {
  id: StepId;
  say: string;
  quick: Quick[];
  /** info steps need no answer */
  info?: boolean;
}

const BANKS: Record<CountryCode, string[]> = {
  SG: ["DBS or POSB", "OCBC", "UOB"],
  MY: ["Maybank", "CIMB", "Public Bank"],
  IN: ["SBI", "HDFC Bank", "ICICI Bank"],
  AU: ["CommBank", "Westpac", "NAB", "ANZ"],
  JP: ["MUFG", "SMBC", "Mizuho", "Japan Post Bank"],
  TH: ["Kasikornbank", "SCB", "Bangkok Bank"],
  ID: ["BCA", "Mandiri", "BRI"],
  PH: ["BDO", "BPI", "GCash"],
  HK: ["HSBC", "Bank of China (Hong Kong)", "Hang Seng"],
  XX: [],
};

const STORY_TAPS: { label: string; type: ScamType }[] = [
  { label: "Someone said they were police or government", type: "digital_arrest" },
  { label: "A message or call said it was my bank", type: "impersonation" },
  { label: "A job or task offer", type: "job_task" },
  { label: "An investment", type: "investment" },
  { label: "Something else", type: "other" },
];

export function summarise(d: ReportDraft): string {
  const r = regionOf(d.country);
  const bits = [
    d.amount ? `You sent ${formatMoney(d.amount, d.currency ?? r.currency)}` : "",
    d.minutesAgo !== undefined ? `about ${d.minutesAgo < 90 ? `${Math.max(1, Math.round(d.minutesAgo))} minutes` : d.minutesAgo < 1440 ? `${Math.round(d.minutesAgo / 60)} hours` : `${Math.round(d.minutesAgo / 1440)} days`} ago` : "",
    d.receivers.length ? `to ${d.receivers.map((x) => x.value).join(" and ")}` : "",
    d.victimBank ? `from your ${d.victimBank} account` : "",
  ].filter(Boolean);
  const contact = d.contacts.length ? ` The scammer used ${d.contacts.map((c) => (c.app ? `${c.app} ${c.value}` : c.value)).join(" and ")}.` : "";
  const out = `${bits.join(" ")}.${contact}`.replace(/^\./, "").trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function ago(m: number): string {
  return m < 90 ? `${Math.max(1, Math.round(m))} minutes` : m < 1440 ? `${Math.round(m / 60)} hours` : `${Math.round(m / 1440)} days`;
}

/** What the bank or hotline asks for first, and whether we have it yet. */
export function callChecklist(d: ReportDraft): { label: string; have?: string; tip: string }[] {
  const r = regionOf(d.country);
  return [
    { label: "Amount", have: d.amount ? formatMoney(d.amount, d.currency ?? r.currency) : undefined, tip: "Total sent, from your bank SMS or app" },
    { label: "When", have: d.minutesAgo !== undefined ? `About ${ago(d.minutesAgo)} ago` : undefined, tip: "Time of the first payment" },
    { label: "Where it went", have: d.receivers.map((x) => x.value).join(", ") || undefined, tip: "Account number or payment ID you paid" },
    {
      label: "Transaction reference",
      have: d.txnRef,
      tip: d.country === "IN" ? "The 12-digit UTR in your bank SMS or UPI app" : "Ref No or Transaction ID in your bank SMS or app",
    },
  ];
}

/** First-person words to read out on the call, built from what we know so far. Null until there is something useful to say. */
export function callScript(d: ReportDraft): string | null {
  if (!d.amount && !d.receivers.length && !d.txnRef) return null;
  const r = regionOf(d.country);
  const money = d.amount ? formatMoney(d.amount, d.currency ?? r.currency) : "money";
  const when = d.minutesAgo !== undefined ? ` about ${ago(d.minutesAgo)} ago` : "";
  const how = d.method && d.method !== "OTHER" ? ` by ${d.method === "TRANSFER" || d.method === "INSTANT" ? "bank transfer" : d.method}` : "";
  const to = d.receivers.length ? ` to ${d.receivers.map((x) => `${x.value}${x.bank ? ` at ${x.bank}` : ""}`).join(" and ")}` : "";
  const from = d.victimBank ? ` from my ${d.victimBank} account` : "";
  return [
    "I want to report a fraud. I was tricked by a scammer.",
    `I sent ${money}${from}${when}${how}${to}.`,
    d.txnRef ? `The transaction reference is ${d.txnRef}.` : "",
    "Please put a hold on the receiving account and try to recall the money.",
    "Can you give me a complaint reference number, please?",
  ]
    .filter(Boolean)
    .join(" ");
}

export function nextStep(d: ReportDraft, done: Set<StepId>, easy: boolean): Step | null {
  const r = regionOf(d.country);
  const first = r.hotline ? `call ${r.hotline.number}, ${r.hotline.name}` : "call your bank’s fraud line, using the number in your banking app or on your card";
  if (!done.has("story"))
    return {
      id: "story",
      say: easy
        ? "Hello. I’m the Golden Hour helper. Have you called yet? If not, tap Call first. Then tell me what happened."
        : "Hello, I’m the Golden Hour helper. If you haven’t called yet, tap Call now: that comes first. Then, or while you’re on hold, tell me what happened in a few words. I’ll get the details the bank will ask for ready on screen.",
      quick: STORY_TAPS.map((t) => ({ label: t.label })),
    };
  if (!done.has("when"))
    return {
      id: "when",
      say: easy ? "When did you send the money?" : "When did you send the first payment?",
      quick: [{ label: "Just now" }, { label: "In the last hour", value: "within an hour" }, { label: "Earlier today", value: "today" }, { label: "Yesterday or before", value: "yesterday" }],
    };
  if (!done.has("urgent") && d.minutesAgo !== undefined && d.minutesAgo <= 24 * 60)
    return {
      id: "urgent",
      info: true,
      say: easy
        ? `This is important. Please ${first} now. They can try to stop the money. I will wait.`
        : `If you haven’t called yet, please ${first} now. The sooner you call, the better the chance the money can be stopped. Keep this screen open: your details are building up on the right, ready to read out.`,
      quick: [{ label: "I’ve called, carry on" }, { label: "I’ll call after this" }],
    };
  if (!done.has("amount"))
    return { id: "amount", say: easy ? "How much money did you send?" : "How much money did you send in total?", quick: [{ label: "I don’t know", value: "don't know" }] };
  if (!done.has("receiver"))
    return {
      id: "receiver",
      say: easy
        ? "Where did the money go? Say the account number or payment ID."
        : "Where did the money go? Say the account number, payment ID or phone number you paid. You can also add a screenshot of your bank message.",
      quick: [{ label: "I don’t know", value: "don't know" }],
    };
  if (!done.has("ref") && !d.txnRef && (d.amount || d.receivers.length))
    return {
      id: "ref",
      say: easy
        ? "Is there a reference number in your bank message? Read it to me. Never a one-time code."
        : `The bank will ask for the transaction reference first. It’s in your bank SMS or payment app${d.country === "IN" ? " (the 12-digit UTR)" : ""}. Can you read it out? It is not a one-time code: never share one of those.`,
      quick: [{ label: "I don’t have it", value: "don't know" }],
    };
  if (!done.has("bank"))
    return { id: "bank", say: easy ? "Which is your bank?" : "Which bank did the money leave from?", quick: [...BANKS[d.country].map((b) => ({ label: b })), { label: "I don’t know", value: "don't know" }] };
  if (!done.has("contact"))
    return {
      id: "contact",
      say: easy ? "How did the scammer talk to you?" : "How did the scammer contact you? If you have their phone number or username, say it.",
      quick: [{ label: "WhatsApp" }, { label: "Phone call" }, { label: "Text message" }, { label: "Telegram" }, { label: "LINE" }, { label: "I don’t know", value: "don't know" }],
    };
  if (!done.has("city"))
    return { id: "city", say: easy ? "Which city are you in?" : "Which city are you in? Just the city, not your address.", quick: [{ label: "Skip" }] };
  if (!done.has("confirm"))
    return {
      id: "confirm",
      say: `${easy ? "Here is your report." : "Here’s what I have."} ${summarise(d)} ${easy ? "Is this right?" : "Is this right? If yes, I’ll send it."}`,
      quick: [{ label: "Yes, send it" }, { label: "Something is wrong" }],
    };
  return null;
}

/** Apply an answer using the offline parser. Returns the fields to merge. */
export function applyOffline(step: StepId, text: string, d: ReportDraft): Partial<ReportDraft> {
  switch (step) {
    case "story": {
      const tap = STORY_TAPS.find((t) => t.label === text);
      return { story: [d.story, text].filter(Boolean).join(" "), scamType: tap?.type ?? d.scamType };
    }
    case "when":
      return { minutesAgo: parseWhen(text) ?? d.minutesAgo };
    case "amount": {
      const a = parseAmount(text);
      return a.amount ? { amount: a.amount, currency: a.currency ?? d.currency ?? regionOf(d.country).currency } : {};
    }
    case "receiver":
      return { receivers: [...d.receivers, ...parseReceivers(text)] };
    case "ref": {
      const ref = isNone(text) ? undefined : parseRef(text, true);
      return ref ? { txnRef: ref } : {};
    }
    case "bank":
      return isNone(text) ? {} : { victimBank: text.trim().slice(0, 60) };
    case "contact":
      return { contacts: [...d.contacts, ...parseContacts(text)] };
    case "city":
      return /^skip$/i.test(text.trim()) || isNone(text) ? {} : { city: text.trim().replace(/^i('| a)m in\s+/i, "").slice(0, 40) };
    default:
      return {};
  }
}
