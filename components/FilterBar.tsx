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
  /** If provided, show This Week / This Month shortcuts that set these two URL params */
  periodKeys?: { from: string; to: string };
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { from: isoDate(mon), to: isoDate(sun) };
}

function getMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: isoDate(from), to: isoDate(to) };
}

export default function FilterBar({ searchPlaceholder = "Search…", filters = [], periodKeys }: FilterBarProps) {
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

  const applyPeriod = useCallback(
    (range: { from: string; to: string }) => {
      if (!periodKeys) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set(periodKeys.from, range.from);
      params.set(periodKeys.to, range.to);
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams, periodKeys]
  );

  const clearPeriod = useCallback(() => {
    if (!periodKeys) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete(periodKeys.from);
    params.delete(periodKeys.to);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [router, pathname, searchParams, periodKeys]);

  const activePeriodFrom = periodKeys ? (searchParams.get(periodKeys.from) ?? "") : "";
  const activePeriodTo   = periodKeys ? (searchParams.get(periodKeys.to)   ?? "") : "";
  const hasPeriod = activePeriodFrom || activePeriodTo;

  const baseInput = "rounded-xl border border-[#e4ddd4] bg-white px-4 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-copper/30 focus:border-copper transition-all";
  const chipBase  = "px-3 py-2 rounded-xl text-xs font-medium transition-colors border";
  const chipOn    = "bg-copper text-white border-copper";
  const chipOff   = "bg-white text-text-muted border-[#e4ddd4] hover:border-copper hover:text-copper";

  const weekRange  = getWeekRange();
  const monthRange = getMonthRange();
  const isWeek  = activePeriodFrom === weekRange.from  && activePeriodTo === weekRange.to;
  const isMonth = activePeriodFrom === monthRange.from && activePeriodTo === monthRange.to;

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

      {/* Quick period chips */}
      {periodKeys && (
        <>
          <button onClick={() => applyPeriod(weekRange)}  className={`${chipBase} ${isWeek  ? chipOn : chipOff}`}>This Week</button>
          <button onClick={() => applyPeriod(monthRange)} className={`${chipBase} ${isMonth ? chipOn : chipOff}`}>This Month</button>
          {hasPeriod && !isWeek && !isMonth && (
            <span className="text-xs text-copper font-medium px-1">Custom range</span>
          )}
          {hasPeriod && (
            <button onClick={clearPeriod} className={`${chipBase} ${chipOff}`}>✕ Clear</button>
          )}
        </>
      )}

      {filters.map((f) => {
        if (f.type === "date") {
          return (
            <div key={f.key} className="flex items-center gap-1.5">
              <label className="text-xs text-text-muted whitespace-nowrap">{f.label}</label>
              <input
                type="date"
                value={searchParams.get(f.key) ?? ""}
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
