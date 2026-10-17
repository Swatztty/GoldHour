import { connection } from "next/server";

/**
 * Public runtime config, so one container image works in any project.
 * demoMode (default on): calls, texts and emails are intercepted so no real hotline, bank or person is contacted.
 * Set DEMO_MODE=false only for a real launch with the agencies' agreement.
 */
export async function GET() {
  await connection();
  const demoMode = process.env.DEMO_MODE !== "false";
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const firebase =
    apiKey && projectId
      ? {
          apiKey,
          projectId,
          authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
          appId: process.env.FIREBASE_APP_ID,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        }
      : null;
  const liveVoice = !!process.env.GEMINI_API_KEY && process.env.VOICE_LIVE_DISABLED !== "true";
  return Response.json({ demoMode, firebase, liveVoice }, { headers: { "Cache-Control": "no-store" } });
}
