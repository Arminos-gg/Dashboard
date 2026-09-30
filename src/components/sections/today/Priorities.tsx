"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLife } from "@/lib/store";
import { theThree } from "@/lib/agenda";
import { audio } from "@/lib/audio";
import { burst } from "@/lib/sparks";

const NUMERALS = ["I", "II", "III"];

/** The three things that make today a good day — editorial type, struck through by hand. */
export function Priorities({ now }: { now: Date }) {
  const tasks = useLife((s) => s.tasks);
  const three = useMemo(() => theThree(tasks, now), [tasks, now]);
  const [striking, setStriking] = useState<string | null>(null);

  const complete = (id: string, e: React.MouseEvent | React.KeyboardEvent) => {
    if (striking) return;
    const s = useLife.getState();
    setStriking(id);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = "clientX" in e && e.clientX ? e.clientX : r.left + 60;
    const cy = "clientY" in e && e.clientY ? e.clientY : r.top + r.height / 2;
    if (s.sfx) audio.tick(1.2);
    window.setTimeout(() => {
      burst(cx, cy, 30, 1.2);
      if (s.sfx) audio.chime(620);
      const t = s.tasks.find((x) => x.id === id);
      s.toggleTask(id);
      s.pushLog(`Done · ${t?.title ?? "task"}`, "accent");
      setStriking(null);
    }, 620);
  };

  return (
    <div>
      <div className="mono flex items-center justify-between text-muted">
        <span>The three</span>
        <span className="text-faint">What makes today a good day</span>
      </div>
      <ol className="mt-4">
        <AnimatePresence initial={false} mode="popLayout">
          {three.map((t, i) => (
            <motion.li
              key={t.id}
              layout
              initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 60, filter: "blur(10px)" }}
              transition={{ type: "spring", stiffness: 140, damping: 22 }}
              className="border-b border-[var(--line)]"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => complete(t.id, e)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && complete(t.id, e)}
                data-cursor="Complete"
                aria-label={`Complete: ${t.title}`}
                className="group relative grid grid-cols-[3.2em_1fr] items-baseline gap-4 py-5 md:grid-cols-[4.2em_1fr_auto]"
              >
                <span className="display text-[clamp(40px,4.4vw,72px)] italic text-accent transition-transform duration-700 [transition-timing-function:var(--ease-out)] group-hover:-translate-x-1">
                  {NUMERALS[i]}
                </span>
                <span className="relative">
                  <span className="display block text-[clamp(28px,3.2vw,52px)] leading-[1.02] transition-transform duration-700 [transition-timing-function:var(--ease-out)] group-hover:translate-x-2">
                    {t.title}
                  </span>
                  <motion.span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-[2px] w-full origin-left bg-[var(--accent)]"
                    initial={false}
                    animate={{ scaleX: striking === t.id ? 1 : 0 }}
                    transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }}
                  />
                </span>
                <span className="mono col-start-2 text-faint md:col-start-auto">
                  {t.dueTime ?? ""}
                </span>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {Array.from({ length: Math.max(0, 3 - three.length) }).map((_, i) => (
          <li key={`empty-${i}`} className="grid grid-cols-[3.2em_1fr] items-baseline gap-4 border-b border-[var(--line)] py-5 md:grid-cols-[4.2em_1fr]">
            <span className="display text-[clamp(40px,4.4vw,72px)] italic text-faint">{NUMERALS[three.length + i]}</span>
            <button
              onClick={() => useLife.getState().setUi({ captureOpen: true })}
              className="display text-left text-[clamp(28px,3.2vw,52px)] text-faint transition-colors hover:text-muted"
            >
              Unclaimed — <em>press K</em>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
