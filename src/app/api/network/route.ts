import { connection } from "next/server";
import { buildNetwork } from "@/lib/server/network";

/** Anonymised network for the console: cities, amounts, receiving accounts and links. No names or contact details of victims. */
export async function GET() {
  await connection();
  const { network } = await buildNetwork();
  return Response.json(network, { headers: { "Cache-Control": "no-store" } });
}
