"use client";

import { usePathname } from "next/navigation";

// Renders dashboard-only chrome (sidebar, market-view modal, chatbot) on the
// manager dashboard but NOT inside the /floor supervisor app, which is a
// self-contained mobile experience. Supervisors should never see the market
// selector or the dashboard sidebar.
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/floor")) return null;
  return <>{children}</>;
}
