import { Suspense } from "react";
import { ReportPlan } from "@/components/rt/ReportPlan";
import { BottomNav, RtHeader } from "@/components/rt/RtHeader";

export const metadata = {
  title: "Your action plan: Golden Hour",
  robots: { index: false },
};

export default function ReportPage() {
  return (
    <>
      <RtHeader />
      <main id="main" tabIndex={-1} lang="en">
        <Suspense fallback={<p className="p-8 text-lg">Opening your report…</p>}>
          <ReportPlan />
        </Suspense>
      </main>
      <BottomNav />
    </>
  );
}
