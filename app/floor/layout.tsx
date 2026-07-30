import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "WN Production",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "WN Production" },
};

export const viewport: Viewport = {
  themeColor: "#b5673a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Full-screen overlay over the dashboard's root chrome (the root layout always
// wraps; z-50 covers the sidebar/chatbot). Phase 3 can extract a route group.
export default function FloorLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 overflow-auto bg-cream">{children}</div>;
}
