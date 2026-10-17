import { Suspense } from "react";
import { CaseFileView } from "@/components/rt/CaseFileView";
import { RtHeader } from "@/components/rt/RtHeader";

export const metadata = {
  title: "Case file: Golden Hour",
  robots: { index: false },
};

export default function CaseFilePage() {
  return (
    <>
      <RtHeader />
      <main id="main" tabIndex={-1} lang="en">
        <Suspense fallback={<p className="p-8 text-lg">Preparing your case file…</p>}>
          <CaseFileView />
        </Suspense>
      </main>
    </>
  );
}
