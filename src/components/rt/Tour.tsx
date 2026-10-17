"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { markTourSeen, setUi, useUi } from "@/lib/rt/ui";

interface Step {
  /** value of a data-tour attribute; the first visible match is highlighted */
  target?: string;
  title: string;
  body: ReactNode;
}

const REPORT_TOUR: Step[] = [
  {
    title: "Welcome to Golden Hour",
    body: (
      <>
        <p>
          Golden Hour lets a scam victim report what happened just by talking, in
          their own language. Each report is linked to other victims across
          Asia-Pacific so banks can freeze the money before the next person
          pays.
        </p>
        <ul className="mt-3 space-y-1.5">
          <li className="flex gap-2">
            <Dot /> This is a demo. Calls, texts and emails are switched off, so
            nobody real is contacted.
          </li>
          <li className="flex gap-2">
            <Dot /> The scam network uses fictional sample data.
          </li>
          <li className="flex gap-2">
            <Dot /> The tour takes about a minute. Press Escape or Skip to leave
            at any time.
          </li>
        </ul>
      </>
    ),
  },
  {
    target: "talk",
    title: "1. Tap and talk",
    body: "Tap the microphone and say what happened, in any of 99 languages. Golden Hour asks one simple question at a time, out loud and with captions.",
  },
  {
    target: "alternatives",
    title: "Prefer not to talk?",
    body: "You can type or tap your answers instead, or start from a screenshot of the scam chat or bank message. Gemini reads it for you.",
  },
  {
    target: "play-demo",
    title: "Play the whole story",
    body: "One tap plays a sample report from start to finish: the voice conversation, the golden-hour countdown, and the report landing on the scam network with a freeze alert.",
  },
  {
    target: "samples",
    title: "Fastest way to try it",
    body: "Pick a sample case. Golden Hour reads the fictional screenshots, fills in the report and only asks about what’s missing.",
  },
  {
    target: "how",
    title: "Three steps",
    body: "After the conversation, the person gets a plan for their country, and the report joins the scam network so banks can freeze the account.",
  },
  {
    target: "check",
    title: "Not sure yet? Check first",
    body: "Paste a message, number, account or link before paying. Golden Hour checks it against other victims’ reports and the tricks scammers use.",
  },
  {
    target: "alerts",
    title: "Scams going around",
    body: "The scams police are warning about in your country right now, with one simple way to spot each.",
  },
  {
    target: "report",
    title: "2. The report fills itself in",
    body: "Each answer fills in a line here. You can send it once Golden Hour knows what happened, and how much was sent or where it went.",
  },
  {
    target: "country",
    title: "Your country decides the help",
    body: "Hotlines, banks and official forms change with the country. Nine Asia-Pacific countries are built in, and any other country gets general advice.",
  },
  {
    target: "call",
    title: "Call the scam hotline first",
    body: "Calling the national scam hotline is always the first step. In this demo the button explains what it would do instead of dialling.",
  },
  {
    target: "settings",
    title: "Make it work for you",
    body: "Larger text, high contrast, easy read, captions and a screen reader mode. Everything also works with just a keyboard.",
  },
  {
    target: "safety-nav",
    title: "Stay safe",
    body: "Practise a scam call, turn on the call shield while you’re on a suspicious call, add a family guardian, and track your reports.",
  },
  {
    target: "network",
    title: "3. See the thread",
    body: "After sending, open the scam network. Your report lands on the map and links to other victims who paid the same account.",
  },
];

const NETWORK_TOUR: Step[] = [
  {
    target: "map",
    title: "Every report on one map",
    body: "Dots are victims, squares are the accounts they paid, and red lines show money sent. The sample data is fictional.",
  },
  {
    target: "run-demo",
    title: "Watch a match happen",
    body: "Run live demo replays a new report from Melaka. It links to an account that four other victims paid, in three countries.",
  },
  {
    target: "rings",
    title: "Scam rings",
    body: "Reports are grouped by shared accounts, phone numbers or the scammer’s script. Gemini matches scripts even across languages.",
  },
  {
    target: "impact",
    title: "Impact you can measure",
    body: "Money paid into accounts flagged to freeze, reports linked across borders, and how long reporting takes, all counted from the reports themselves.",
  },
  {
    target: "accounts",
    title: "Freeze before the next victim pays",
    body: "When an account is paid by 3 or more victims within 3 hours, banks get an alert with a one-click freeze request. In the demo the request is simulated.",
  },
  {
    target: "report-nav",
    title: "Try it yourself",
    body: "Open Report a scam in another tab and send a report. This map updates the moment it arrives.",
  },
];

function Dot() {
  return (
    <span
      className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-red"
      aria-hidden="true"
    />
  );
}

function visibleTarget(name?: string): HTMLElement | null {
  if (!name) return null;
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (
      r.width > 0 &&
      r.height > 0 &&
      getComputedStyle(el).visibility !== "hidden"
    )
      return el;
  }
  return null;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * A short guided tour: a highlight around one part of the page and a bubble that explains it.
 * Built on a native modal dialog, so the rest of the page is inert, focus stays in the bubble,
 * and Escape closes it.
 */
