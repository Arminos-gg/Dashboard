"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLife } from "@/lib/store";
import { useMoodKey } from "@/lib/useMood";
import { MOOD_ORDER, MOODS } from "@/lib/mood";
import { dayOfYear, pad, tzAbbr } from "@/lib/time";
import { scrollToId } from "@/lib/scroll";
import { scrollState } from "@/lib/pointer";
import { cloudConfigured } from "@/lib/sync";
import { useNow } from "@/components/ui/hooks";
import { usePref, useVisibleSections } from "@/lib/prefs";
import { LunchChip } from "@/components/sections/Lunch";
import { Hideable } from "@/components/ui/Hideable";
import { Glyph } from "@/components/ui/Glyph";

export function cycleMood() {
  const s = useLife.getState();
  const cycle: (typeof MOOD_ORDER[number] | null)[] = [null, "drift", "flow", "surge", "nocturne"];
  const i = cycle.indexOf(s.moodOverride);
  const next = cycle[(i + 1) % cycle.length];
  s.setMoodOverride(next);
  s.pushLog(next ? `Mood pinned · ${MOODS[next].label}` : "Mood engine · auto");
}

function useActiveSection(ids: string) {
  const [active, setActive] = useState<string>("now");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const id of ids.split(",")) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

export function Chrome() {
  const now = useNow(1000);
  const mood = useMoodKey();
  const m = MOODS[mood.key];
  const ai = useLife((s) => s.ai);
  const sync = useLife((s) => s.syncStatus);
  const log = useLife((s) => s.log);
  const setUi = useLife((s) => s.setUi);
  const sections = useVisibleSections();
  const active = useActiveSection(sections.map((s) => s.id).join(","));
  const showRails = usePref("rails");
  const showLog = usePref("log");
  const detail = usePref("detail");
  const rail = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (rail.current) rail.current.style.transform = `scaleY(${Math.max(0.002, scrollState.progress)})`;
      if (readout.current) readout.current.textContent = String(Math.round(scrollState.progress * 100)).padStart(3, "0");
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // log lines expire on the clock's own one-second cadence
  const recent = showLog ? log.filter((l) => now.getTime() - l.at < 7000).slice(-3) : [];

  return (
    <div className="pointer-events-none fixed inset-0 z-40 select-none" data-intro="chrome">
      {/* edge fades keep HUD text legible over scrolling content */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[rgb(5_5_6/0.96)] via-[rgb(5_5_6/0.7)] to-transparent md:h-32" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[rgb(5_5_6/0.95)] via-[rgb(5_5_6/0.6)] to-transparent md:h-36" />

      {/* corner brackets */}
      <div className="brackets absolute inset-3 opacity-70 md:inset-4" />

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between px-[var(--gutter)] pt-6 md:pt-7">
        <Hideable id="hud.brand">
          <div className="mono flex items-center gap-5">
            <button
              className="pointer-events-auto text-ink"
              onClick={() => scrollToId("now")}
              aria-label="Back to top"
              data-cursor="Top"
            >
              Life<span className="text-accent">/</span>OS
            </button>
            {detail && (
              <span className="hidden text-faint sm:inline">
                Nº {pad(dayOfYear(now))} — {now.getFullYear()}
              </span>
            )}
          </div>
          <button
            onClick={cycleMood}
            className="mono pointer-events-auto mt-2.5 flex items-center gap-3 text-left"
            data-cursor="Shift mood"
            aria-label={`Mood ${m.label}${mood.overridden ? " (pinned)" : " (auto)"} — press M to cycle`}
          >
            <span className="relative grid h-2.5 w-2.5 place-items-center">
              <span className="absolute inset-0 animate-ping bg-[var(--accent)] opacity-30" style={{ animationDuration: `${3.2 - m.energy * 2.2}s` }} />
              <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
            </span>
            <span className="text-faint">Mood</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={m.key}
                initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                transition={{ duration: 0.5 }}
                className="text-accent"
              >
                {m.label}
              </motion.span>
            </AnimatePresence>
            {mood.overridden && <span className="hidden text-faint sm:inline">· pinned</span>}
            {detail && (
              <span className="hidden normal-case tracking-normal text-muted lg:inline" style={{ fontFamily: "var(--font-display)", fontSize: 14, fontStyle: "italic" }}>
                {m.line}
              </span>
            )}
          </button>
        </Hideable>

        <Hideable id="hud.shortcuts">
        <div className="hidden items-center gap-8 md:flex">
          <button
            onClick={() => setUi({ captureOpen: true })}
            className="mono pointer-events-auto flex items-center gap-3 text-muted transition-colors hover:text-ink"
            data-cursor="Capture"
          >
            <span className="kbd">K</span>
            <span>Capture</span>
          </button>
          <button
            onClick={() => setUi({ plannerOpen: true })}
            className="mono pointer-events-auto flex items-center gap-3 text-muted transition-colors hover:text-ink"
            data-cursor="Planner"
          >
            <span className="kbd">E</span>
            <span>Planner</span>
          </button>
          <button
            onClick={() => setUi({ monitor: true })}
            className="mono pointer-events-auto flex items-center gap-3 text-muted transition-colors hover:text-ink"
            data-cursor="Monitor"
          >
            <span className="kbd">G</span>
            <span>Monitor</span>
          </button>
        </div>
        </Hideable>

        <Hideable id="hud.status">
        <div className="mono flex items-center gap-5 text-right">
          <Hideable id="hud.lunch" className="hidden sm:block">
            <LunchChip />
          </Hideable>
          {detail && (
          <span className="hidden items-center gap-2 lg:flex" title={ai?.model ?? "Local interpreter"}>
            <span
              className="inline-block h-1.5 w-1.5"
              style={{ background: ai?.online ? "var(--accent)" : "transparent", border: "1px solid var(--line-strong)" }}
            />
            <span className="text-faint">{ai?.online ? "Claude" : "Local AI"}</span>
          </span>
          )}
          {detail && cloudConfigured && (
            <span className="hidden items-center gap-2 lg:flex">
              <span
                className="inline-block h-1.5 w-1.5"
                style={{
                  background: sync === "cloud" ? "var(--accent)" : "transparent",
                  border: "1px solid var(--line-strong)",
                }}
              />
              <span className="text-faint">{sync === "cloud" ? "Synced" : sync === "connecting" ? "Linking" : "Offline"}</span>
            </span>
          )}
          <span className="text-ink">
            {pad(now.getHours())}:{pad(now.getMinutes())}
            {detail && <span className="text-faint">:{pad(now.getSeconds())}</span>}
          </span>
          {detail && <span className="hidden text-faint sm:inline">{tzAbbr(now)}</span>}
        </div>
        </Hideable>
      </div>

      {/* left rail: scroll telemetry */}
      {showRails && (
      <div className="absolute left-[calc(var(--gutter)*0.5)] top-1/2 hidden -translate-y-1/2 flex-col items-center gap-4 lg:flex">
        <div className="relative h-[34vh] w-px bg-[var(--line)]">
          <div ref={rail} className="absolute inset-x-0 top-0 h-full origin-top bg-[var(--accent)]" />
          {Array.from({ length: 11 }).map((_, i) => (
            <span key={i} className="absolute -left-1 h-px w-2 bg-[var(--line-strong)]" style={{ top: `${i * 10}%` }} />
          ))}
        </div>
        <span className="mono text-faint [writing-mode:vertical-rl]">
          Depth <span ref={readout}>000</span>
        </span>
      </div>
      )}

      {/* right rail: section index */}
      {showRails && (
      <nav
        className="pointer-events-auto absolute right-[var(--gutter)] top-1/2 hidden -translate-y-1/2 flex-col items-end gap-3 md:flex"
        aria-label="Sections"
      >
        {sections.map((s, i) => {
          const on = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => scrollToId(s.id)}
              className="mono group flex items-center gap-3"
              aria-current={on ? "true" : undefined}
              data-cursor={s.label}
            >
              <span
                className="transition-all duration-500"
                style={{ opacity: on ? 1 : 0, transform: `translateX(${on ? 0 : 8}px)`, color: "var(--ink)" }}
              >
                {s.label}
              </span>
              <span
                className="block h-px transition-all duration-500"
                style={{ width: on ? 36 : 14, background: on ? "var(--accent)" : "var(--line-strong)" }}
              />
              <span style={{ color: on ? "var(--accent)" : "var(--faint)" }}>0{i + 1}</span>
            </button>
          );
        })}
      </nav>
      )}

      {/* bottom-right: telemetry log + shortcuts */}
      <div className="absolute bottom-6 right-[var(--gutter)] flex flex-col items-end gap-2 md:bottom-7">
        <div className="flex flex-col items-end gap-1" aria-live="polite">
          <AnimatePresence initial={false}>
            {recent.map((l) => (
              <motion.div
                key={l.id}
                layout
                initial={{ opacity: 0, x: 16, filter: "blur(6px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.45 }}
                className="mono text-right"
                style={{ color: l.tone === "accent" ? "var(--accent)" : "var(--muted)" }}
              >
                <span className="text-faint">
                  {new Date(l.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                </span>{" "}
                — {l.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setUi({ captureOpen: true })}
            className="mono pointer-events-auto flex items-center gap-2 text-muted md:hidden"
            aria-label="Capture"
          >
            <Glyph name="capture" size={16} /> Capture
          </button>
          <button
            onClick={() => setUi({ plannerOpen: true })}
            className="mono pointer-events-auto flex items-center gap-2 text-muted md:hidden"
          >
            Planner
          </button>
          <button
            onClick={() => setUi({ labOpen: !useLife.getState().labOpen })}
            className="mono pointer-events-auto flex items-center gap-2 text-faint transition-colors hover:text-ink"
            data-cursor="Lab"
          >
            <span className="kbd">T</span>
            <span className="hidden sm:inline">Lab</span>
          </button>
          <button
            onClick={() => setUi({ shortcutsOpen: true })}
            className="mono pointer-events-auto flex items-center gap-2 text-faint transition-colors hover:text-ink"
            data-cursor="Controls"
          >
            <span className="kbd">?</span>
            <span className="hidden sm:inline">Controls</span>
          </button>
        </div>
      </div>
    </div>
  );
}
