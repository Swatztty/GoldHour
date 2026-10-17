import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import { connection } from "next/server";
import { LIVE_MODEL_DEFAULT, liveConfig } from "@/lib/rt/voice-config";
import { limited } from "@/lib/server/ratelimit";

/**
 * Diagnoses live voice from the server: connects to Gemini Live with the same model and settings the
 * app uses, adding one setting at a time, and reports which step Gemini accepts or rejects (with its
 * close reason). Returns no secrets. Open /api/voice/selftest in a browser.
 */
export const maxDuration = 60;

interface Step {
  step: string;
  ok: boolean;
  detail: string;
  ms: number;
}

async function tryConnect(ai: GoogleGenAI, model: string, config: Record<string, unknown>, text: string): Promise<Omit<Step, "step">> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    let done = false;
    let session: { close(): void; sendRealtimeInput(x: unknown): void } | null = null;
    const finish = (ok: boolean, detail: string) => {
      if (done) return;
      done = true;
      try {
        session?.close();
      } catch {
        /* ignore */
      }
      resolve({ ok, detail, ms: Date.now() - t0 });
    };
    const timer = setTimeout(() => finish(false, "No reply from Gemini within 15 seconds"), 15000);
    ai.live
      .connect({
        model,
        config,
        callbacks: {
          onmessage: (m: LiveServerMessage) => {
            if (m.serverContent?.modelTurn || m.serverContent?.outputTranscription || m.toolCall) {
              clearTimeout(timer);
              finish(true, m.toolCall ? "Replied with a tool call" : "Replied");
            }
          },
          onerror: (e: unknown) => {
            clearTimeout(timer);
            finish(false, `Error: ${(e as { message?: string })?.message ?? String(e)}`);
          },
          onclose: (e: { code?: number; reason?: string }) => {
            clearTimeout(timer);
            finish(false, `Closed by Gemini: ${e?.code ?? ""} ${e?.reason || "(no reason given)"}`.trim());
          },
        },
      })
      .then((s) => {
        session = s as unknown as typeof session;
        try {
          session?.sendRealtimeInput({ text });
        } catch (e) {
          clearTimeout(timer);
          finish(false, `Could not send text: ${(e as Error).message}`);
        }
      })
      .catch((e: unknown) => {
        clearTimeout(timer);
        finish(false, `Could not connect: ${(e as Error)?.message ?? String(e)}`);
      });
  });
}

export async function GET(req: Request) {
  await connection();
  if (limited(req, "voice-selftest", 6)) return Response.json({ error: "Try again in a few minutes." }, { status: 429 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ ok: false, problem: "GEMINI_API_KEY is not set on the server." });
  const model = process.env.GEMINI_LIVE_MODEL || LIVE_MODEL_DEFAULT;
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: "v1alpha" } });
  const full = liveConfig({ country: "MY", browserLang: "en", easyRead: false }) as Record<string, unknown>;

  const plan: [string, Record<string, unknown>][] = [
    ["1. Audio reply only", { responseModalities: [Modality.AUDIO] }],
    ["2. + system instruction", { responseModalities: [Modality.AUDIO], systemInstruction: full.systemInstruction }],
    ["3. + captions (transcription)", { responseModalities: [Modality.AUDIO], systemInstruction: full.systemInstruction, inputAudioTranscription: {}, outputAudioTranscription: {} }],
    ["4. + tools (the full app setup)", full],
  ];

  const steps: Step[] = [];
  for (const [step, config] of plan) {
    const r = await tryConnect(ai, model, config, "Hello, I think I was scammed.");
    steps.push({ step, ...r });
    if (!r.ok) break;
  }

  // Also check that the key can mint the short-lived voice pass the browser uses
  let token = { ok: false, detail: "" };
  try {
    const t = await new GoogleGenAI({ apiKey: key }).authTokens.create({ config: { uses: 1, httpOptions: { apiVersion: "v1alpha" } } });
    token = { ok: !!t.name, detail: t.name ? "Voice pass created" : "No token returned" };
  } catch (e) {
    token = { ok: false, detail: (e as Error).message.slice(0, 300) };
  }

  const failed = steps.find((s) => !s.ok);
  return Response.json(
    {
      model,
      voicePass: token,
      steps,
      verdict: !token.ok
        ? "The key can't create voice passes. Use a key made in Google AI Studio."
        : failed
          ? `Gemini rejected step "${failed.step}". Send this page to your developer.`
          : "Live voice works from the server with the full app setup.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
