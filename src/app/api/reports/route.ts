import { linkAndSave } from "@/lib/server/network";
import { limited } from "@/lib/server/ratelimit";
import { cleanDraft, draftReady } from "@/lib/rt/validate";

export async function POST(req: Request) {
  if (limited(req, "report", 20)) {
    return Response.json({ error: "Too many reports from this network. Wait a few minutes, then try again." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "The report could not be read. Try again." }, { status: 400 });
  const draft = cleanDraft(body);
  if (!draftReady(draft)) {
    return Response.json({ error: "Tell us what happened, and either how much money was sent or where it went." }, { status: 400 });
  }
  try {
    const report = await linkAndSave(draft);
    return Response.json(report);
  } catch (e) {
    console.error("[reports]", e);
    return Response.json({ error: "The report could not be saved. Your details are still on this screen, so you can try again." }, { status: 500 });
  }
}
