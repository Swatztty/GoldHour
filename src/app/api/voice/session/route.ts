import { REGIONS, type CountryCode } from "@/lib/regions";
import { LIVE_MODEL_DEFAULT, liveConfig, practiceConfig } from "@/lib/rt/voice-config";
import { SCENARIOS } from "@/lib/rt/practice";
import { GoogleGenAI } from "@google/genai";
import { limited } from "@/lib/server/ratelimit";

/**
 * Starts a voice session. With an AI Studio key, mints a short-lived, single-use ephemeral token
 * locked to the Live model and this exact configuration, so the browser can stream audio straight
 * to Gemini without ever seeing the real key. Otherwise tells the browser to use guided mode.
 */
// Daily cap on voice sessions per server instance (protects free-tier quota). Set MAX_VOICE_SESSIONS_PER_DAY=0 for no cap.
const DAILY_CAP = Number(process.env.MAX_VOICE_SESSIONS_PER_DAY ?? "200");
let day = "";
let used = 0;
function overDailyCap(): boolean {
  if (!DAILY_CAP) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    used = 0;
  }
  if (used >= DAILY_CAP) return true;
  used++;
  return false;
}

export async function POST(req: Request) {
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const country = (typeof b.country === "string" && b.country in REGIONS ? b.country : "XX") as CountryCode;
  const browserLang = typeof b.browserLang === "string" ? b.browserLang.slice(0, 20) : "en";
  const easyRead = b.easyRead === true;

  if (!process.env.GEMINI_API_KEY || process.env.VOICE_LIVE_DISABLED === "true") {
    return Response.json({ mode: "guided", reason: "Live voice is not configured on this server." });
  }
  if (limited(req, "voice", 12)) {
    return Response.json({ mode: "guided", reason: "Too many voice sessions from this network right now." });
  }
  if (overDailyCap()) {
    return Response.json({ mode: "guided", reason: "Today's free voice limit has been reached. Guided mode still works." });
  }

  const model = process.env.GEMINI_LIVE_MODEL || LIVE_MODEL_DEFAULT;
  // purpose "practice": Gemini plays a scammer in a labelled training role-play
  const scenario = b.purpose === "practice" ? SCENARIOS.find((x) => x.id === b.scenario) ?? SCENARIOS[0] : null;
  const config = scenario
    ? practiceConfig({
        country,
        browserLang,
        title: scenario.title,
        caller: scenario.caller,
        script: scenario.turns.map((t) => t.line),
        lesson: scenario.lesson,
      })
    : liveConfig({ country, browserLang, easyRead });
  try {
    const now = Date.now();
    // Ephemeral tokens are a Gemini Developer API feature, so use the AI Studio key even when other calls use Vertex AI.
    const devApi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const token = await devApi.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 11 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 1 * 60 * 1000).toISOString(),
        httpOptions: { apiVersion: "v1alpha" },
        // @ts-expect-error the SDK types config as LiveConnectConfig; this object matches it at runtime
        liveConnectConstraints: { model, config },
      },
    });
    return Response.json({ mode: "live", token: token.name, model, config });
  } catch (e) {
    console.error("[voice] token failed", e);
    return Response.json({ mode: "guided", reason: "Live voice could not start." });
  }
}
