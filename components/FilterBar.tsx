"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDef {
  key: string;
  label: string;
  options?: FilterOption[];
  type?: "select" | "date";
}

interface FilterBarProps {
  searchPlaceholder?: string;
  filters?: FilterDef[];
}

export default function FilterBar({ searchPlaceholder = "Search…", filters = [] }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  const baseInput = "rounded-xl border border-[#e4ddd4] bg-white px-4 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-copper/30 focus:border-copper transition-all";

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Search box */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <input
          type="text"
          placeholder={searchPlaceholder}
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => update("search", e.target.value)}
          className={`w-full pr-9 ${baseInput}`}
        />
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </div>

      {filters.map((f) => {
        if (f.type === "date") {
          return (
            <div key={f.key} className="flex items-center gap-1.5">
              <label className="text-xs text-text-muted whitespace-nowrap">{f.label}</label>
              <input
                type="date"
                defaultValue={searchParams.get(f.key) ?? ""}
                onChange={(e) => update(f.key, e.target.value)}
                className={`${baseInput} cursor-pointer`}
              />
            </div>
          );
        }
        return (
          <select
            key={f.key}
            defaultValue={searchParams.get(f.key) ?? ""}
            onChange={(e) => update(f.key, e.target.value)}
            className={`${baseInput} cursor-pointer`}
          >
            <option value="">{f.label}: All</option>
            {(f.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      })}
    </div>
  );
}
