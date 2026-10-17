import { regionOf } from "@/lib/regions";
import type { Report } from "@/lib/rt/types";
import { GEMINI_MODEL, gemini, geminiAvailable, withTimeout } from "@/lib/server/gemini";
import { limited } from "@/lib/server/ratelimit";
import { getReport } from "@/lib/server/store";

export interface CaseFile {
  summary: string;
  timeline: { when: string; what: string }[];
  requests: string[];
  scriptEnglish?: string;
  source: "gemini" | "template";
}

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Formal, factual English summary for police and bank fraud teams, 3-5 sentences, first person is not used" },
    timeline: {
      type: "array",
      items: { type: "object", properties: { when: { type: "string" }, what: { type: "string" } }, required: ["when", "what"] },
    },
    requests: { type: "array", items: { type: "string" }, description: "Specific actions requested of the bank/police, e.g. freeze account X" },
    scriptEnglish: { type: "string", description: "English translation of the scammer's quoted words, if a quote exists and is not English" },
  },
  required: ["summary", "timeline", "requests"],
};

function template(r: Report): CaseFile {
  const region = regionOf(r.country);
  const money = r.amount ? `${r.currency ?? region.currency} ${r.amount.toLocaleString("en")}` : "an amount not yet confirmed";
  const to = r.receivers.map((x) => `${x.value}${x.bank ? ` (${x.bank})` : ""}`).join(", ");
  const from = r.contacts.map((c) => `${c.value}${c.app ? ` via ${c.app}` : ""}`).join(", ");
  const created = new Date(r.createdAt);
  const paid = r.minutesAgo !== undefined ? new Date(created.getTime() - r.minutesAgo * 60000) : undefined;
  return {
    summary: `The reporting person in ${r.city ? `${r.city}, ` : ""}${region.name} transferred ${money}${to ? ` to ${to}` : ""} after being deceived${r.ringName ? ` in a scam matching the pattern “${r.ringName}”` : ""}.${from ? ` The scammer made contact from ${from}.` : ""}${r.summaryEnglish ? ` ${r.summaryEnglish}` : ""} The report was linked to ${Math.max(0, ...r.matches.map((m) => m.otherReports))} earlier report(s) through shared identifiers.`,
    timeline: [
      ...(paid ? [{ when: paid.toISOString(), what: "First payment to the scammer (approximate, as reported)." }] : []),
      { when: r.createdAt, what: "Scam reported through Golden Hour; linked to the scam network." },
      ...(r.freezeNow.length ? [{ when: r.createdAt, what: `${r.freezeNow.join(", ")} flagged for freezing (3+ victims within 3 hours).` }] : []),
    ],
    requests: [
      ...r.receivers.map((x) => `Freeze or place a hold on receiving account ${x.value}${x.bank ? ` at ${x.bank}` : ""} and preserve its records.`),
      "Attempt recall of the transfer(s) and confirm the outcome in writing.",
      ...r.contacts.filter((c) => c.kind === "phone").map((c) => `Investigate and block the number ${c.value}.`),
    ],
    source: "template",
  };
}

export async function POST(req: Request) {
  if (limited(req, "casefile", 30)) return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as { id?: string; report?: Report };
  const report = (b.id ? await getReport(b.id) : null) ?? (b.report && typeof b.report.id === "string" ? b.report : null);
  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });
  const base = template(report);
  if (!geminiAvailable()) return Response.json(base);
  try {
    const facts = {
      country: regionOf(report.country).name,
      city: report.city,
      reportedAt: report.createdAt,
      minutesBetweenPaymentAndReport: report.minutesAgo,
      amount: report.amount,
      currency: report.currency,
      method: report.method,
      receivers: report.receivers,
      scammerContacts: report.contacts,
      victimBank: report.victimBank,
      scamPattern: report.ringName,
      story: report.story,
      summaryEnglish: report.summaryEnglish,
      scammerQuote: report.scriptQuote,
      linkedReports: report.matches,
      flaggedForFreeze: report.freezeNow,
    };
    const res = await withTimeout(
      gemini().models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Write a case file for police and bank fraud teams from these facts (the victim may have spoken another language; translate to clear formal English). Use only the facts given; never invent names, times or numbers. Timeline times must be ISO 8601 derived from reportedAt and minutesBetweenPaymentAndReport.\n${JSON.stringify(facts)}`,
              },
            ],
          },
        ],
        config: { responseMimeType: "application/json", responseJsonSchema: SCHEMA, temperature: 0 },
      }),
      15000,
      "Case file",
    );
    const g = JSON.parse(res.text ?? "{}") as Partial<CaseFile>;
    if (!g.summary) return Response.json(base);
    return Response.json({ ...base, ...g, source: "gemini" } satisfies CaseFile);
  } catch (e) {
    console.error("[casefile]", e);
    return Response.json(base);
  }
}
