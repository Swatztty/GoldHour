import { CallShield } from "@/components/rt/CallShield";
import { BottomNav, RtHeader } from "@/components/rt/RtHeader";

export const metadata = {
  title: "Call shield: Golden Hour",
  description: "Put a suspicious call on speaker. Golden Hour listens for scam tricks and warns you straight away.",
};

export default function ShieldPage() {
  return (
    <>
      <RtHeader current="safety" />
      <main id="main" tabIndex={-1} lang="en" className="pb-16">
        <CallShield />
      </main>
      <BottomNav current="safety" />
    </>
  );
}
