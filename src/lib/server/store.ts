import "server-only";
import { createHash } from "node:crypto";
import type { App } from "firebase-admin/app";
import type { Report } from "../rt/types";
import type { CaseRecord } from "../types";

/**
 * Persistence layer. Uses Firestore (and Cloud Storage for evidence) when the app runs with
 * Google credentials — on Cloud Run this is automatic. Locally, without credentials, it falls
 * back to an in-memory store so the app still works end to end.
 */

let appPromise: Promise<App | null> | null = null;

export function firebaseConfigured(): boolean {
  if (process.env.FIRESTORE_DISABLED === "true") return false;
  return !!(process.env.K_SERVICE || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID);
}

async function getApp(): Promise<App | null> {
  if (!firebaseConfigured()) return null;
  if (!appPromise) {
    appPromise = (async () => {
      try {
        const { initializeApp, getApps, applicationDefault } = await import("firebase-admin/app");
        if (getApps().length) return getApps()[0];
        return initializeApp({
          credential: applicationDefault(),
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
      } catch (e) {
        console.error("[store] Firebase init failed, using memory store", e);
        return null;
      }
    })();
  }
  return appPromise;
}

async function db() {
  const app = await getApp();
  if (!app) return null;
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore(app);
}

// ---------- memory fallback ----------
const g = globalThis as unknown as {
  __ghCases?: Map<string, CaseRecord>;
  __ghReports?: Map<string, number>;
};
const memCases = (g.__ghCases ??= new Map());
const memReports = (g.__ghReports ??= new Map());

export function hashIdentifier(id: string): string {
  return createHash("sha256").update(id.trim().toLowerCase()).digest("hex").slice(0, 40);
}

export async function saveCase(c: CaseRecord): Promise<"firestore" | "memory"> {
  const d = await db();
  if (d) {
    try {
      await d.collection("cases").doc(c.id).set(JSON.parse(JSON.stringify(c)));
      return "firestore";
    } catch (e) {
      console.error("[store] saveCase failed", e);
    }
  }
  memCases.set(c.id, c);
  return "memory";
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  const d = await db();
  if (d) {
    try {
      const snap = await d.collection("cases").doc(id).get();
      if (snap.exists) return snap.data() as CaseRecord;
    } catch (e) {
      console.error("[store] getCase failed", e);
    }
  }
  return memCases.get(id) ?? null;
}

export async function patchCase(
  id: string,
  patch: Partial<Pick<CaseRecord, "victim" | "stepsDone">>,
): Promise<CaseRecord | null> {
  const d = await db();
  if (d) {
    try {
      const ref = d.collection("cases").doc(id);
      await ref.set(JSON.parse(JSON.stringify({ ...patch, updatedAt: new Date().toISOString() })), { merge: true });
      const snap = await ref.get();
      return (snap.data() as CaseRecord) ?? null;
    } catch (e) {
      console.error("[store] patchCase failed", e);
    }
  }
  const existing = memCases.get(id);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  memCases.set(id, next);
  return next;
}

/**
 * Community radar: how many earlier Golden Hour cases named this identifier.
 * Identifiers are stored only as SHA-256 hashes plus a masked display form.
 */
export async function lookupReports(identifiers: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const d = await db();
  for (const raw of identifiers) {
    const key = raw.trim().toLowerCase();
    if (!key) continue;
    const h = hashIdentifier(key);
    let count = 0;
    if (d) {
      try {
        const snap = await d.collection("identifiers").doc(h).get();
        count = (snap.data()?.count as number) ?? 0;
      } catch (e) {
        console.error("[store] lookupReports failed", e);
      }
    } else {
      count = memReports.get(h) ?? 0;
    }
    out[key] = count;
  }
  return out;
}

export async function recordReports(identifiers: string[], caseId: string): Promise<void> {
  const unique = [...new Set(identifiers.map((i) => i.trim().toLowerCase()).filter(Boolean))];
  const d = await db();
  if (d) {
    try {
      const { FieldValue } = await import("firebase-admin/firestore");
      const batch = d.batch();
      for (const id of unique) {
        batch.set(
          d.collection("identifiers").doc(hashIdentifier(id)),
          {
            count: FieldValue.increment(1),
            display: maskIdentifier(id),
            lastSeen: new Date().toISOString(),
            lastCase: caseId,
          },
          { merge: true },
        );
      }
      await batch.commit();
      return;
    } catch (e) {
      console.error("[store] recordReports failed", e);
    }
  }
  for (const id of unique) {
    const h = hashIdentifier(id);
    memReports.set(h, (memReports.get(h) ?? 0) + 1);
  }
}

export function maskIdentifier(id: string): string {
  if (id.includes("@")) {
    const [u, h] = id.split("@");
    return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${h}`;
  }
  return id.length > 4 ? `${"•".repeat(id.length - 4)}${id.slice(-4)}` : id;
}

export async function saveEvidence(
  caseId: string,
  files: { name: string; mimeType: string; data: string }[],
): Promise<{ name: string; path?: string }[]> {
  const app = await getApp();
  if (!app || !process.env.FIREBASE_STORAGE_BUCKET) return files.map((f) => ({ name: f.name }));
  try {
    const { getStorage } = await import("firebase-admin/storage");
    const bucket = getStorage(app).bucket();
    return await Promise.all(
      files.map(async (f, i) => {
        const path = `evidence/${caseId}/${i}-${f.name.replace(/[^a-z0-9._-]/gi, "_")}`;
        await bucket.file(path).save(Buffer.from(f.data, "base64"), { contentType: f.mimeType, resumable: false });
        return { name: f.name, path };
      }),
    );
  } catch (e) {
    console.error("[store] saveEvidence failed", e);
    return files.map((f) => ({ name: f.name }));
  }
}

export async function readEvidence(path: string): Promise<{ data: Buffer; contentType: string } | null> {
  const app = await getApp();
  if (!app || !process.env.FIREBASE_STORAGE_BUCKET || !path.startsWith("evidence/")) return null;
  try {
    const { getStorage } = await import("firebase-admin/storage");
    const file = getStorage(app).bucket().file(path);
    const [[data], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
    return { data, contentType: (meta.contentType as string) || "image/png" };
  } catch (e) {
    console.error("[store] readEvidence failed", e);
    return null;
  }
}

/** Verifies a Firebase Auth ID token (anonymous sign-in from the browser). */
export async function verifyUid(authHeader: string | null): Promise<string | undefined> {
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return undefined;
  const app = await getApp();
  if (!app) return undefined;
  try {
    const { getAuth } = await import("firebase-admin/auth");
    return (await getAuth(app).verifyIdToken(token)).uid;
  } catch {
    return undefined;
  }
}

// ---------- Golden Hour reports ----------
const gr = globalThis as unknown as { __rtReports?: Map<string, Report> };
const memRtReports = (gr.__rtReports ??= new Map());

export async function saveReport(r: Report): Promise<"firestore" | "memory"> {
  const d = await db();
  if (d) {
    try {
      await d.collection("reports").doc(r.id).set(JSON.parse(JSON.stringify(r)));
      // A tiny public event (no personal details) that wakes every open network console instantly
      await d.collection("network_events").doc(r.id).set({ createdAt: r.createdAt, country: r.country, ring: r.ring });
      memRtReports.set(r.id, r);
      return "firestore";
    } catch (e) {
      console.error("[store] saveReport failed", e);
    }
  }
  memRtReports.set(r.id, r);
  return "memory";
}

export async function getReport(id: string): Promise<Report | null> {
  const d = await db();
  if (d) {
    try {
      const snap = await d.collection("reports").doc(id).get();
      if (snap.exists) return snap.data() as Report;
    } catch (e) {
      console.error("[store] getReport failed", e);
    }
  }
  return memRtReports.get(id) ?? null;
}

/** Most recent reports from the last 24 hours, newest first. */
export async function listRecentReports(limit = 300): Promise<Report[]> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const d = await db();
  if (d) {
    try {
      const snap = await d.collection("reports").where("createdAt", ">=", since).orderBy("createdAt", "desc").limit(limit).get();
      return snap.docs.map((x) => x.data() as Report);
    } catch (e) {
      console.error("[store] listRecentReports failed", e);
    }
  }
  return [...memRtReports.values()].filter((r) => r.createdAt >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
