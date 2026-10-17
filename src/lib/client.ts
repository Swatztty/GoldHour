"use client";

import type { FirebaseApp, FirebaseOptions } from "firebase/app";

/**
 * Firebase in the browser: anonymous sign-in and a live Firestore listener that tells the
 * network console the moment a new report lands. Everything degrades gracefully without config.
 */

let fbPromise: Promise<FirebaseApp | null> | null = null;

export function firebaseApp(): Promise<FirebaseApp | null> {
  if (!fbPromise) {
    fbPromise = (async () => {
      try {
        const res = await fetch("/api/config");
        const { firebase } = (await res.json()) as { firebase: FirebaseOptions | null };
        if (!firebase) return null;
        const { initializeApp, getApps } = await import("firebase/app");
        return getApps()[0] ?? initializeApp(firebase);
      } catch {
        return null;
      }
    })();
  }
  return fbPromise;
}

export async function signedIn(): Promise<boolean> {
  const app = await firebaseApp();
  if (!app) return false;
  try {
    const { getAuth, signInAnonymously } = await import("firebase/auth");
    const auth = getAuth(app);
    if (!auth.currentUser) await signInAnonymously(auth);
    return true;
  } catch {
    return false;
  }
}

/** Calls `onEvent` whenever a new report is linked anywhere. Returns an unsubscribe function. */
export async function subscribeNetworkEvents(onEvent: () => void): Promise<() => void> {
  const app = await firebaseApp();
  if (!app || !(await signedIn())) return () => {};
  try {
    const { getFirestore, collection, query, orderBy, limit, onSnapshot } = await import("firebase/firestore");
    let first = true;
    return onSnapshot(
      query(collection(getFirestore(app), "network_events"), orderBy("createdAt", "desc"), limit(1)),
      () => {
        if (first) {
          first = false;
          return;
        }
        onEvent();
      },
      () => {},
    );
  } catch {
    return () => {};
  }
}
