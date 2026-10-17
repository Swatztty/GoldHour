"use client";

import { useState } from "react";
import { callChecklist, callScript } from "@/lib/rt/guided";
import { regionOf, firstCall } from "@/lib/regions";
import { speak, stopSpeaking } from "@/lib/rt/speech";
import type { ReportDraft } from "@/lib/rt/types";
import { PhoneIcon } from "./RtHeader";

/**
 * Shown at the top of the conversation until the person says they have called.
 * Golden Hour never puts questions between a victim and the call that can stop the money.
 */
export function CallFirstBar({ draft, onCalled }: { draft: ReportDraft; onCalled: () => void }) {
  const region = regionOf(draft.country);
  const call = firstCall(region);
  return (
    <div role="region" aria-labelledby="callfirst-h" className="rt-pop mt-4 rounded-2xl border-2 border-red bg-red-soft p-4 sm:p-5">
      <h2 id="callfirst-h" className="font-semibold text-lg leading-snug">
        {call.href ? `Haven’t called yet? Call ${call.number} now.` : "Haven’t called yet? Call your bank’s fraud line now."}
      </h2>
      <p className="mt-1 t-small">
        {region.hotline
          ? `${region.hotline.name}. It’s the fastest way to stop the money. Keep this screen open: the details they’ll ask for build up as you talk.`
          : "Use the number on the back of your card or in your banking app, never one from a search result or a message. Keep this screen open: the details they’ll ask for build up as you talk."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {call.href && (
          <a href={call.href} onClick={onCalled} className="rt-btn rt-btn-red">
            <PhoneIcon />
            {call.label}
          </a>
        )}
        <button type="button" className="rt-btn rt-btn-line !bg-paper" onClick={onCalled}>
          I’ve already called
        </button>
      </div>
    </div>
  );
}

/** "Ready for the call": what the bank will ask, what we have, and the words to read out. */
export function CallReady({ draft }: { draft: ReportDraft }) {
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState(false);
  const list = callChecklist(draft);
  const script = callScript(draft);
  const have = list.filter((x) => x.have).length;

  async function copy() {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the text is on screen to read */
    }
  }
  function readAloud() {
    if (!script) return;
    if (reading) {
      stopSpeaking();
      setReading(false);
      return;
    }
    setReading(true);
    speak(script, "en", () => setReading(false));
  }

  return (
    <section aria-labelledby="ready-h" className="rounded-2xl border border-line bg-paper p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="ready-h" className="font-semibold">
          Ready for the call
        </h3>
        <span className="tabular t-small font-semibold text-muted">
          {have} of {list.length}
        </span>
      </div>
      <p className="mt-0.5 t-small text-muted">What the bank or hotline asks for first.</p>
      <ul className="mt-2 space-y-1.5">
        {list.map((x) => (
          <li key={x.label} className="flex gap-2 t-small">
            <span aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${x.have ? "bg-ok" : "border-2 border-line-strong"}`} />
            <span className="min-w-0">
              <span className="font-semibold">{x.label}: </span>
              {x.have ? <span className="break-words tabular">{x.have}</span> : <span className="text-muted">{x.tip}</span>}
            </span>
          </li>
        ))}
      </ul>
      {script && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="t-small font-semibold">Read this out</p>
          <p className="mt-1 rounded-xl bg-gold-soft p-3 leading-relaxed" lang="en">
            {script}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="rt-btn rt-btn-line !min-h-10" onClick={readAloud} aria-pressed={reading}>
              {reading ? "Stop reading" : "Read aloud"}
            </button>
            <button type="button" className="rt-btn rt-btn-line !min-h-10" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
