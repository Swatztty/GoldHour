import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { customAlphabet } from "nanoid";
import type { Content, FunctionDeclaration, Part } from "@google/genai";
import { resolveIdentifier } from "../banks";
import { offlineDrafting, LANG_NAMES, guidanceFor } from "../drafting";
import { buildInvestigation, formatMoney, minutesSince, urgencyFor, sortedTimes } from "../investigate";
import { regionOf, type Region } from "../regions";
import { normalizeExtraction, offlineExtract } from "../normalize";
import { getSample } from "../samples";
import type { AgentEvent, AnalyzeInput, CaseRecord, Drafting, Extraction, Lang, Victim } from "../types";
import { GEMINI_MODEL, gemini, geminiAvailable, withTimeout } from "./gemini";
import { lookupReports, recordReports, saveCase, saveEvidence } from "./store";

const newId = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 10);

type Emit = (e: Omit<AgentEvent, "t">) => void;

const EMPTY_VICTIM: Victim = { name: "", phone: "", email: "", address: "", city: "", ackNumber: "" };

// ---------------------------------------------------------------------------
// Stage 1 · Read the evidence (Gemini multimodal + JSON schema)
// ---------------------------------------------------------------------------

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    currency: { type: "string", description: "ISO 4217 code of the money lost, e.g. INR, SGD, AUD, JPY, MYR, IDR, PHP, THB, HKD" },
    scamType: {
      type: "string",
      enum: ["digital_arrest", "impersonation", "job_task", "investment", "kyc_link", "remote_access", "sextortion", "shopping", "loan_app", "other"],
    },
    scamLabel: { type: "string", description: "Short plain-English name of the scam" },
    summary: { type: "string", description: "Two sentences, addressed to the victim as 'you', describing what happened" },
    victimBank: { type: "string", description: "The victim's own bank, from the debit SMS sender or text" },
    victimAccount: { type: "string", description: "Masked victim account as shown, e.g. XX4821" },
    unauthorized: { type: "boolean", description: "true only if the victim did not approve the debit (e.g. remote access, OTP stolen)" },
    transactions: {
      type: "array",
      description: "Every debit of money from the victim to the suspects. Exclude credits/refunds to the victim.",
      items: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Rupees, no symbols" },
          datetime: { type: "string", description: "ISO 8601 with the victim's UTC offset. Omit if no time or date is visible." },
          method: { type: "string", enum: ["UPI", "IMPS", "NEFT", "RTGS", "TRANSFER", "INSTANT", "CARD", "WALLET", "OTHER"], description: "UPI for India UPI; INSTANT for PayNow/FAST/Osko/PayID/DuitNow/PromptPay/FPS/InstaPay/BI-FAST; TRANSFER for ordinary bank transfers (e.g. Japanese 振込)" },
          fromBank: { type: "string" },
          fromAccount: { type: "string" },
          toVpa: { type: "string", description: "Receiving payment ID exactly as written: UPI ID, PayNow/PayID/FPS/PromptPay/DuitNow proxy, or e-wallet ID" },
          toAccount: { type: "string", description: "Receiving bank account number, digits only" },
          toIfsc: { type: "string", description: "Bank code shown with the account: IFSC, BSB, branch code, SWIFT" },
          toBank: { type: "string", description: "Receiving bank name as shown" },
          toName: { type: "string", description: "Receiver name if shown" },
          reference: { type: "string", description: "Transaction reference exactly as written (UTR, Ref No, Transaction ID, 受付番号)" },
        },
        required: ["amount", "method"],
      },
    },
    suspect: {
      type: "object",
      properties: {
        phones: { type: "array", items: { type: "string" } },
        upiIds: { type: "array", items: { type: "string" } },
        accounts: { type: "array", items: { type: "string" } },
        urls: { type: "array", items: { type: "string" } },
        names: { type: "array", items: { type: "string" }, description: "Names, aliases, handles the suspects used" },
        apps: { type: "array", items: { type: "string" }, description: "Apps used: WhatsApp, Telegram, AnyDesk..." },
        emails: { type: "array", items: { type: "string" } },
      },
      required: ["phones", "upiIds", "accounts", "urls", "names", "apps", "emails"],
    },
    redFlags: {
      type: "array",
      items: { type: "string" },
      description: "2-4 short, kind sentences explaining what gave the scam away, without blaming the victim",
    },
    missingInfo: { type: "array", items: { type: "string" }, description: "Facts needed for the complaint that are not visible" },
    confidence: { type: "number", description: "0-1 confidence in the extracted transactions" },
  },
  required: ["currency", "scamType", "scamLabel", "summary", "unauthorized", "transactions", "suspect", "redFlags", "missingInfo", "confidence"],
};

