"use client";

import { useState, useMemo } from "react";
import type { BomSheet } from "@/lib/types";

type Props = { rmBom: BomSheet; ancBom: BomSheet };

type ResultMode = "where-used" | "product-bom";

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{label}</span>
  );
}

function codeType(code: string): "1-code" | "2-code" | "3-code" | "4-code" | "unknown" {
  if (code.startsWith("10000")) return "1-code";
  if (code.startsWith("2")) return "2-code";
  if (code.startsWith("3")) return "3-code";
  if (code.startsWith("4")) return "4-code";
  return "unknown";
}

const codeBadge: Record<string, string> = {
  "1-code": "bg-blue-100 text-blue-700",
  "2-code": "bg-green-100 text-green-700",
  "3-code": "bg-copper/10 text-copper",
  "4-code": "bg-purple-100 text-purple-700",
  "unknown": "bg-cream-dark text-text-muted",
};

export default function BomSearch({ rmBom, ancBom }: Props) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ResultMode>("where-used");

  const q = query.trim().toLowerCase();

  // Build flat searchable list for suggestions
  const allComponents = useMemo(() => {
    const items: { code: string; name: string; bom: "rm" | "ancillary" }[] = [];
    rmBom.byComponent.forEach((v, code) => items.push({ code, name: v.componentName, bom: "rm" }));
    ancBom.byComponent.forEach((v, code) => items.push({ code, name: v.componentName, bom: "ancillary" }));
    return items;
  }, [rmBom, ancBom]);

  const allProducts = useMemo(() => {
    const items: { code: string; name: string; bom: "rm" | "ancillary" }[] = [];
    rmBom.products.forEach(p => items.push({ code: p.code, name: p.name, bom: "rm" }));
    ancBom.products.forEach(p => items.push({ code: p.code, name: p.name, bom: "ancillary" }));
    return items;
  }, [rmBom, ancBom]);

  // Determine what we're looking at based on query
  const whereUsedResults = useMemo(() => {
    if (!q) return null;
    const results: { code: string; name: string; bom: "rm" | "ancillary"; usedIn: { code: string; name: string; qty: number }[] }[] = [];
    rmBom.byComponent.forEach((v, code) => {
      if (code.toLowerCase().includes(q) || v.componentName.toLowerCase().includes(q)) {
        results.push({ code, name: v.componentName, bom: "rm", usedIn: v.usedIn });
      }
    });
    ancBom.byComponent.forEach((v, code) => {
      if (code.toLowerCase().includes(q) || v.componentName.toLowerCase().includes(q)) {
        results.push({ code, name: v.componentName, bom: "ancillary", usedIn: v.usedIn });
      }
    });
    return results;
  }, [q, rmBom, ancBom]);

  const productBomResults = useMemo(() => {
    if (!q) return null;
    const results: { code: string; name: string; bom: "rm" | "ancillary"; components: { code: string; name: string; qty: number }[] }[] = [];
    rmBom.products.forEach(p => {
      if (p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
        results.push({ code: p.code, name: p.name, bom: "rm", components: p.components });
      }
    });
    ancBom.products.forEach(p => {
      if (p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
        results.push({ code: p.code, name: p.name, bom: "ancillary", components: p.components });
      }
    });
    return results;
  }, [q, rmBom, ancBom]);

  const hasWhereUsed = (whereUsedResults?.length ?? 0) > 0;
  const hasProductBom = (productBomResults?.length ?? 0) > 0;

  return (
    <div>
      {/* Search bar */}
      <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5 mb-5">
        <div className="relative mb-4">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by code (e.g. 20000114) or name (e.g. sodium hyaluronate, magnesium jar)…"
            className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-[#e4ddd4] bg-cream placeholder-text-muted focus:outline-none focus:border-copper transition-colors"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-charcoal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("where-used")}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${mode === "where-used" ? "bg-copper text-white" : "bg-cream text-text-muted hover:bg-[#ede6db]"}`}
          >
            Where Used — ingredient → products
          </button>
          <button
            onClick={() => setMode("product-bom")}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${mode === "product-bom" ? "bg-copper text-white" : "bg-cream text-text-muted hover:bg-[#ede6db]"}`}
          >
            Product BOM — product → ingredients
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!q && (
        <div className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-12 text-center">
          <p className="text-text-muted text-sm mb-1">Start typing to search</p>
          <p className="text-xs text-text-muted">
            <strong>Where Used:</strong> enter a 2-code ingredient or 4-code ancillary to see which products use it<br />
            <strong>Product BOM:</strong> enter a 1-code blend or 3-code finished good to see its full recipe
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            {["20000114", "sodium hyaluronate", "10000673", "magnesium jar", "30000254"].map(s => (
              <button key={s} onClick={() => setQuery(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-cream border border-[#e4ddd4] text-charcoal hover:border-copper hover:text-copper transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {q && !hasWhereUsed && !hasProductBom && (
        <div className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-10 text-center text-text-muted text-sm">
          No BOM entries found for <strong>"{query}"</strong>
        </div>
      )}

      {/* Where Used results */}
      {q && mode === "where-used" && hasWhereUsed && (
        <div className="space-y-4">
          {whereUsedResults!.map(item => (
            <div key={item.code} className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 bg-cream border-b border-[#e4ddd4]">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-sm font-medium text-charcoal">{item.code}</span>
                  <Badge label={codeType(item.code)} color={codeBadge[codeType(item.code)]} />
                  <Badge label={item.bom === "rm" ? "Raw Material BOM" : "Ancillary BOM"} color="bg-cream-dark text-text-muted" />
                </div>
                <p className="text-base font-medium text-charcoal mt-1">{item.name}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Used in <strong>{item.usedIn.length}</strong> product{item.usedIn.length !== 1 ? "s" : ""} ·{" "}
                  {item.bom === "rm" ? "Qty = kg per 1,000 capsules" : "Qty = units per finished product"}
                </p>
              </div>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e4ddd4] text-left">
                      <th className="px-5 py-3 text-xs tracking-widest uppercase text-text-muted font-medium">Product Code</th>
                      <th className="px-5 py-3 text-xs tracking-widest uppercase text-text-muted font-medium">Product Name</th>
                      <th className="px-5 py-3 text-xs tracking-widest uppercase text-text-muted font-medium">Type</th>
                      <th className="px-5 py-3 text-xs tracking-widest uppercase text-text-muted font-medium text-right">
                        {item.bom === "rm" ? "kg / 1,000 caps" : "Units / product"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.usedIn
                      .sort((a, b) => b.qty - a.qty)
                      .map(p => (
                        <tr key={p.code} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                          <td className="px-5 py-3 font-mono text-xs text-copper">{p.code}</td>
                          <td className="px-5 py-3 text-charcoal">{p.name}</td>
                          <td className="px-5 py-3">
                            <Badge label={codeType(p.code)} color={codeBadge[codeType(p.code)]} />
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-charcoal tabular-nums">{p.qty.toFixed(3)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product BOM results */}
      {q && mode === "product-bom" && hasProductBom && (
        <div className="space-y-4">
          {productBomResults!.map(item => (
            <div key={item.code} className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 bg-cream border-b border-[#e4ddd4]">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-sm font-medium text-charcoal">{item.code}</span>
                  <Badge label={codeType(item.code)} color={codeBadge[codeType(item.code)]} />
                  <Badge label={item.bom === "rm" ? "Raw Material BOM" : "Ancillary BOM"} color="bg-cream-dark text-text-muted" />
                </div>
                <p className="text-base font-medium text-charcoal mt-1">{item.name}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  <strong>{item.components.length}</strong> component{item.components.length !== 1 ? "s" : ""} ·{" "}
                  {item.bom === "rm" ? "Qty = kg per 1,000 capsules" : "Qty = units per finished product"}
                </p>
              </div>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e4ddd4] text-left">
                      <th className="px-5 py-3 text-xs tracking-widest uppercase text-text-muted font-medium">Component Code</th>
                      <th className="px-5 py-3 text-xs tracking-widest uppercase text-text-muted font-medium">Component Name</th>
                      <th className="px-5 py-3 text-xs tracking-widest uppercase text-text-muted font-medium">Type</th>
                      <th className="px-5 py-3 text-xs tracking-widest uppercase text-text-muted font-medium text-right">
                        {item.bom === "rm" ? "kg / 1,000 caps" : "Units / product"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.components
                      .sort((a, b) => b.qty - a.qty)
                      .map(c => (
                        <tr key={c.code} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                          <td className="px-5 py-3 font-mono text-xs text-copper">{c.code}</td>
                          <td className="px-5 py-3 text-charcoal">{c.name}</td>
                          <td className="px-5 py-3">
                            <Badge label={codeType(c.code)} color={codeBadge[codeType(c.code)]} />
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-charcoal tabular-nums">{c.qty.toFixed(3)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cross-mode hint */}
      {q && mode === "where-used" && !hasWhereUsed && hasProductBom && (
        <div className="bg-cream rounded-2xl border border-[#e4ddd4] px-5 py-4 text-sm text-charcoal">
          No ingredients found for <strong>"{query}"</strong> — but it matches a product.{" "}
          <button onClick={() => setMode("product-bom")} className="text-copper underline">Switch to Product BOM</button>
        </div>
      )}
      {q && mode === "product-bom" && !hasProductBom && hasWhereUsed && (
        <div className="bg-cream rounded-2xl border border-[#e4ddd4] px-5 py-4 text-sm text-charcoal">
          No products found for <strong>"{query}"</strong> — but it matches an ingredient.{" "}
          <button onClick={() => setMode("where-used")} className="text-copper underline">Switch to Where Used</button>
        </div>
      )}
    </div>
  );
}
