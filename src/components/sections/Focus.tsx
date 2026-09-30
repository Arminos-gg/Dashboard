"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useLife } from "@/lib/store";
import { rankTasks } from "@/lib/agenda";
import { audio } from "@/lib/audio";
import { dateKey, fmtMinutes } from "@/lib/time";
import { useNow } from "@/components/ui/hooks";
import { SectionHead } from "@/components/ui/SectionHead";
import { Glyph } from "@/components/ui/Glyph";
import { Hideable } from "@/components/ui/Hideable";
import { usePref } from "@/lib/prefs";
import type { SoundKey } from "@/lib/types";

export const SOUNDSCAPES: { key: SoundKey; label: string; line: string }[] = [
  { key: "orbit", label: "Orbit", line: "Generative bells, slow delay" },
  { key: "rain", label: "Rain", line: "Rain on glass, low rumble" },
  { key: "drone", label: "Drone", line: "Detuned strings, breathing filter" },
  { key: "brown", label: "Brown", line: "Deep noise, pure isolation" },
];

const PRESETS = [25, 50, 90];

export function startFocusSession(minutes: number, taskId?: string) {
  const s = useLife.getState();
  const task = taskId ? s.tasks.find((t) => t.id === taskId) : rankTasks(s.tasks, new Date())[0];
  s.startFocus(minutes, task?.id, task?.title);
  s.pushLog(`Focus engaged · ${minutes} min`, "accent");
  audio.setVolume(s.volume);
  audio.play(s.soundscape);
}

export function FocusSection() {
  const now = useNow(60_000);
  const tasks = useLife((s) => s.tasks);
  const sessions = useLife((s) => s.sessions);
  const soundscape = useLife((s) => s.soundscape);
  const setSoundscape = useLife((s) => s.setSoundscape);
  const detail = usePref("detail");
  const candidates = useMemo(() => rankTasks(tasks, now).slice(0, 5), [tasks, now]);
  const [taskId, setTaskId] = useState<string | undefined>(undefined);
  const [hover, setHover] = useState<number | null>(null);
  const [preview, setPreview] = useState<SoundKey | null>(null);
  const chosen = taskId ?? candidates[0]?.id;
  const today = dateKey(now);
  const todays = sessions.filter((x) => dateKey(new Date(x.start)) === today);
  const minutes = todays.reduce((a, x) => a + x.minutes, 0);

  const togglePreview = (k: SoundKey) => {
    setSoundscape(k);
    if (preview === k) {
      audio.stop();
      setPreview(null);
    } else {
      audio.setVolume(useLife.getState().volume);
      audio.play(k);
      setPreview(k);
    }
  };

  return (
    <section id="focus" className="relative px-frame pb-[22vh] pt-[16vh]">
      <Hideable id="focus.head">
        <SectionHead
          index="04"
          title="Focus"
          italic="chamber"
          meta={`${todays.length} session${todays.length === 1 ? "" : "s"} today · ${fmtMinutes(minutes)} of depth`}
          echo="Depth"
        />
      </Hideable>

      <div className="mt-[9vh] grid gap-16 lg:grid-cols-12">
        <Hideable id="focus.durations" className="lg:col-span-7">
          <div className="mono text-muted">Choose a duration</div>
          <div className="mt-4 flex items-end gap-[3vw]" onPointerLeave={() => setHover(null)}>
            {PRESETS.map((p, i) => (
              <motion.button
                key={p}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => startFocusSession(p, chosen)}
                animate={{ opacity: hover == null || hover === i ? 1 : 0.28, scale: hover === i ? 1.04 : 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 20 }}
                className="group relative text-left"
                style={{ transformOrigin: "bottom left" }}
                data-cursor="Engage"
                aria-label={`Start a ${p}-minute focus session`}
              >
                <span className="display block text-[clamp(96px,14vw,240px)] leading-[0.8]">{p}</span>
                <span className="mono mt-3 block text-faint transition-colors group-hover:text-accent">minutes →</span>
              </motion.button>
            ))}
          </div>
          {detail && (
            <p className="mono mt-10 text-faint">
              Or press <span className="kbd">F</span> anywhere for 25 minutes on your top task.
            </p>
          )}
        </Hideable>

        <div className="space-y-14 lg:col-span-5">
          <Hideable id="focus.intention">
            <div className="mono text-muted">Intention</div>
            <ul className="mt-4" role="radiogroup" aria-label="Intention">
              {candidates.map((t) => {
                const on = t.id === chosen;
                return (
                  <li key={t.id}>
                    <button
                      role="radio"
                      aria-checked={on}
                      onClick={() => setTaskId(t.id)}
                      className="flex w-full items-center gap-4 border-b border-[var(--line)] py-3 text-left transition-colors"
                      style={{ color: on ? "var(--ink)" : "var(--muted)" }}
                    >
                      <Glyph name={on ? "diamond-fill" : "diamond"} size={12} className={on ? "text-accent" : ""} />
                      <span className="truncate text-[16px]">{t.title}</span>
                    </button>
                  </li>
                );
              })}
              {!candidates.length && <li className="text-faint">No open tasks — pure depth then.</li>}
            </ul>
          </Hideable>

          <Hideable id="focus.soundscape">
            <div className="mono flex justify-between text-muted">
              <span>Soundscape</span>
              {detail && <span className="text-faint">Synthesised live</span>}
            </div>
            <div className="mt-4 grid grid-cols-2 border-l border-t border-[var(--line)]">
              {SOUNDSCAPES.map((s) => {
                const on = soundscape === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => togglePreview(s.key)}
                    className="group flex flex-col gap-3 border-b border-r border-[var(--line)] p-4 text-left transition-colors hover:bg-[rgb(236_232_225/0.035)]"
                    aria-pressed={on}
                    data-cursor={preview === s.key ? "Stop" : "Preview"}
                  >
                    <span className="flex items-center justify-between">
                      <Glyph name={s.key} size={20} className={on ? "text-accent" : "text-muted"} />
                      {preview === s.key && <span className="mono text-accent">live</span>}
                    </span>
                    <span className="display text-[26px] leading-none">{s.label}</span>
                    {detail && <span className="text-[12.5px] text-faint">{s.line}</span>}
                  </button>
                );
              })}
            </div>
          </Hideable>
        </div>
      </div>
    </section>
  );
}