function localNow(r: Region): string {
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: r.timeZone, ...o }).format(new Date());
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: r.timeZone, timeZoneName: "longOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  return `${fmt({ dateStyle: "full", timeStyle: "short" })} (${r.timeZone}, ${offset.replace("GMT", "UTC")})`;
}

export async function extractWithGemini(input: AnalyzeInput, r: Region): Promise<Extraction> {
  const parts: Part[] = input.images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
  parts.push({
    text: `The victim is in ${r.name}. Current local date and time: ${localNow(r)}.
Usual currency: ${r.currency}. Common payment methods there: ${r.rails}.

Evidence from a person who believes they have just been scammed. It may include screenshots of chats, SMS, bank alerts and payment apps in any language, plus pasted text.

Pasted text (may be empty):
"""
${input.text.slice(0, 12000)}
"""

Extract the facts needed to file a cybercrime complaint and freeze the money.
Rules:
- Only report what is visible. Never invent amounts, reference numbers, UPI IDs or account numbers.
- Copy identifiers character for character.
- One transaction per debit. If the same debit appears in two screenshots, list it once.
- If a time is shown without a date, assume today unless that would be in the future, then assume yesterday.
- Use the victim's local UTC offset for datetimes.
- Write the summary and red flags in simple English, kindly, without blaming the victim.`,
  });
  const res = await withTimeout(
    gemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction:
          "You are a forensic analyst for scam response across Asia-Pacific. You read scam evidence in any language precisely and extract structured facts for police and banks.",
        responseMimeType: "application/json",
        responseJsonSchema: EXTRACTION_SCHEMA,
        temperature: 0.1,
      },
    }),
    60000,
    "Reading the evidence",
  );
  return normalizeExtraction(JSON.parse(res.text ?? "{}"), r.currency);
}

// ---------------------------------------------------------------------------
// Stage 2 · Investigate (Gemini function-calling agent)
// ---------------------------------------------------------------------------

const TOOLS: FunctionDeclaration[] = [
  {
    name: "resolve_payment_identifier",
    description: "Identify which bank issued a UPI ID (VPA), IFSC code or account. Use for every receiving identifier.",
    parametersJsonSchema: {
      type: "object",
      properties: { identifier: { type: "string", description: "UPI ID like name@okaxis, or an IFSC like HDFC0004127" } },
      required: ["identifier"],
    },
  },
  {
    name: "check_community_reports",
    description: "Check how many earlier Golden Hour cases reported the same UPI IDs, accounts or phone numbers.",
    parametersJsonSchema: {
      type: "object",
      properties: { identifiers: { type: "array", items: { type: "string" } } },
      required: ["identifiers"],
    },
  },
  {
    name: "golden_hour_status",
    description: "Compute how long ago the first payment happened and how urgent the response is.",
    parametersJsonSchema: {
      type: "object",
      properties: { first_payment_iso: { type: "string", description: "ISO 8601 time of the earliest payment, if known" } },
    },
  },
  {
    name: "official_reporting_channels",
    description: "Get the official channels in the victim's country for reporting this kind of fraud.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        scam_type: { type: "string" },
        has_fraud_phone_numbers: { type: "boolean" },
        unauthorized_debit: { type: "boolean" },
      },
      required: ["scam_type"],
    },
  },
];

