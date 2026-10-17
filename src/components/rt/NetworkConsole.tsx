"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { subscribeNetworkEvents } from "@/lib/client";
import { guessLang } from "@/lib/rt/speech";
import type { NetEntity, NetReport, Network } from "@/lib/rt/types";

export interface MapGeo {
  w: number;
  h: number;
  land: string[];
  labels: { name: string; xy: [number, number] }[];
}

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const RECENT_MIN = 120;
const FREEZE_MIN = 180;
const SYMBOL: Record<string, string> = { SGD: "S$", MYR: "RM ", THB: "฿", HKD: "HK$", INR: "₹", PHP: "₱", IDR: "Rp ", AUD: "A$", JPY: "¥", USD: "US$" };
const usd = (n: number) => `US$${Math.round(n).toLocaleString("en-US")}`;
const local = (r: NetReport) => `${SYMBOL[r.currency] ?? `${r.currency} `}${r.amount.toLocaleString(r.currency === "INR" ? "en-IN" : "en-US")}`;
const ago = (m: number) => (m <= 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`);

function curve(a: [number, number], b: [number, number], bend = 0.22): string {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const cx = (x1 + x2) / 2 - (y2 - y1) * bend;
  const cy = (y1 + y2) / 2 + (x2 - x1) * bend;
  return `M${x1} ${y1} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}`;
}

function useTween(target: View, ms = 850): View {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
    const a = cur.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = reduce ? 1 : Math.min(1, (t - start) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const next = { x: a.x + (target.x - a.x) * e, y: a.y + (target.y - a.y) * e, w: a.w + (target.w - a.w) * e, h: a.h + (target.h - a.h) * e };
      cur.current = next;
      setV(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setV(a + (target - a) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

interface EntityStat {
  entity: NetEntity;
  victims: NetReport[];
  countries: string[];
  recentUsd: number;
  freezeVictims: number;
  isMoneyDest: boolean;
}

export function NetworkConsole({ geo, initial, demo }: { geo: MapGeo; initial: Network; demo: NetReport }) {
  const [net, setNet] = useState(initial);
  const [ring, setRing] = useState(initial.rings[0]?.id ?? "r1");
  // On narrow screens the whole region is drawn small, so marks and labels are drawn larger to stay legible
  const mapRef = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [zoomed, setZoomed] = useState(false);
  const [demoState, setDemoState] = useState<"idle" | "arriving" | "linked">("idle");
  const [arrival, setArrival] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});
  const [hover, setHover] = useState<string | null>(null);
  const known = useRef(new Set(initial.reports.map((r) => r.id)));

  // Arriving from a report (?focus=id): zoom to its ring and replay the moment it linked
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("focus");
    const r = id ? initial.reports.find((x) => x.id === id) : undefined;
    if (!r) return;
    const t1 = window.setTimeout(() => {
      setRing(r.ring);
      setZoomed(true);
    }, 500);
    const t2 = window.setTimeout(() => setArrival(r.id), 1400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [initial.reports]);

  // Live updates: poll, plus an instant nudge when a report is sent from another tab on this device
  useEffect(() => {
    let stop = false;
    const refresh = async () => {
      try {
        const res = await fetch("/api/network", { cache: "no-store" });
        if (!res.ok) return;
        const n = (await res.json()) as Network;
        if (stop) return;
        const fresh = n.reports.filter((r) => !known.current.has(r.id));
        n.reports.forEach((r) => known.current.add(r.id));
        setNet(n);
        if (fresh.length) {
          const latest = fresh[fresh.length - 1];
          setRing(latest.ring);
          setZoomed(true);
          setArrival(latest.id);
        }
      } catch {
        /* offline: keep current view */
      }
    };
    const id = setInterval(refresh, 8000);
    let unsub = () => {};
    subscribeNetworkEvents(refresh).then((u) => (unsub = u));
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("golden-hour");
      bc.onmessage = () => refresh();
    } catch {
      /* not supported */
    }
    return () => {
      stop = true;
      clearInterval(id);
      bc?.close();
      unsub();
    };
  }, []);

  const reports = useMemo(() => {
    const base = net.reports;
    if (demoState === "idle") return base;
    return [{ ...demo, live: true }, ...base];
  }, [net.reports, demo, demoState]);
  const visible = (r: NetReport) => r.id !== demo.id || demoState === "linked";

  const entityById = useMemo(() => new Map(net.entities.map((e) => [e.id, e])), [net.entities]);
  const P = (id: string): [number, number] => {
    const r = reports.find((x) => x.id === id);
    if (r) return [r.x, r.y];
    const e = entityById.get(id);
    return e ? [e.x, e.y] : [0, 0];
  };

  const stats = useMemo(() => {
    const m = new Map<string, EntityStat>();
    for (const e of net.entities) m.set(e.id, { entity: e, victims: [], countries: [], recentUsd: 0, freezeVictims: 0, isMoneyDest: e.kind === "account" || e.kind === "payid" });
    for (const r of reports) {
      if (!visible(r)) continue;
      const share = r.paidTo.length ? r.usd / r.paidTo.length : 0;
      for (const id of r.paidTo) {
        const s = m.get(id);
        if (!s) continue;
        s.victims.push(r);
        if (r.minutesAgo <= RECENT_MIN) s.recentUsd += share;
        if (r.minutesAgo <= FREEZE_MIN) s.freezeVictims += 1;
      }
      for (const id of r.contactedBy) m.get(id)?.victims.push(r);
    }
    for (const s of m.values()) s.countries = [...new Set(s.victims.map((v) => v.country))];
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, net.entities, demoState]);

  const flagged = [...stats.values()].filter((s) => s.isMoneyDest && s.recentUsd > 0);
  const recoverable = flagged.reduce((a, s) => a + s.recentUsd, 0);
  const recoverableShown = useCountUp(recoverable);

  const ringStats = net.rings
    .map((rg) => {
      const rs = reports.filter((r) => r.ring === rg.id && visible(r));
      return { ring: rg, victims: rs.length, countries: [...new Set(rs.map((r) => r.country))], usd: rs.reduce((a, r) => a + r.usd, 0) };
    })
    .filter((x) => x.victims > 0);

  // Alert: the newest arrival (demo or real) paid an account that has now reached the freeze threshold
  const arrivalId = demoState === "linked" ? demo.id : arrival;
  const arrivalReport = arrivalId ? reports.find((r) => r.id === arrivalId) : undefined;
  const alertStat = arrivalReport
    ? arrivalReport.paidTo
        .map((id) => stats.get(id))
        .filter((s): s is EntityStat => !!s && s.freezeVictims >= 3)
        .sort((a, b) => b.freezeVictims - a.freezeVictims)[0]
    : undefined;

  const full: View = useMemo(() => ({ x: 0, y: 0, w: geo.w, h: geo.h }), [geo.w, geo.h]);
  const target: View = useMemo(() => {
    if (!zoomed) return full;
    const ids = [
      ...reports.filter((r) => r.ring === ring && visible(r)).map((r) => [r.x, r.y] as [number, number]),
      ...[...stats.values()].filter((s) => s.victims.some((v) => v.ring === ring)).map((s) => [s.entity.x, s.entity.y] as [number, number]),
    ];
    if (!ids.length) return full;
    const xs = ids.map((p) => p[0]);
    const ys = ids.map((p) => p[1]);
    const pad = 70;
    let w = Math.max(Math.max(...xs) - Math.min(...xs) + pad * 2, 320) * 1.25;
    let h = Math.max(Math.max(...ys) - Math.min(...ys) + pad * 2, 260) * 1.1;
    const aspect = geo.w / geo.h;
    if (w / h > aspect) h = w / aspect;
    else w = h * aspect;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2 - w * 0.08;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2 + h * 0.04;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomed, ring, reports, stats, full, geo.w, geo.h, demoState]);
  const view = useTween(target);

  // A short two-tone chime and a vibration when a freeze alert appears (skipped for reduced motion)
  const alertKey = alertStat ? `${arrivalId}:${alertStat.entity.id}` : "";
  useEffect(() => {
    if (!alertKey) return;
    const calm = document.documentElement.dataset.motion === "reduce" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      if (!calm && navigator.userActivation?.hasBeenActive) navigator.vibrate?.([180, 90, 180]);
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      [880, 660].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.18 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.16);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.18);
        o.stop(ctx.currentTime + i * 0.18 + 0.18);
      });
      window.setTimeout(() => ctx.close().catch(() => {}), 800);
    } catch {
      /* audio not allowed until the page is touched */
    }
  }, [alertKey]);
  const k = (view.w / geo.w) * (narrow ? 1.9 : 1);

  function pickRing(id: string) {
    setRing(id);
    setZoomed(true);
  }

  function runDemo() {
    if (demoState !== "idle") {
      setDemoState("idle");
      setSent({});
      setZoomed(false);
      return;
    }
    setRing(demo.ring);
    setZoomed(true);
    window.setTimeout(() => setDemoState("arriving"), 700);
    window.setTimeout(() => setDemoState("linked"), 2300);
  }

  const sel = net.rings.find((r) => r.id === ring) ?? net.rings[0];
  const selStats = ringStats.find((r) => r.ring.id === ring);
  const ringEntities = [...stats.values()].filter((s) => s.victims.some((v) => v.ring === ring)).sort((a, b) => b.victims.length - a.victims.length);
  const hoverEntity = hover ? entityById.get(hover) : undefined;
  const hoverReport = hover ? reports.find((r) => r.id === hover) : undefined;
  const totalCountries = new Set(reports.filter(visible).map((r) => r.country)).size;
  const liveCount = net.reports.filter((r) => r.live).length;

  return (
    <div className="grid lg:h-full lg:grid-cols-[minmax(0,1fr)_28rem]">
      {/* Map */}
      <section ref={mapRef} className="relative h-[min(72svh,40rem)] overflow-hidden bg-sea lg:h-auto lg:min-h-0" aria-labelledby="map-title" data-tour="map">
        <h1 id="map-title" className="sr-only">
          Scam network map
        </h1>
        <p id="map-summary" className="sr-only">
          {reports.filter(visible).length} scam reports in {totalCountries} countries, grouped into {ringStats.length} rings. The same information is listed in the panel next to the map.
        </p>
        <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" role="img" aria-labelledby="map-title map-summary">
          <g>
            {geo.land.map((d, i) => (
              <path key={i} d={d} className="rt-land" style={{ strokeWidth: 0.7 * k }} />
            ))}
          </g>
          <g aria-hidden="true">
            {geo.labels.map((l) => (
              <text key={l.name} x={l.xy[0]} y={l.xy[1]} className="rt-country" textAnchor="middle" style={{ fontSize: 12 * k }}>
                {l.name}
              </text>
            ))}
          </g>
          <g fill="none" aria-hidden="true">
            {reports.map((r, ri) => {
              if (!visible(r)) return null;
              const fresh = r.id === arrivalId;
              return (
                <g key={r.id} opacity={r.ring === ring ? 1 : 0.16} className="rt-fade">
                  {r.contactedBy.map((id) => (
                    <path key={id} d={curve([r.x, r.y], P(id), -0.18)} className="rt-contact" style={{ strokeDasharray: `${3 * k} ${3 * k}`, strokeWidth: 1.1 * k }} />
                  ))}
                  {r.paidTo.map((id, j) => (
                    <path
                      key={id}
                      d={curve([r.x, r.y], P(id))}
                      pathLength={1}
                      className={`rt-thread ${fresh ? "rt-draw-live" : "rt-draw"}`}
                      style={{ animationDelay: fresh ? `${j * 220}ms` : `${300 + ri * 60 + j * 90}ms`, strokeWidth: (fresh ? 2.8 : 1.7) * k }}
                    />
                  ))}
                </g>
              );
            })}
          </g>
          <g aria-hidden="true">
            {net.entities.map((e) => {
              const s = stats.get(e.id)!;
              if (!s.victims.length) return null;
              const on = s.victims.some((v) => v.ring === ring);
              const hot = alertStat?.entity.id === e.id;
              const frozen = !!sent[e.id];
              return (
                <g key={e.id} transform={`translate(${e.x} ${e.y}) scale(${k})`} opacity={on ? 1 : 0.25} className="rt-fade cursor-pointer" onMouseEnter={() => setHover(e.id)} onMouseLeave={() => setHover(null)} onClick={() => pickRing(s.victims[0].ring)}>
                  {hot && !frozen && <circle r="16" className="rt-alert-ring" />}
                  {s.isMoneyDest ? (
                    <rect x="-5.5" y="-5.5" width="11" height="11" transform={e.kind === "payid" ? "rotate(45)" : undefined} className={frozen ? "rt-acct-frozen" : "rt-acct"} />
                  ) : (
                    <circle r="4.5" className="rt-contact-node" />
                  )}
                </g>
              );
            })}
            {reports.map((r) => {
              if (r.id === demo.id && demoState === "idle") return null;
              const fresh = r.id === arrivalId;
              return (
                <g key={r.id} transform={`translate(${r.x} ${r.y}) scale(${k})`} opacity={r.ring === ring ? 1 : 0.3} className="rt-fade cursor-pointer" onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onClick={() => pickRing(r.ring)}>
                  {fresh && <circle r="5" className="rt-ping" />}
                  <circle r={fresh ? 6 : 4.5} className={fresh || r.live ? "rt-report-live" : "rt-report"} />
                </g>
              );
            })}
            {(hoverEntity || hoverReport) && (
              <g transform={`translate(${P(hover!)[0] + 12 * k} ${P(hover!)[1] - 12 * k}) scale(${k})`} pointerEvents="none">
                <text className="rt-tip-halo">{hoverEntity ? `${hoverEntity.where} ${hoverEntity.label}` : `${hoverReport!.city}, ${local(hoverReport!)}`}</text>
                <text className="rt-tip">{hoverEntity ? `${hoverEntity.where} ${hoverEntity.label}` : `${hoverReport!.city}, ${local(hoverReport!)}`}</text>
              </g>
            )}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-5 sm:p-7">
          <p className="pointer-events-auto max-w-sm text-muted">
            Every scam report in Asia-Pacific, linked, so the accounts can be frozen before the next person pays.
          </p>
          <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
            <button type="button" onClick={runDemo} className="rt-btn rt-btn-ink" data-tour="run-demo">
              {demoState === "idle" ? "Run live demo" : "Reset demo"}
            </button>
            {zoomed && (
              <button type="button" onClick={() => setZoomed(false)} className="rt-btn !min-h-0 !py-1 text-sm underline underline-offset-4">
                Show all of Asia-Pacific
              </button>
            )}
          </div>
        </div>

        <div className="rt-foot pointer-events-none absolute bottom-0 left-0 p-5 pr-16 pt-16 sm:p-7 sm:pr-24 sm:pt-20">
          <p className="rt-display rt-big tabular" aria-hidden="true">
            {usd(recoverableShown)}
          </p>
          <p className="sr-only">{usd(recoverable)}</p>
          <p className="mt-1 max-w-sm text-muted">paid into {flagged.length} flagged accounts in the last 2 hours. Freezing them now could still stop it moving on.</p>
          <ul className="mt-4 hidden flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted sm:flex" aria-label="Map key">
            <li className="flex items-center gap-2">
              <svg width="10" height="10" aria-hidden="true">
                <circle cx="5" cy="5" r="4" fill="var(--rt-ink)" />
              </svg>
              Victim report
            </li>
            <li className="flex items-center gap-2">
              <svg width="10" height="10" aria-hidden="true">
                <circle cx="5" cy="5" r="4" fill="var(--rt-red)" />
              </svg>
              Reported by voice today
            </li>
            <li className="flex items-center gap-2">
              <svg width="12" height="12" aria-hidden="true">
                <rect x="1.5" y="1.5" width="9" height="9" fill="var(--rt-sea)" stroke="var(--rt-red)" strokeWidth="2" />
              </svg>
              Receiving account
            </li>
            <li className="flex items-center gap-2">
              <svg width="22" height="6" aria-hidden="true">
                <path d="M1 3h20" stroke="var(--rt-red)" strokeWidth="2" />
              </svg>
              Money sent
            </li>
            <li className="flex items-center gap-2">
              <svg width="22" height="6" aria-hidden="true">
                <path d="M1 3h20" stroke="var(--rt-muted)" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
              Same scammer contact
            </li>
          </ul>
        </div>
        <p className="absolute bottom-3 right-4 hidden text-xs text-muted lg:block">Seed data is fictional. Red dots are reports made through Golden Hour.</p>
      </section>

      {/* Panel: the accessible equivalent of the map */}
      <aside className="relative overflow-y-auto border-l border-line bg-paper" aria-label="Scam rings and accounts">
        <div aria-live="assertive">
          {demoState === "arriving" && (
            <div className="rt-slide border-b border-line px-6 py-5">
              <p className="font-semibold">New report from {demo.city}</p>
              <p className="mt-1 text-muted">Gemini is reading it and matching it against {net.reports.length} open reports…</p>
            </div>
          )}
          {alertStat && (
            <section className="rt-alert border-b border-line px-6 py-6" aria-labelledby="alert-h">
              <p className="font-semibold text-red">Freeze this account now</p>
              <h2 id="alert-h" className="t-h2 mt-1">
                {alertStat.entity.where} {alertStat.entity.label}
              </h2>
              <p className="mt-2 leading-relaxed">
                The new report from {arrivalReport?.city} paid the same account as {alertStat.freezeVictims - 1} earlier victims. In the last 3 hours it received money from{" "}
                <strong>
                  {alertStat.freezeVictims} victims in {alertStat.countries.length} {alertStat.countries.length === 1 ? "country" : "countries"}
                </strong>
                , about <strong>{usd(alertStat.recentUsd)}</strong>.
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Countries">
                {alertStat.countries.map((c) => (
                  <li key={c} className="rt-chip">
                    {c}
                  </li>
                ))}
              </ul>
              {sent[alertStat.entity.id] ? (
                <p className="mt-5 flex items-center gap-2 font-semibold" role="status">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                  Freeze request sent to {alertStat.entity.where} at {sent[alertStat.entity.id]} (demo)
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSent((s) => ({ ...s, [alertStat.entity.id]: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }))}
                    className="rt-btn rt-btn-red mt-5"
                  >
                    Send freeze request to {alertStat.entity.where}
                  </button>
                  <p className="mt-2 t-small text-muted">Demo: the request is simulated and nothing is sent to the bank.</p>
                </>
              )}
            </section>
          )}
        </div>

        {net.impact && (
          <section className="border-b border-line px-6 py-5" aria-labelledby="impact-h" data-tour="impact">
            <h2 id="impact-h" className="t-h3">
              Impact right now
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              {[
                [formatUsd(net.impact.moneyAtRisk), "paid into accounts flagged to freeze"],
                [String(net.impact.flaggedAccounts), `account${net.impact.flaggedAccounts === 1 ? "" : "s"} flagged (3+ victims in 3 hours)`],
                [`${net.impact.crossBorder} of ${net.impact.reports}`, "reports linked across borders"],
                net.impact.medianSeconds
                  ? [formatDuration(net.impact.medianSeconds), `median time to report (${net.impact.measured} report${net.impact.measured === 1 ? "" : "s"} via the app)`]
                  : [String(net.impact.countries), "countries reporting"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-2xl bg-surface px-3.5 py-3">
                  <dt className="sr-only">{l}</dt>
                  <dd className="rt-display text-[1.6rem] font-bold leading-tight tabular">{v}</dd>
                  <dd className="t-small text-muted">{l}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className="px-6 pt-6" aria-labelledby="rings-h" data-tour="rings">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="rings-h" className="t-h3">
              Scam rings found
            </h2>
            {liveCount > 0 && <p className="t-small text-muted">{liveCount} reported by voice today</p>}
          </div>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {ringStats.map((rs) => (
              <li key={rs.ring.id}>
                <button
                  type="button"
                  onClick={() => pickRing(rs.ring.id)}
                  aria-pressed={ring === rs.ring.id}
                  className={`flex min-h-11 w-full items-baseline justify-between gap-3 py-3 text-left ${ring === rs.ring.id ? "" : "text-muted hover:text-ink"}`}
                >
                  <span className="flex items-baseline gap-2.5">
                    <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ring === rs.ring.id ? "bg-red" : "bg-line-strong"}`} aria-hidden="true" />
                    <span className="font-semibold">{rs.ring.name}</span>
                  </span>
                  <span className="tabular shrink-0 text-sm">
                    {rs.victims} victims, {rs.countries.length} {rs.countries.length === 1 ? "country" : "countries"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {sel && (
          <section className="px-6 py-6" aria-labelledby="ring-h">
            <h2 id="ring-h" className="t-h2">
              {sel.name}
            </h2>
            <p className="mt-1 text-muted">{sel.pattern}</p>
            {selStats && (
              <p className="mt-3 tabular">
                <strong>{usd(selStats.usd)}</strong> lost by {selStats.victims} victims in {selStats.countries.join(", ")}
              </p>
            )}
            {sel.evidence.length > 0 && (
              <>
                <h3 className="mt-6 font-semibold">How Gemini linked these reports</h3>
                <ul className="mt-2 space-y-3">
                  {sel.evidence.map((ev, i) => (
                    <li key={`${ev.text}-${i}`} className="grid grid-cols-[18px_1fr] gap-2.5">
                      <span className="mt-1.5" aria-hidden="true">
                        {ev.kind === "account" ? (
                          <svg width="12" height="12">
                            <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="var(--rt-red)" strokeWidth="2" />
                          </svg>
                        ) : ev.kind === "contact" ? (
                          <svg width="14" height="12">
                            <path d="M1 6h12" stroke="var(--rt-muted)" strokeWidth="1.6" strokeDasharray="3 2" />
                          </svg>
                        ) : (
                          <svg width="14" height="12">
                            <path d="M2 3h10M2 6h7M2 9h9" stroke="var(--rt-ink)" strokeWidth="1.4" />
                          </svg>
                        )}
                      </span>
                      <span className="leading-snug">
                        <span className="sr-only">{ev.kind === "account" ? "Shared account: " : ev.kind === "contact" ? "Shared contact: " : "Same script: "}</span>
                        {ev.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div data-tour="accounts">
            <h3 className="mt-7 font-semibold" id="acct-h">
              Accounts and contacts
            </h3>
            <table className="mt-2 w-full text-sm" aria-labelledby="acct-h">
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col" className="pb-1.5 font-medium">
                    Where
                  </th>
                  <th scope="col" className="pb-1.5 text-right font-medium">
                    Victims
                  </th>
                  <th scope="col" className="pb-1.5 text-right font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line border-t border-line">
                {ringEntities.map((s) => {
                  const status = sent[s.entity.id] ? "Freeze requested" : s.isMoneyDest ? (s.freezeVictims >= 3 ? "Freeze now" : s.recentUsd > 0 ? "Watch" : "Flagged") : "Reported";
                  return (
                    <tr key={s.entity.id}>
                      <td className="py-2 pr-2">
                        <span className="block font-medium">{s.entity.where}</span>
                        <span className="block break-all text-muted">{s.entity.label}</span>
                      </td>
                      <td className="py-2 text-right align-top tabular">{s.victims.length}</td>
                      <td className={`py-2 pl-2 text-right align-top ${status === "Freeze now" ? "font-semibold text-red" : "text-muted"}`}>{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            <h3 className="mt-7 font-semibold" id="latest-h">
              Latest reports
            </h3>
            <ul className="mt-2 divide-y divide-line border-t border-line text-sm" aria-labelledby="latest-h">
              {reports
                .filter((r) => r.ring === ring && visible(r))
                .sort((a, b) => a.minutesAgo - b.minutesAgo)
                .map((r) => (
                  <li key={r.id} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">
                        {r.city}, {r.country}
                        {r.live && <span className="ml-2 rounded-full bg-red-soft px-2 py-0.5 text-xs font-semibold text-red">Voice report</span>}
                      </span>
                      <span className="tabular shrink-0">{local(r)}</span>
                    </div>
                    {r.script && (
                      <p className="mt-0.5 text-muted">
                        <span className="tabular">{ago(r.minutesAgo)}</span>. “<span lang={guessLang(r.script)}>{r.script}</span>”
                      </p>
                    )}
                  </li>
                ))}
            </ul>
            <p className="mt-8 text-xs text-muted lg:hidden">Seed data is fictional. Red dots are reports made through Golden Hour.</p>
          </section>
        )}
      </aside>
    </div>
  );
}

function formatUsd(n: number) {
  return n >= 1000 ? `US$${Math.round(n / 100) / 10}k` : `US$${Math.round(n)}`;
}

function formatDuration(sec: number) {
  if (sec < 90) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m} min`;
}
