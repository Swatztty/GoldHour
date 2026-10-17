import "server-only";
import { customAlphabet } from "nanoid";
import { ENTITIES, REPORTS, RINGS } from "../radar/data";
import { project } from "../radar/geo";
import { regionOf } from "../regions";
import { idKey, type IdKind } from "../rt/ids";
import { locate, toUsd } from "../rt/places";
import type { Impact, LinkMatch, NetEntity, NetReport, NetRing, Network, Report, ReportDraft } from "../rt/types";
import { gemini, geminiAvailable, withTimeout } from "./gemini";
import { listRecentReports, saveReport } from "./store";

const newId = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 10);

// ---------------------------------------------------------------------------
// Seed network (fictional demo data) in canonical form
// ---------------------------------------------------------------------------

const SEED_KIND: Record<string, IdKind> = { account: "account", payid: "payid", phone: "phone", handle: "handle" };

function seedEntities(): NetEntity[] {
  return ENTITIES.map((e) => {
    const [x, y] = project(e.at);
    return { id: e.id, key: idKey(SEED_KIND[e.kind], e.label), kind: e.kind, label: e.label, where: e.where, country: e.country, x, y };
  });
}

function seedReports(): NetReport[] {
  return REPORTS.map((r) => {
    const [x, y] = project(r.at);
    return { id: r.id, ring: r.ring, city: r.city, country: r.country, x, y, minutesAgo: r.minutesAgo, amount: r.amount, currency: r.currency, usd: r.usd, paidTo: r.paidTo, contactedBy: r.contactedBy, script: r.script };
  });
}

// ---------------------------------------------------------------------------
// Script similarity: Gemini embeddings when available, a multilingual lexicon otherwise
// ---------------------------------------------------------------------------

const LEXICON: Record<string, string[]> = {
  r1: ["safety account", "verification", "verify your", "mas ", "central bank", "bank negara", "police", "polis", "arrest", "money laundering", "akaun keselamatan", "pengesahan", "บัญชีปลอดภัย", "ตรวจสอบ", "ตำรวจ", "returned within 24", "digital arrest", "customs", "parcel", "安全账户", "安全帳戶", "洗钱", "洗錢"],
  r2: ["task", "part-time", "part time", "review", "rate hotel", "vip", "merchant", "commission", "unlock", "withdraw", "tax clearance", "telegram", "tugas", "komisi", "trabaho", "gawain", "pajak", "刷单", "兼职"],
  r3: ["safe account", "fraud team", "hacker", "new device", "compromised", "protected account", "security team", "move your money"],
  r4: ["保全口座", "警視庁", "逮捕", "マネーロンダリング", "警察", "資産", "asset protection", "振り込"],
};

function lexiconRing(text: string): { ring: string; score: number } | null {
  const t = ` ${text.toLowerCase()} `;
  let best: { ring: string; score: number } | null = null;
  for (const [ring, words] of Object.entries(LEXICON)) {
    const score = words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (score >= 2 && (!best || score > best.score)) best = { ring, score };
  }
  return best;
}

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
const ringVectors = new Map<string, number[]>();

