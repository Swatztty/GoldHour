import { regionOf, REGIONS, type CountryCode } from "@/lib/regions";
import { normalizeExtraction } from "@/lib/normalize";
import { draftFromExtraction, extractionNote } from "@/lib/rt/from-extraction";
import { getSample } from "@/lib/samples";
import { extractWithGemini } from "@/lib/server/agent";
import { geminiAvailable } from "@/lib/server/gemini";
import { limited } from "@/lib/server/ratelimit";

export const maxDuration = 120;

/** Reads screenshots (chats, bank alerts, payment receipts) in any language and returns report fields. */
export async function POST(req: Request) {
  if (limited(req, "extract", 30)) return Response.json({ error: "Too many uploads right now. Wait a few minutes." }, { status: 429 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const country = (typeof b.country === "string" && b.country in REGIONS ? b.country : "XX") as CountryCode;
  const region = regionOf(country);

  // Sample screenshots for demos: use the stored reading so it works without a key
  const sample = getSample(typeof b.sampleId === "string" ? b.sampleId : undefined);
  if (sample && !geminiAvailable()) {
    const ex = normalizeExtraction(sample.cached, regionOf(sample.country).currency);
    const quote = sample.transcript.split("\n")[2]?.replace(/^Me:\s*/, "");
    return Response.json({
      draft: { ...draftFromExtraction(ex), minutesAgo: sample.firstOffsetMin, story: ex.summary, scriptQuote: quote },
      note: extractionNote(ex),
      country: sample.country,
    });
  }

  const images = (Array.isArray(b.images) ? b.images : [])
    .slice(0, 6)
    .filter((i): i is { name: string; mimeType: string; data: string } => !!i && typeof i.data === "string" && i.data.length < 7_000_000 && /^image\//.test(String(i.mimeType)));
  if (!images.length && !sample) return Response.json({ error: "No screenshot was received. Try choosing it again." }, { status: 400 });
  if (!geminiAvailable()) {
    return Response.json({ error: "Reading screenshots needs the AI service, which isn’t available right now. You can say or type what it shows instead." }, { status: 503 });
  }
  try {
    const input = sample
      ? { text: sample.transcript, images: [], lang: "en" as const, country: sample.country }
      : { text: "", images, lang: "en" as const, country };
    const ex = await extractWithGemini(input, sample ? regionOf(sample.country) : region);
    return Response.json({ draft: sample ? { ...draftFromExtraction(ex), minutesAgo: sample.firstOffsetMin } : draftFromExtraction(ex), note: extractionNote(ex), country: sample?.country ?? country });
  } catch (e) {
    console.error("[extract]", e);
    return Response.json({ error: "That screenshot couldn’t be read. You can say or type what it shows instead." }, { status: 502 });
  }
}
