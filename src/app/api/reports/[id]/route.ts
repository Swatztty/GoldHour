import type { NextRequest } from "next/server";
import { getReport } from "@/lib/server/store";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/reports/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{6,20}$/.test(id)) return Response.json({ error: "Report not found" }, { status: 404 });
  const r = await getReport(id);
  if (!r) return Response.json({ error: "Report not found" }, { status: 404 });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
