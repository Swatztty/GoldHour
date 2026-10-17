import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Golden Hour: report a scam by voice, in any language",
    short_name: "Golden Hour",
    description: "Report a scam by talking, in any language. Your report is linked to other victims so the money can be frozen.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#10151c",
    categories: ["finance", "utilities", "security"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Share a suspicious message from WhatsApp, SMS or email straight into the checker (Android)
    share_target: {
      action: "/check",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    shortcuts: [
      { name: "Report a scam", short_name: "Report", url: "/?source=shortcut" },
      { name: "Check a message", short_name: "Check", url: "/check" },
      { name: "Practice call", short_name: "Practice", url: "/practice" },
      { name: "Scam network", short_name: "Network", url: "/network" },
    ],
  };
}
