"use client";

import { useEffect, useState } from "react";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** "Install the app" for Android and desktop Chrome/Edge, with a short how-to for iPhone and iPad. */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    // Read the environment once, after hydration
    const t = window.setTimeout(() => {
      setInstalled(standalone);
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);
    }, 0);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <div className="min-w-0">
        <p className="font-semibold">Keep Golden Hour on your phone</p>
        <p className="t-small text-muted">
          {ios
            ? "In Safari, tap Share, then “Add to Home Screen”."
            : "Install it as an app. It opens full screen, like any other app."}
        </p>
      </div>
      {prompt && (
        <button
          type="button"
          className="rt-btn rt-btn-ink"
          onClick={async () => {
            await prompt.prompt();
            await prompt.userChoice.catch(() => undefined);
            setPrompt(null);
          }}
        >
          Install app
        </button>
      )}
    </div>
  );
}