async function runTool(name: string, args: Record<string, unknown>, r: Region, ex?: Extraction): Promise<{ result: unknown; summary: string }> {
  switch (name) {
    case "resolve_payment_identifier": {
      const id = String(args.identifier ?? "");
      const res = resolveIdentifier(id);
      if (res.bank) return { result: res, summary: `${res.bank}${res.app ? `, via ${res.app}` : ""}` };
      const shown = ex?.transactions.find((t) => t.toVpa === id || t.toAccount === id || t.toIfsc === id)?.toBank;
      if (shown) return { result: { identifier: id, bank: shown, source: "named in the evidence" }, summary: shown };
      return { result: res, summary: "Bank to confirm from the bank statement" };
    }
    case "check_community_reports": {
      const ids = Array.isArray(args.identifiers) ? args.identifiers.map(String) : [];
      const counts = await lookupReports(ids);
      const flagged = Object.entries(counts).filter(([, c]) => c > 0);
      return {
        result: counts,
        summary: flagged.length
          ? flagged.map(([id, c]) => `${id} seen in ${c} earlier case${c === 1 ? "" : "s"}`).join(", ")
          : "No earlier reports for these identifiers",
      };
    }
    case "golden_hour_status": {
      const m = minutesSince(args.first_payment_iso as string | undefined);
      const u = urgencyFor(m);
      return {
        result: {
          minutes_since_first_payment: m ?? "unknown",
          urgency: u,
          note:
            u === "critical"
              ? `Inside the golden hour: ${r.hotline ? `calling ${r.hotline.number}` : "calling the bank"} now gives the best chance of a freeze before funds are moved on.`
              : u === "high"
                ? "Past the first hour but recent. Funds may still be traceable; report immediately. For unauthorized debits, report to the bank within 3 working days."
                : "Older incident. Still report: complaints help trace and freeze mule accounts.",
        },
        summary: m === undefined ? "Payment time unknown, treating as urgent" : `${m} min since first payment · ${u}`,
      };
    }
    case "official_reporting_channels": {
      const channels: { name: string; contact: string; purpose: string }[] = [];
      if (r.hotline) channels.push({ name: r.hotline.name, contact: r.hotline.number, purpose: r.hotline.why });
      channels.push({ name: "Your bank's fraud line", contact: "Number in your banking app or on your card", purpose: "Stop further payments and recall transfers" });
      if (r.portal) channels.push({ name: r.portal.name, contact: r.portal.url, purpose: r.portal.why });
      if (r.support) channels.push({ name: r.support.name, contact: r.support.number, purpose: r.support.why });
      if (r.telecom) channels.push({ name: r.telecom.name, contact: r.telecom.url, purpose: r.telecom.why });
      channels.push({ name: "Police", contact: `Emergency ${r.emergency}`, purpose: r.policeNote });
      return { result: { country: r.name, channels }, summary: `${channels.length} official channels in ${r.name}` };
    }
    default:
      return { result: { error: "unknown tool" }, summary: "Unknown tool" };
  }
}

function toolLabel(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "resolve_payment_identifier":
      return `Tracing ${args.identifier}`;
    case "check_community_reports":
      return `Checking ${Array.isArray(args.identifiers) ? args.identifiers.length : 0} identifiers against earlier cases`;
    case "golden_hour_status":
      return "Checking the clock";
    case "official_reporting_channels":
      return "Finding the official reporting channels";
    default:
      return name;
  }
}

