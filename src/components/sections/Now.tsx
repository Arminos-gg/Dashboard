"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { gsap } from "gsap";
import { useLife } from "@/lib/store";
import { useMoodKey } from "@/lib/useMood";
import { MOODS } from "@/lib/mood";
import { directives, eventsOn, freeWindows } from "@/lib/agenda";
import { dateKey, greeting, monthName, pad, weekday } from "@/lib/time";
import { formatCoords } from "@/lib/weather";
import { introDelay } from "@/lib/intro";
import { calmMotion, usePref } from "@/lib/prefs";
import { Hideable } from "@/components/ui/Hideable";
import { audio } from "@/lib/audio";
import { burst } from "@/lib/sparks";
import { useNow } from "@/components/ui/hooks";
import { Glyph } from "@/components/ui/Glyph";
import { Magnetic } from "@/components/ui/Magnetic";
import { WeatherTelemetry } from "./WeatherTelemetry";
import { BriefingSheet } from "./BriefingSheet";

function Digit({ value }: { value: string }) {
  return (
    <span className="relative inline-block overflow-hidden align-top" style={{ height: "0.86em", width: "0.52em" }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="absolute inset-x-0 top-0 text-center"
          initial={{ y: "95%", filter: "blur(8px)", opacity: 0 }}
          animate={{ y: "0%", filter: "blur(0px)", opacity: 1 }}
          exit={{ y: "-95%", filter: "blur(8px)", opacity: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function BigTime({ now }: { now: Date }) {
  const detail = usePref("detail");
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const dayPct = ((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) * 100;
  return (
    <div className="relative">
      <h1 className="display velocity-skew relative flex items-start text-[clamp(128px,24vw,420px)] leading-[0.86] tracking-[-0.04em]" aria-label={`${hh}:${mm}`}>
        <Digit value={hh[0]} />
        <Digit value={hh[1]} />
        <span className="relative -mx-[0.02em] inline-block w-[0.26em] text-center italic text-accent" style={{ animation: "pulse-colon 2s ease-in-out infinite" }}>
          :
        </span>
        <Digit value={mm[0]} />
        <Digit value={mm[1]} />
        {detail && (
          <span className="mono ml-3 mt-[0.9em] text-[11px] text-muted md:ml-5" style={{ fontSize: "clamp(10px,0.9vw,13px)" }}>
            {pad(now.getSeconds())}
          </span>
        )}
      </h1>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-px w-[min(56vw,640px)] bg-[var(--line)]">
          <div className="absolute inset-y-0 left-0 bg-[var(--accent)]" style={{ width: `${dayPct}%` }} />
          <div className="absolute -top-1 h-[9px] w-px bg-[var(--accent)]" style={{ left: `${dayPct}%` }} />
        </div>
        {detail && <span className="mono text-faint">Day {dayPct.toFixed(1)}% elapsed</span>}
      </div>
    </div>
  );
}

function partOfDay(d: Date) {
  const h = d.getHours();
  return h < 12 ? "The morning" : h < 17 ? "The afternoon" : "The evening";
}

function Directive() {
  const now = useNow(30_000);
  const tasks = useLife((s) => s.tasks);
  const events = useLife((s) => s.events);
  const habits = useLife((s) => s.habits);
  const weather = useLife((s) => s.weather);
  const list = useMemo(() => directives({ now, tasks, events, habits, weather }), [now, tasks, events, habits, weather]);
  const [i, setI] = useState(0);
  const d = list[i % Math.max(1, list.length)];

  useEffect(() => {
    const next = () => setI((n) => n + 1);
    window.addEventListener("lifeos:next-directive", next);
    return () => window.removeEventListener("lifeos:next-directive", next);
  }, []);

  if (!d) return null;

  const act = (e: React.MouseEvent) => {
    const s = useLife.getState();
    if (!d.action) return;
    if (d.action.type === "focus") {
      const task = s.tasks.find((t) => t.id === (d.action as { taskId?: string }).taskId);
      s.startFocus(d.action.minutes, task?.id, task?.title);
      audio.play(s.soundscape);
    } else if (d.action.type === "habit") {
      const on = s.toggleHabit(d.action.habitId);
      if (on) {
        burst(e.clientX, e.clientY, 26);
        if (s.sfx) audio.chime(740);
      }
      s.pushLog("Ritual logged", "accent");
    }
  };

  return (
    <div>
      <div className="mono flex items-center gap-3 text-muted">
        <span>What now</span>
        <span className="h-px w-8 bg-[var(--line-strong)]" />
        <AnimatePresence mode="wait">
          <motion.span key={d.id + d.kicker} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-accent">
            {d.kicker}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="min-h-[3.3em] text-[clamp(30px,3.5vw,58px)]">
        <AnimatePresence mode="wait">
          <motion.p
            key={d.id}
            className="display mt-5 max-w-[20ch] leading-[1.02]"
            initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -16, filter: "blur(10px)" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {d.lead} <em className="text-accent">{d.emph}</em>
            {d.tail}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="mono mt-7 flex flex-wrap items-center gap-x-8 gap-y-3">
        {d.action && (
          <Magnetic>
            <button onClick={act} className="group flex items-center gap-3 text-ink" data-cursor={d.action.label}>
              <span className="grid h-9 w-9 place-items-center border border-[var(--line-strong)] transition-colors group-hover:border-[var(--accent)] group-hover:text-accent">
                <Glyph name={d.action.type === "focus" ? "focus" : "diamond"} size={15} />
              </span>
              {d.action.label}
            </button>
          </Magnetic>
        )}
        {list.length > 1 && (
          <button onClick={() => setI((n) => n + 1)} className="flex items-center gap-3 text-muted transition-colors hover:text-ink" data-cursor="Another">
            <span className="kbd">N</span> Another <span className="text-faint">{(i % list.length) + 1}/{list.length}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function NowSection() {
  const now = useNow(1000);
  const moodKey = useMoodKey().key;
  const mood = MOODS[moodKey];
  const name = useLife((s) => s.profileName);
  const events = useLife((s) => s.events);
  const location = useLife((s) => s.location);
  const root = useRef<HTMLElement>(null);
  const echo = useRef<HTMLDivElement>(null);
  const showEcho = usePref("echo");
  const detail = usePref("detail");

  const minuteKey = Math.floor(now.getTime() / 60_000);
  const subline = useMemo(() => {
    const d = new Date(minuteKey * 60_000);
    const windows = freeWindows(events, d);
    const longest = [...windows].sort((a, b) => b.minutes - a.minutes)[0];
    const left = eventsOn(events, dateKey(d)).filter((e) => new Date(e.end) > d).length;
    if (d.getHours() >= 21) return "Let the day land.";
    if (longest && longest.minutes >= 120) {
      const startsNow = longest.start.getTime() - d.getTime() < 30 * 60_000;
      if (startsNow) return `The next ${Math.floor(longest.minutes / 60)} hours are yours.`;
      return `${partOfDay(longest.start)} is yours.`;
    }
    if (left) return `${left} commitment${left === 1 ? "" : "s"} ahead.`;
    return "Clear skies ahead.";
  }, [events, minuteKey]);

  // intro choreography + parallax echo
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || calmMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-now-in]", {
        opacity: 0,
        y: 40,
        filter: "blur(12px)",
        duration: 1.6,
        ease: "expo.out",
        stagger: 0.09,
        delay: introDelay(),
      });
      if (echo.current) {
        gsap.to(echo.current, {
          yPercent: 30,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
        });
      }
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section id="now" ref={root} className="relative min-h-svh overflow-hidden px-frame pb-[12vh] pt-[15vh] md:pt-[16vh]">
      <div
        ref={echo}
        aria-hidden
        className="outline-text display pointer-events-none absolute -left-[3vw] bottom-[-4vw] select-none text-[clamp(160px,30vw,540px)] italic leading-none"
        style={{ display: showEcho ? undefined : "none" }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={mood.key}
            className="inline-block"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {mood.label}
          </motion.span>
        </AnimatePresence>
      </div>

      <Hideable id="now.date" className="relative w-fit">
        <div data-now-in className="mono flex flex-wrap items-center gap-x-6 gap-y-1 text-muted">
          <span className="text-accent">01</span>
          <span>
            {weekday(now)}, {now.getDate()} {monthName(now)}
          </span>
          {detail && location && <span className="hidden text-faint md:inline">{formatCoords(location.lat, location.lon)}</span>}
        </div>
      </Hideable>

      <div className="relative mt-[3vh] grid gap-12 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <Hideable id="now.clock" className="w-fit">
            <div data-now-in>
              <BigTime now={now} />
            </div>
          </Hideable>
          <Hideable id="now.greeting" className="w-fit">
            <p data-now-in className="display max-w-[16ch] text-[clamp(32px,4.2vw,68px)] leading-[0.98]">
              {greeting(now)}
              {name ? `, ${name}` : ""}. <em className="text-accent">{subline}</em>
            </p>
          </Hideable>
        </div>
        <Hideable id="now.weather" className="lg:col-span-4 lg:pt-[2vh]">
          <div data-now-in>
            <WeatherTelemetry now={now} />
          </div>
        </Hideable>
      </div>

      <div className="relative mt-[10vh] grid gap-12 lg:grid-cols-12 lg:gap-16">
        <Hideable id="now.directive" className="lg:col-span-7">
          <div data-now-in>
            <Directive />
          </div>
        </Hideable>
        <Hideable id="now.briefing" className="lg:col-span-5">
          <div data-now-in>
            <BriefingSheet moodKey={moodKey} />
          </div>
        </Hideable>
      </div>
    </section>
  );
}