export function Tour({ page }: { page: "report" | "network" }) {
  const { tour } = useUi();
  const ref = useRef<HTMLDialogElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [i, setI] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    side: "above" | "below" | "center";
  } | null>(null);

  // Offer the tour once on first visit, or when arriving with ?tour=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("tour") === "1";
    if (wanted) {
      params.delete("tour");
      const q = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (q ? `?${q}` : ""),
      );
    }
    // Only on request (?tour=1, "How it works" or the tour buttons): someone who has just been scammed
    // should land straight on the microphone, not behind a pop-up.
    if (wanted) {
      const t = window.setTimeout(() => setUi({ tour: true }), 600);
      return () => window.clearTimeout(t);
    }
  }, [page]);

  // Open and close
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (tour) {
      const all = page === "report" ? REPORT_TOUR : NETWORK_TOUR;
      const raf = requestAnimationFrame(() => {
        setSteps(all.filter((s) => !s.target || visibleTarget(s.target)));
        setI(0);
      });
      if (!d.open) d.showModal();
      return () => cancelAnimationFrame(raf);
    } else if (d.open) d.close();
  }, [tour, page]);

  const step = steps[i];

  const place = useCallback(() => {
    if (!step) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(380, vw - 32);
    const bh = bubble.current?.offsetHeight ?? 220;
    const el = visibleTarget(step.target);
    if (!el) {
      setSpot(null);
      setPos({
        top: Math.max(16, (vh - bh) / 2),
        left: (vw - width) / 2,
        width,
        side: "center",
      });
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 8;
    const box = {
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    };
    setSpot(box);
    const gap = 14;
    const below = box.top + box.height + gap;
    const above = box.top - gap - bh;
    let side: "above" | "below" | "center" = "below";
    let top = below;
    if (below + bh > vh - 12) {
      if (above >= 12) {
        side = "above";
        top = above;
      } else {
        side = "center";
        top = Math.max(12, vh - bh - 12);
      }
    }
    const left = Math.min(
      Math.max(16, box.left + box.width / 2 - width / 2),
      vw - width - 16,
    );
    setPos({ top, left, width, side });
  }, [step]);

  // Bring the target into view, then place the bubble
  useLayoutEffect(() => {
    if (!tour || !step) return;
    const el = visibleTarget(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 120) {
        window.scrollTo({
          top: window.scrollY + r.top - window.innerHeight / 3,
          behavior: "auto",
        });
      }
    }
    const raf = requestAnimationFrame(() => {
      place();
      titleRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [tour, step, place]);

  useEffect(() => {
    if (!tour) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [tour, place]);

  function close() {
    markTourSeen();
    setUi({ tour: false });
  }

  const last = i === steps.length - 1;

  return (
    <dialog
      ref={ref}
      onClose={close}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      className="rt-tour m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-transparent"
    >
      {step && (
        <>
          <div
            className="rt-tour-spot"
            aria-hidden="true"
            style={
              spot
                ? {
                    top: spot.top,
                    left: spot.left,
                    width: spot.width,
                    height: spot.height,
                  }
                : { top: "50%", left: "50%", width: 0, height: 0 }
            }
          />
          <div
            ref={bubble}
            className="rt-tour-bubble"
            data-side={pos?.side ?? "center"}
            // Positioned with transform (not top/left) so moving between steps never counts as layout shift
            style={{
              top: 0,
              left: 0,
              width: pos?.width ?? 360,
              transform: `translate(${pos?.left ?? 0}px, ${pos?.top ?? 0}px)`,
              visibility: pos ? "visible" : "hidden",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="rt-eyebrow tabular">
                {steps.length > 1
                  ? `Quick tour · ${i + 1} of ${steps.length}`
                  : "Quick tour"}
              </p>
              <button
                type="button"
                onClick={close}
                className="rt-btn rt-btn-ghost !min-h-9 !px-2 t-small underline underline-offset-4"
              >
                Skip tour
              </button>
            </div>
            <h2
              id="tour-title"
              ref={titleRef}
              tabIndex={-1}
              className="t-h3 mt-1 !text-[1.25rem]"
            >
              {step.title}
            </h2>
            <div
              id="tour-body"
              className="mt-2 text-[0.975rem] leading-relaxed text-muted"
            >
              {step.body}
            </div>
            <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
              {steps.map((s, n) => (
                <span
                  key={s.title}
                  className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-red" : "w-1.5 bg-line-strong/50"}`}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => setI(i - 1)}
                  className="rt-btn rt-btn-line"
                >
                  Back
                </button>
              )}
              {!last && (
                <button
                  type="button"
                  onClick={() => setI(i + 1)}
                  className="rt-btn rt-btn-ink"
                >
                  {i === 0 ? "Show me around" : "Next"}
                </button>
              )}
              {last && page === "report" && (
                <a
                  href="/network?tour=1"
                  onClick={markTourSeen}
                  className="rt-btn rt-btn-line"
                >
                  Tour the network
                </a>
              )}
              {last && (
                <button
                  type="button"
                  onClick={close}
                  className="rt-btn rt-btn-ink"
                >
                  {page === "report" ? "Start reporting" : "Done"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}
