"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLife } from "@/lib/store";
import { MOOD_ORDER, MOODS } from "@/lib/mood";
import { useMoodKey } from "@/lib/useMood";
import { parseLocal } from "@/lib/parse-local";
import { audio } from "@/lib/audio";
import { burst } from "@/lib/sparks";
import { scrollToId } from "@/lib/scroll";
import { requestBriefing } from "@/lib/briefing-runner";
import { dateKey } from "@/lib/time";
import { startFocusSession, SOUNDSCAPES } from "@/components/sections/Focus";
import { Glyph } from "@/components/ui/Glyph";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { clearAllData, resetDemoData } from "@/lib/data-actions";
import type { Prefs, Weather } from "@/lib/types";
import { PRESETS, SECTION_PREFS, setPrefs, usePref } from "@/lib/prefs";
import { elementLabel, showAllElements, showElement, useHidden } from "@/lib/layout";

/** A square on/off switch — a plain labelled checkbox underneath. */
function Toggle({ label, hint, pref }: { label: string; hint?: string; pref: keyof Prefs }) {
  const on = usePref(pref) as boolean;
  const others = useLife((st) => SECTION_PREFS.filter((x) => x.pref !== pref && (st.prefs?.[x.pref] ?? true)).length);
  // never let the last visible section be switched off
  const locked = pref.startsWith("section") && on && others === 0;
  return (
    <label className={`flex items-center justify-between gap-3 border-b border-[var(--line)] py-2 ${locked ? "opacity-50" : "cursor-pointer"}`}>
      <span className="min-w-0">
        <span className="block text-[14px] text-ink">{label}</span>
        {hint && <span className="block text-[11.5px] leading-tight text-faint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={locked}
        onChange={(e) => setPrefs({ [pref]: e.target.checked } as Partial<Prefs>)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-[18px] w-[34px] shrink-0 border transition-colors peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]"
        style={{ borderColor: on ? "var(--accent)" : "var(--line-strong)", background: on ? "color-mix(in oklab, var(--accent) 22%, transparent)" : "transparent" }}
      >
        <span
          className="absolute top-[3px] h-[10px] w-[10px] transition-all duration-200"
          style={{ left: on ? 19 : 3, background: on ? "var(--accent)" : "var(--muted)" }}
        />
      </span>
    </label>
  );
}

function HiddenList() {
  const hidden = useHidden();
  if (!hidden.length) return <p className="mt-3 text-[13px] text-faint">Nothing hidden yet.</p>;
  return (
    <div className="mt-3">
      <ul>
        {hidden.map((id) => (
          <li key={id} className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2">
            <span className="text-[14px] text-muted">{elementLabel(id)}</span>
            <button onClick={() => showElement(id)} className="mono text-ink transition-colors hover:text-accent">
              Show
            </button>
          </li>
        ))}
      </ul>
      <button onClick={showAllElements} className="mono mt-3 text-faint transition-colors hover:text-ink">
        Restore all ({hidden.length})
      </button>
    </div>
  );
}

function SfxToggle() {
  const on = useLife((st) => st.sfx);
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-[var(--line)] py-2">
      <span className="block text-[14px] text-ink">Sound effects</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => useLife.getState().setSfx(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-[18px] w-[34px] shrink-0 border transition-colors peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]"
        style={{ borderColor: on ? "var(--accent)" : "var(--line-strong)", background: on ? "color-mix(in oklab, var(--accent) 22%, transparent)" : "transparent" }}
      >
        <span className="absolute top-[3px] h-[10px] w-[10px] transition-all duration-200" style={{ left: on ? 19 : 3, background: on ? "var(--accent)" : "var(--muted)" }} />
      </span>
    </label>
  );
}

const LAB_TAG = "lab";

const CAPTURE_SAMPLES = [
  "remind me to call Alex tomorrow at 3",
  "lunch with Mara friday 1pm for 90 min",
  "urgent: send the invoice to Nord by thursday",
  "stretch every morning",
];

const LOAD_TASKS = [
  "Ship the pricing page",
  "Prepare board deck",
  "Fix the checkout bug",
  "Sign the lease renewal",
  "Answer the press request",
];

