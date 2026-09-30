"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import * as Slider from "@radix-ui/react-slider";
import { focusElapsed, useLife } from "@/lib/store";
import { audio } from "@/lib/audio";
import { lockScroll } from "@/lib/scroll";
import { burst } from "@/lib/sparks";
import { pad } from "@/lib/time";
import { useNow } from "@/components/ui/hooks";
import { Glyph } from "@/components/ui/Glyph";
import { SOUNDSCAPES } from "@/components/sections/Focus";

function Visualizer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = 300 * dpr;
    c.height = 44 * dpr;
    ctx.scale(dpr, dpr);
    let raf = 0;
    let data: Uint8Array<ArrayBuffer> | null = null;
    const draw = () => {
      const a = audio.analyser;
      ctx.clearRect(0, 0, 300, 44);
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#fff";
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      const bars = 64;
      if (a) {
        if (!data || data.length !== a.frequencyBinCount) data = new Uint8Array(a.frequencyBinCount);
        a.getByteFrequencyData(data);
      }
      for (let i = 0; i < bars; i++) {
        const v = data ? data[Math.floor((i / bars) * (data.length * 0.7))] / 255 : 0;
        const h = 1 + v * 20;
        const x = 2 + i * (296 / bars);
        ctx.globalAlpha = 0.25 + v * 0.75;
        ctx.beginPath();
        ctx.moveTo(x, 22 - h);
        ctx.lineTo(x, 22 + h);
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} style={{ width: 300, height: 44 }} aria-hidden />;
}

