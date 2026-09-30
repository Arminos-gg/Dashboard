"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion";
import { ACTIVITIES } from "@/lib/seed";
import type { ActivityKey } from "@/lib/types";

const SIZE = 340;
const STEP = 19;
const OUTER = 150;
const SWEEP = Math.PI * 1.5;

function arcPath(r: number, a: number) {
  const p = (t: number) => `${(r * Math.sin(t)).toFixed(2)} ${(-r * Math.cos(t)).toFixed(2)}`;
  if (a <= 0.0001) return "";
  return `M${p(0)} A${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${p(a)}`;
}

/**
 * Concentric complications: one ring per activity, all on the same angular scale
 * (the largest activity sweeps 270°). Identity is carried by the direct labels.
 */
export function Allocation({ totals, detail = true }: { totals: Record<ActivityKey, number>; detail?: boolean }) {
  const rows = ACTIVITIES.map((a) => ({ ...a, min: totals[a.key] ?? 0 })).sort((a, b) => b.min - a.min);
  const max = Math.max(1, ...rows.map((r) => r.min));
  const sum = rows.reduce((s, r) => s + r.min, 0);
  const target = Object.fromEntries(rows.map((r) => [r.key, (r.min / max) * SWEEP])) as Record<ActivityKey, number>;
  const [angles, setAngles] = useState<Record<ActivityKey, number>>(() =>
    Object.fromEntries(ACTIVITIES.map((a) => [a.key, 0])) as Record<ActivityKey, number>,
  );
  const from = useRef(angles);
  const [hover, setHover] = useState<ActivityKey | null>(null);
  const key = JSON.stringify(target);

  useEffect(() => {
    const start = { ...from.current };
    const end = JSON.parse(key) as Record<ActivityKey, number>;
    const ctrl = animate(0, 1, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (t) => {
        const next = {} as Record<ActivityKey, number>;
        for (const a of ACTIVITIES) next[a.key] = start[a.key] + (end[a.key] - start[a.key]) * t;
        from.current = next;
        setAngles(next);
      },
    });
    return () => ctrl.stop();
  }, [key]);

  const focus = rows.find((r) => r.key === hover);

  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`}
        className="max-w-full shrink-0 overflow-visible"
        role="img"
        aria-label={`Time allocation: ${rows.map((r) => `${r.label} ${(r.min / 60).toFixed(1)} hours`).join(", ")}`}
      >
        {rows.map((r, i) => {
          const rad = OUTER - i * STEP;
          const dim = hover && hover !== r.key;
          return (
            <g
              key={r.key}
              onPointerEnter={() => setHover(r.key)}
              onPointerLeave={() => setHover(null)}
              style={{ opacity: dim ? 0.25 : 1, transition: "opacity .4s" }}
              data-cursor={r.label}
            >
              <circle r={rad} fill="none" stroke="var(--line)" />
              <path d={arcPath(rad, angles[r.key])} fill="none" stroke="var(--accent)" strokeWidth={hover === r.key ? 5 : 3} style={{ transition: "stroke-width .3s" }} />
              <circle r={rad} fill="none" stroke="transparent" strokeWidth={STEP} />
              <line x1={0} x2={0} y1={-rad - 4} y2={-rad + 4} stroke="var(--line-strong)" />
            </g>
          );
        })}
        <text textAnchor="middle" y={-4} className="figure" fontSize={44} fill="var(--ink)">
          {((focus ? focus.min : sum) / 60).toFixed(focus ? 1 : 0)}
        </text>
        <text textAnchor="middle" y={18} className="mono" fontSize={9.5} fill="var(--faint)" letterSpacing="0.18em">
          {focus ? `HOURS · ${focus.label.toUpperCase()}` : "HOURS LOGGED"}
        </text>
      </svg>

      <ol className="mono w-full max-w-[280px]">
        {rows.map((r) => (
          <li
            key={r.key}
            onPointerEnter={() => setHover(r.key)}
            onPointerLeave={() => setHover(null)}
            className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-2.5 transition-colors"
            style={{ color: hover === r.key ? "var(--ink)" : "var(--muted)" }}
          >
            <span>{r.label}</span>
            <span>
              <span className="text-ink">{(r.min / 60).toFixed(1)}h</span>
              {detail && <span className="text-faint"> · {sum ? Math.round((r.min / sum) * 100) : 0}%</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
