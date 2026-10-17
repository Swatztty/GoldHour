import "server-only";

const buckets = new Map<string, number[]>();

/** Simple per-instance sliding window. Returns true when the caller should be refused. */
export function limited(req: Request, name: string, max: number, windowMs = 10 * 60 * 1000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${name}:${ip}`;
  const now = Date.now();
  const list = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  buckets.set(key, list);
  return list.length > max;
}
