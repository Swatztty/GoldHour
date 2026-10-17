"use client";

import { useEffect, useRef, useState } from "react";
import { isDemo } from "@/lib/rt/demo";

interface Notice {
  kind: "call" | "text" | "email";
  target: string;
  label: string;
}

/**
 * Catches every call, text and email link on every page (mouse, touch, keyboard or voice control)
 * and, in demo mode, explains what would happen instead of contacting anyone.
 */
export function DemoGuard() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="tel:"], a[href^="sms:"], a[href^="mailto:"]') as HTMLAnchorElement | null;
      if (!a || !isDemo()) return;
      e.preventDefault();
      e.stopPropagation();
      const href = a.getAttribute("href") ?? "";
      const kind: Notice["kind"] = href.startsWith("tel:") ? "call" : href.startsWith("sms:") ? "text" : "email";
      const target = kind === "email" ? "" : href.replace(/^(tel|sms):/, "");
      returnFocus.current = a;
      setNotice({ kind, target, label: a.getAttribute("title") || a.textContent?.trim() || "" });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (notice && !d.open) d.showModal();
    if (!notice && d.open) d.close();
  }, [notice]);

  function close() {
    setNotice(null);
    setTimeout(() => returnFocus.current?.focus(), 0);
  }

  const spaced = notice?.target.split("").join(" ");

  return (
    <dialog
      ref={ref}
      onClose={close}
      aria-labelledby="demo-title"
      aria-describedby="demo-body"
      className="m-auto w-[min(30rem,92vw)] rounded-3xl border border-line bg-paper p-0 text-ink backdrop:bg-black/50"
    >
      {notice && (
        <div className="p-6 sm:p-7">
          <p className="rt-eyebrow">Demo version</p>
          <h2 id="demo-title" className="t-h2 mt-1">
            {notice.kind === "call" ? "No call was made" : notice.kind === "text" ? "No message was sent" : "No email was opened"}
          </h2>
          <div id="demo-body" className="mt-3 space-y-3 text-muted">
            {notice.kind === "email" ? (
              <p>In the live service, this opens your email app with the letter ready to send. In this demo, email is switched off so no bank or agency receives anything.</p>
            ) : (
              <p>
                In the live service, this button {notice.kind === "call" ? "calls" : "texts"}{" "}
                <span className="font-semibold text-ink">
                  <span aria-hidden="true">{notice.target}</span>
                  <span className="sr-only">{spaced}</span>
                </span>
                {notice.label && !notice.label.includes(notice.target) ? ` (${notice.label})` : ""}. In this demo, calls and messages are switched off so no real hotline, bank or person is contacted.
              </p>
            )}
            <p>If you have really lost money, use your own phone to call your bank or your country’s scam hotline.</p>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={close} className="rt-btn rt-btn-ink" autoFocus>
              OK
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
