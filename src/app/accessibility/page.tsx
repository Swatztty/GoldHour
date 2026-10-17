import { BottomNav, RtHeader } from "@/components/rt/RtHeader";

export const metadata = {
  title: "Accessibility: Golden Hour",
  description: "How Golden Hour works for people who are blind, Deaf, older, have low literacy or limited mobility, and how it meets WCAG 2.2.",
};

const GROUPS = [
  {
    who: "Blind and low-vision users",
    how: [
      "The whole report can be made by voice, with no reading or typing needed.",
      "Works with screen readers (VoiceOver, TalkBack, NVDA, JAWS). Choose “My screen reader” in Accessibility so you don’t hear two voices at once.",
      "A soft tone and a spoken cue tell you when it’s your turn to talk.",
      "Text can be enlarged to 200% and the layout reflows without sideways scrolling. High contrast mode is available.",
      "Phone numbers are read digit by digit.",
    ],
  },
  {
    who: "Deaf and hard-of-hearing users",
    how: [
      "Live captions show everything the assistant says, and what it heard you say, so you can check it understood you.",
      "Nothing is said only by sound: every step, warning and result is also on screen.",
      "You can tap or type every answer, in any language. The microphone button pulses and grows as it hears you, so you can see it is listening.",
      "On phones, a short vibration tells you it’s your turn.",
    ],
  },
  {
    who: "Older users and people with low literacy or cognitive disabilities",
    how: [
      "One question at a time, in short sentences and everyday words.",
      "Big tap-answer buttons for common replies: Yes, No, I don’t know, Repeat that, Say it more simply.",
      "Easy read mode simplifies the assistant’s language and shows one step at a time.",
      "There are no time limits. You can stop, go back or start again whenever you like.",
      "Your report is shown as it fills in, and read back for you to check before anything is sent.",
    ],
  },
  {
    who: "People with limited movement",
    how: [
      "Every control works with a keyboard, switch access or voice control, in a logical order with a clear focus outline.",
      "Buttons are at least 44 by 44 pixels.",
      "Nothing needs dragging, swiping or precise pointing. Screenshots can be added with a button.",
    ],
  },
  {
    who: "People who speak other languages",
    how: [
      "Speak or type in any language the Gemini Live model supports, which includes 99 languages across Asia-Pacific and beyond. The assistant replies in your language and switches when you do.",
      "Official letters are written in English for police and banks, and you can hear them read aloud.",
    ],
  },
];

const CRITERIA: [string, string][] = [
  ["1.1.1 Non-text content", "Icons have text labels; the map has a text summary and the panel lists the same information."],
  ["1.2.4 Captions (live)", "Live captions of both sides of the voice conversation."],
  ["1.3.1 Info and relationships", "Headings, lists, tables with header cells, labelled form fields and landmark regions."],
  ["1.4.1 Use of colour", "The map uses shapes and line styles as well as colour; statuses are written out."],
  ["1.4.3 / 1.4.6 Contrast", "Body text meets 7:1; secondary text and buttons meet at least 4.5:1, in light, dark and high contrast."],
  ["1.4.4 / 1.4.10 Resize and reflow", "Text up to 200% and 320 px wide screens without loss of content."],
  ["1.4.12 Text spacing", "Layouts use flexible sizes, so user text-spacing styles don’t clip content."],
  ["2.1.1 Keyboard", "Everything works by keyboard; no keyboard traps; no single-key shortcuts."],
  ["2.2.1 Timing adjustable", "No time limits anywhere."],
  ["2.3.3 Animation from interactions", "Motion stops with the system setting or the Reduce motion option."],
  ["2.4.1 Bypass blocks", "Skip to main content link."],
  ["2.4.7 / 2.4.11 Focus visible and not obscured", "A thick focus outline that is never hidden behind the sticky header."],
  ["2.5.3 Label in name", "Button names match their visible text."],
  ["2.5.8 Target size", "Targets are at least 44 by 44 pixels."],
  ["3.1.1 / 3.1.2 Language", "The page language is set, and captions in other scripts are marked with their language."],
  ["3.2.6 Consistent help", "The hotline call button and Accessibility settings are in the same place on every page."],
  ["3.3.1 / 3.3.3 Errors", "Errors say what went wrong and how to fix it, in plain words."],
  ["3.3.4 Error prevention", "Your report is shown and read back for you to confirm before it is sent."],
  ["3.3.7 Redundant entry", "Details you already gave, or that were read from a screenshot, are never asked for again."],
  ["3.3.8 Accessible authentication", "No sign-in, passwords or puzzles."],
  ["4.1.2 / 4.1.3 Name, role, value and status messages", "Native controls and live regions announce status changes such as “Your turn to talk” and “Report sent”."],
];

export default function AccessibilityPage() {
  return (
    <>
      <RtHeader current="accessibility" />
      <main id="main" tabIndex={-1} lang="en" className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
        <h1 className="t-h1">Accessibility</h1>
        <p className="t-lead mt-4 !text-ink">
          Scams target everyone, so Golden Hour has to work for everyone, including people who can’t see the screen, can’t hear the voice, can’t type, or find forms hard. You can use it entirely by voice, entirely by tapping, or entirely by typing.
        </p>
        <p className="mt-4 text-muted">
          Golden Hour aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, and several level AAA criteria. This is our own assessment, made during development with automated checks (axe-core), contrast checks and keyboard-only testing. It has not yet been tested with disabled users or independently audited, and we would welcome both.
        </p>

        {GROUPS.map((g) => (
          <section key={g.who} className="mt-10" aria-labelledby={g.who}>
            <h2 id={g.who} className="t-h2">
              {g.who}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              {g.how.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-12" aria-labelledby="wcag-h">
          <h2 id="wcag-h" className="t-h2">
            How we meet WCAG 2.2
          </h2>
          <table className="mt-4 w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-ink">
                <th scope="col" className="py-2 pr-4">
                  Success criterion
                </th>
                <th scope="col" className="py-2">
                  How
                </th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map(([c, h]) => (
                <tr key={c} className="border-b border-line align-top">
                  <th scope="row" className="py-3 pr-4 font-semibold">
                    {c}
                  </th>
                  <td className="py-3">{h}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-12" aria-labelledby="limits-h">
          <h2 id="limits-h" className="t-h2">
            Known limitations
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>The map on the Scam network page is visual. Everything on it is also listed in the panel beside it, which screen readers can use.</li>
            <li>Main screens (navigation, home, Check a message, Stay safe) can be shown in nine languages. Some detailed pages, such as the action plan, letters, practice scripts and this statement, are still in English. The assistant itself speaks and understands your language.</li>
            <li>The call shield relies on the browser’s speech recognition, which needs the call on speaker and may not be available in every browser.</li>
            <li>Sign language is not supported yet. Deaf users can use captions, tapping and typing.</li>
            <li>If live voice is unavailable, guided mode uses your browser’s speech features, which vary by browser.</li>
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="fb-h">
          <h2 id="fb-h" className="t-h2">
            Tell us if something doesn’t work for you
          </h2>
          <p className="mt-3">
            Open an issue on the project’s GitHub repository, describing what you were trying to do and which device, browser and assistive technology you use.
          </p>
        </section>
      </main>
      <BottomNav current="accessibility" />
    </>
  );
}
