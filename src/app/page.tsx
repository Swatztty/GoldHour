import { Reporter } from "@/components/rt/Reporter";
import { BottomNav, RtHeader } from "@/components/rt/RtHeader";

export default function Home() {
  return (
    <>
      <RtHeader current="report" />
      <main id="main" tabIndex={-1} className="rt-hero-glow">
        <Reporter />
      </main>
      <footer className="mx-auto mt-16 max-w-6xl border-t border-line px-4 py-8 text-muted sm:px-6">
        <p>
          Golden Hour is a prototype built with Gemini on Google Cloud. It never asks for PINs, passwords or one-time codes. Police, banks and official hotlines never charge a fee to recover money.{" "}
          <a href="/accessibility" className="underline underline-offset-4">
            Accessibility statement
          </a>
        </p>
      </footer>
      <BottomNav current="report" />
    </>
  );
}
