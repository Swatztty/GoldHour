import { regionOf, type CountryCode } from "../regions";

export interface PlanStep {
  id: string;
  title: string;
  why: string;
  action?: { label: string; href: string; external?: boolean };
}

/** What to do now, in order, for the person's country. Short and spoken-friendly. */
export function buildPlan(country: CountryCode, victimBank?: string, hasScammerNumber = true, remoteAccess = false): PlanStep[] {
  const r = regionOf(country);
  const bank = victimBank || "your bank";
  const steps: PlanStep[] = [];
  if (r.hotline) {
    steps.push({
      id: "hotline",
      title: `Call ${r.hotline.number} now`,
      why: `${r.hotline.name}. ${r.hotline.why.replace(" Read out the script below.", "")}`,
      action: { label: `Call ${r.hotline.number}`, href: `tel:${r.hotline.number.replace(/[^\d]/g, "")}` },
    });
    steps.push({ id: "bank", title: `Tell ${bank}`, why: "Ask them to block your account and cards, and to try to recall the payments. Use the number in your banking app or on your card." });
  } else {
    steps.push({ id: "bank", title: `Call ${bank}’s fraud line now`, why: "Ask them to stop further payments and recall the transfers. Use the number in your banking app or on the back of your card." });
  }
  if (r.portal)
    steps.push({ id: "report", title: `File a report on ${r.portal.name}`, why: r.portal.why, action: { label: `Open ${r.portal.name}`, href: r.portal.url, external: true } });
  if (r.support)
    steps.push({ id: "support", title: `Call ${r.support.name} on ${r.support.number}`, why: r.support.why, action: { label: `Call ${r.support.number}`, href: `tel:${r.support.number.replace(/[^\d]/g, "")}` } });
  if (!r.portal?.isPoliceReport) steps.push({ id: "police", title: "Report it to the police", why: r.policeNote });
  if (r.telecom && hasScammerNumber)
    steps.push({ id: "telecom", title: `Report the scammer on ${r.telecom.name}`, why: r.telecom.why, action: { label: `Open ${r.telecom.name}`, href: r.telecom.url, external: true } });
  steps.push({
    id: "secure",
    title: "Keep yourself safe",
    why: remoteAccess
      ? "Delete any screen-sharing app the caller asked you to install, then change your banking passwords. Don’t delete the chats: they are evidence."
      : "Change your banking PIN and passwords if you shared them. Don’t delete the chats: they are evidence. Never pay anyone who offers to get your money back for a fee.",
  });
  return steps;
}
