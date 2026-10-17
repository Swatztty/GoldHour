"use client";

/** Browser speech, used in guided mode when live voice isn't available. */

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => RecognitionLike;

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecognise(): boolean {
  return typeof window !== "undefined" && !!ctor();
}

export function listen(
  lang: string,
  onText: (text: string, final: boolean) => void,
  onDone: (error?: string) => void,
): () => void {
  const C = ctor();
  if (!C) {
    onDone("not-supported");
    return () => {};
  }
  const r = new C();
  r.lang = lang;
  r.interimResults = true;
  r.continuous = false;
  let finalText = "";
  r.onresult = (e) => {
    let interim = "";
    for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim += res[0].transcript;
    }
    onText((finalText + interim).trim(), false);
  };
  r.onerror = (e) => onDone(e.error);
  r.onend = () => {
    if (finalText.trim()) onText(finalText.trim(), true);
    onDone();
  };
  r.start();
  return () => r.stop();
}

export function speak(text: string, lang: string, onEnd?: () => void): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return () => {};
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.95;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));
  if (voice) u.voice = voice;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
  return () => window.speechSynthesis.cancel();
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Best guess of the script of a caption, so screen readers pronounce it correctly. */
export function guessLang(text: string): string | undefined {
  if (/[぀-ヿ]/.test(text)) return "ja";
  if (/[一-鿿]/.test(text)) return "zh";
  if (/[฀-๿]/.test(text)) return "th";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (/[஀-௿]/.test(text)) return "ta";
  if (/[가-힯]/.test(text)) return "ko";
  return undefined;
}

/**
 * Keep listening until stopped (the browser ends recognition after silences, so restart it).
 * onText receives the full transcript so far.
 */
export function listenContinuous(lang: string, onText: (all: string, interim: string) => void, onError: (e: string) => void): () => void {
  const C = ctor();
  if (!C) {
    onError("not-supported");
    return () => {};
  }
  let active = true;
  let done = "";
  let r: RecognitionLike | null = null;
  const start = () => {
    if (!active) return;
    r = new C();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    let base = done;
    r.onresult = (e) => {
      let fin = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      done = (base + fin).trim() + " ";
      onText(done.trim(), interim.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        active = false;
        onError(e.error);
      }
    };
    r.onend = () => {
      base = done;
      if (active) window.setTimeout(start, 250);
    };
    try {
      r.start();
    } catch {
      /* already started */
    }
  };
  start();
  return () => {
    active = false;
    try {
      r?.stop();
    } catch {
      /* ignore */
    }
  };
}
