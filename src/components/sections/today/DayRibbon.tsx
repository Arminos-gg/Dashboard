"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLife } from "@/lib/store";
import { eventsOn, freeWindows } from "@/lib/agenda";
import { dateKey, fmtMinutes, hhmm, minutesOfDay, pad } from "@/lib/time";
import { ACTIVITIES } from "@/lib/seed";
import type { CalEvent } from "@/lib/types";
import { usePref } from "@/lib/prefs";

interface Placed {
  e: CalEvent;
  s: number;
  f: number;
  lane: number;
  /** minute until which the label may extend */
  room: number;
}

function place(events: CalEvent[]): Placed[] {
  const lanesEnd: number[] = [];
  const placed = events.map((e) => {
    const s = minutesOfDay(new Date(e.start));
    const f = Math.max(s + 15, minutesOfDay(new Date(e.end)) || 24 * 60);
    let lane = lanesEnd.findIndex((end) => end <= s);
    if (lane === -1) {
      lane = lanesEnd.length;
      lanesEnd.push(f);
    } else lanesEnd[lane] = f;
    return { e, s, f, lane, room: 24 * 60 };
  });
  // labels may run past their band until the next band in the same lane
  for (const p of placed) {
    const next = placed.filter((q) => q.lane === p.lane && q.s >= p.f).sort((a, b) => a.s - b.s)[0];
    p.room = next ? next.s : 24 * 60;
  }
  return placed;
}

