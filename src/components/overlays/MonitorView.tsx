"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLife } from "@/lib/store";
import { MOODS } from "@/lib/mood";
import { useMoodKey } from "@/lib/useMood";
import { currentEvent, directives, eventsOn, nextEvent, theThree } from "@/lib/agenda";
import { dateKey, fmtMinutes, hhmm, minutesOfDay, monthName, pad, weekday } from "@/lib/time";
import { weatherGlyph, weatherLabel } from "@/lib/weather";
import { habitStreak } from "@/lib/stats";
import { getPref, setPrefs, usePref } from "@/lib/prefs";
import { useFocusClock } from "@/lib/useFocusClock";
import { audio } from "@/lib/audio";
import { burst } from "@/lib/sparks";
import { useNow } from "@/components/ui/hooks";
import { Glyph } from "@/components/ui/Glyph";
import { LunchMonitor } from "@/components/sections/Lunch";
import { Hideable } from "@/components/ui/Hideable";
import { startFocusSession } from "@/components/sections/Focus";
import type { CalEvent } from "@/lib/types";

const NUMERALS = ["I", "II", "III"];

function Label({ children }: { children: ReactNode }) {
  return <div className="mono text-faint" style={{ fontSize: "clamp(10px, 0.62vw, 13px)" }}>{children}</div>;
}

// ── now / next ────────────────────────────────────────────────────────────

