"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { MotionConfig } from "motion/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
import { Chrome, cycleMood } from "./hud/Chrome";
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
import { LunchWatcher } from "@/components/sections/Lunch";
import { Planner } from "./overlays/Planner";
import { MonitorView } from "./overlays/MonitorView";
import { EditLayout } from "./overlays/EditLayout";
import { Hideable } from "./ui/Hideable";
import { getPref, SECTION_PREFS, usePref, useVisibleSections } from "@/lib/prefs";
import { lockScroll, parkScroll, rememberScroll, unparkScroll } from "@/lib/scroll";
import type { PersistedLife } from "@/lib/store";

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
    <Hideable id="footer">
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
    </Hideable>
  );
}

export function LifeOS() {
  const { key: moodKey } = useMoodKey();
  const focusActive = useLife((s) => s.focus.active);
  const location = useLife((s) => s.location);
  const ai = useLife((s) => s.ai);
  const hasWeather = useLife((s) => !!s.weather || s.weatherFailed);
  const monitor = useLife((s) => s.monitor);
  const wasMonitor = useRef(false);
  const calm = usePref("calm");
  const rails = usePref("rails");
  const sections = useVisibleSections();
  const show = (id: string) => sections.some((s) => s.id === id);

  // monitor mode is addressable: /?monitor opens straight into it (bookmark it on a second screen)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("monitor")) useLife.getState().setUi({ monitor: true });
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (monitor) url.searchParams.set("monitor", "");
    else url.searchParams.delete("monitor");
    window.history.replaceState(null, "", url.toString().replace("monitor=", "monitor"));
    const locked = monitor || useLife.getState().focus.active;
    if (monitor) {
      parkScroll();
      lockScroll(true);
    } else {
      lockScroll(locked);
      if (wasMonitor.current) unparkScroll();
    }
    wasMonitor.current = monitor;
  }, [monitor]);

  // layout changed (sections, hidden elements, detail) → scroll-driven reveals must re-measure,
  // otherwise a header that moved into view never plays its entrance and stays masked
  const hidden = useLife((s) => (s.prefs?.hidden ?? []).join(","));
  const detail = usePref("detail");
  const sectionKey = sections.map((s) => s.id).join(",");
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [hidden, detail, sectionKey, monitor]);

  // capture the scroll position synchronously, before React unmounts the page for monitor mode
  useEffect(
    () =>
      useLife.subscribe((s, prev) => {
        if (s.monitor && !prev.monitor) rememberScroll();
      }),
    [],
  );

  // the section index on the right reserves space only while it is shown
  useEffect(() => {
    document.documentElement.dataset.rails = rails ? "on" : "off";
  }, [rails]);

  // keep tabs in step: a change made in one window (say the main screen) shows up in the other (the monitor)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "life-os" || !e.newValue) return;
      try {
        const incoming = (JSON.parse(e.newValue) as { state?: PersistedLife }).state;
        if (incoming && incoming.updatedAt > useLife.getState().updatedAt) void useLife.persist.rehydrate();
      } catch {
        /* ignore malformed writes */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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
      const key = e.key.toLowerCase();

      // Ctrl/⌘+E opens or closes the planner from anywhere, even while typing
      if (mod && !e.altKey && !e.shiftKey && key === "e") {
        e.preventDefault();
        s.setUi({ plannerOpen: !s.plannerOpen, labOpen: false });
        return;
      }

      // Inside the planner every shortcut works bare when no field has focus,
      // and with Ctrl/⌘ while you're typing. Other Ctrl combos (copy, paste,
      // text undo…) are left to the browser.
      if (s.plannerOpen) {
        if (e.altKey || s.captureOpen || s.shortcutsOpen) return;
        const close = (patch: Parameters<typeof s.setUi>[0] = {}) => s.setUi({ plannerOpen: false, ...patch });
        // chord: also available as Ctrl/⌘+key (keys the browser reserves, like T or F, stay bare-only)
        const actions: Record<string, { chord: boolean; run: () => void }> = {
          e: { chord: true, run: () => close() },
          k: { chord: true, run: () => window.dispatchEvent(new Event("lifeos:planner-quick")) },
          g: { chord: true, run: () => close({ monitor: true }) },
          l: { chord: true, run: () => close({ editLayout: true }) },
          m: { chord: true, run: cycleMood },
          b: { chord: true, run: () => void requestBriefing(currentMood(), true) },
          s: {
            chord: true,
            run: () => {
              s.setSfx(!s.sfx);
              s.pushLog(`Sound effects · ${!s.sfx ? "on" : "off"}`);
            },
          },
          "/": { chord: true, run: () => close({ shortcutsOpen: true }) },
          "?": { chord: false, run: () => close({ shortcutsOpen: true }) },
          z: { chord: !typing, run: undo },
          t: { chord: false, run: () => close({ labOpen: true }) },
          f: {
            chord: false,
            run: () => {
              close();
              startFocusSession(25);
            },
          },
        };
        const action = actions[e.key === "?" ? "?" : key];
        if (!action || (typing && !mod) || (mod && !action.chord)) return;
        e.preventDefault();
        action.run();
        return;
      }

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
      if (typing || s.captureOpen || s.shortcutsOpen || s.plannerOpen || mod || e.altKey) return;

      if (e.key.toLowerCase() === "l") {
        s.setUi({ editLayout: !s.editLayout, labOpen: false });
        return;
      }
      if (s.editLayout) return;
      if (e.key.toLowerCase() === "g") {
        s.setUi({ monitor: !s.monitor, labOpen: false });
        return;
      }
      if (e.key === "Escape" && s.monitor) {
        s.setUi({ monitor: false });
        return;
      }
      if (e.key.toLowerCase() === "e" && !s.focus.active) {
        e.preventDefault();
        s.setUi({ plannerOpen: true, labOpen: false });
        return;
      }
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
      else if (["1", "2", "3", "4"].includes(k) && !s.monitor) {
        const target = SECTION_PREFS.filter((x) => getPref(x.pref))[Number(k) - 1];
        if (target) scrollToId(target.id);
      }
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
    <MotionConfig reducedMotion={calm ? "always" : "user"}>
      <Background />
      {monitor ? (
        <MonitorView />
      ) : (
        <>
          <main className="relative z-10">
            {show("now") && <NowSection />}
            {show("today") && <TodaySection />}
            {show("telemetry") && <StatsSection />}
            {show("focus") && <FocusSection />}
            <Colophon />
          </main>
          <Chrome />
        </>
      )}
      <FocusOverlay />
      <QuickCapture />
      <Controls />
      <Lab />
      <EditLayout />
      <Planner />
      <LunchWatcher />
      <SparksLayer />
      <Intro />
      <Cursor />
    </MotionConfig>
  );
}