/** The day as a horizontal instrument: hours as ticks, commitments as translucent bands, a live needle for now. */
export function DayRibbon({ now }: { now: Date }) {
  const detail = usePref("detail");
  const events = useLife((s) => s.events);
  const removeEvent = useLife((s) => s.removeEvent);
  const pushLog = useLife((s) => s.pushLog);
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1200);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(760, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const today = dateKey(now);
  const todays = useMemo(() => eventsOn(events, today), [events, today]);
  const placed = useMemo(() => place(todays), [todays]);
  const lanes = Math.max(1, ...placed.map((p) => p.lane + 1));
  const windows = useMemo(() => freeWindows(events, now, 22, 45), [events, now]);

  const startH = Math.min(7, ...todays.map((e) => new Date(e.start).getHours()));
  const endH = 24;
  const H = 170 + (lanes - 1) * 40;
  const axisY = H - 64;
  const padX = 8;
  const x = (min: number) => padX + ((min - startH * 60) / ((endH - startH) * 60)) * (W - padX * 2);
  const nowMin = minutesOfDay(now) + now.getSeconds() / 60;
  const nx = x(nowMin);
  const sel = placed.find((p) => p.e.id === selected);

  const hoverMin =
    hoverX != null ? Math.round(((hoverX - padX) / (W - padX * 2)) * (endH - startH) * 12) * 5 + startH * 60 : null;

  return (
    <div>
      <div ref={wrap} className="-mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)] md:mx-0 md:overflow-visible md:px-0" data-lenis-prevent-wheel>
        <svg
          width={W}
          height={H}
          className="block overflow-visible"
          role="img"
          aria-label={`Timeline for today: ${todays.map((e) => `${e.title} ${hhmm(new Date(e.start))}–${hhmm(new Date(e.end))}`).join("; ") || "no events"}`}
          onPointerMove={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect();
            setHoverX(ev.clientX - r.left);
          }}
          onPointerLeave={() => setHoverX(null)}
        >
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(236 232 225 / 0.06)" strokeWidth="1" />
            </pattern>
            <linearGradient id="band" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* elapsed part of the day */}
          <rect x={padX} y={0} width={Math.max(0, nx - padX)} height={axisY} fill="url(#hatch)" />

          {/* hour ticks */}
          {Array.from({ length: (endH - startH) * 4 + 1 }).map((_, i) => {
            const min = startH * 60 + i * 15;
            const major = i % 4 === 0;
            const label = major && (min / 60) % 3 === 0;
            return (
              <g key={i}>
                <line
                  x1={x(min)}
                  x2={x(min)}
                  y1={axisY}
                  y2={axisY + (label ? 12 : major ? 7 : 3)}
                  stroke={major ? "var(--line-strong)" : "var(--line)"}
                />
                {label && (
                  <text x={x(min)} y={axisY + 26} textAnchor="middle" fontSize={10} fill="var(--faint)" className="mono" letterSpacing="0.14em">
                    {pad(min / 60)}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={padX} x2={W - padX} y1={axisY} y2={axisY} stroke="var(--line-strong)" />

          {/* open windows */}
          {windows.map((w) => {
            const a = x(minutesOfDay(w.start));
            const b = x(minutesOfDay(w.end) || 24 * 60);
            const big = b - a > 90;
            // minimal view: only the open stretches worth planning around
            if (!big && !detail) return null;
            return (
              <g key={w.start.toISOString()}>
                <path d={`M${a + 2} ${axisY + 36} V${axisY + 40} H${b - 2} V${axisY + 36}`} fill="none" stroke="var(--accent)" strokeOpacity={0.55} />
                {big ? (
                  <text x={(a + b) / 2} y={axisY + 58} textAnchor="middle" fontSize={14} fill="var(--accent)" style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}>
                    open · {fmtMinutes(w.minutes)}
                  </text>
                ) : (
                  b - a > 34 && (
                    <text x={(a + b) / 2} y={axisY + 54} textAnchor="middle" fontSize={8.5} fill="var(--accent)" className="mono" opacity={0.8}>
                      {fmtMinutes(w.minutes)}
                    </text>
                  )
                )}
              </g>
            );
          })}

          {/* events */}
          {placed.map((p) => {
            const a = x(p.s);
            const b = x(p.f);
            const top = axisY - 10 - (p.lane + 1) * 40;
            const past = p.f <= nowMin;
            const live = p.s <= nowMin && p.f > nowMin;
            const on = selected === p.e.id;
            return (
              <g
                key={p.e.id}
                role="button"
                tabIndex={0}
                aria-label={`${p.e.title}, ${hhmm(new Date(p.e.start))} to ${hhmm(new Date(p.e.end))}`}
                onClick={() => setSelected(on ? null : p.e.id)}
                onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && setSelected(on ? null : p.e.id)}
                data-cursor={on ? "Close" : "Inspect"}
                style={{ opacity: past ? 0.42 : 1, transition: "opacity .6s" }}
                className="outline-none"
              >
                <rect x={a} y={top} width={Math.max(2, b - a - 2)} height={34} fill="url(#band)" />
                <line x1={a} x2={Math.max(a + 2, b - 2)} y1={top} y2={top} stroke="var(--accent)" strokeWidth={on || live ? 2 : 1} />
                <line x1={a} x2={a} y1={top} y2={axisY} stroke="var(--accent)" strokeOpacity={0.35} />
                {(() => {
                  const room = x(p.room) - a - 12;
                  const chars = Math.floor(room / 6.6);
                  const title = p.e.title.length > chars ? p.e.title.slice(0, Math.max(1, chars - 1)) + "…" : p.e.title;
                  return room > 40 ? (
                    <>
                      <text x={a + 7} y={top + 15} fontSize={12.5} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                        {title}
                      </text>
                      <text x={a + 7} y={top + 28} fontSize={9} fill="var(--muted)" className="mono" letterSpacing="0.12em">
                        {hhmm(new Date(p.e.start))}
                        {room > 92 ? `–${hhmm(new Date(p.e.end))}` : ""}
                      </text>
                    </>
                  ) : (
                    <text x={a + 5} y={top + 15} fontSize={9} fill="var(--muted)" className="mono">
                      {hhmm(new Date(p.e.start))}
                    </text>
                  );
                })()}
                {live && <rect x={a} y={top - 1} width={Math.max(2, b - a - 2)} height={2} fill="var(--accent)" className="animate-pulse" />}
              </g>
            );
          })}

          {/* hover crosshair */}
          {hoverMin != null && hoverMin >= startH * 60 && hoverMin <= endH * 60 && (
            <g pointerEvents="none">
              <line x1={x(hoverMin)} x2={x(hoverMin)} y1={0} y2={axisY} stroke="var(--ink)" strokeOpacity={0.25} />
              <text x={x(hoverMin) + 6} y={10} fontSize={9.5} fill="var(--muted)" className="mono" letterSpacing="0.14em">
                {pad(Math.floor(hoverMin / 60) % 24)}:{pad(hoverMin % 60)}
              </text>
            </g>
          )}

          {/* now needle */}
          <g pointerEvents="none">
            <line x1={nx} x2={nx} y1={-6} y2={axisY + 4} stroke="var(--accent)" strokeWidth={1} />
            <path d={`M${nx - 4} ${axisY + 10} L${nx} ${axisY + 3} L${nx + 4} ${axisY + 10} Z`} fill="var(--accent)" />
            <text x={nx - 6} y={-12} textAnchor="end" fontSize={10} fill="var(--accent)" className="mono" letterSpacing="0.16em">
              NOW {hhmm(now)}
            </text>
          </g>
        </svg>
      </div>

      <AnimatePresence>
        {sel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-6 flex flex-wrap items-end justify-between gap-6 border-t border-[var(--line)] pt-5">
              <div>
                <div className="mono text-faint">
                  {ACTIVITIES.find((a) => a.key === sel.e.activity)?.label} {sel.e.location && `· ${sel.e.location}`}
                </div>
                <div className="display mt-2 text-[40px]">{sel.e.title}</div>
                <div className="mono mt-2 text-accent">
                  {hhmm(new Date(sel.e.start))} — {hhmm(new Date(sel.e.end))} · {fmtMinutes(sel.f - sel.s)}
                </div>
              </div>
              <button
                className="mono text-faint transition-colors hover:text-ink"
                onClick={() => {
                  removeEvent(sel.e.id);
                  pushLog(`Removed · ${sel.e.title} (Z to undo)`);
                  setSelected(null);
                }}
              >
                Remove from day
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
