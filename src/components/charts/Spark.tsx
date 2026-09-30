"use client";

import { useId, useMemo, useState } from "react";
import { relativeDay } from "@/lib/time";

/** A small single-series trend under a headline figure; hover reads any day. */
export function Spark({ values, dates, format, height = 40 }: { values: number[]; dates: string[]; format: (v: number) => string; height?: number }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const W = 240;
  const H = height;
  const n = values.length;
  const max = Math.max(1e-6, ...values);
  const pts = useMemo(
    () => values.map((v, i) => [n > 1 ? (i / (n - 1)) * W : W, H - 3 - (v / max) * (H - 8)] as const),
    [values, n, max, H],
  );
  if (n < 2) return null;
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const area = `${line}L${W} ${H}L0 ${H}Z`;
  const h = hover ?? n - 1;
  const [hx, hy] = pts[h];

  return (
    <div className="relative mt-4 max-w-[240px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-[40px] w-full overflow-visible"
        aria-hidden
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`sp-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--line)" vectorEffect="non-scaling-stroke" />
        <path d={area} fill={`url(#sp-${id})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover != null && <line x1={hx} x2={hx} y1={0} y2={H} stroke="var(--ink)" strokeOpacity={0.3} vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* the dot lives outside the stretched SVG so it stays round */}
      <span
        className="pointer-events-none absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]"
        style={{ left: `${(hx / W) * 100}%`, top: `${(hy / H) * 40}px` }}
      />
      <div className="mono mt-1.5 flex justify-between text-[10px] text-faint">
        <span>{hover != null && dates[h] ? relativeDay(dates[h]) : "trend"}</span>
        <span className={hover != null ? "text-ink" : ""}>{format(values[h])}</span>
      </div>
    </div>
  );
}
