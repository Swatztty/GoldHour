import { SafetyHub } from "@/components/rt/SafetyHub";
import { BottomNav, RtHeader } from "@/components/rt/RtHeader";

export const metadata = {
  title: "Stay safe: Golden Hour",
  description: "Practice saying no to scammers, get warnings during a call, and let someone you trust look out for you.",
};

export default function Page() {
  return (
    <>
      <RtHeader current="safety" />
      <main id="main" tabIndex={-1} className="pb-16">
        <SafetyHub />
      </main>
      <BottomNav current="safety" />
    </>
  );
}
