"use client";

import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";

/**
 * Real-time voice with the Gemini Live API, straight from the browser using a short-lived token.
 * Microphone: 16 kHz 16-bit PCM. Model voice: 24 kHz 16-bit PCM. Both sides are transcribed
 * so everything spoken also appears as captions (for Deaf and hard-of-hearing users).
 */

/** Voice sessions end on their own so a forgotten tab never keeps a paid connection open */
export const LIVE_IDLE_MS = 2 * 60 * 1000; // no speech either way for 2 minutes
export const LIVE_MAX_MS = 10 * 60 * 1000; // any single session
const HIDDEN_GRACE_MS = 30 * 1000; // tab in the background

export type LiveEndReason = "idle" | "limit" | "hidden";

export type VoiceState = "idle" | "connecting" | "listening" | "muted" | "thinking" | "speaking" | "error";

export interface LiveHandlers {
  onState(s: VoiceState): void;
  onCaption(role: "assistant" | "user", text: string, final: boolean): void;
  onLevel(level: number): void;
  onTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
  onError(message: string): void;
  /** reason is Gemini's close message (for example an invalid setting), shown to help fix problems */
  onClose(reason?: string, code?: number): void;
}

const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.ratio = sampleRate / 16000; this.pos = 0; this.acc = 0; this.n = 0; this.out = []; this.sq = 0; this.cnt = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i];
      this.sq += v * v; this.cnt++;
      this.acc += v; this.n++; this.pos += 1;
      if (this.pos >= this.ratio) { this.out.push(this.acc / this.n); this.acc = 0; this.n = 0; this.pos -= this.ratio; }
    }
    if (this.out.length >= 640) {
      const pcm = new Int16Array(this.out.length);
      for (let i = 0; i < this.out.length; i++) { const s = Math.max(-1, Math.min(1, this.out[i])); pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
      this.port.postMessage({ pcm: pcm.buffer, level: Math.sqrt(this.sq / Math.max(1, this.cnt)) }, [pcm.buffer]);
      this.out = []; this.sq = 0; this.cnt = 0;
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Int16Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}

export class LiveVoice {
  private session: Session | null = null;
  private stream: MediaStream | null = null;
  private inCtx: AudioContext | null = null;
  private outCtx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private playing = new Set<AudioBufferSourceNode>();
  private nextTime = 0;
  private micOn = true;
  private streamEnded = false;
  private closed = false;
  private assistantBuf = "";
  private userBuf = "";
  private state: VoiceState = "idle";
  /** the microphone stays closed until the greeting has finished, so the person and the
   * assistant never start two conversations at once */
  private greeted = false;
  private greetTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private lastActive = 0;
  private onPageHide = () => this.endBy("hidden");
  private onVisibility = () => {
    if (document.visibilityState === "hidden") {
      if (!this.hiddenTimer) this.hiddenTimer = setTimeout(() => this.endBy("hidden"), HIDDEN_GRACE_MS);
    } else if (this.hiddenTimer) {
      clearTimeout(this.hiddenTimer);
      this.hiddenTimer = null;
    }
  };
  speakAloud = true;

  constructor(
    private token: string,
    private model: string,
    private config: Record<string, unknown>,
    private h: LiveHandlers,
  ) {}

  private set(s: VoiceState) {
    if (this.state !== s) {
      this.state = s;
      this.h.onState(s);
    }
  }

  /** Must be called from a user gesture (tap or key press), so audio can start. */
  async start(withMic: boolean, opener = "(The person has just opened Golden Hour. Greet them briefly and ask what happened.)") {
    this.set("connecting");
    this.startedAt = this.lastActive = Date.now();
    window.addEventListener("pagehide", this.onPageHide);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.watchdog = setInterval(() => {
      const now = Date.now();
      if (now - this.startedAt > LIVE_MAX_MS) this.endBy("limit");
      else if (now - this.lastActive > LIVE_IDLE_MS && !this.playing.size) this.endBy("idle");
    }, 5000);
    this.outCtx = new AudioContext({ sampleRate: 24000 });
    await this.outCtx.resume();
    if (withMic) await this.startMic();
    else this.micOn = false;
    if (this.closed) return this.cleanup();

    const ai = new GoogleGenAI({ apiKey: this.token, httpOptions: { apiVersion: "v1alpha" } });
    this.session = await ai.live.connect({
      model: this.model,
      config: this.config,
      callbacks: {
        onmessage: (m: LiveServerMessage) => this.onMessage(m),
        onerror: () => this.h.onError("The voice connection had a problem."),
        onclose: (e?: CloseEvent) => {
          const reason = e?.reason?.trim() || undefined;
          if (reason || (e?.code && e.code !== 1000)) console.warn("[live] connection closed", e?.code, reason);
          if (!this.closed) this.h.onClose(reason, e?.code);
        },
      },
    });
    // Closed while connecting (person tapped Start again, or left the page): end this session too
    if (this.closed) {
      try {
        this.session.close();
      } catch {
        /* ignore */
      }
      this.session = null;
      return;
    }
    this.sendText(opener);
    this.set("thinking");
    // If the greeting never arrives, open the microphone anyway after a few seconds
    this.greetTimer = setTimeout(() => this.openMic(), 6000);
  }

  /** what to show when the assistant isn't talking */
  private idle(): VoiceState {
    if (!this.greeted) return "thinking";
    return this.micOn ? "listening" : "muted";
  }

  private openMic() {
    if (this.greeted || this.closed) return;
    this.greeted = true;
    if (this.greetTimer) clearTimeout(this.greetTimer);
    if (!this.playing.size) this.set(this.idle());
  }

  private async startMic() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.inCtx = new AudioContext();
    await this.inCtx.resume();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await this.inCtx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = this.inCtx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.inCtx, "pcm-capture");
    this.node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
      this.h.onLevel(this.micOn && this.greeted ? e.data.level : 0);
      if (this.micOn && this.greeted && e.data.level > 0.03) this.lastActive = Date.now();
      if (!this.micOn || !this.greeted || !this.session || this.closed) return;
      this.streamEnded = false;
      this.session.sendRealtimeInput({ audio: { data: toBase64(e.data.pcm), mimeType: "audio/pcm;rate=16000" } });
    };
    src.connect(this.node);
    this.micOn = true;
  }

  get hasMic() {
    return !!this.stream;
  }

  async setMic(on: boolean) {
    if (on && !this.stream) await this.startMic();
    this.micOn = on;
    if (!on && this.session && !this.streamEnded) {
      this.session.sendRealtimeInput({ audioStreamEnd: true });
      this.streamEnded = true;
    }
    if (this.state === "listening" || this.state === "muted") this.set(on ? "listening" : "muted");
  }

  sendText(text: string) {
    if (!this.session || this.closed) return;
    this.lastActive = Date.now();
    this.session.sendRealtimeInput({ text });
  }

  /** Stop the assistant talking (barge-in by button). */
  interrupt() {
    this.greeted = true;
    this.stopPlayback();
    this.set(this.idle());
  }

  private stopPlayback() {
    for (const s of this.playing) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.playing.clear();
    this.nextTime = 0;
  }

  private play(b64: string) {
    if (!this.outCtx || !this.speakAloud) return;
    const pcm = fromBase64(b64);
    const buf = this.outCtx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = this.outCtx.createBufferSource();
    src.buffer = buf;
    src.connect(this.outCtx.destination);
    const t = Math.max(this.outCtx.currentTime + 0.02, this.nextTime);
    src.start(t);
    this.nextTime = t + buf.duration;
    this.playing.add(src);
    src.onended = () => {
      this.playing.delete(src);
      if (!this.playing.size && this.state === "speaking") this.set(this.idle());
    };
  }

  private flushUser() {
    if (this.userBuf.trim()) this.h.onCaption("user", this.userBuf.trim(), true);
    this.userBuf = "";
  }

  /** End the session on our side and tell the screen why */
  private endBy(reason: LiveEndReason) {
    if (this.closed) return;
    this.close();
    this.h.onClose(reason);
  }

  private async onMessage(m: LiveServerMessage) {
    if (this.closed) return;
    this.lastActive = Date.now();
    const c = m.serverContent;
    if (c?.interrupted) {
      this.stopPlayback();
      if (this.assistantBuf.trim()) this.h.onCaption("assistant", this.assistantBuf.trim(), true);
      this.assistantBuf = "";
      this.set(this.idle());
    }
    if (c?.inputTranscription?.text) {
      this.userBuf += c.inputTranscription.text;
      this.h.onCaption("user", this.userBuf.trim(), false);
      if (this.state !== "speaking") this.set("thinking");
    }
    if (c?.outputTranscription?.text) {
      this.flushUser();
      this.assistantBuf += c.outputTranscription.text;
      this.h.onCaption("assistant", this.assistantBuf.trim(), false);
    }
    for (const part of c?.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) {
        this.flushUser();
        if (this.speakAloud) {
          this.set("speaking");
          this.play(part.inlineData.data);
        }
      }
    }
    if (c?.turnComplete) {
      if (!this.greeted) this.openMic();
      this.flushUser();
      if (this.assistantBuf.trim()) this.h.onCaption("assistant", this.assistantBuf.trim(), true);
      this.assistantBuf = "";
      if (!this.playing.size) this.set(this.idle());
    }
    const calls = m.toolCall?.functionCalls ?? [];
    if (calls.length && this.session) {
      this.flushUser();
      this.set("thinking");
      const functionResponses = [];
      for (const fc of calls) {
        let response: Record<string, unknown>;
        try {
          response = await this.h.onTool(fc.name ?? "", (fc.args ?? {}) as Record<string, unknown>);
        } catch (e) {
          response = { error: (e as Error).message };
        }
        functionResponses.push({ id: fc.id, name: fc.name, response });
      }
      this.session.sendToolResponse({ functionResponses });
    }
  }

  close() {
    this.closed = true;
    if (this.greetTimer) clearTimeout(this.greetTimer);
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
    this.watchdog = this.hiddenTimer = this.greetTimer = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", this.onPageHide);
      document.removeEventListener("visibilitychange", this.onVisibility);
    }
    this.cleanup();
  }

  get isOpen() {
    return !this.closed;
  }

  private cleanup() {
    this.stopPlayback();
    try {
      this.session?.close();
    } catch {
      /* ignore */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node?.disconnect();
    this.inCtx?.close().catch(() => {});
    this.outCtx?.close().catch(() => {});
    this.stream = null;
    this.node = null;
    this.inCtx = null;
    this.outCtx = null;
    this.session = null;
    this.set("idle");
  }
}