async function investigateWithGemini(ex: Extraction, emit: Emit, r: Region): Promise<string> {
  const contents: Content[] = [
    {
      role: "user",
      parts: [
        {
          text: `Country: ${r.name}. Facts extracted from a fraud victim's evidence:
${JSON.stringify({ scamType: ex.scamType, victimBank: ex.victimBank, unauthorized: ex.unauthorized, transactions: ex.transactions, suspect: ex.suspect }, null, 2)}

Investigate before advising. Use the tools to:
1. Resolve the bank behind every receiving UPI ID and IFSC.
2. Check the receiving identifiers and phone numbers against community reports.
3. Check how urgent this is.
4. Get the official reporting channels.
Then reply with 2-3 plain sentences for the victim: where the money went, how urgent it is, and the single most important thing to do next. No markdown.`,
        },
      ],
    },
  ];

  for (let turn = 0; turn < 6; turn++) {
    const res = await withTimeout(
      gemini().models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction:
            "You are Golden Hour, an emergency response agent for online fraud victims across Asia-Pacific. You are calm, precise and fast. You only state facts returned by tools or present in the evidence. Amounts are in the case currency.",
          tools: [{ functionDeclarations: TOOLS }],
          temperature: 0.2,
        },
      }),
      45000,
      "Investigating",
    );
    const calls = res.functionCalls ?? [];
    const modelContent = res.candidates?.[0]?.content;
    if (!calls.length) return (res.text ?? "").trim();
    if (modelContent) contents.push(modelContent);
    const responses: Part[] = [];
    for (const call of calls) {
      const args = (call.args ?? {}) as Record<string, unknown>;
      const name = call.name ?? "";
      emit({ kind: "tool", label: toolLabel(name, args) });
      const { result, summary } = await runTool(name, args, r, ex);
      emit({ kind: "result", label: summary });
      responses.push({ functionResponse: { name, id: call.id, response: { output: result } } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return "";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The offline path is instant; a short pause keeps each step readable on screen. */
async function investigateOffline(ex: Extraction, emit: Emit, r: Region): Promise<string> {
  const ids = [
    ...new Set([
      ...ex.suspect.upiIds,
      ...ex.transactions.map((t) => (t.toVpa ? undefined : t.toIfsc ?? t.toAccount)).filter((x): x is string => !!x),
    ]),
  ];
  for (const id of ids) {
    emit({ kind: "tool", label: toolLabel("resolve_payment_identifier", { identifier: id }) });
    await sleep(450);
    const { summary } = await runTool("resolve_payment_identifier", { identifier: id }, r, ex);
    emit({ kind: "result", label: summary });
  }
  const all = [...ex.suspect.upiIds, ...ex.suspect.accounts, ...ex.suspect.phones];
  emit({ kind: "tool", label: toolLabel("check_community_reports", { identifiers: all }) });
  await sleep(450);
  emit({ kind: "result", label: (await runTool("check_community_reports", { identifiers: all }, r)).summary });
  const first = sortedTimes(ex.transactions)[0];
  emit({ kind: "tool", label: toolLabel("golden_hour_status", {}) });
  await sleep(350);
  emit({ kind: "result", label: (await runTool("golden_hour_status", { first_payment_iso: first }, r)).summary });
  const total = ex.transactions.reduce((s, t) => s + t.amount, 0);
  const call = r.hotline ? `Call ${r.hotline.number} now` : "Call your bank’s fraud line now";
  return `${formatMoney(total, ex.currency)} left your account in ${ex.transactions.length} payment${ex.transactions.length === 1 ? "" : "s"}. ${call} and read out the reference numbers so the receiving accounts can be put on hold.`;
}

// ---------------------------------------------------------------------------
// Stage 3 · Draft (Gemini, structured, in the victim's language)
// ---------------------------------------------------------------------------

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    narrative: {
      type: "string",
      description:
        "Formal first-person English description of the incident for the police and cybercrime portal, 120-220 words. Facts only from the input. Include amounts, times, receiving accounts and how the suspects made contact. End by requesting the receiving accounts be frozen and the money returned.",
    },
    callScript: {
      type: "string",
      description: "What the victim should say on the first call (the national scam hotline, or their bank if there is none), in the target language, under 110 words, first person, including total amount, reference numbers and receiving payment IDs/accounts.",
    },
    guidance: {
      type: "array",
      items: { type: "string" },
      description: "4 short, calm sentences in the target language: make the first call now, keep evidence, beware of 'recovery agents' who ask for fees, secure accounts. Tailor to this scam and country.",
    },
    whatHappened: {
      type: "string",
      description: "2 kind sentences in the target language explaining the scam in plain words, without blaming the victim.",
    },
  },
  required: ["narrative", "callScript", "guidance", "whatHappened"],
};

async function draftWithGemini(ex: Extraction, agentNotes: string, lang: Lang, r: Region, firstTxnAt?: string): Promise<Drafting> {
  const res = await withTimeout(
    gemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Country: ${r.name}. First call: ${r.hotline ? `${r.hotline.number} (${r.hotline.name})` : "the victim's bank fraud line"}. Currency: ${ex.currency}.
Target language for callScript, guidance and whatHappened: ${LANG_NAMES[lang]} (${lang}). The narrative is always English.
Keep amounts in ${ex.currency} and keep payment IDs, account numbers and reference numbers exactly as given.

Case facts:
${JSON.stringify({ scamLabel: ex.scamLabel, summary: ex.summary, victimBank: ex.victimBank, unauthorized: ex.unauthorized, firstPaymentAt: firstTxnAt, transactions: ex.transactions, suspect: ex.suspect }, null, 2)}

Investigator notes: ${agentNotes}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          "You draft official complaint text and calm guidance for scam victims across Asia-Pacific. Never invent facts, names, laws or phone numbers. Use [square brackets] for anything the victim must fill in.",
        responseMimeType: "application/json",
        responseJsonSchema: DRAFT_SCHEMA,
        temperature: 0.3,
      },
    }),
    60000,
    "Drafting",
  );
  const d = JSON.parse(res.text ?? "{}") as Partial<Drafting>;
  if (!d.narrative || !d.callScript) throw new Error("Draft incomplete");
  return {
    narrative: d.narrative,
    callScript: d.callScript,
    guidance: Array.isArray(d.guidance) && d.guidance.length ? d.guidance.slice(0, 5) : guidanceFor(r, lang),
    whatHappened: d.whatHappened || ex.summary,
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** Sample cases are re-anchored so the first payment is a few minutes ago, keeping the clock live. */
function reanchor(ex: Extraction, firstOffsetMin: number): Extraction {
  const times = sortedTimes(ex.transactions);
  const target = Date.now() - firstOffsetMin * 60000;
  const base = times.length ? Date.parse(times[0]) : target;
  const delta = target - base;
  const toIso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    ...ex,
    transactions: ex.transactions.map((t, i) => ({
      ...t,
      datetime: t.datetime ? toIso(Date.parse(t.datetime) + delta) : toIso(target + i * 5 * 60000),
    })),
  };
}

