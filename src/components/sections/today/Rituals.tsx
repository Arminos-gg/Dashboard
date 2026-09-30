"use client";

import { motion } from "motion/react";
import { useLife } from "@/lib/store";
import { habitStreak } from "@/lib/stats";
import { addDays, dateKey, weekday } from "@/lib/time";
import { audio } from "@/lib/audio";
import { burst } from "@/lib/sparks";
import { Glyph } from "@/components/ui/Glyph";
import type { Habit } from "@/lib/types";

const SIZE = 104;
const R = 44;
/** Open arc, clockwise from 12 o'clock — a stroke, not a wedge, so pathLength animates cleanly. */
function arc({ a0, a1 }: { a0: number; a1: number }, r = R) {
  const p = (a: number) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
  return `M${p(a0)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
}

function Orbit({ habit, now }: { habit: Habit; now: Date }) {
  const toggle = useLife((s) => s.toggleHabit);
  const days = Array.from({ length: 7 }, (_, i) => dateKey(addDays(now, i - 6)));
  const doneToday = !!habit.log[days[6]];
  const streak = habitStreak(habit, now);
  const gap = 0.12;
  const seg = (Math.PI * 2) / 7;

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const on = toggle(habit.id);
    const s = useLife.getState();
    if (on) {
      const r = e.currentTarget.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + SIZE / 2, 34, 1.1);
      if (s.sfx) audio.chime(880);
      s.pushLog(`Ritual · ${habit.name}`, "accent");
    } else if (s.sfx) audio.tick(0.8);
  };

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-3 text-center"
      aria-pressed={doneToday}
      aria-label={`${habit.name}: ${doneToday ? "done today" : "not yet today"}, ${streak}-day streak`}
      data-cursor={doneToday ? "Undo" : "Log"}
    >
      <svg width={SIZE} height={SIZE} viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`} className="overflow-visible">
        {days.map((d, i) => {
          const a0 = i * seg + gap / 2;
          const a1 = (i + 1) * seg - gap / 2;
          const done = !!habit.log[d];
          const isToday = i === 6;
          return (
            <g key={d}>
              <title>{`${weekday(new Date(`${d}T12:00`))}: ${done ? "done" : "missed"}`}</title>
              <path d={arc({ a0, a1 })} fill="none" stroke="var(--line-strong)" strokeWidth={1} />
              {isToday ? (
                <motion.path
                  d={arc({ a0, a1 })}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={3}
                  initial={false}
                  animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 90, damping: 16 }}
                />
              ) : (
                done && <path d={arc({ a0, a1 })} fill="none" stroke="var(--accent)" strokeOpacity={0.75} strokeWidth={2} />
              )}
            </g>
          );
        })}
        <circle r={R - 12} fill="none" stroke="var(--line)" className="transition-all duration-700 group-hover:stroke-[var(--accent)]" />
        <motion.circle
          r={R - 12}
          fill="var(--accent)"
          initial={false}
          animate={{ opacity: doneToday ? 0.14 : 0, scale: doneToday ? 1 : 0.6 }}
          transition={{ type: "spring", stiffness: 160, damping: 14 }}
        />
        <foreignObject x={-12} y={-12} width={24} height={24}>
          <div className={doneToday ? "text-accent" : "text-muted"}>
            <Glyph name={habit.glyph} size={24} />
          </div>
        </foreignObject>
      </svg>
      <span className="text-[13.5px] leading-tight text-ink">{habit.name}</span>
      <span className="mono -mt-2 text-faint">
        <span className={streak > 0 ? "text-accent" : ""}>{streak}</span>d streak
      </span>
    </button>
  );
}

export function Rituals({ now }: { now: Date }) {
  const habits = useLife((s) => s.habits);
  const done = habits.filter((h) => h.log[dateKey(now)]).length;
  return (
    <div>
      <div className="mono flex items-center justify-between text-muted">
        <span>Rituals</span>
        <span className="text-faint">
          <span className="text-ink">{done}</span>/{habits.length}
        </span>
      </div>
      {habits.length === 0 ? (
        <button
          onClick={() => useLife.getState().setUi({ plannerOpen: true })}
          className="display mt-8 block text-left text-[clamp(26px,2.6vw,40px)] text-faint transition-colors hover:text-muted"
        >
          No rituals yet — <em>add one in the Planner (E)</em>
        </button>
      ) : (
        <div className="mt-8 grid grid-cols-3 gap-x-4 gap-y-10 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-3">
          {habits.map((h) => (
            <Orbit key={h.id} habit={h} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
