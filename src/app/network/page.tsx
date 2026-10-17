import { connection } from "next/server";
import { Suspense } from "react";
import { NetworkConsole } from "@/components/rt/NetworkConsole";
import { BottomNav, RtHeader } from "@/components/rt/RtHeader";
import { COUNTRY_LABELS, INCOMING } from "@/lib/radar/data";
import { landPaths, MAP_H, MAP_W, project } from "@/lib/radar/geo";
import { buildNetwork } from "@/lib/server/network";
import type { NetReport } from "@/lib/rt/types";

export const metadata = {
  title: "Scam network: Golden Hour",
  description: "Every scam report in Asia-Pacific, linked, so mule accounts can be frozen before the next victim pays.",
};

async function Console() {
  await connection();
  const { network } = await buildNetwork();
  const [dx, dy] = project(INCOMING.at);
  const demo: NetReport = {
    id: INCOMING.id,
    ring: INCOMING.ring,
    city: INCOMING.city,
    country: INCOMING.country,
    x: dx,
    y: dy,
    minutesAgo: 0,
    amount: INCOMING.amount,
    currency: INCOMING.currency,
    usd: INCOMING.usd,
    paidTo: INCOMING.paidTo,
    contactedBy: INCOMING.contactedBy,
    script: INCOMING.script,
  };
  const geo = { w: MAP_W, h: MAP_H, land: landPaths(), labels: COUNTRY_LABELS.map((l) => ({ name: l.name, xy: project(l.at) })) };
  return <NetworkConsole geo={geo} initial={network} demo={demo} />;
}

export default function NetworkPage() {
  return (
    <div className="lg:flex lg:h-dvh lg:flex-col">
      <RtHeader current="network" />
      <main id="main" tabIndex={-1} lang="en" className="lg:min-h-0 lg:flex-1">
        <Suspense fallback={<p className="p-8 text-lg">Loading the network…</p>}>
          <Console />
        </Suspense>
      </main>
      <BottomNav current="network" />
    </div>
  );
}
