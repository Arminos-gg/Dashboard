"use client";

import { gsap } from "gsap";
import { hexToRgb, type Mood } from "./mood";

type RGB = { r: number; g: number; b: number };
const rgb = (hex: string): RGB => {
  const [r, g, b] = hexToRgb(hex);
  return { r, g, b };
};

/**
 * The live, continuously-tweened expression of the current mood. WebGL reads it
 * every frame; CSS custom properties are tweened alongside so the DOM follows.
 */
export const moodLive = {
  a: rgb("#120f33"),
  b: rgb("#5847d8"),
  c: rgb("#c4bbff"),
  accent: rgb("#ac9fff"),
  energy: 0.5,
  focus: 0,
};

let first = true;

export function applyMood(m: Mood, focusActive: boolean) {
  const duration = first ? 0 : 2.4;
  first = false;
  const ease = "power2.inOut";
  const [a, b, c] = m.colors.map(rgb);
  gsap.to(moodLive.a, { ...a, duration, ease, overwrite: true });
  gsap.to(moodLive.b, { ...b, duration, ease, overwrite: true });
  gsap.to(moodLive.c, { ...c, duration, ease, overwrite: true });
  gsap.to(moodLive.accent, { ...rgb(m.accent), duration, ease, overwrite: true });
  gsap.to(moodLive, { energy: m.energy, focus: focusActive ? 1 : 0, duration: duration * 1.2, ease, overwrite: "auto" });
  gsap.to(document.documentElement, {
    "--accent": m.accent,
    "--accent-2": m.colors[1],
    duration,
    ease,
    overwrite: true,
  });
}
