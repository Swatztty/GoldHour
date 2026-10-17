import { PracticeCall } from "@/components/rt/PracticeCall";
import { BottomNav, RtHeader } from "@/components/rt/RtHeader";

export const metadata = {
  title: "Practice call: Golden Hour",
  description: "A pretend scammer calls you. Practise saying no and get a score, before a real scammer calls.",
};

export default function PracticePage() {
  return (
    <>
      <RtHeader current="safety" />
      <main id="main" tabIndex={-1} lang="en" className="pb-16">
        <PracticeCall />
      </main>
      <BottomNav current="safety" />
    </>
  );
}
