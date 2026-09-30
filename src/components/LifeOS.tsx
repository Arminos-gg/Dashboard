"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { MotionConfig } from "motion/react";
import { useLife } from "@/lib/store";
import { startPointer } from "@/lib/pointer";
import { scrollToId, startSmoothScroll } from "@/lib/scroll";
import { applyMood } from "@/lib/mood-live";
import { computeLoad, deriveMood, MOODS } from "@/lib/mood";
import { useMoodKey } from "@/lib/useMood";
import { checkAi } from "@/lib/ai.client";
import { requestBriefing } from "@/lib/briefing-runner";
import { startCloudSync } from "@/lib/sync";
import { fetchWeather, locationFromTimeZone } from "@/lib/weather";
import { mountSparks } from "@/lib/sparks";
import { audio } from "@/lib/audio";
import { Chrome, cycleMood, SECTIONS } from "./hud/Chrome";
import { Cursor } from "./hud/Cursor";
import { Intro } from "./hud/Intro";
import { NowSection } from "./sections/Now";
import { TodaySection } from "./sections/Today";
import { StatsSection } from "./sections/Stats";
import { FocusSection, startFocusSession } from "./sections/Focus";
import { FocusOverlay } from "./overlays/FocusOverlay";
import { QuickCapture } from "./overlays/QuickCapture";
import { Controls } from "./overlays/Controls";
import { Lab } from "./overlays/Lab";

const Background = dynamic(() => import("./scene/Background"), { ssr: false });

function currentMood() {
  const s = useLife.getState();
  if (s.focus.active) return "focus";
  return s.moodOverride ?? deriveMood(computeLoad(s.tasks, s.events, new Date()), false, new Date());
}

function undo() {
  const s = useLife.getState();
  if (s.undo()) s.pushLog("Reverted last change");
  else s.pushLog("Nothing to undo");
}

function SparksLayer() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => (ref.current ? mountSparks(ref.current) : undefined), []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[70] h-full w-full" aria-hidden />;
}

function Colophon() {
  return (
    <footer className="relative px-frame pb-40 pt-[10vh]">
      <div className="h-px w-full bg-[var(--line-strong)]" />
      <p className="display mt-[8vh] max-w-[14ch] text-[clamp(56px,9vw,160px)] leading-[0.9]">
        Make it a <em className="text-accent">good day.</em>
      </p>
      <div className="mono mt-12 flex flex-wrap justify-between gap-6 text-faint">
        <span>
          Life<span className="text-accent">/</span>OS — an instrument for one
        </span>
        <span>Local-first · Claude interpreter · Supabase sync optional</span>
        <button onClick={() => scrollToId("now")} className="text-muted hover:text-ink">
          Return to now ↑
        </button>
      </div>
    </footer>
  );
}

export function LifeOS() {
  const { key: moodKey } = useMoodKey();
  const focusActive = useLife((s) => s.focus.active);
  const location = useLife((s) => s.location);
  const ai = useLife((s) => s.ai);
  const hasWeather = useLife((s) => !!s.weather || s.weatherFailed);

  // runtimes
  useEffect(() => {
    startPointer();
    startSmoothScroll();
    void checkAi();
    void startCloudSync();
    const s = useLife.getState();
    s.ensureToday();
    audio.setVolume(s.volume);
    const t = window.setInterval(() => useLife.getState().ensureToday(), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // mood engine → shader, particles, CSS
  useEffect(() => {
    applyMood(MOODS[moodKey], focusActive);
  }, [moodKey, focusActive]);

  // location + weather
  useEffect(() => {
    if (!location) useLife.getState().setLocation(locationFromTimeZone());
  }, [location]);
  const lat = location?.lat;
  const lon = location?.lon;
  useEffect(() => {
    const loc = useLife.getState().location;
    if (lat == null || lon == null || !loc) return;
    const ctrl = new AbortController();
    const load = () =>
      fetchWeather(loc, ctrl.signal)
        .then((w) => useLife.getState().setWeather(w))
        .catch(() => {
          if (ctrl.signal.aborted) return;
          const s = useLife.getState();
          if (!s.weather) s.setWeather(null, true);
        });
    void load();
    const t = window.setInterval(load, 20 * 60_000);
    return () => {
      ctrl.abort();
      window.clearInterval(t);
    };
  }, [lat, lon]);

  // briefing once we know whether Claude is available (and ideally the weather)
  useEffect(() => {
    if (!ai) return;
    const t = window.setTimeout(() => void requestBriefing(currentMood()), hasWeather ? 200 : 2500);
    return () => window.clearTimeout(t);
  }, [ai, hasWeather]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useLife.getState();
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest?.("input, textarea, select, [contenteditable='true']");
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        s.setUi({ captureOpen: true });
        return;
      }
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        undo();
        return;
      }
      if (typing || s.captureOpen || s.shortcutsOpen || mod || e.altKey) return;

      if (e.key.toLowerCase() === "t") {
        s.setUi({ labOpen: !s.labOpen });
        return;
      }
      if (e.key === "Escape" && s.labOpen) {
        s.setUi({ labOpen: false });
        return;
      }

      if (s.focus.active) {
        if (e.key === " ") {
          e.preventDefault();
          if (s.focus.completed != null) return;
          if (s.focus.runningSince) s.pauseFocus();
          else s.resumeFocus();
        } else if (e.key === "Escape") {
          if (s.focus.completed == null) s.endFocus(false);
          s.closeFocus();
          audio.stop();
        }
        return;
      }

      const k = e.key.toLowerCase();
      if (k === "k" || k === "/") {
        e.preventDefault();
        s.setUi({ captureOpen: true });
      } else if (k === "f") startFocusSession(25);
      else if (["1", "2", "3", "4"].includes(k)) scrollToId(SECTIONS[Number(k) - 1].id);
      else if (k === "n") window.dispatchEvent(new Event("lifeos:next-directive"));
      else if (k === "b") void requestBriefing(currentMood(), true);
      else if (k === "v") window.dispatchEvent(new Event("lifeos:flip-chart"));
      else if (k === "m") cycleMood();
      else if (k === "s") {
        s.setSfx(!s.sfx);
        s.pushLog(`Sound effects · ${!s.sfx ? "on" : "off"}`);
      } else if (k === "z") undo();
      else if (e.key === "?") {
        e.preventDefault();
        s.setUi({ shortcutsOpen: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Background />
      <main className="relative z-10">
        <NowSection />
        <TodaySection />
        <StatsSection />
        <FocusSection />
        <Colophon />
      </main>
      <Chrome />
      <FocusOverlay />
      <QuickCapture />
      <Controls />
      <Lab />
      <SparksLayer />
      <Intro />
      <Cursor />
    </MotionConfig>
  );
}
