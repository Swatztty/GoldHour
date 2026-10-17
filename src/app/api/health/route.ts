import { connection } from "next/server";
import { GEMINI_MODEL, geminiAvailable } from "@/lib/server/gemini";
import { firebaseConfigured } from "@/lib/server/store";

export async function GET() {
  await connection();
  return Response.json({
    ok: true,
    gemini: geminiAvailable() ? GEMINI_MODEL : "offline",
    firestore: firebaseConfigured(),
    storage: !!process.env.FIREBASE_STORAGE_BUCKET,
    region: process.env.K_SERVICE ? "cloud-run" : "local",
  });
}