async function embed(text: string): Promise<number[]> {
  const res = await withTimeout(gemini().models.embedContent({ model: EMBED_MODEL, contents: text }), 12000, "Embedding");
  return res.embeddings?.[0]?.values ?? [];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

async function similarRing(text: string): Promise<{ ring: string; score: number; via: "gemini" | "lexicon" } | null> {
  if (!text.trim()) return null;
  if (geminiAvailable()) {
    try {
      for (const ring of RINGS) {
        if (!ringVectors.has(ring.id)) {
          const scripts = REPORTS.filter((r) => r.ring === ring.id).map((r) => r.script);
          ringVectors.set(ring.id, await embed(`${ring.pattern}\n${scripts.join("\n")}`));
        }
      }
      const v = await embed(text);
      let best: { ring: string; score: number } | null = null;
      for (const [ring, rv] of ringVectors) {
        const s = cosine(v, rv);
        if (!best || s > best.score) best = { ring, score: s };
      }
      if (best && best.score >= 0.72) return { ...best, via: "gemini" };
      return null;
    } catch (e) {
      console.error("[network] embedding failed, using lexicon", e);
    }
  }
  const lex = lexiconRing(text);
  return lex ? { ...lex, via: "lexicon" } : null;
}

// ---------------------------------------------------------------------------
// Build the network: seed + reports made through the voice assistant
// ---------------------------------------------------------------------------

interface Built {
  network: Network;
  /** entity key -> entity id */
  byKey: Map<string, string>;
}

function reportIds(r: ReportDraft): { kind: IdKind; value: string; role: "paid" | "contact"; where?: string }[] {
  return [
    ...r.receivers.filter((x) => x.value?.trim()).map((x) => ({ kind: x.kind as IdKind, value: x.value, role: "paid" as const, where: x.bank })),
    ...r.contacts.filter((x) => x.value?.trim() && (x.kind === "phone" || x.kind === "handle")).map((x) => ({ kind: x.kind as IdKind, value: x.value, role: "contact" as const, where: x.app })),
  ];
}

function minutesAgoOf(r: Report, now: number): number {
  return Math.max(0, Math.round((now - Date.parse(r.createdAt)) / 60000) + (r.minutesAgo ?? 0));
}

export async function buildNetwork(): Promise<Built> {
  const entities = seedEntities();
  const reports = seedReports();
  const rings: NetRing[] = RINGS.map((r) => ({ ...r, evidence: [...r.evidence] }));
  const byKey = new Map(entities.map((e) => [e.key, e.id]));
  const now = Date.now();

  const live = (await listRecentReports()).slice().reverse(); // oldest first
  for (const r of live) {
    const paidTo: string[] = [];
    const contactedBy: string[] = [];
    reportIds(r).forEach((idf, i) => {
      const key = idKey(idf.kind, idf.value);
      let id = byKey.get(key);
      if (!id) {
        id = `x-${r.id}-${i}`;
        const angle = (i + 1) * 1.9;
        const kind: NetEntity["kind"] = idf.kind === "account" ? "account" : idf.kind === "payid" ? "payid" : idf.kind === "handle" ? "handle" : "phone";
        entities.push({ id, key, kind, label: idf.value, where: idf.where || (idf.role === "paid" ? "Bank account" : "Contact"), country: regionOf(r.country).name, x: r.x + Math.cos(angle) * 34, y: r.y + Math.sin(angle) * 34 });
        byKey.set(key, id);
      }
      (idf.role === "paid" ? paidTo : contactedBy).push(id);
    });
    if (!rings.some((g) => g.id === r.ring)) {
      rings.push({ id: r.ring, name: r.ringName, pattern: r.summaryEnglish || "A new pattern reported through the voice assistant.", evidence: [] });
    }
    const ring = rings.find((g) => g.id === r.ring)!;
    for (const m of r.matches) {
      ring.evidence.unshift({
        kind: m.kind === "receiver" ? "account" : m.kind === "contact" ? "contact" : "script",
        text:
          m.kind === "script"
            ? `Gemini matched a new voice report from ${r.city || regionOf(r.country).name} to this ring’s script`
            : `A new voice report from ${r.city || regionOf(r.country).name} named ${m.value}, already linked to ${m.otherReports} earlier report${m.otherReports === 1 ? "" : "s"}`,
        victims: m.otherReports + 1,
      });
    }
    reports.push({
      id: r.id,
      ring: r.ring,
      city: r.city || regionOf(r.country).name,
      country: regionOf(r.country).name,
      x: r.x,
      y: r.y,
      minutesAgo: minutesAgoOf(r, now),
      amount: r.amount ?? 0,
      currency: r.currency ?? regionOf(r.country).currency,
      usd: r.usd,
      paidTo,
      contactedBy,
      script: r.scriptQuote || r.story?.slice(0, 140) || "",
      live: true,
    });
  }
  for (const g of rings) g.evidence = g.evidence.slice(0, 5);

  // Impact, measured from the network itself (no estimates)
  const touching = new Map<string, NetReport[]>();
  for (const r of reports) for (const id of [...r.paidTo, ...r.contactedBy]) touching.set(id, [...(touching.get(id) ?? []), r]);
  const flagged = new Set<string>();
  const atRisk = new Set<string>();
  for (const e of entities) {
    const recent = reports.filter((r) => r.paidTo.includes(e.id) && r.minutesAgo <= 180);
    if (recent.length >= 3) {
      flagged.add(e.id);
      recent.forEach((r) => atRisk.add(r.id));
    }
  }
  const crossBorder = reports.filter((r) => [...r.paidTo, ...r.contactedBy].some((id) => (touching.get(id) ?? []).some((o) => o.country !== r.country))).length;
  const secs = live.map((r) => r.secondsToReport).filter((n): n is number => typeof n === "number").sort((a, b) => a - b);
  const impact: Impact = {
    reports: reports.length,
    countries: new Set(reports.map((r) => r.country)).size,
    flaggedAccounts: flagged.size,
    moneyAtRisk: reports.filter((r) => atRisk.has(r.id)).reduce((t, r) => t + r.usd, 0),
    crossBorder,
    liveReports: live.length,
    medianSeconds: secs.length ? secs[Math.floor(secs.length / 2)] : undefined,
    measured: secs.length,
  };

  return { network: { rings, entities, reports, generatedAt: new Date().toISOString(), impact }, byKey };
}

// ---------------------------------------------------------------------------
// Link and save a new report
// ---------------------------------------------------------------------------

export async function linkAndSave(draft: ReportDraft): Promise<Report> {
  const { network, byKey } = await buildNetwork();
  const id = newId();
  const region = regionOf(draft.country);
  const currency = draft.currency || region.currency;

  // Hard links: the same account, payment ID, phone or handle
  const ringVotes = new Map<string, number>();
  const matches: LinkMatch[] = [];
  for (const idf of reportIds(draft)) {
    const entityId = byKey.get(idKey(idf.kind, idf.value));
    if (!entityId) continue;
    const touching = network.reports.filter((r) => r.paidTo.includes(entityId) || r.contactedBy.includes(entityId));
    if (!touching.length) continue;
    for (const t of touching) ringVotes.set(t.ring, (ringVotes.get(t.ring) ?? 0) + 2);
    matches.push({ kind: idf.role === "paid" ? "receiver" : "contact", value: idf.value, otherReports: touching.length, countries: [...new Set(touching.map((t) => t.country))] });
  }

  // Soft link: the same script, in any language
  const sim = await similarRing([draft.scriptQuote, draft.story, draft.summaryEnglish].filter(Boolean).join("\n"));
  if (sim) {
    ringVotes.set(sim.ring, (ringVotes.get(sim.ring) ?? 0) + 1);
    const ringReports = network.reports.filter((r) => r.ring === sim.ring);
    matches.push({ kind: "script", value: RINGS.find((r) => r.id === sim.ring)?.name ?? sim.ring, otherReports: ringReports.length, countries: [...new Set(ringReports.map((r) => r.country))] });
  }

  const ranked = [...ringVotes.entries()].sort((a, b) => b[1] - a[1]);
  const ring = ranked[0]?.[0] ?? `n-${id}`;
  const ringName = network.rings.find((r) => r.id === ring)?.name ?? "New pattern";

  // Freeze threshold: a receiving account paid by 3 or more victims in the last 3 hours
  const freezeNow: string[] = [];
  for (const rcv of draft.receivers) {
    const entityId = byKey.get(idKey(rcv.kind, rcv.value));
    const recent = entityId ? network.reports.filter((r) => r.paidTo.includes(entityId) && r.minutesAgo <= 180).length : 0;
    if (recent + 1 >= 3) freezeNow.push(rcv.value);
  }

  const place = locate(draft.country, draft.city, id);
  const [x, y] = project(place.at);
  const report: Report = {
    ...draft,
    city: place.city || draft.city,
    currency,
    id,
    createdAt: new Date().toISOString(),
    ring,
    ringName,
    usd: toUsd(draft.amount ?? 0, currency),
    x,
    y,
    matches,
    freezeNow,
  };
  await saveReport(report);
  return report;
}
