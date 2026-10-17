import type { CountryCode } from "../regions";

/**
 * Practice calls: a pretend scammer calls, and the person practises saying no.
 * Every line is fictional and clearly labelled as practice.
 */

export interface PracticeChoice {
  label: string;
  safe: boolean;
  /** shown after the choice: why it was safe or risky */
  why: string;
  /** ends the call (hanging up, or saying you'll call the bank yourself) */
  ends?: boolean;
}

export interface PracticeTurn {
  line: string;
  choices: PracticeChoice[];
}

export interface Scenario {
  id: string;
  title: string;
  caller: string;
  blurb: string;
  turns: PracticeTurn[];
  lesson: string;
}

const HANG_UP = (why: string): PracticeChoice => ({ label: "Hang up", safe: true, ends: true, why });

export const SCENARIOS: Scenario[] = [
  {
    id: "police",
    title: "Fake police officer",
    caller: "“Inspector Lee”",
    blurb: "A caller says your bank account is linked to a crime.",
    lesson: "Real police never ask you to move money, keep a call secret, or stay on a video call.",
    turns: [
      {
        line: "Good afternoon. This is Inspector Lee from the police. Your bank account has been used for money laundering. This is very serious.",
        choices: [
          { label: "Oh no, what should I do?", safe: false, why: "Scammers want you scared and following orders. It’s fine to be polite, but don’t let them take control." },
          { label: "I’ll call the police station myself to check", safe: true, ends: true, why: "Perfect. Hang up and call the official number you find yourself. A real officer will understand." },
          HANG_UP("Hanging up is always allowed. You can check with the police on a number you look up yourself."),
        ],
      },
      {
        line: "If you hang up, a warrant will be issued for your arrest today. Do not tell anyone, including your family, because the case is confidential.",
        choices: [
          { label: "OK, I won’t tell anyone", safe: false, why: "Secrecy is the biggest warning sign. Scammers isolate you so nobody can stop them." },
          { label: "I’m going to talk to my family first", safe: true, why: "Good. Talking to someone you trust breaks the scammer’s pressure." },
          HANG_UP("Threats of arrest are a scare tactic. Police don’t arrest people over the phone."),
        ],
      },
      {
        line: "To prove you are innocent, move your savings to our safety account for checking. It will be returned in 24 hours. Tell me the code the bank sends you.",
        choices: [
          { label: "Here is the code…", safe: false, why: "Never share a one-time code. It lets them take your money straight away." },
          { label: "No. Police never ask for that. Goodbye.", safe: true, ends: true, why: "Exactly right. There is no such thing as a police “safety account”." },
          HANG_UP("Right call. A “safety account” is always a scam."),
        ],
      },
    ],
  },
  {
    id: "bank",
    title: "Your bank’s “fraud team”",
    caller: "“Bank security”",
    blurb: "A text says your account is under attack, then someone calls.",
    lesson: "Your bank will never ask you to move money to keep it safe, or to read out a code.",
    turns: [
      {
        line: "Hello, this is your bank’s fraud team. We’ve blocked a suspicious payment of 4,800 from your account. Can you confirm your full name and card number?",
        choices: [
          { label: "Sure, my card number is…", safe: false, why: "Your bank already knows your card number. Never read it out to someone who called you." },
          { label: "I’ll call the number on the back of my card", safe: true, ends: true, why: "The best move. Call your bank using the number on your card or in your banking app." },
          HANG_UP("Hanging up and calling your bank yourself is the safe way to check."),
        ],
      },
      {
        line: "There’s no time. Hackers are inside your account right now. Install the app called AnyDesk so our engineer can secure your phone.",
        choices: [
          { label: "OK, it’s installing", safe: false, why: "Remote-access apps let scammers control your phone and your banking app." },
          { label: "No, I don’t install apps for callers", safe: true, why: "Correct. A real bank will never ask you to install an app during a call." },
          HANG_UP("Good. Urgency plus “install this app” is a classic scam."),
        ],
      },
      {
        line: "Then you must move your money to a new safe account we’ve opened for you. I’ll give you the account number now.",
        choices: [
          { label: "OK, I’ll transfer it", safe: false, why: "There is no “safe account”. Money sent there goes straight to criminals." },
          { label: "No. I’m hanging up and calling my bank", safe: true, ends: true, why: "That’s exactly what to do." },
          HANG_UP("Right. Banks never ask you to move money to protect it."),
        ],
      },
    ],
  },
  {
    id: "family",
    title: "“Hi Mum, new number”",
    caller: "“Your son”",
    blurb: "A message from a new number says it’s your child and they need money.",
    lesson: "Call your family member on the number you already have before you send anything.",
    turns: [
      {
        line: "Hi Mum, it’s me. I dropped my phone and this is my new number. Can you save it?",
        choices: [
          { label: "Saved! Are you OK?", safe: false, why: "It feels natural, but you haven’t checked it’s really them yet." },
          { label: "Which of my children is this? Call me on your old number.", safe: true, why: "Smart. Asking them to call from the old number, or a question only they’d know, catches scammers." },
          HANG_UP("Fine to stop and check first."),
        ],
      },
      {
        line: "I can’t call, the mic is broken. I need to pay a bill today or I’ll get a fine. Can you send 1,200? I’ll pay you back tomorrow.",
        choices: [
          { label: "OK, send me the account", safe: false, why: "“Can’t call, need money urgently” is the pattern of this scam." },
          { label: "I’ll call your old number first", safe: true, ends: true, why: "Exactly right. If it’s really them, they’ll understand." },
          HANG_UP("Good. Check by calling the number you already have."),
        ],
      },
    ],
  },
  {
    id: "job",
    title: "Easy money job offer",
    caller: "“HR recruiter”",
    blurb: "A recruiter offers paid tasks rating hotels online.",
    lesson: "A job that asks you to pay a deposit to get your earnings is always a scam.",
    turns: [
      {
        line: "Hi! We have a part-time job. Just rate hotels online and earn 150 a day. Interested? It only takes 20 minutes.",
        choices: [
          { label: "Yes please, tell me more", safe: false, why: "Unrequested jobs with easy money are how task scams start." },
          { label: "Which company is this? I’ll look it up myself", safe: true, why: "Good. Real employers can be checked independently." },
          HANG_UP("Fine to ignore unrequested job offers."),
        ],
      },
      {
        line: "Great, you earned your first 150! To unlock VIP tasks and withdraw, just pay a deposit of 500. Everyone does it.",
        choices: [
          { label: "OK, I’ll pay the deposit", safe: false, why: "This is the trap. The deposits grow and the “earnings” never come out." },
          { label: "No. Real jobs never ask me to pay.", safe: true, ends: true, why: "Exactly. Stop here and block them." },
          HANG_UP("Right. Paying to get paid is always a scam."),
        ],
      },
    ],
  },
];

export function scenarioFor(country: CountryCode): Scenario {
  if (country === "AU") return SCENARIOS[1];
  if (country === "IN" || country === "PH" || country === "ID") return SCENARIOS[3];
  return SCENARIOS[0];
}

/** Judge a spoken or typed reply. */
export function judge(text: string): "safe" | "risky" | "unclear" {
  const t = text.toLowerCase();
  if (/\b(\d{4,}|here (is|'s) the code|my (otp|pin|password|card number)|i('ll| will) (transfer|send|pay|install)|ok(ay)?,? (i('ll| will)|sure)|yes,? (i('ll| will)|sure|ok))\b/.test(t)) return "risky";
  if (/\b(no|nope|hang(ing)? up|bye|goodbye|scam|i('ll| will) call (the |my )?(bank|police|station|son|daughter)|not (going to|gonna) (share|send|pay)|never|verify|check (it )?myself|block)\b/.test(t)) return "safe";
  if (/\b(yes|ok|okay|sure|alright|fine)\b/.test(t)) return "risky";
  return "unclear";
}
