"use client";

import { useState } from "react";
import { alertGuardian, saveGuardian, useGuardian, type Guardian } from "@/lib/rt/guardian";

const EMPTY: Guardian = { name: "", relation: "", phone: "", onReport: true, onCheck: true, onShield: true };

export function FamilyGuardian() {
  const saved = useGuardian();
  const [draft, setDraft] = useState<Guardian | null>(null);
  const g = draft ?? saved ?? EMPTY;
  const editing = draft !== null || !saved;
  const [msg, setMsg] = useState("");

  const set = (patch: Partial<Guardian>) => setDraft({ ...g, ...patch });
  const valid = g.name.trim().length > 0 && g.phone.replace(/\D/g, "").length >= 6;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 lg:pt-12">
      <p className="rt-pill rt-rise">Scammers isolate people. Guardians don’t.</p>
      <h1 className="t-h1 rt-rise mt-4" style={{ animationDelay: "60ms" }}>
        Family guardian
      </h1>
      <p className="t-lead rt-rise mt-3" style={{ animationDelay: "120ms" }}>
        Choose one person you trust, like a son, daughter or friend. If you report a scam, a check looks risky, or the call shield hears a scam, Golden Hour gets a message ready for them, so you’re never dealing with it alone.
      </p>

      {editing ? (
        <form
          className="rt-rise mt-7 rounded-3xl border border-line bg-surface p-5 sm:p-6"
          style={{ animationDelay: "180ms" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            saveGuardian({ ...g, name: g.name.trim(), relation: g.relation.trim(), phone: g.phone.trim() });
            setDraft(null);
            setMsg(`${g.name.trim()} is now your family guardian.`);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="g-name" className="rt-label">
                Their name
              </label>
              <input id="g-name" className="rt-input mt-1.5 w-full" autoComplete="off" value={g.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="g-rel" className="rt-label">
                They are my… <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id="g-rel" className="rt-input mt-1.5 w-full" placeholder="daughter, son, friend" value={g.relation} onChange={(e) => set({ relation: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="g-phone" className="rt-label">
                Their mobile number
              </label>
              <input id="g-phone" className="rt-input mt-1.5 w-full" type="tel" inputMode="tel" autoComplete="off" value={g.phone} onChange={(e) => set({ phone: e.target.value })} />
              <p className="mt-1 t-small text-muted">Saved only on this phone. Golden Hour never sends it anywhere.</p>
            </div>
          </div>
          <fieldset className="mt-5">
            <legend className="font-semibold">Let them know when…</legend>
            {(
              [
                ["onReport", "I report a scam"],
                ["onCheck", "A message I check looks like a scam"],
                ["onShield", "The call shield hears a scam"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="mt-2 flex min-h-11 cursor-pointer items-center gap-3">
                <input type="checkbox" className="h-5 w-5 accent-[var(--rt-ink)]" checked={g[k]} onChange={(e) => set({ [k]: e.target.checked })} />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="submit" className="rt-btn rt-btn-ink" disabled={!valid}>
              Save guardian
            </button>
            {saved && (
              <button type="button" className="rt-btn rt-btn-line" onClick={() => setDraft(null)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        saved && (
          <section aria-labelledby="g-h" className="rt-pop mt-7 rounded-3xl border-2 border-gold bg-paper p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gold-soft text-[1.4rem] font-bold text-gold-ink" aria-hidden="true">
                {saved.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 id="g-h" className="t-h3 !font-bold">
                  {saved.name}
                  {saved.relation && <span className="font-normal text-muted"> · {saved.relation}</span>}
                </h2>
                <p className="tabular text-muted">{saved.phone}</p>
              </div>
            </div>
            <ul className="mt-4 flex flex-wrap gap-1.5 t-small">
              {saved.onReport && <li className="rounded-full bg-surface px-2.5 py-1">When you report a scam</li>}
              {saved.onCheck && <li className="rounded-full bg-surface px-2.5 py-1">Risky checks</li>}
              {saved.onShield && <li className="rounded-full bg-surface px-2.5 py-1">Call shield warnings</li>}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="rt-btn rt-btn-ink" onClick={() => alertGuardian("test", "This is a test, everything is fine.")}>
                Send a test alert
              </button>
              <button type="button" className="rt-btn rt-btn-line" onClick={() => setDraft(saved)}>
                Edit
              </button>
              <button
                type="button"
                className="rt-btn rt-btn-ghost underline underline-offset-4"
                onClick={() => {
                  saveGuardian(null);
                  setMsg("Guardian removed.");
                }}
              >
                Remove
              </button>
            </div>
          </section>
        )
      )}
      <p className="sr-only" aria-live="polite">
        {msg}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ["You stay in control", "Alerts are prepared as a text message that you choose to send. In this demo, nothing is ever sent."],
          ["Private by design", "Your guardian’s details stay on this phone and are never uploaded."],
          ["Why it works", "Most scams rely on secrecy. One call from someone you trust can stop a payment."],
        ].map(([h, b]) => (
          <div key={h} className="rounded-2xl bg-surface p-4">
            <p className="font-semibold">{h}</p>
            <p className="mt-1 t-small text-muted">{b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
