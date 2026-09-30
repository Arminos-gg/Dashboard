"use client";

import { useMemo, useState } from "react";
import type { DayStat, Habit } from "@/lib/types";
import { addDays, dateKey, fromDateKey, monthName, relativeDay } from "@/lib/time";
import { dayScore, habitsDoneOn } from "@/lib/stats";

const WEEKS = 26;
const CELL = 17;

/** 26 weeks of days as a star chart: dot size and brightness both follow the day's score (one hue, sequential). */
export function Consistency({
  history,
  todayStat,
  habits,
  now,
}: {
  history: Record<string, DayStat>;
  todayStat: DayStat;
  habits: Habit[];
  now: Date;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const cells = useMemo(() => {
    const out: { key: string; col: number; row: number; score: number | null; stat?: DayStat }[] = [];
    const mondayOffset = (now.getDay() + 6) % 7; // 0 = Monday
    const start = addDays(now, -(WEEKS - 1) * 7 - mondayOffset);
    for (let c = 0; c < WEEKS; c++) {
      for (let r = 0; r < 7; r++) {
        const d = addDays(start, c * 7 + r);
        if (d > now) continue;
        const key = dateKey(d);
        const stat = key === todayStat.date ? todayStat : history[key];
        out.push({ key, col: c, row: r, score: stat ? dayScore(stat, habits, key) : null, stat });
      }
    }
    return out;
  }, [history, todayStat, habits, now]);

  const months = useMemo(() => {
    const seen = new Set<string>();
    return cells
      .filter((c) => c.row === 0)
      .filter((c) => {
        const m = c.key.slice(0, 7);
        if (seen.has(m)) return false;
        seen.add(m);
        return true;
      })
      .map((c) => ({ col: c.col, label: monthName(fromDateKey(c.key)).slice(0, 3) }));
  }, [cells]);

  const weeks = useMemo(() => {
    const out = Array.from({ length: WEEKS }, () => ({ sum: 0, n: 0 }));
    for (const c of cells) {
      if (c.score == null) continue;
      out[c.col].sum += c.score;
      out[c.col].n++;
    }
    return out.map((w) => (w.n ? w.sum / w.n : null));
  }, [cells]);
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);

  const BAR_H = 30;
  const GRID_B = 20 + 7 * CELL;
  const W = WEEKS * CELL + 28;
  const H = GRID_B + 14 + BAR_H + 4;
  const h = cells.find((c) => c.key === hover);
  const today = dateKey(now);

  return (
    <div>
      <div className="overflow-x-auto" data-lenis-prevent-wheel>
        <svg width={W} height={H} className="block" role="img" aria-label="Daily consistency over the last 26 weeks">
          <defs>
            <filter id="cs-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          {months.map((m) => (
            <text key={m.label + m.col} x={28 + m.col * CELL} y={9} fontSize={9} fill="var(--faint)" className="mono" letterSpacing="0.14em">
              {m.label.toUpperCase()}
            </text>
          ))}
          {["M", "W", "F"].map((d, i) => (
            <text key={d} x={0} y={26 + (i * 2) * CELL + CELL / 2 + 3} fontSize={9} fill="var(--faint)" className="mono">
              {d}
            </text>
          ))}
          {cells.map((c) => {
            const cx = 28 + c.col * CELL + CELL / 2;
            const cy = 20 + c.row * CELL + CELL / 2;
            const s = c.score ?? 0;
            return (
              <g key={c.key} onPointerEnter={() => setHover(c.key)} onPointerLeave={() => setHover(null)}>
                <rect x={cx - CELL / 2} y={cy - CELL / 2} width={CELL} height={CELL} fill="transparent" />
                {c.score == null ? (
                  <circle cx={cx} cy={cy} r={1} fill="var(--line-strong)" />
                ) : (
                  <>
                    {s > 0.7 && <circle cx={cx} cy={cy} r={4 + s * 4} fill="var(--accent)" opacity={0.35 * s} filter="url(#cs-glow)" />}
                    <circle cx={cx} cy={cy} r={1.4 + s * 4.6} fill="var(--accent)" opacity={0.18 + s * 0.82} />
                  </>
                )}
                {(c.key === today || c.key === hover) && <circle cx={cx} cy={cy} r={7.5} fill="none" stroke="var(--ink)" strokeOpacity={0.6} />}
              </g>
            );
          })}
          {/* weekly average — the rhythm under the stars */}
          <text x={0} y={GRID_B + 14 + BAR_H - 2} fontSize={9} fill="var(--faint)" className="mono">
            WK
          </text>
          <line x1={28} x2={W} y1={GRID_B + 14 + BAR_H + 0.5} y2={GRID_B + 14 + BAR_H + 0.5} stroke="var(--line)" />
          {weeks.map((w, i) => {
            const bh = w == null ? 0 : Math.max(2, w * BAR_H);
            const x = 28 + i * CELL + 3;
            return (
              <g key={i} onPointerEnter={() => setHoverWeek(i)} onPointerLeave={() => setHoverWeek(null)}>
                <rect x={x - 3} y={GRID_B + 10} width={CELL} height={BAR_H + 6} fill="transparent" />
                <rect
                  x={x}
                  y={GRID_B + 14 + BAR_H - bh}
                  width={CELL - 6}
                  height={bh}
                  rx={1.5}
                  fill="var(--accent)"
                  opacity={hoverWeek === i ? 1 : 0.25 + (w ?? 0) * 0.6}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mono mt-4 flex flex-wrap items-center justify-between gap-4 text-faint">
        <span className="flex items-center gap-2">
          Less
          {[0.1, 0.35, 0.6, 0.85, 1].map((s) => (
            <svg key={s} width={12} height={12} aria-hidden>
              <circle cx={6} cy={6} r={1.4 + s * 4.6} fill="var(--accent)" opacity={0.18 + s * 0.82} />
            </svg>
          ))}
          More
        </span>
        <span className="min-h-[1.5em] text-muted" aria-live="polite">
          {hoverWeek != null
            ? `Week of ${relativeDay(cells.find((c) => c.col === hoverWeek)?.key ?? today, now)} · average ${weeks[hoverWeek] == null ? "—" : Math.round((weeks[hoverWeek] ?? 0) * 100)}`
            : h && h.stat
            ? `${relativeDay(h.key, now)} · ${Math.round((h.score ?? 0) * 100)} · ${h.stat.completed} tasks · ${habitsDoneOn(habits, h.key)}/${habits.length} rituals · ${(h.stat.focusMin / 60).toFixed(1)}h focus`
            : "Hover a day"}
        </span>
      </div>
    </div>
  );
}
