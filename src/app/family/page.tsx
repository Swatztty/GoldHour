import { FamilyGuardian } from "@/components/rt/FamilyGuardian";
import { BottomNav, RtHeader } from "@/components/rt/RtHeader";

export const metadata = {
  title: "Family guardian: Golden Hour",
  description: "Choose someone you trust to be alerted if you report a scam or a check looks risky.",
};

export default function Page() {
  return (
    <>
      <RtHeader current="safety" />
      <main id="main" tabIndex={-1} lang="en" className="pb-16">
        <FamilyGuardian />
      </main>
      <BottomNav current="safety" />
    </>
  );
}