function Chamber() {
  const now = useNow(250);
  const focus = useLife((s) => s.focus);
  const soundscape = useLife((s) => s.soundscape);
  const volume = useLife((s) => s.volume);
  const s = useLife.getState();
  const done = focus.completed ?? null;
  const [soundOn, setSoundOn] = useState(() => audio.playing != null);
  const elapsed = Math.min(focusElapsed(focus, now.getTime()), focus.durationMs);
  const remaining = Math.max(0, focus.durationMs - elapsed);
  const progress = focus.durationMs ? elapsed / focus.durationMs : 0;
  const paused = !focus.runningSince;
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);

  useEffect(() => {
    if (remaining > 0 || done != null) return;
    useLife.getState().endFocus(true);
    audio.chime(523.25);
    window.setTimeout(() => audio.chime(784), 280);
    burst(window.innerWidth / 2, window.innerHeight / 2, 60, 1.8);
  }, [remaining, done]);

  const R = 44; // vmin
  const C = 2 * Math.PI * R;

  const setSound = (k: (typeof SOUNDSCAPES)[number]["key"]) => {
    s.setSoundscape(k);
    audio.play(k);
    setSoundOn(true);
  };

  if (done != null) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <div className="mono text-accent">Session complete</div>
        <div className="display mt-6 text-[clamp(56px,9vw,150px)]">
          {done} minutes <em className="text-accent">of depth.</em>
        </div>
        <button
          className="mono mt-10 inline-flex items-center gap-3 border border-[var(--line-strong)] px-5 py-3 text-ink transition-colors hover:border-[var(--accent)]"
          onClick={() => {
            audio.stop();
            s.closeFocus();
          }}
          autoFocus
        >
          Leave the chamber <span className="kbd">Esc</span>
        </button>
      </motion.div>
    );
  }

  return (
    <div className="relative flex w-full flex-col items-center">
      <div className="mono text-muted">
        Focus chamber · <span className="text-accent">{paused ? "holding" : "engaged"}</span>
      </div>
      {focus.intention && (
        <div className="display mt-4 max-w-[26ch] text-center text-[clamp(22px,2.4vw,36px)] italic text-muted">{focus.intention}</div>
      )}

      <div className="relative mt-6 grid place-items-center" style={{ width: "min(88vmin, 720px)", height: "min(58vmin, 520px)" }}>
        <svg viewBox="-50 -50 100 100" className="absolute h-[min(88vmin,620px)] w-[min(88vmin,620px)] -rotate-90 overflow-visible" aria-hidden>
          <circle r={R} fill="none" stroke="var(--line)" strokeWidth={0.2} />
          <circle
            r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={0.45}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            style={{ transition: "stroke-dashoffset .3s linear" }}
          />
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * Math.PI * 2;
            const l = i % 5 === 0 ? 2.2 : 1;
            return (
              <line
                key={i}
                x1={Math.cos(a) * (R + 2)}
                y1={Math.sin(a) * (R + 2)}
                x2={Math.cos(a) * (R + 2 + l)}
                y2={Math.sin(a) * (R + 2 + l)}
                stroke={i / 60 <= progress ? "var(--accent)" : "var(--line-strong)"}
                strokeWidth={0.18}
              />
            );
          })}
        </svg>
        <div
          className="display text-[clamp(96px,19vw,300px)] leading-none tracking-[-0.04em] tabular-nums"
          role="timer"
          aria-live="off"
          aria-label={`${mins} minutes ${secs} seconds remaining`}
          style={{ opacity: paused ? 0.45 : 1, transition: "opacity .6s" }}
        >
          {pad(mins)}
          <span className="italic text-accent">:</span>
          {pad(secs)}
        </div>
      </div>

      <div className="mono mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <button onClick={() => (paused ? s.resumeFocus() : s.pauseFocus())} className="flex items-center gap-2 text-ink" data-cursor={paused ? "Resume" : "Hold"}>
          <Glyph name={paused ? "play" : "pause"} size={16} /> {paused ? "Resume" : "Hold"} <span className="kbd">Space</span>
        </button>
        <button onClick={() => s.extendFocus(5)} className="flex items-center gap-2 text-muted hover:text-ink">
          <Glyph name="plus" size={14} /> 5 min
        </button>
        <button
          onClick={() => {
            s.endFocus(false);
            audio.stop();
          }}
          className="flex items-center gap-2 text-muted hover:text-ink">
          <Glyph name="stop" size={14} /> End <span className="kbd">Esc</span>
        </button>
      </div>

      <div className="mt-10 flex flex-col items-center gap-5">
        <div className="mono flex flex-wrap items-center justify-center gap-5">
          {SOUNDSCAPES.map((k) => (
            <button
              key={k.key}
              onClick={() => setSound(k.key)}
              className="flex items-center gap-2 transition-colors"
              style={{ color: soundscape === k.key && soundOn ? "var(--accent)" : "var(--faint)" }}
              aria-pressed={soundscape === k.key && soundOn}
            >
              <Glyph name={k.key} size={14} /> {k.label}
            </button>
          ))}
        </div>
        <Visualizer />
        <div className="mono flex items-center gap-5 text-faint">
          <button
            onClick={() => {
              if (soundOn) audio.stop();
              else audio.play(soundscape);
              setSoundOn(!soundOn);
            }}
            aria-label={soundOn ? "Mute soundscape" : "Play soundscape"}
            className="hover:text-ink"
          >
            <Glyph name={soundOn ? "sound-on" : "sound-off"} size={16} />
          </button>
          <Slider.Root
            className="relative flex h-5 w-40 touch-none select-none items-center"
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={([v]) => {
              s.setVolume(v);
              audio.setVolume(v);
            }}
            aria-label="Volume"
          >
            <Slider.Track className="relative h-px grow bg-[var(--line-strong)]">
              <Slider.Range className="absolute h-full bg-[var(--accent)]" />
            </Slider.Track>
            <Slider.Thumb className="block h-2.5 w-2.5 rotate-45 bg-[var(--ink)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]" />
          </Slider.Root>
          <button onClick={() => {
            const i = SOUNDSCAPES.findIndex((x) => x.key === soundscape);
            setSound(SOUNDSCAPES[(i + 1) % SOUNDSCAPES.length].key);
          }} aria-label="Next soundscape" className="hover:text-ink">
            <Glyph name="next" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function FocusOverlay() {
  const active = useLife((s) => s.focus.active);
  useEffect(() => {
    document.documentElement.dataset.focus = active ? "on" : "off";
    lockScroll(active);
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="chamber"
          role="dialog"
          aria-modal="true"
          aria-label="Focus chamber"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto px-[var(--gutter)] py-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          data-lenis-prevent
        >
          <motion.div
            initial={{ scale: 1.08, filter: "blur(20px)" }}
            animate={{ scale: 1, filter: "blur(0px)" }}
            exit={{ scale: 0.96, filter: "blur(16px)" }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <Chamber />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
