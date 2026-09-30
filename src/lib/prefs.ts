"use client";

import { DEFAULT_PREFS, useLife } from "./store";
import type { Prefs } from "./types";

/** Reads one preference, falling back to its default (older saved states may lack newer keys). */
export function usePref<K extends keyof Prefs>(key: K): Prefs[K] {
  return useLife((s) => s.prefs?.[key] ?? DEFAULT_PREFS[key]);
}

export function getPref<K extends keyof Prefs>(key: K): Prefs[K] {
  return useLife.getState().prefs?.[key] ?? DEFAULT_PREFS[key];
}

export function setPrefs(patch: Partial<Prefs>) {
  useLife.getState().setPrefs(patch);
}

/** OS "reduce motion" or the in-app Calm motion switch. */
export function calmMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || getPref("calm");
}

export const SECTION_PREFS = [
  { id: "now", label: "Now", pref: "sectionNow" },
  { id: "today", label: "Agenda", pref: "sectionToday" },
  { id: "telemetry", label: "Telemetry", pref: "sectionTelemetry" },
  { id: "focus", label: "Focus", pref: "sectionFocus" },
] as const;

export function useVisibleSections() {
  const now = usePref("sectionNow");
  const today = usePref("sectionToday");
  const telemetry = usePref("sectionTelemetry");
  const focus = usePref("sectionFocus");
  const on = { now, today, telemetry, focus };
  return SECTION_PREFS.filter((s) => on[s.id]);
}

export const PRESETS: { name: string; hint: string; patch: Partial<Prefs> }[] = [
  {
    name: "Everything",
    hint: "all effects and sections",
    patch: {
      field: true, particles: true, rings: true, cursor: true, intro: true, echo: true, calm: false, rails: true, log: true,
      sectionNow: true, sectionToday: true, sectionTelemetry: true, sectionFocus: true,
    },
  },
  {
    name: "Performance",
    hint: "no WebGL, calm motion",
    patch: { field: false, particles: false, rings: false, calm: true },
  },
  {
    name: "Minimal",
    hint: "just the content",
    patch: { field: false, particles: false, rings: false, cursor: false, intro: false, echo: false, calm: true, rails: false, log: false },
  },
];
