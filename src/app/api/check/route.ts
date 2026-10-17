import { REGIONS, regionOf, type CountryCode } from "@/lib/regions";
import { findIdentifiers, riskFrom, ruleFlags, type Flag, type Risk } from "@/lib/rt/check-rules";
import { idKey } from "@/lib/rt/ids";
import { GEMINI_MODEL, gemini, geminiAvailable, withTimeout } from "@/lib/server/gemini";
import { buildNetwork } from "@/lib/server/network";
import { limited } from "@/lib/server/ratelimit";

export interface CheckHit {
  value: string;
  where: string;
  kind: string;
  victims: number;
  countries: string[];
  ring: string;
  /** minutes since the most recent report naming it */
  lastMinutesAgo: number;
}

export interface CheckResult {
  risk: Risk;
  verdict: string;
  flags: Flag[];
  hits: CheckHit[];
  advice: string[];
  source: "gemini" | "rules";
}

const SCHEMA = {
  type: "object",
  properties: {
    risk: { type: "string", enum: ["high", "medium", "low"] },
    verdict: { type: "string", description: "One plain sentence for the person, in the same language they wrote in" },
    flags: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, detail: { type: "string" }, severe: { type: "boolean" } },
        required: ["title", "detail"],
      },
    },
    advice: { type: "array", items: { type: "string" } },
  },
  required: ["risk", "verdict", "flags", "advice"],
};

function baseAdvice(risk: Risk, country: CountryCode): string[] {
  const r = regionOf(country);
  const line = r.hotline ?? r.support;
  const tell = line ? `If you already paid or shared details, call ${line.number} (${line.name}) and your bank now.` : "If you already paid or shared details, call your bank now.";
  if (risk === "low")
    return [
      "No known warning signs were found, but that doesn’t prove it’s safe.",
      "Check the person or company through a number or website you find yourself, not one in the message.",
      tell,
    ];
  return [
    "Don’t pay, don’t click links and don’t share any codes.",
    "Stop replying. Contact the bank, company or agency using a number you look up yourself.",
    tell,
  ];
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function verdictFor(risk: Risk, hits: CheckHit[]): string {
  if (hits.length) {
    const h = hits[0];
    return `Stop. ${h.value} has been reported by ${h.victims} scam victim${h.victims === 1 ? "" : "s"}${h.countries.length ? ` in ${list(h.countries)}` : ""}.`;
  }
  if (risk === "high") return "This looks like a scam. Don’t pay or reply.";
  if (risk === "medium") return "Be careful: this has a warning sign of a scam.";
  return "No warning signs found, but stay careful.";
}

export async function POST(req: Request) {
  if (limited(req, "check", 60)) return Response.json({ error: "Too many checks from this network. Try again in a few minutes." }, { status: 429 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const text = typeof b.text === "string" ? b.text.slice(0, 3000).trim() : "";
  const country = (typeof b.country === "string" && b.country in REGIONS ? b.country : "XX") as CountryCode;
  if (!text) return Response.json({ error: "Paste a message, number, account or link to check." }, { status: 400 });

  // 1. Is any number, account, payment ID or handle already in the scam network?
  const { network, byKey } = await buildNetwork();
  const hits: CheckHit[] = [];
  for (const idf of findIdentifiers(text)) {
    const keys =
      idf.kind === "number"
        ? [idKey("phone", idf.value), idKey("account", idf.value)]
        : idf.kind === "payid"
          ? [idKey("payid", idf.value)]
          : idf.kind === "handle"
            ? [idKey("handle", idf.value)]
            : [];
    const entityId = keys.map((k) => byKey.get(k)).find(Boolean);
    if (!entityId) continue;
    const e = network.entities.find((x) => x.id === entityId);
    const touching = network.reports.filter((r) => r.paidTo.includes(entityId) || r.contactedBy.includes(entityId));
    if (!e || !touching.length || hits.some((h) => h.value === e.label)) continue;
    hits.push({
      value: e.label,
      where: e.where,
      kind: e.kind,
      victims: touching.length,
      countries: [...new Set(touching.map((t) => t.country))],
      ring: network.rings.find((g) => g.id === touching[0].ring)?.name ?? "Scam ring",
      lastMinutesAgo: Math.min(...touching.map((t) => t.minutesAgo)),
    });
  }

  // 2. Warning signs in the wording
  const rules = ruleFlags(text);
  const ruleRisk = riskFrom(rules, hits.length);
  let result: CheckResult = {
    risk: ruleRisk,
    verdict: verdictFor(ruleRisk, hits),
    flags: rules,
    hits,
    advice: baseAdvice(ruleRisk, country),
    source: "rules",
  };

  // 3. Gemini reads the message like a careful friend would, in any language
  if (geminiAvailable() && text.length > 12) {
    try {
      const res = await withTimeout(
        gemini().models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `A person in ${regionOf(country).name} received this and wants to know if it is a scam before they pay or reply.
"""${text}"""
${hits.length ? `Our scam network already has reports naming: ${hits.map((h) => `${h.value} (${h.victims} victims)`).join("; ")}. Treat this as high risk.` : ""}
Warning signs our rules found: ${rules.map((f) => f.title).join("; ") || "none"}.
Judge the risk honestly. List the specific warning signs in this message (title under 8 words, one plain sentence of detail each). Give 2-3 short, practical next steps. Never tell them to call a number or open a link that appears in the message. Write the verdict, flags and advice in the same language as the message.`,
                },
              ],
            },
          ],
          config: { responseMimeType: "application/json", responseJsonSchema: SCHEMA, temperature: 0 },
        }),
        12000,
        "Checking",
      );
      const g = JSON.parse(res.text ?? "{}") as Partial<CheckResult>;
      if (g.risk && g.verdict) {
        const risk: Risk = hits.length ? "high" : g.risk;
        result = {
          risk,
          verdict: hits.length ? verdictFor(risk, hits) : g.verdict,
          flags: (g.flags ?? []).slice(0, 6).map((f, i) => ({ id: `g${i}`, title: f.title, detail: f.detail, severe: f.severe })),
          hits,
          advice: (g.advice ?? []).slice(0, 4).length ? (g.advice ?? []).slice(0, 4) : baseAdvice(risk, country),
          source: "gemini",
        };
      }
    } catch (e) {
      console.error("[check]", e);
    }
  }

  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
