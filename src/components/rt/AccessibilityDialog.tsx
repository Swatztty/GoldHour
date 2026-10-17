"use client";

import { LanguageSelect } from "./RtHeader";

import { useEffect, useRef } from "react";
import { setPrefs, usePrefs, type Prefs } from "@/lib/rt/prefs";

function Choice<T extends string | number>({
  legend,
  hint,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  hint?: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="mt-6">
      <legend className="t-h3">{legend}</legend>
      {hint && <p className="mt-0.5 t-small text-muted">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={String(o.value)} className="cursor-pointer">
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" />
            <span className="rt-btn rt-btn-line peer-checked:!border-ink peer-checked:!bg-ink peer-checked:!text-paper peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--rt-focus)]">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-6 flex cursor-pointer items-start gap-4">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-[var(--rt-ink)]" />
      <span>
        <span className="t-h3 block">{label}</span>
        {hint && <span className="mt-0.5 block t-small text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function AccessibilityDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const prefs = usePrefs();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const set = (patch: Partial<Prefs>) => setPrefs(patch);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="a11y-title"
      className="m-auto max-h-[92dvh] w-[min(40rem,94vw)] overflow-y-auto rounded-3xl border border-line bg-paper p-0 text-ink backdrop:bg-black/50"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 id="a11y-title" className="t-h2">
            Make it easier to use
          </h2>
          <button type="button" onClick={onClose} className="rt-btn rt-btn-line" aria-label="Close settings">
            <svg viewBox="0 0 16 16" className="h-4 w-4" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        <p className="mt-1 t-small text-muted">These settings are saved on this device and apply everywhere in Golden Hour.</p>

        <div className="mt-6">
          <p className="t-h3" id="lang-legend">
            Language of the screen
          </p>
          <p className="t-small text-muted">The voice assistant always answers in the language you speak.</p>
          <LanguageSelect id="lang-dialog" className="mt-2 w-full sm:w-72" />
        </div>

        <Choice
          legend="Text size"
          name="text"
          value={prefs.textSize}
          onChange={(v) => set({ textSize: v })}
          options={[
            { value: 100, label: "Normal" },
            { value: 125, label: "Large" },
            { value: 150, label: "Larger" },
            { value: 200, label: "Largest" },
          ]}
        />

        <Choice
          legend="How should replies reach you?"
          hint="Choose screen reader if you use VoiceOver, TalkBack, NVDA or JAWS, so you don’t hear two voices at once."
          name="replies"
          value={prefs.replies}
          onChange={(v) => set({ replies: v })}
          options={[
            { value: "voice", label: "Spoken aloud" },
            { value: "screenreader", label: "My screen reader" },
            { value: "text", label: "Text only" },
          ]}
        />

        <Toggle
          label="Show captions"
          hint="Everything the assistant says, and what it heard you say, appears as large text."
          checked={prefs.captions}
          onChange={(v) => set({ captions: v })}
        />
        <Toggle label="Easy read" hint="Shorter sentences, simpler words, one step at a time." checked={prefs.easyRead} onChange={(v) => set({ easyRead: v })} />
        <Toggle label="High contrast" hint="Black and white with stronger outlines." checked={prefs.contrast === "high"} onChange={(v) => set({ contrast: v ? "high" : "standard" })} />
        <Toggle label="Reduce motion" hint="Turns off moving lines and pulsing." checked={prefs.reduceMotion} onChange={(v) => set({ reduceMotion: v })} />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <a href="/accessibility" className="font-semibold underline underline-offset-4">
            Accessibility statement
          </a>
          <button type="button" onClick={onClose} className="rt-btn rt-btn-ink">
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