function NowNext({ now }: { now: Date }) {
  const events = useLife((s) => s.events);
  const current = currentEvent(events, now);
  const next = nextEvent(events, now);
  const later = eventsOn(events, dateKey(now))
    .filter((e) => new Date(e.start) > now && e.id !== next?.id)
    .slice(0, 3);

  const block = (label: string, e: CalEvent, detail: string, progress?: number) => (
    <div>
      <Label>{label}</Label>
      <div className="display mt-2 leading-[1.02]" style={{ fontSize: "clamp(28px, 2.9vw, 64px)" }}>
        {e.title}
      </div>
      <div className="mono mt-2 text-muted" style={{ fontSize: "clamp(10px, 0.7vw, 14px)" }}>
        {hhmm(new Date(e.start))}–{hhmm(new Date(e.end))}
        {e.location ? ` · ${e.location}` : ""} · <span className="text-accent">{detail}</span>
      </div>
      {progress != null && (
        <div className="mt-3 h-[2px] w-full bg-[var(--line)]">
          <div className="h-full bg-[var(--accent)]" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );

  const until = (d: Date) => fmtMinutes((d.getTime() - now.getTime()) / 60_000);

  return (
    <div className="space-y-[3.2vh]">
      {current ? (
        block(
          "Now",
          current,
          `${until(new Date(current.end))} left`,
          (now.getTime() - new Date(current.start).getTime()) / (new Date(current.end).getTime() - new Date(current.start).getTime()),
        )
      ) : (
        <div>
          <Label>Now</Label>
          <div className="display mt-2 italic text-accent" style={{ fontSize: "clamp(28px, 2.9vw, 64px)" }}>
            {next ? `Free until ${hhmm(new Date(next.start))}` : "Nothing scheduled"}
          </div>
          {next && (
            <div className="mono mt-2 text-muted" style={{ fontSize: "clamp(10px, 0.7vw, 14px)" }}>
              {until(new Date(next.start))} of open time
            </div>
          )}
        </div>
      )}
      {next && block("Next", next, `in ${until(new Date(next.start))}`)}
      {later.length > 0 && (
        <div>
          <Label>Later today</Label>
          <ul className="mt-2 space-y-1.5">
            {later.map((e) => (
              <li key={e.id} className="flex gap-4 text-muted" style={{ fontSize: "clamp(14px, 1vw, 22px)" }}>
                <span className="mono shrink-0 text-faint" style={{ fontSize: "0.8em" }}>
                  {hhmm(new Date(e.start))}
                </span>
                <span className="truncate text-ink">{e.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── focus ─────────────────────────────────────────────────────────────────

function FocusCard() {
  const { focus, done, progress, paused, mins, secs } = useFocusClock();
  const s = useLife.getState();
  if (done != null) {
    return (
      <div>
        <Label>Focus · complete</Label>
        <div className="display mt-3 leading-none" style={{ fontSize: "clamp(40px, 4.6vw, 110px)" }}>
          {done} minutes <em className="text-accent">of depth.</em>
        </div>
        <button
          onClick={() => {
            audio.stop();
            s.closeFocus();
          }}
          className="mono mt-6 border border-[var(--line-strong)] px-4 py-2.5 text-ink transition-colors hover:border-[var(--accent)]"
        >
          Close session
        </button>
      </div>
    );
  }
  return (
    <div>
      <Label>
        Focus · <span className="text-accent">{paused ? "holding" : "engaged"}</span>
      </Label>
      {focus.intention && (
        <div className="display mt-2 italic text-muted" style={{ fontSize: "clamp(20px, 1.7vw, 38px)" }}>
          {focus.intention}
        </div>
      )}
      <div className="display mt-2 leading-none tabular-nums" style={{ fontSize: "clamp(80px, 9vw, 220px)", opacity: paused ? 0.5 : 1 }}>
        {pad(mins)}
        <span className="italic text-accent">:</span>
        {pad(secs)}
      </div>
      <div className="mt-4 h-[2px] w-full bg-[var(--line)]">
        <div className="h-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="mono mt-5 flex flex-wrap gap-5 text-muted">
        <button onClick={() => (paused ? s.resumeFocus() : s.pauseFocus())} className="flex items-center gap-2 text-ink">
          <Glyph name={paused ? "play" : "pause"} size={14} /> {paused ? "Resume" : "Hold"} <span className="kbd">Space</span>
        </button>
        <button onClick={() => s.extendFocus(5)} className="hover:text-ink">
          +5 min
        </button>
        <button
          onClick={() => {
            s.endFocus(false);
            s.closeFocus();
            audio.stop();
          }}
          className="hover:text-ink"
        >
          End
        </button>
      </div>
    </div>
  );
}

// ── timeline ──────────────────────────────────────────────────────────────

function Timeline({ now }: { now: Date }) {
  const events = useLife((s) => s.events);
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const todays = eventsOn(events, dateKey(now));
  const startH = Math.max(0, Math.min(now.getHours() - 1, ...todays.map((e) => new Date(e.start).getHours())));
  const endH = 24;
  const H = 74;
  const axis = 50;
  const x = (min: number) => ((min - startH * 60) / ((endH - startH) * 60)) * W;
  const nowMin = minutesOfDay(now);

  // simple lane packing so overlapping events stay readable
  const lanesEnd: number[] = [];
  const placed = todays.map((e) => {
    const s0 = minutesOfDay(new Date(e.start));
    const f = Math.max(s0 + 15, minutesOfDay(new Date(e.end)) || 1440);
    let lane = lanesEnd.findIndex((end) => end <= s0);
    if (lane === -1) {
      lane = lanesEnd.length;
      lanesEnd.push(f);
    } else lanesEnd[lane] = f;
    return { e, s0, f, lane: Math.min(lane, 1) };
  });

  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H} className="block overflow-visible" role="img" aria-label="Today's remaining timeline">
        <rect x={0} y={0} width={Math.max(0, x(nowMin))} height={axis} fill="rgb(255 255 255 / 0.025)" />
        {Array.from({ length: endH - startH + 1 }).map((_, i) => {
          const h = startH + i;
          const X = x(h * 60);
          return (
            <g key={h}>
              <line x1={X} x2={X} y1={axis} y2={axis + (h % 3 === 0 ? 9 : 4)} stroke="var(--line-strong)" />
              {h % 3 === 0 && h < 24 && (
                <text x={X} y={H - 2} textAnchor="middle" className="mono" fontSize={11} fill="var(--faint)" letterSpacing="0.12em">
                  {pad(h)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={0} x2={W} y1={axis} y2={axis} stroke="var(--line-strong)" />
        {placed.map(({ e, s0, f, lane }) => {
          const a = x(s0);
          const b = x(f);
          const top = lane === 0 ? 26 : 2;
          const past = f <= nowMin;
          return (
            <g key={e.id} opacity={past ? 0.35 : 1}>
              <rect x={a} y={top} width={Math.max(2, b - a - 2)} height={20} fill="var(--accent)" fillOpacity={0.16} />
              <rect x={a} y={top} width={Math.max(2, b - a - 2)} height={2} fill="var(--accent)" />
              {b - a > 60 && (
                <text x={a + 6} y={top + 15} fontSize={12} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                  {e.title.length > (b - a) / 7.5 ? e.title.slice(0, Math.max(1, Math.floor((b - a) / 7.5) - 1)) + "…" : e.title}
                </text>
              )}
            </g>
          );
        })}
        <line x1={x(nowMin)} x2={x(nowMin)} y1={-4} y2={axis + 4} stroke="var(--accent)" strokeWidth={1.5} />
        <circle cx={x(nowMin)} cy={axis} r={3.5} fill="var(--accent)" />
      </svg>
    </div>
  );
}

// ── priorities, rituals, directive ────────────────────────────────────────

function Three({ now }: { now: Date }) {
  const tasks = useLife((s) => s.tasks);
  const three = useMemo(() => theThree(tasks, now), [tasks, now]);
  return (
    <div>
      <Label>The three</Label>
      {three.length === 0 ? (
        <div className="display mt-3 italic text-faint" style={{ fontSize: "clamp(22px, 1.8vw, 40px)" }}>
          Nothing pressing today.
        </div>
      ) : (
        <ol className="mt-2">
          <AnimatePresence initial={false}>
            {three.map((t, i) => (
              <motion.li key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b border-[var(--line)]">
                <button
                  onClick={(e) => {
                    const s = useLife.getState();
                    s.toggleTask(t.id);
                    burst(e.clientX, e.clientY, 24);
                    if (s.sfx) audio.chime(620);
                    s.pushLog(`Done · ${t.title}`, "accent");
                  }}
                  className="group grid w-full grid-cols-[2.4em_1fr_auto] items-baseline gap-3 py-[1.1vh] text-left"
                  style={{ fontSize: "clamp(18px, 1.55vw, 36px)" }}
                  aria-label={`Complete ${t.title}`}
                >
                  <span className="display italic text-accent">{NUMERALS[i]}</span>
                  <span className="display truncate leading-tight group-hover:text-accent">{t.title}</span>
                  <span className="mono text-faint" style={{ fontSize: "clamp(10px, 0.62vw, 13px)" }}>
                    {t.dueTime ?? ""}
                  </span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}

function Rituals({ now }: { now: Date }) {
  const habits = useLife((s) => s.habits);
  const today = dateKey(now);
  return (
    <div>
      <Label>
        Rituals · {habits.filter((h) => h.log[today]).length}/{habits.length}
      </Label>
      {habits.length === 0 ? (
        <div className="mt-3 text-faint">No habits yet.</div>
      ) : (
        <div className={`mt-3 grid gap-1.5 ${habits.length > 3 ? "grid-cols-2" : "grid-cols-1"}`}>
          {habits.slice(0, 8).map((h) => {
            const on = !!h.log[today];
            return (
              <button
                key={h.id}
                onClick={(e) => {
                  const s = useLife.getState();
                  if (s.toggleHabit(h.id)) {
                    burst(e.clientX, e.clientY, 20);
                    if (s.sfx) audio.chime(880);
                  }
                }}
                aria-pressed={on}
                className="flex items-center gap-3 border px-3 py-[0.8vh] text-left transition-colors"
                style={{
                  borderColor: on ? "var(--accent)" : "var(--line)",
                  background: on ? "color-mix(in oklab, var(--accent) 14%, transparent)" : "transparent",
                  fontSize: "clamp(13px, 0.95vw, 20px)",
                }}
              >
                <Glyph name={h.glyph} size={16} className={on ? "text-accent" : "text-muted"} />
                <span className="flex-1 truncate">{h.name}</span>
                <span className="mono text-faint" style={{ fontSize: "0.7em" }}>
                  {habitStreak(h, now)}d
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WhatNow({ now }: { now: Date }) {
  const tasks = useLife((s) => s.tasks);
  const events = useLife((s) => s.events);
  const habits = useLife((s) => s.habits);
  const weather = useLife((s) => s.weather);
  const briefing = useLife((s) => s.briefing);
  const minute = Math.floor(now.getTime() / 60_000);
  const list = useMemo(
    () => directives({ now: new Date(minute * 60_000), tasks, events, habits, weather }),
    [minute, tasks, events, habits, weather],
  );
  // an ambient display: cycle through the suggestions every 30 seconds
  const d = list.length ? list[Math.floor(now.getTime() / 30_000) % list.length] : null;
  return (
    <div>
      <Label>What now{d ? ` · ${d.kicker}` : ""}</Label>
      <AnimatePresence mode="wait">
        {d && (
          <motion.p
            key={d.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.8 }}
            className="display mt-2 leading-[1.08]"
            style={{ fontSize: "clamp(22px, 1.9vw, 44px)" }}
          >
            {d.lead} <em className="text-accent">{d.emph}</em>
            {d.tail}
          </motion.p>
        )}
      </AnimatePresence>
      {briefing && (
        <p className="mt-[2vh] text-muted" style={{ fontSize: "clamp(13px, 0.9vw, 19px)" }}>
          <span className="mono mr-2 text-faint" style={{ fontSize: "0.72em" }}>
            Briefing
          </span>
          {briefing.headline} {briefing.nextMove}
        </p>
      )}
    </div>
  );
}

// ── shell ─────────────────────────────────────────────────────────────────

function ToolButton({ children, onClick, active, label }: { children: ReactNode; onClick: () => void; active?: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className="mono flex items-center gap-2 border px-3 py-2 transition-colors hover:text-ink"
      style={{ borderColor: active ? "var(--accent)" : "var(--line-strong)", color: active ? "var(--accent)" : "var(--muted)" }}
    >
      {children}
    </button>
  );
}

export function MonitorView() {
  const now = useNow(1000);
  const setUi = useLife((s) => s.setUi);
  const name = useLife((s) => s.profileName);
  const weather = useLife((s) => s.weather);
  const location = useLife((s) => s.location);
  const focusActive = useLife((s) => s.focus.active);
  const mood = MOODS[useMoodKey().key];
  const dim = usePref("monitorDim");
  const seconds = usePref("monitorSeconds");
  const wake = usePref("monitorWake");
  const fieldOn = usePref("field");
  const particlesOn = usePref("particles");
  const ringsOn = usePref("rings");
  const effects = fieldOn || particlesOn || ringsOn;
  const [idle, setIdle] = useState(false);
  const editing = useLife((s) => s.editLayout);
  const [fullscreen, setFullscreen] = useState(false);
  const [wakeOk, setWakeOk] = useState(true);
  const idleTimer = useRef<number | undefined>(undefined);

  // toolbar and pointer fade out when the mouse rests
  useEffect(() => {
    const poke = () => {
      setIdle(false);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), 3000);
    };
    poke();
    window.addEventListener("pointermove", poke);
    window.addEventListener("keydown", poke);
    return () => {
      window.removeEventListener("pointermove", poke);
      window.removeEventListener("keydown", poke);
      window.clearTimeout(idleTimer.current);
    };
  }, []);

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // keep the screen awake while the monitor view is up (where the browser allows it)
  useEffect(() => {
    if (!wake) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
        if (cancelled) void lock?.release();
        setWakeOk(!!lock);
      } catch {
        setWakeOk(false);
      }
    };
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [wake]);

  // burn-in care: the whole layout drifts a few pixels once a minute
  const minute = Math.floor(now.getTime() / 60_000);
  const shift = { x: ((minute * 7) % 9) - 4, y: ((minute * 5) % 7) - 3 };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };
  const toggleEffects = () => {
    const on = !effects;
    setPrefs({ field: on, particles: on, rings: on });
  };

  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const dayPct = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;

  return (
    <div className="fixed inset-0 z-30 overflow-hidden" style={{ cursor: idle && !editing ? "none" : "auto" }}>
      <div
        className="relative flex h-full flex-col px-[4vw] py-[4.5vh] transition-transform duration-[3000ms]"
        style={{ transform: `translate(${shift.x}px, ${shift.y}px)` }}
      >
        {/* header */}
        <Hideable id="monitor.header">
        <div className="mono flex items-center justify-between text-faint">
          <span>
            <span className="text-ink">
              Life<span className="text-accent">/</span>OS
            </span>{" "}
            · Monitor
          </span>
          <span className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
            <span className="text-accent">{mood.label}</span>
            <span className="hidden md:inline">{mood.line}</span>
          </span>
        </div>
        </Hideable>

        {/* main */}
        <div className="mt-[4vh] grid flex-1 grid-cols-1 gap-[4vh] lg:grid-cols-12 lg:gap-[3vw]">
          <div className="lg:col-span-7">
            <Hideable id="monitor.date" className="w-fit">
            <div className="display italic text-muted" style={{ fontSize: "clamp(22px, 1.9vw, 46px)" }}>
              {weekday(now)}, {now.getDate()} {monthName(now)}
              {name ? ` — ${name}` : ""}
            </div>
            </Hideable>
            <Hideable id="monitor.clock" className="w-fit">
            <div className="display flex items-start leading-[0.85] tracking-[-0.04em]" style={{ fontSize: "clamp(120px, 15.5vw, 420px)" }}>
              <span>{hh}</span>
              <span className="italic text-accent" style={{ animation: "pulse-colon 2s ease-in-out infinite" }}>
                :
              </span>
              <span>{mm}</span>
              {seconds && (
                <span className="mono ml-4 mt-[0.4em] text-faint" style={{ fontSize: "clamp(14px, 1.2vw, 28px)", letterSpacing: "0.1em" }}>
                  {pad(now.getSeconds())}
                </span>
              )}
            </div>
            <div className="mt-[2vh] h-px w-full max-w-[46vw] bg-[var(--line)]">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${dayPct}%` }} />
            </div>
            </Hideable>
            <Hideable id="monitor.weather" className="w-fit">
            {weather ? (
              <div className="mt-[3vh] flex flex-wrap items-center gap-x-[2vw] gap-y-2">
                <Glyph name={weatherGlyph(weather.code, weather.isDay)} size={34} className="text-accent" />
                <span className="figure" style={{ fontSize: "clamp(40px, 3.6vw, 90px)" }}>
                  {Math.round(weather.temp)}°
                </span>
                <span className="display italic" style={{ fontSize: "clamp(20px, 1.6vw, 38px)" }}>
                  {weatherLabel(weather.code)}
                </span>
                <span className="mono text-faint" style={{ fontSize: "clamp(10px, 0.7vw, 14px)" }}>
                  H {Math.round(weather.hi)}° · L {Math.round(weather.lo)}° · Rain {weather.precipProb}%{location ? ` · ${location.label}` : ""}
                </span>
              </div>
            ) : (
              <div className="mono mt-[3vh] text-faint">{location?.label ?? ""} · weather unavailable</div>
            )}
            </Hideable>
            <Hideable id="monitor.lunch">
              <LunchMonitor />
            </Hideable>
          </div>

          <Hideable id={focusActive ? "monitor.focus" : "monitor.agenda"} className="lg:col-span-5 lg:border-l lg:border-[var(--line)] lg:pl-[3vw]">
            {focusActive ? <FocusCard /> : <NowNext now={now} />}
          </Hideable>
        </div>

        {/* bottom */}
        <div className="mt-[3vh]">
          <Hideable id="monitor.timeline">
            <Timeline now={now} />
          </Hideable>
          <div className="mt-[3.5vh] grid grid-cols-1 gap-[3vh] md:grid-cols-12 md:gap-[3vw]">
            <Hideable id="monitor.three" className="md:col-span-4">
              <Three now={now} />
            </Hideable>
            <Hideable id="monitor.rituals" className="md:col-span-4">
              <Rituals now={now} />
            </Hideable>
            <Hideable id="monitor.whatnow" className="md:col-span-4">
              <WhatNow now={now} />
            </Hideable>
          </div>
        </div>
      </div>

      {/* dimmer sits over the content, under the toolbar */}
      <div
        className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-700"
        style={{ opacity: dim === 2 ? 0.62 : dim === 1 ? 0.35 : 0 }}
      />

      {/* toolbar */}
      <div
        className="absolute inset-x-0 bottom-0 flex justify-center pb-5 transition-opacity duration-500"
        style={{ opacity: idle || editing ? 0 : 1, pointerEvents: idle || editing ? "none" : "auto" }}
      >
        <div className="flex flex-wrap items-center justify-center gap-2 border border-[var(--line)] bg-[rgb(7_7_9/0.92)] p-2 backdrop-blur-xl">
          <ToolButton label="Brightness" onClick={() => setPrefs({ monitorDim: ((dim + 1) % 3) as 0 | 1 | 2 })} active={dim > 0}>
            {dim === 0 ? "Bright" : dim === 1 ? "Dim" : "Night"}
          </ToolButton>
          <ToolButton label="Show seconds" onClick={() => setPrefs({ monitorSeconds: !seconds })} active={seconds}>
            Seconds
          </ToolButton>
          <ToolButton label="Background effects" onClick={toggleEffects} active={effects}>
            Effects
          </ToolButton>
          <ToolButton label="Keep screen awake" onClick={() => setPrefs({ monitorWake: !getPref("monitorWake") })} active={wake}>
            {wake && !wakeOk ? "Awake (unsupported)" : "Keep awake"}
          </ToolButton>
          <ToolButton label="Fullscreen" onClick={toggleFullscreen} active={fullscreen}>
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </ToolButton>
          {!focusActive && (
            <ToolButton label="Start a 25 minute focus session" onClick={() => startFocusSession(25)}>
              <Glyph name="focus" size={13} /> Focus 25
            </ToolButton>
          )}
          <ToolButton label="Capture" onClick={() => setUi({ captureOpen: true })}>
            <span className="kbd">K</span> Capture
          </ToolButton>
          <ToolButton label="Planner" onClick={() => setUi({ plannerOpen: true })}>
            <span className="kbd">E</span> Planner
          </ToolButton>
          <ToolButton label="Edit layout — click parts to hide them" onClick={() => setUi({ editLayout: true })}>
            <span className="kbd">L</span> Layout
          </ToolButton>
          <ToolButton label="Leave monitor mode" onClick={() => setUi({ monitor: false })}>
            <span className="kbd">Esc</span> Exit
          </ToolButton>
        </div>
      </div>
    </div>
  );
}
