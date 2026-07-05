"use client";

import { useRef } from "react";

/**
 * Exports the nearest <table> (walking up from the button) to a CSV download.
 * Drop it inside any container that also contains the table.
 */
export default function ExportCsvButton({ filename }: { filename: string }) {
  const ref = useRef<HTMLButtonElement>(null);

  function handleExport() {
    let el: HTMLElement | null = ref.current;
    let table: HTMLTableElement | null = null;
    while (el) {
      table = el.querySelector("table");
      if (table) break;
      el = el.parentElement;
    }
    if (!table) return;

    const esc = (s: string) => {
      const clean = s.replace(/\s+/g, " ").trim();
      return /[",\n]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
    };

    const lines: string[] = [];
    table.querySelectorAll("tr").forEach(tr => {
      const cells = Array.from(tr.querySelectorAll("th,td")).map(c => esc(c.textContent ?? ""));
      if (cells.some(c => c !== "")) lines.push(cells.join(","));
    });

    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      ref={ref}
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-copper hover:text-copper-light transition-colors"
      title="Download table as CSV"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      Export CSV
    </button>
  );
}
