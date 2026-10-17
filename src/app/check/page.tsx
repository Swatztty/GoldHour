import { Checker } from "@/components/rt/Checker";
import { BottomNav, RtHeader } from "@/components/rt/RtHeader";

export const metadata = {
  title: "Check before you pay: Golden Hour",
  description: "Paste a message, number, account or link and check it against reports from scam victims across Asia-Pacific.",
};

export default function CheckPage() {
  return (
    <>
      <RtHeader current="check" />
      <main id="main" tabIndex={-1} className="pb-16">
        <Checker />
      </main>
      <BottomNav current="check" />
    </>
  );
}
