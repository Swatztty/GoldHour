import type { Metadata, Viewport } from "next";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/noto-sans-devanagari";
import "@fontsource-variable/noto-sans-tamil";
import "@fontsource-variable/noto-sans-thai";
import "./globals.css";
import { DemoGuard } from "@/components/rt/DemoGuard";
import { GuardianToast } from "@/components/rt/GuardianToast";
import { RegisterSW } from "@/components/rt/RegisterSW";
import { PREFS_BOOT_SCRIPT } from "@/lib/rt/prefs";

export const metadata: Metadata = {
  title: "Golden Hour: report a scam by voice, in any language",
  description:
    "Talk to Golden Hour in your own language to report a scam. It links your report to other victims across Asia-Pacific so the accounts can be frozen before the next person pays.",
  applicationName: "Golden Hour",
  appleWebApp: { capable: true, title: "Golden Hour", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#12171f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-text="100" data-contrast="standard" data-easy="0" data-motion="auto" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
      </head>
      {/* Browser extensions (Grammarly, password managers) add attributes to <body>; ignore those differences */}
      <body className="min-h-dvh" suppressHydrationWarning>
        <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-50 rounded-lg bg-paper px-4 py-2 font-semibold shadow">
          Skip to main content
        </a>
        {children}
        <DemoGuard />
        <GuardianToast />
        <RegisterSW />
      </body>
    </html>
  );
}