/** A believable fake sky so the weather-driven suggestions can be exercised offline. */
function fakeWeather(kind: "clear" | "storm" | "snow"): Weather {
  const now = new Date();
  const day = (h: number, m: number) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const base = kind === "clear" ? 19 : kind === "storm" ? 13 : -2;
  const precip = kind === "clear" ? 0 : 85;
  return {
    fetchedAt: Date.now(),
    temp: base,
    feels: base - 1,
    code: kind === "clear" ? 0 : kind === "storm" ? 95 : 73,
    isDay: true,
    wind: kind === "clear" ? 6 : 38,
    humidity: kind === "clear" ? 45 : 92,
    hi: base + 4,
    lo: base - 6,
    precipProb: precip,
    sunrise: day(6, 58),
    sunset: day(18, 41),
    hourly: Array.from({ length: 13 }, (_, i) => ({
      time: new Date(now.getTime() + i * 3600_000).toISOString(),
      temp: base + Math.sin(i / 3) * 3,
      precip: kind === "clear" ? 0 : Math.round(60 + Math.sin(i) * 30),
    })),
  };
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-[var(--line)] py-5">
      <div className="mono flex items-baseline justify-between gap-4 text-muted">
        <span>{title}</span>
        {hint && <span className="text-faint normal-case tracking-normal" style={{ fontSize: 11 }}>{hint}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function Btn({ children, onClick, active, label }: { children: ReactNode; onClick: (e: React.MouseEvent) => void; active?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      data-cursor={label}
      className="mono flex items-center gap-2 border px-3 py-2 transition-colors hover:border-[var(--accent)] hover:text-ink"
      style={{
        borderColor: active ? "var(--accent)" : "var(--line-strong)",
        color: active ? "var(--accent)" : "var(--muted)",
      }}
    >
      {children}
    </button>
  );
}

export function Lab() {
  const open = useLife((s) => s.labOpen);
  const setUi = useLife((s) => s.setUi);
  const override = useLife((s) => s.moodOverride);
  const soundscape = useLife((s) => s.soundscape);
  const mood = useMoodKey();
  const s = () => useLife.getState();

  const log = (text: string) => s().pushLog(`Lab · ${text}`, "accent");

  const simulateLoad = () => {
    const today = dateKey();
    LOAD_TASKS.forEach((title) => s().addTask({ title, priority: 3, dueDate: today, tags: [LAB_TAG] }));
    s().setMoodOverride(null);
    log("5 urgent tasks added — watch the mood surge");
  };

  const clearLab = () => {
    const ids = s().tasks.filter((t) => t.tags.includes(LAB_TAG)).map((t) => t.id);
    ids.forEach((id) => s().removeTask(id));
    log(`removed ${ids.length} lab tasks`);
  };

  const clearToday = () => {
    const today = dateKey();
    s()
      .tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= today)
      .forEach((t) => s().toggleTask(t.id));
    s().setMoodOverride(null);
    burst(window.innerWidth / 2, window.innerHeight / 2, 50, 1.6);
    audio.chime(660);
    log("today's manifest cleared — watch it calm down (Z to undo)");
  };

  const finishFocusNow = () => {
    const f = s().focus;
    if (!f.active) startFocusSession(1);
    useLife.setState((st) => ({ focus: { ...st.focus, elapsed: st.focus.durationMs, runningSince: null } }));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="lab"
          role="complementary"
          aria-label="Feature lab"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 28 }}
          className="fixed inset-y-0 right-0 z-[66] w-full max-w-[420px] overflow-y-auto border-l border-[var(--line-strong)] px-6 pb-10 pt-6 shadow-[-40px_0_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
          style={{ background: "rgb(7 7 9 / 0.96)" }}
          data-lenis-prevent
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="mono text-accent">Lab</div>
              <h2 className="display mt-2 text-[44px] leading-none">
                Try <em className="text-accent">everything</em>
              </h2>
              <p className="mt-3 text-[13px] text-faint">
                Non-destructive: lab tasks are tagged #lab, and most changes undo with Z.
              </p>
            </div>
            <button onClick={() => setUi({ labOpen: false })} className="mono flex items-center gap-2 text-muted hover:text-ink" aria-label="Close lab">
              <span className="kbd">T</span>
              <Glyph name="close" size={14} />
            </button>
          </div>

          <div className="mt-6">
            <section className="border-t border-[var(--line)] py-5">
              <div className="mono text-muted">Second screen</div>
              <button
                onClick={() => setUi({ labOpen: false, monitor: true })}
                className="mt-3 flex w-full items-center justify-between gap-4 border border-[var(--accent)] px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]"
              >
                <span>
                  <span className="block text-[15px] text-ink">Open monitor mode</span>
                  <span className="block text-[12px] text-faint">Glanceable, no scrolling — bookmark /?monitor for your 2nd screen</span>
                </span>
                <span className="kbd">G</span>
              </button>
            </section>

            <section className="border-t border-[var(--line)] py-5">
              <div className="mono text-muted">Layout</div>
              <button
                onClick={() => setUi({ labOpen: false, editLayout: true })}
                className="mt-3 flex w-full items-center justify-between gap-4 border border-[var(--line-strong)] px-4 py-3 text-left transition-colors hover:border-[var(--accent)]"
              >
                <span>
                  <span className="block text-[15px] text-ink">Edit layout</span>
                  <span className="block text-[12px] text-faint">Click any part of the page to hide it</span>
                </span>
                <span className="kbd">L</span>
              </button>
              <div className="mt-3">
                <Toggle pref="detail" label="Show extra detail" hint="seconds, coordinates, tags, deltas, hourly weather…" />
              </div>
              <div className="mono mt-5 text-faint">Hidden elements</div>
              <HiddenList />
            </section>

            <section className="border-t border-[var(--line)] py-5">
              <div className="mono flex items-baseline justify-between text-muted">
                <span>Display & features</span>
                <span className="text-faint normal-case tracking-normal" style={{ fontSize: 11 }}>saved in this browser</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Btn key={p.name} onClick={() => { setPrefs(p.patch); log(`display preset · ${p.name}`); }} label={p.hint}>
                    {p.name}
                  </Btn>
                ))}
              </div>
              <div className="mono mt-5 text-faint">Effects</div>
              <div className="mt-1">
                <Toggle pref="field" label="Animated background" hint="the flowing colour field" />
                <Toggle pref="particles" label="Particles" />
                <Toggle pref="rings" label="3D rings" />
                <Toggle pref="calm" label="Calm motion" hint="fewer animations, no bursts" />
                <Toggle pref="cursor" label="Custom cursor" hint="off = normal system pointer" />
                <Toggle pref="intro" label="Boot intro" hint="the startup sequence" />
                <Toggle pref="echo" label="Giant outline words" />
                <SfxToggle />
              </div>
              <div className="mono mt-5 text-faint">Interface</div>
              <div className="mt-1">
                <Toggle pref="rails" label="Side rails" hint="scroll depth + section index" />
                <Toggle pref="log" label="Activity log" hint="the small messages bottom-right" />
              </div>
              <div className="mono mt-5 text-faint">Sections</div>
              <div className="mt-1">
                {SECTION_PREFS.map((x) => (
                  <Toggle key={x.pref} pref={x.pref} label={x.label} />
                ))}
              </div>
            </section>

            <Group title="Mood engine" hint={`now: ${MOODS[mood.key].label}${mood.overridden ? " (pinned)" : " (auto)"}`}>
              <Btn active={override === null} onClick={() => { s().setMoodOverride(null); log("mood · auto"); }}>
                Auto
              </Btn>
              {MOOD_ORDER.filter((k) => k !== "focus").map((k) => (
                <Btn key={k} active={override === k} onClick={() => { s().setMoodOverride(k); log(`mood · ${MOODS[k].label}`); }}>
                  <span className="h-2 w-2" style={{ background: MOODS[k].accent }} />
                  {MOODS[k].label}
                </Btn>
              ))}
            </Group>

            <Group title="Load" hint="drives the auto mood">
              <Btn onClick={simulateLoad}>+ 5 urgent tasks</Btn>
              <Btn onClick={clearToday}>Complete all of today</Btn>
              <Btn onClick={clearLab}>Remove lab tasks</Btn>
            </Group>

            <Group title="Quick capture" hint="local parser, filed instantly">
              <Btn onClick={() => { setUi({ labOpen: false, captureOpen: true }); }}>
                <Glyph name="capture" size={14} /> Open capture
              </Btn>
              {CAPTURE_SAMPLES.map((text) => (
                <Btn
                  key={text}
                  onClick={(e) => {
                    const r = parseLocal(text);
                    const filed = s().commitCapture(r);
                    s().setUi({ highlightId: filed.id });
                    burst(e.clientX, e.clientY, 22);
                    audio.chime(990);
                    log(`${r.kind} · ${r.title} — ${filed.label}`);
                  }}
                >
                  <span className="normal-case tracking-normal">“{text}”</span>
                </Btn>
              ))}
            </Group>

            <Group title="Focus chamber">
              <Btn onClick={() => { setUi({ labOpen: false }); startFocusSession(1); }}>1-min session</Btn>
              <Btn onClick={() => { setUi({ labOpen: false }); startFocusSession(25); }}>25 min</Btn>
              <Btn onClick={() => { setUi({ labOpen: false }); finishFocusNow(); }}>Jump to completion</Btn>
            </Group>

            <Group title="Soundscapes" hint="synthesised live">
              {SOUNDSCAPES.map((k) => (
                <Btn
                  key={k.key}
                  active={soundscape === k.key && audio.playing === k.key}
                  onClick={() => { s().setSoundscape(k.key); audio.setVolume(s().volume); audio.play(k.key); log(`sound · ${k.label}`); }}
                >
                  <Glyph name={k.key} size={14} /> {k.label}
                </Btn>
              ))}
              <Btn onClick={() => { audio.stop(); log("sound · off"); }}>
                <Glyph name="sound-off" size={14} /> Stop
              </Btn>
            </Group>

            <Group title="Weather" hint="changes the ‘what now’ suggestion">
              <Btn onClick={() => { s().setWeather(fakeWeather("clear")); log("sky · clear 19°"); }}>
                <Glyph name="sun" size={14} /> Clear
              </Btn>
              <Btn onClick={() => { s().setWeather(fakeWeather("storm")); log("sky · storm"); }}>
                <Glyph name="storm" size={14} /> Storm
              </Btn>
              <Btn onClick={() => { s().setWeather(fakeWeather("snow")); log("sky · snow"); }}>
                <Glyph name="snow" size={14} /> Snow
              </Btn>
            </Group>

            <Group title="Briefing & suggestions">
              <Btn onClick={() => { void requestBriefing(mood.key, true); scrollToId("now"); }}>Recompose briefing</Btn>
              <Btn onClick={() => { window.dispatchEvent(new Event("lifeos:next-directive")); scrollToId("now"); }}>Next ‘what now’</Btn>
            </Group>

            <Group title="Charts">
              <Btn onClick={() => { scrollToId("telemetry"); window.setTimeout(() => window.dispatchEvent(new Event("lifeos:flip-chart")), 1400); }}>
                Morph timeline ⇄ dial
              </Btn>
            </Group>

            <Group title="Micro-interactions">
              <Btn onClick={(e) => burst(e.clientX, e.clientY, 40, 1.4)}>Spark burst</Btn>
              <Btn onClick={() => { burst(window.innerWidth / 2, window.innerHeight / 2, 80, 2); audio.chime(523.25); window.setTimeout(() => audio.chime(784), 260); }}>Big finale</Btn>
              <Btn onClick={() => audio.tick()}>Tick</Btn>
              <Btn onClick={() => audio.chime()}>Chime</Btn>
            </Group>

            <Group title="Data">
              <Btn onClick={() => { if (s().undo()) log("undone"); }}>
                <Glyph name="undo" size={14} /> Undo
              </Btn>
              <Btn onClick={() => setUi({ labOpen: false, plannerOpen: true })}>Open planner (E)</Btn>
              <Btn onClick={() => resetDemoData()}>
                <Glyph name="reset" size={14} /> Reset demo
              </Btn>
              <ConfirmButton onConfirm={clearAllData} confirmLabel="Yes, delete everything">
                <Glyph name="close" size={13} /> Clear all data
              </ConfirmButton>
            </Group>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
