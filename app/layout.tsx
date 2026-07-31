import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MarketModal from "@/components/MarketModal";
import ChatBot from "@/components/ChatBot";
import ChromeGate from "@/components/ChromeGate";
import { getMarketMode } from "@/lib/markets";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Wild Nutrition — SKU Dashboard",
  description: "Inventory & cover tracking for Wild Nutrition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const configured = cookies().get("marketsConfigured")?.value === "1";
  const mode = getMarketMode();

  return (
    <html lang="en">
      <body className="flex min-h-screen antialiased bg-cream">
        <ChromeGate><Sidebar mode={mode} /></ChromeGate>
        <main className="flex-1 min-w-0 overflow-auto p-4 pt-20 md:p-10">{children}</main>
        <ChromeGate>
          {!configured && <MarketModal show={true} currentMode={mode} />}
          <ChatBot />
        </ChromeGate>
      </body>
    </html>
  );
}