async function loadSampleImages(srcs: string[]) {
  return Promise.all(
    srcs.map(async (src) => ({
      name: path.basename(src),
      mimeType: "image/png",
      data: (await readFile(path.join(process.cwd(), "public", src))).toString("base64"),
    })),
  );
}

export async function runAgent(input: AnalyzeInput, emit: Emit, ownerUid?: string): Promise<CaseRecord> {
  const sample = getSample(input.sampleId);
  if (sample) input = { ...input, country: sample.country };
  const region = regionOf(input.country);
  const useGemini = geminiAvailable();
  let source: CaseRecord["source"] = useGemini ? "gemini" : "offline";

  if (sample && !input.images.length) {
    try {
      input = { ...input, images: await loadSampleImages(sample.images.map((i) => i.src)), text: "" };
    } catch {
      input = { ...input, text: sample.transcript };
    }
  }

  // Stage 1
  const evidenceCount = input.images.length + (input.text.trim() ? 1 : 0);
  emit({ kind: "stage", label: "Reading your evidence", detail: `${input.images.length} screenshot${input.images.length === 1 ? "" : "s"}${input.text.trim() ? " and pasted text" : ""}` });
  let ex: Extraction;
  try {
    if (!useGemini) throw new Error("offline");
    ex = await extractWithGemini(input, region);
    if (!ex.transactions.length && sample) ex = normalizeExtraction(sample.cached, region.currency);
  } catch (e) {
    if (useGemini) emit({ kind: "note", label: "Gemini was unavailable, switching to the offline reader", detail: (e as Error).message });
    source = "offline";
    await sleep(900);
    ex = sample ? normalizeExtraction(sample.cached, region.currency) : offlineExtract(input.text, new Date().toISOString().replace(/\.\d{3}Z$/, "Z"), region.currency);
  }
  if (sample) ex = reanchor(ex, sample.firstOffsetMin);
  if (!ex.transactions.length && evidenceCount === 0) throw new Error("Add a screenshot or paste the messages first.");
  emit({
    kind: "result",
    label: ex.transactions.length
      ? `Found ${ex.transactions.length} payment${ex.transactions.length === 1 ? "" : "s"} totalling ${formatMoney(ex.transactions.reduce((s, t) => s + t.amount, 0), ex.currency)}`
      : "No payments found yet. You can still file, and add them later.",
    detail: ex.scamLabel,
  });

  // Stage 2
  emit({ kind: "stage", label: "Following the money" });
  let notes = "";
  try {
    if (source !== "gemini") throw new Error("offline");
    notes = await investigateWithGemini(ex, emit, region);
    if (!notes) throw new Error("Agent returned no summary");
  } catch (e) {
    if (source === "gemini") emit({ kind: "note", label: "Agent step failed, using the offline investigator", detail: (e as Error).message });
    notes = await investigateOffline(ex, emit, region);
  }
  const identifiers = [...ex.suspect.upiIds, ...ex.suspect.accounts, ...ex.suspect.phones];
  const reports = await lookupReports(identifiers);
  const inv = buildInvestigation(ex, reports, notes);

  // Stage 3
  emit({
    kind: "stage",
    label: "Drafting your complaints",
    detail: `${region.portal ? `${region.portal.name} report, ` : ""}${inv.beneficiaries.length + 1} bank letters${region.portal?.isPoliceReport ? "" : ", police complaint"}`,
  });
  let drafting: Drafting;
  let lang = input.lang;
  try {
    if (source !== "gemini") throw new Error("offline");
    drafting = await draftWithGemini(ex, notes, input.lang, region, inv.firstTxnAt);
  } catch (e) {
    if (source === "gemini") emit({ kind: "note", label: "Using standard templates for the drafts", detail: (e as Error).message });
    await sleep(900);
    if (!["en", "hi", "ta"].includes(lang)) lang = "en";
    drafting = offlineDrafting(ex, inv, lang, region);
  }

  const id = newId();
  const evidence = sample
    ? sample.images.map((img) => ({ name: path.basename(img.src), path: img.src }))
    : await saveEvidence(id, input.images);
  const record: CaseRecord = {
    id,
    createdAt: new Date().toISOString(),
    ownerUid,
    country: region.code,
    lang,
    source,
    sampleId: sample?.id,
    model: source === "gemini" ? GEMINI_MODEL : undefined,
    extraction: ex,
    investigation: inv,
    drafting,
    victim: { ...EMPTY_VICTIM, ...(input.victim ?? {}) },
    stepsDone: [],
    evidence,
    agentLog: [],
  };
  await recordReports(identifiers, id);
  emit({ kind: "done", label: "Your response plan is ready" });
  return record;
}

export async function persist(record: CaseRecord) {
  return saveCase(record);
}
