"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  /** Target value to animate to. */
  value: number;
  /** Decimal places to show. */
  decimals?: number;
  /** Prefix (e.g. "£") and suffix (e.g. "%"). */
  prefix?: string;
  suffix?: string;
  /** Use locale grouping (1,234) — on by default. */
  group?: boolean;
  /** Animation duration in ms. */
  duration?: number;
}

// easeOutExpo — fast start, gentle settle. Feels "live" without being bouncy.
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function format(n: number, decimals: number, group: boolean): string {
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: group,
  });
}

/**
 * Rolls a number up from 0 to `value` on mount. Restarts if `value` changes.
 * Respects prefers-reduced-motion (jumps straight to the final value).
 */
export default function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  group = true,
  duration = 1100,
}: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const frame = useRef<number>();

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || duration <= 0 || !isFinite(value)) {
      setDisplay(value);
      return;
    }

    let start: number | null = null;
    const from = 0;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      setDisplay(from + (value - from) * easeOutExpo(t));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  return (
    <span className="tabular-nums">
      {prefix}
      {format(display, decimals, group)}
      {suffix}
    </span>
  );
}
