"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLife } from "@/lib/store";
import { DEFAULT_LUNCH, LUNCH_DAYS, getLunch, fmtCountdown, lunchQuip, lunchState, setLunch, todaysMenu, useLunch, type LunchState } from "@/lib/lunch";
import { dateKey, hhmm } from "@/lib/time";
import { audio } from "@/lib/audio";
import { burst } from "@/lib/sparks";
import { calmMotion } from "@/lib/prefs";
import { useNow } from "@/components/ui/hooks";
import { TimeField } from "@/components/ui/TimeField";
import { SelectField } from "@/components/ui/SelectField";

const DURATIONS = [15, 20, 30, 45, 60, 75, 90].map((m) => ({ value: m, label: `${m} min` }));

function kicker(st: LunchState, name: string) {
  switch (st.phase) {
    case "eating":
      return `${name} · refuelling`;
    case "final":
      return `${name} · final countdown`;
    case "approach":
      return `${name} · final approach`;
    case "later":
      return `${name} · next launch`;
    default:
      return `${name} · T-minus`;
  }
}

/** The fuel gauge: 24 cells that fill as lunch nears, and drain while you eat. */
function Gauge({ st }: { st: LunchState }) {
  const cells = 24;
  const eating = st.phase === "eating";
  const lit = Math.round((eating ? 1 - st.progress : st.progress) * cells);
  return (
    <div className="flex gap-[3px]" aria-hidden>
      {Array.from({ length: cells }, (_, i) => {
        const on = i < lit;
        const hot = !eating && on && i >= cells * 0.75;
        return (
          <span
            key={i}
            className="h-[10px] flex-1 transition-colors duration-700"
            style={{
              background: on ? "var(--accent)" : "var(--line)",
              opacity: on ? (hot ? 1 : 0.35 + (i / cells) * 0.55) : 1,
              boxShadow: hot && st.phase !== "waiting" ? "0 0 8px var(--accent)" : undefined,
              animation: hot && st.phase === "final" ? "pulse-colon 0.8s ease-in-out infinite" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="mono flex items-center gap-2 text-[11px] transition-colors"
      style={{ color: on ? "var(--ink)" : "var(--faint)" }}
    >
      <span className="grid h-3.5 w-3.5 place-items-center border" style={{ borderColor: on ? "var(--accent)" : "var(--line-strong)" }}>
        {on && <span className="h-1.5 w-1.5 bg-[var(--accent)]" />}
      </span>
      {children}
    </button>
  );
}

export function LunchSettings() {
  const cfg = useLunch();
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="mono mb-1.5 block text-[10px] text-faint">Starts at</span>
          <TimeField value={cfg.time} onChange={(time) => setLunch({ time })} required ariaLabel="Lunch time" className="h-9 w-full" />
        </label>
        <label>
          <span className="mono mb-1.5 block text-[10px] text-faint">Lasts</span>
          <SelectField value={cfg.minutes} onChange={(minutes) => setLunch({ minutes })} options={DURATIONS} ariaLabel="Lunch duration" className="h-9 w-full" />
        </label>
      </div>
      <div>
        <span className="mono mb-1.5 block text-[10px] text-faint">On these days</span>
        <div className="flex gap-1.5">
          {LUNCH_DAYS.map(({ d, l }) => {
            const on = cfg.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]}
                onClick={() => setLunch({ days: on ? cfg.days.filter((x) => x !== d) : [...cfg.days, d] })}
                className="mono grid h-8 w-8 place-items-center border text-[11px] transition-colors"
                style={{
                  borderColor: on ? "var(--accent)" : "var(--line-strong)",
                  background: on ? "color-mix(in oklab, var(--accent) 16%, transparent)" : "transparent",
                  color: on ? "var(--ink)" : "var(--faint)",
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>
      <label>
        <span className="mono mb-1.5 block text-[10px] text-faint">Call it</span>
        <input
          value={cfg.name}
          onChange={(e) => setLunch({ name: e.target.value.slice(0, 24) })}
          onBlur={(e) => !e.target.value.trim() && setLunch({ name: DEFAULT_LUNCH.name })}
          placeholder="Lunch"
          className="field h-9 w-full"
        />
      </label>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Toggle on={cfg.sound} onClick={() => setLunch({ sound: !cfg.sound })}>Launch sounds</Toggle>
        <Toggle on={cfg.tabTitle} onClick={() => setLunch({ tabTitle: !cfg.tabTitle })}>Countdown in tab title</Toggle>
        <Toggle on={cfg.hud} onClick={() => setLunch({ hud: !cfg.hud })}>Top-bar timer</Toggle>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("lifeos:lunch-liftoff"))}
          className="mono border border-[var(--line-strong)] px-3 py-2 text-[11px] text-ink transition-colors hover:border-[var(--accent)]"
        >
          Test liftoff
        </button>
        <button
          type="button"
          onClick={() => setLunch({ enabled: !cfg.enabled })}
          className="mono px-3 py-2 text-[11px] text-faint transition-colors hover:text-ink"
        >
          {cfg.enabled ? "Turn countdown off" : "Turn countdown on"}
        </button>
      </div>
    </div>
  );
}

/** The card in the Now section. */
export function LunchCard() {
  const now = useNow(1000);
  const cfg = useLunch();
  const st = lunchState(now, cfg);
  const [editing, setEditing] = useState(false);
  const [menuDraft, setMenuDraft] = useState<string | null>(null);
  const menu = todaysMenu(cfg, now);
  const name = cfg.name || "Lunch";
  const live = st.phase !== "off";

  return (
    <div className="border border-[var(--line)] p-5 backdrop-blur-sm" style={{ background: "rgb(8 8 10 / 0.35)" }}>
      <div className="mono flex items-center justify-between gap-4 text-muted">
        <span className={st.phase === "approach" || st.phase === "final" || st.phase === "eating" ? "text-accent" : ""}>{kicker(st, name)}</span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="flex items-center gap-2 text-faint transition-colors hover:text-ink"
        >
          {editing ? "Done" : "Set"}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
          </svg>
        </button>
      </div>

      {live && (
        <>
          <div className="mt-3 flex items-baseline gap-3">
            <span
              className="figure tabular-nums leading-none"
              style={{ fontSize: st.phase === "final" ? "clamp(56px,6vw,88px)" : "clamp(40px,4vw,64px)", color: st.phase === "final" ? "var(--accent)" : undefined }}
              aria-live={st.phase === "final" ? "polite" : "off"}
            >
              {st.phase === "eating" ? hhmm(st.end) : fmtCountdown(st.msLeft, st.msLeft >= 3600_000)}
            </span>
            <span className="mono text-faint">{st.phase === "eating" ? "back on duty" : st.today ? `at ${cfg.time}` : st.start.toLocaleDateString("en-GB", { weekday: "short" })}</span>
          </div>
          <div className="mt-4">
            <Gauge st={st} />
            <div className="mono mt-2 flex justify-between text-[10px] text-faint">
              <span>{st.phase === "eating" ? "Plate" : "Hunger"}</span>
              <span>{Math.round((st.phase === "eating" ? 1 - st.progress : st.progress) * 100)}%</span>
            </div>
          </div>
        </>
      )}

      <AnimatePresence mode="wait">
        <motion.p
          key={lunchQuip(st, cfg, now)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4 }}
          className="display mt-4 text-[19px] italic leading-snug text-muted"
        >
          {lunchQuip(st, cfg, now)}
        </motion.p>
      </AnimatePresence>

      {live && st.today && (
        <div className="mono mt-4 flex items-center gap-3 border-t border-[var(--line)] pt-3 text-[11px]">
          <span className="shrink-0 text-faint">Payload</span>
          <input
            value={menuDraft ?? menu}
            onChange={(e) => setMenuDraft(e.target.value.slice(0, 48))}
            onBlur={() => {
              if (menuDraft != null) setLunch({ menu: menuDraft.trim(), menuDate: dateKey(now) });
              setMenuDraft(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="what's for lunch?"
            aria-label="What's for lunch today"
            className="min-w-0 flex-1 bg-transparent normal-case tracking-normal text-ink outline-none placeholder:text-faint focus-visible:outline-none"
            style={{ fontFamily: "var(--font-sans, inherit)", fontSize: 14 }}
          />
        </div>
      )}

      <AnimatePresence initial={false} mode="popLayout">
        {editing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <LunchSettings />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Compact chip for the top bar. */
export function LunchChip() {
  const now = useNow(1000);
  const cfg = useLunch();
  const st = lunchState(now, cfg);
  if (!cfg.hud || !st.today || (st.phase !== "waiting" && st.phase !== "approach" && st.phase !== "final" && st.phase !== "eating")) return null;
  const hot = st.phase !== "waiting";
  return (
    <span className="flex items-center gap-2" title={lunchQuip(st, cfg, now)}>
      <span className="h-1.5 w-1.5" style={{ background: hot ? "var(--accent)" : "var(--line-strong)", animation: hot ? "pulse-colon 1.2s ease-in-out infinite" : undefined }} />
      <span className={hot ? "text-accent" : "text-faint"}>
        {(cfg.name || "Lunch").slice(0, 10)} {st.phase === "eating" ? "· now" : `−${fmtCountdown(st.msLeft)}`}
      </span>
    </span>
  );
}

/** Big, glanceable version for monitor mode. */
export function LunchMonitor() {
  const now = useNow(1000);
  const cfg = useLunch();
  const st = lunchState(now, cfg);
  if (st.phase === "off") return null;
  const name = cfg.name || "Lunch";
  const menu = todaysMenu(cfg, now);
  return (
    <div className="mt-[3vh] max-w-[46vw]">
      <div className="mono flex items-center gap-3 text-muted" style={{ fontSize: "clamp(10px, 0.7vw, 14px)" }}>
        <span className={st.phase !== "waiting" && st.phase !== "later" ? "text-accent" : ""}>{kicker(st, name)}</span>
        {menu && <span className="text-faint">· {menu}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-[1.2vw]">
        <span className="figure tabular-nums leading-none" style={{ fontSize: "clamp(40px, 3.6vw, 96px)", color: st.phase === "final" ? "var(--accent)" : undefined }}>
          {st.phase === "eating" ? hhmm(st.end) : fmtCountdown(st.msLeft, st.msLeft >= 3600_000)}
        </span>
        <span className="display italic text-muted" style={{ fontSize: "clamp(16px, 1.3vw, 30px)" }}>
          {lunchQuip(st, cfg, now)}
        </span>
      </div>
      <div className="mt-[1.5vh] max-w-[30vw]">
        <Gauge st={st} />
      </div>
    </div>
  );
}

function liftoffSound() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => window.setTimeout(() => audio.chime(f), i * 150));
}

function liftoffSparks() {
  if (calmMotion()) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < 9; i++) {
    window.setTimeout(() => burst(w * (0.15 + Math.random() * 0.7), h * (0.25 + Math.random() * 0.5), 36, 1.6 + Math.random()), i * 170);
  }
}

/**
 * Always mounted: ticks through the last ten seconds, launches at T-0, and keeps
 * the tab title counting down so it's visible from any other tab.
 */
export function LunchWatcher() {
  const now = useNow(1000);
  const cfg = useLunch();
  const monitor = useLife((s) => s.monitor);
  const sfx = useLife((s) => s.sfx);
  const st = lunchState(now, cfg);
  const prev = useRef(st.phase);
  const [show, setShow] = useState<{ name: string; back: string; menu: string } | null>(null);
  const sound = sfx && cfg.sound;

  const launch = useCallback(() => {
    const c = getLunch();
    const s = lunchState(new Date(), c);
    const back = s.phase === "eating" ? hhmm(s.end) : hhmm(new Date(Date.now() + c.minutes * 60_000));
    setShow({ name: c.name || "Lunch", back, menu: todaysMenu(c) });
    if (useLife.getState().sfx && c.sound) liftoffSound();
    liftoffSparks();
    useLife.getState().pushLog(`${c.name || "Lunch"} · liftoff. Back at ${back}.`, "accent");
  }, []);

  useEffect(() => {
    window.addEventListener("lifeos:lunch-liftoff", launch);
    return () => window.removeEventListener("lifeos:lunch-liftoff", launch);
  }, [launch]);

  // last ten seconds tick, then launch on the crossing into lunch
  const secs = Math.ceil(st.msLeft / 1000);
  useEffect(() => {
    if (st.phase === "final" && secs <= 10 && sound) audio.tick(1 + (10 - secs) * 0.06);
    if (prev.current !== "eating" && st.phase === "eating" && now.getTime() - st.start.getTime() < 5000) launch();
    prev.current = st.phase;
  }, [secs, st.phase, st.start, now, sound, launch]);

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => setShow(null), 7000);
    return () => window.clearTimeout(t);
  }, [show]);

  // tab title: counts down during the last hour, says so while eating
  const base = monitor ? "Life/OS — Monitor" : "Life OS — Personal Command Center";
  const name = cfg.name || "Lunch";
  const title =
    !cfg.tabTitle || !st.today
      ? base
      : st.phase === "eating"
        ? `${name} · back at ${hhmm(st.end)}`
        : st.msLeft <= 3600_000 && st.phase !== "off"
          ? `${fmtCountdown(st.msLeft)} · ${name}`
          : base;
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="liftoff"
          role="status"
          className="fixed inset-0 z-[72] grid cursor-pointer place-items-center bg-[rgb(3_3_4/0.55)] backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          onClick={() => setShow(null)}
        >
          <div className="px-[var(--gutter)] text-center">
            <motion.div
              className="mono text-accent"
              initial={{ opacity: 0, letterSpacing: "0.6em" }}
              animate={{ opacity: 1, letterSpacing: "0.24em" }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            >
              T-00:00 · Liftoff
            </motion.div>
            <motion.h2
              className="display mt-6 text-[clamp(64px,11vw,200px)] leading-[0.9]"
              initial={{ y: 80, opacity: 0, filter: "blur(16px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              {show.name} <em className="text-accent">is served.</em>
            </motion.h2>
            <motion.p
              className="mono mt-8 text-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {show.menu ? `Payload: ${show.menu} · ` : ""}Go eat. Back on duty at {show.back}.
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
