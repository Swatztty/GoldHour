import { formatMoney, formatWhen } from "./investigate";
import { firstCall, regionOf, type Region } from "./regions";
import type { CaseRecord, Transaction, Victim } from "./types";

export interface DocField {
  label: string;
  value: string;
}

export interface DocDraft {
  id: string;
  title: string;
  to: string;
  channel: "portal" | "email" | "in-person";
  subject?: string;
  body: string;
  fields?: DocField[];
}

export interface Step {
  id: string;
  short: string;
  title: string;
  why: string;
  docIds: string[];
  /** shows the call script */
  script?: boolean;
  action?: { label: string; href: string; external?: boolean };
}

const fill = (v: string, placeholder: string) => (v.trim() ? v.trim() : `[${placeholder}]`);

const METHOD_LABEL: Record<string, string> = {
  UPI: "UPI",
  IMPS: "IMPS",
  NEFT: "NEFT",
  RTGS: "RTGS",
  TRANSFER: "bank transfer",
  INSTANT: "instant transfer",
  CARD: "card",
  WALLET: "e-wallet",
  OTHER: "transfer",
};

export function receiverLabel(t: Transaction): string {
  if (t.toVpa) return t.toVpa;
  if (t.toAccount) {
    const code = t.toIfsc ? `, ${/^[A-Z]{4}0/.test(t.toIfsc) ? "IFSC" : "code"} ${t.toIfsc}` : "";
    return `${t.toBank ? `${t.toBank} ` : ""}account ${t.toAccount}${code}`;
  }
  return "receiver not visible";
}

function txnLine(t: Transaction, i: number, currency: string, tz: string): string {
  return `${i + 1}. ${t.amount ? formatMoney(t.amount, currency) : "[amount]"} by ${METHOD_LABEL[t.method] ?? t.method} on ${formatWhen(t.datetime, tz)} to ${receiverLabel(t)}${
    t.toName ? ` (${t.toName})` : ""
  }. Reference: ${t.reference ?? "[not visible]"}`;
}

