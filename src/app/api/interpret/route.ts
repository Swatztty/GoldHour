import { REGIONS, regionOf, type CountryCode } from "@/lib/regions";
import { GEMINI_MODEL, gemini, geminiAvailable, withTimeout } from "@/lib/server/gemini";
import { limited } from "@/lib/server/ratelimit";

/**
 * Guided mode (when live voice isn't available): understands one answer, in any language,
 * and returns the report fields it contains. The browser has an offline parser as backup.
 */
const SCHEMA = {
  type: "object",
  properties: {
    story: { type: "string", description: "What happened, in the person's words" },
    summaryEnglish: { type: "string", description: "Two-sentence plain English summary" },
    scamType: { type: "string", enum: ["digital_arrest", "impersonation", "job_task", "investment", "kyc_link", "remote_access", "sextortion", "shopping", "loan_app", "other"] },
    amount: { type: "number" },
    currency: { type: "string", description: "ISO 4217 code" },
    minutesAgo: { type: "number", description: "Minutes since the first payment" },
    receivers: {
      type: "array",
      items: { type: "object", properties: { kind: { type: "string", enum: ["account", "payid"] }, value: { type: "string" }, bank: { type: "string" }, name: { type: "string" } }, required: ["kind", "value"] },
    },
    contacts: {
      type: "array",
      items: { type: "object", properties: { kind: { type: "string", enum: ["phone", "handle", "url", "email"] }, value: { type: "string" }, app: { type: "string" } }, required: ["kind", "value"] },
    },
    victimBank: { type: "string" },
    txnRef: { type: "string", description: "Transaction reference exactly as said: UTR, Ref No, Transaction ID" },
    city: { type: "string" },
    scriptQuote: { type: "string", description: "A sentence the scammer said, verbatim" },
    language: { type: "string", description: "Language the person used, in English" },
  },
};

export async function POST(req: Request) {
  if (!geminiAvailable()) return Response.json({ offline: true });
  if (limited(req, "interpret", 120)) return Response.json({ offline: true });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const text = typeof b.text === "string" ? b.text.slice(0, 2000) : "";
  const question = typeof b.question === "string" ? b.question.slice(0, 300) : "";
  const country = (typeof b.country === "string" && b.country in REGIONS ? b.country : "XX") as CountryCode;
  if (!text.trim()) return Response.json({ fields: {} });
  try {
    const res = await withTimeout(
      gemini().models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `A person in ${regionOf(country).name} is reporting a scam. They were asked: "${question}"\nThey answered: "${text}"\nExtract only the facts present in the answer. Usual currency: ${regionOf(country).currency}. Never include PINs, passwords or one-time codes.`,
              },
            ],
          },
        ],
        config: { responseMimeType: "application/json", responseJsonSchema: SCHEMA, temperature: 0 },
      }),
      15000,
      "Interpreting",
    );
    return Response.json({ fields: JSON.parse(res.text ?? "{}") });
  } catch (e) {
    console.error("[interpret]", e);
    return Response.json({ offline: true });
  }
}
