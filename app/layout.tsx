import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Wild Nutrition — SKU Dashboard",
  description: "Inventory & cover tracking for Wild Nutrition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen antialiased bg-cream">
        <Sidebar />
        <main className="flex-1 overflow-auto p-10">{children}</main>
      </body>
    </html>
  );
}
