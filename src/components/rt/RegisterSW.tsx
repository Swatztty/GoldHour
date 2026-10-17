"use client";

import { useEffect } from "react";

/** Registers the service worker in production so Golden Hour installs as an app. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      /* the app still works without it */
    });
  }, []);
  return null;
}