function signature(v: Victim): string {
  return [
    fill(v.name, "Your full name"),
    `Phone: ${fill(v.phone, "Your mobile number")}`,
    v.email.trim() ? `Email: ${v.email.trim()}` : "",
    `Address: ${fill(v.address, "Your address")}${v.city.trim() ? `, ${v.city.trim()}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function refLine(v: Victim, r: Region): string {
  return v.ackNumber.trim() ? `${r.refName}: ${v.ackNumber.trim()}.` : `${r.refName}: [add once you have it].`;
}

export function buildDocuments(c: CaseRecord, v: Victim): DocDraft[] {
  const r = regionOf(c.country);
  const ex = c.extraction;
  const inv = c.investigation;
  const cur = ex.currency;
  const tz = r.timeZone;
  const txns = ex.transactions;
  const txnBlock = txns.length ? txns.map((t, i) => txnLine(t, i, cur, tz)).join("\n") : "[Add each payment: amount, date and time, receiver, reference number]";
  const suspectBits = [
    ex.suspect.phones.length ? `Phone numbers: ${ex.suspect.phones.join(", ")}` : "",
    ex.suspect.upiIds.length ? `Payment IDs: ${ex.suspect.upiIds.join(", ")}` : "",
    ex.suspect.accounts.length ? `Bank accounts: ${ex.suspect.accounts.join(", ")}` : "",
    ex.suspect.urls.length ? `Websites/links: ${ex.suspect.urls.join(", ")}` : "",
    ex.suspect.emails.length ? `Emails: ${ex.suspect.emails.join(", ")}` : "",
    ex.suspect.names.length ? `Names/handles used: ${ex.suspect.names.join(", ")}` : "",
    ex.suspect.apps.length ? `Apps used: ${ex.suspect.apps.join(", ")}` : "",
  ].filter(Boolean);
  const victimBank = ex.victimBank ?? "[Your bank]";
  const victimAcc = ex.victimAccount ?? "[your account number]";
  const total = formatMoney(inv.totalLost, cur);
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "long" }).format(new Date());
  const isIndia = r.code === "IN";

  const docs: DocDraft[] = [];

  // 1. Official written report (portal or police)
  docs.push({
    id: "report",
    title: r.portal ? `${r.portal.name} report` : "Police report",
    to: r.portal ? r.portal.url.replace(/^https?:\/\//, "") : "Your nearest police station",
    channel: r.portal ? "portal" : "in-person",
    body: c.drafting.narrative,
    fields: [
      ...(isIndia
        ? [
            { label: "Category", value: inv.ncrpCategory },
            { label: "Sub-category", value: inv.ncrpSubCategory },
          ]
        : [{ label: "Type of scam", value: ex.scamLabel }]),
      { label: "Date and time of incident", value: formatWhen(inv.firstTxnAt, tz) },
      { label: "Total amount lost", value: total },
      ...txns.map((t, i) => ({
        label: `Transaction ${i + 1}`,
        value: [
          `From: ${t.fromBank ?? victimBank}${t.fromAccount ? ` ${t.fromAccount}` : ""}`,
          `To: ${receiverLabel(t)}${t.toName ? ` (${t.toName})` : ""}`,
          `Reference: ${t.reference ?? "[not visible]"}`,
          `Date: ${formatWhen(t.datetime, tz)}`,
          `Amount: ${t.amount ? formatMoney(t.amount, cur) : "[amount]"}`,
        ].join("\n"),
      })),
      { label: "Suspect details", value: suspectBits.join("\n") || "[Any phone number, payment ID, website or account the scammer used]" },
      { label: "What happened", value: c.drafting.narrative },
    ],
  });

  // 2. Victim's own bank
  docs.push({
    id: "bank-own",
    title: `Letter to ${ex.victimBank ?? "your bank"}`,
    to: `${victimBank}, fraud team`,
    channel: "email",
    subject: `Fraud report: ${total} lost from account ${victimAcc}. Please block, dispute and recall`,
    body: `To the Fraud / Disputes Team,
${victimBank}

Date: ${today}

Subject: Fraudulent transactions from account ${victimAcc}. Request to block, raise a dispute and recall the funds

I am writing to report that ${total} has been taken from my account ${victimAcc} ${
      ex.unauthorized ? "through transactions I did not authorise" : "through a scam, after I was deceived by fraudsters"
    }. The transactions are:

${txnBlock}

${refLine(v, r)}

Please:
1. Block further debits on my account and cards until I confirm, and help me secure my online banking.
2. Register a fraud dispute for the transactions above${ex.unauthorized ? " as unauthorised transactions under the applicable customer protection rules" : ""}.
3. Contact the receiving banks urgently to hold and recall the funds.
4. Give me a case reference and keep me updated in writing.

Copies of the messages and transaction alerts are attached.

Yours sincerely,
${signature(v)}`,
  });

  // 3. Each receiving bank
  inv.beneficiaries.forEach((b, i) => {
    const bank = b.bank ?? "[Receiving bank]";
    const related = txns.filter((t) => b.txnIds.includes(t.id));
    docs.push({
      id: `bank-ben-${i}`,
      title: `Freeze request to ${b.bank ?? "receiving bank"}`,
      to: `${bank}, ${isIndia ? "nodal officer" : "fraud team"}`,
      channel: "email",
      subject: `Urgent: please freeze ${b.identifier}, which received scam proceeds`,
      body: `To the ${isIndia ? "Nodal Officer (Cyber Fraud)" : "Fraud Investigations Team"},
${bank}

Date: ${today}

Subject: Urgent request to freeze ${b.kind === "vpa" ? "payment ID" : "account"} ${b.identifier}${b.ifsc ? ` (${b.ifsc})` : ""}

${b.total ? formatMoney(b.total, cur) : "[Amount]"} was transferred from my account at ${victimBank} to ${b.identifier}${b.name ? `, in the name of ${b.name},` : ""} which is held with your bank, as part of a scam:

${related.map((t, j) => txnLine(t, j, cur, tz)).join("\n")}

${refLine(v, r)}

Please urgently freeze or hold this account for the amount above, preserve its records, and cooperate with the police for the return of my money.

Yours sincerely,
${signature(v)}`,
    });
  });

  // 4. Police complaint, unless the portal already is the police report
  if (!r.portal?.isPoliceReport) {
    docs.push({
      id: "police",
      title: "Police complaint",
      to: isIndia ? "The Station House Officer, Cyber Crime Police Station" : "The officer in charge, your nearest police station",
      channel: "in-person",
      subject: `Complaint of online fraud of ${total}`,
      body: `To
${isIndia ? "The Station House Officer\nCyber Crime Police Station / [Nearest police station]" : "The Officer in Charge\n[Nearest police station]"}${v.city.trim() ? `\n${v.city.trim()}` : ""}

Date: ${today}

Subject: Complaint of online fraud of ${total}

I, ${fill(v.name, "Your full name")}, wish to report the following:

${c.drafting.narrative}

Transactions:
${txnBlock}

Details of the suspects:
${suspectBits.join("\n") || "[Phone numbers, payment IDs, websites or names used by the suspects]"}

${refLine(v, r)}

${
  isIndia
    ? "These acts appear to amount to cheating and cheating by personation under the Bharatiya Nyaya Sanhita, 2023 (Sections 318 and 319) and offences under the Information Technology Act, 2000 (Sections 66C and 66D), as the police may determine. I request you to register an FIR, take steps to freeze the receiving accounts, and help recover my money."
    : "I request that this complaint be recorded and investigated, that steps be taken to freeze the receiving accounts, and that I be helped to recover my money."
}

I am attaching copies of the messages, transaction alerts and my bank statement.

Yours faithfully,
${signature(v)}`,
    });
  }

  return docs;
}

export function buildSteps(c: CaseRecord): Step[] {
  const r = regionOf(c.country);
  const ex = c.extraction;
  const benDocs = c.investigation.beneficiaries.map((_, i) => `bank-ben-${i}`);
  const bankName = ex.victimBank ?? "your bank";
  const steps: Step[] = [];

  if (r.hotline) {
    const call = firstCall(r);
    steps.push({
      id: "call-hotline",
      short: `Call ${r.hotline.number}`,
      title: `Call ${r.hotline.number}, ${r.hotline.name}`,
      why: r.hotline.why,
      docIds: [],
      script: true,
      action: { label: call.label, href: call.href! },
    });
  } else {
    steps.push({
      id: "call-bank",
      short: "Call your bank",
      title: `Call ${bankName}’s fraud line now`,
      why: "Ask them to stop further payments and recall the transfers. Use the number in your banking app or on the back of your card.",
      docIds: [],
      script: true,
    });
  }

  if (r.portal) {
    steps.push({
      id: "file-report",
      short: r.portal.isPoliceReport ? "File police report" : "File online report",
      title: `File the report on ${r.portal.name}`,
      why: r.portal.why,
      docIds: ["report"],
      action: { label: `Open ${r.portal.name}`, href: r.portal.url, external: true },
    });
  }

  if (r.hotline) {
    steps.push({
      id: "bank-own",
      short: "Tell your bank",
      title: `Tell ${bankName} to block and dispute`,
      why: ex.unauthorized && r.unauthorizedNote ? r.unauthorizedNote : "Your bank can block further debits and push the receiving banks to hold the money.",
      docIds: ["bank-own"],
    });
  } else {
    steps.push({
      id: "bank-own",
      short: "Confirm in writing",
      title: `Confirm the fraud to ${bankName} in writing`,
      why: "A written record backs up your call and speeds up the dispute.",
      docIds: ["bank-own"],
    });
  }

  if (benDocs.length)
    steps.push({
      id: "bank-ben",
      short: "Freeze receiving banks",
      title: `Send freeze requests to ${benDocs.length === 1 ? "the receiving bank" : `${benDocs.length} receiving banks`}`,
      why: "Email each bank so a freeze request is on record with your reference number.",
      docIds: benDocs,
    });

  if (r.support) {
    steps.push({
      id: "support",
      short: `Call ${r.support.number}`,
      title: `Call ${r.support.name} on ${r.support.number}`,
      why: r.support.why,
      docIds: [],
      action: { label: `Call ${r.support.number}`, href: `tel:${r.support.number.replace(/[^\d]/g, "")}` },
    });
  }

  if (r.telecom && (ex.suspect.phones.length || ex.suspect.urls.length || r.code !== "IN")) {
    steps.push({
      id: "telecom",
      short: "Report the scammer",
      title: `Report the scam on ${r.telecom.name}`,
      why: r.telecom.why,
      docIds: [],
      action: { label: `Open ${r.telecom.name}`, href: r.telecom.url, external: true },
    });
  }

  if (!r.portal?.isPoliceReport) {
    steps.push({
      id: "police",
      short: "Police complaint",
      title: "File a police complaint today",
      why: r.policeNote,
      docIds: ["police"],
    });
  }

  steps.push({
    id: "secure",
    short: "Secure your accounts",
    title: "Secure your phone and accounts",
    why:
      ex.scamType === "remote_access"
        ? "Uninstall the screen-sharing app, change your banking and email passwords, and check for unknown linked devices."
        : "Change your banking PIN and passwords if you shared them, and turn on transaction alerts.",
    docIds: [],
  });

  return steps;
}

export function docAsText(d: DocDraft): string {
  if (d.fields) return d.fields.map((f) => `${f.label}:\n${f.value}`).join("\n\n");
  return `${d.subject ? `Subject: ${d.subject}\n\n` : ""}${d.body}`;
}
