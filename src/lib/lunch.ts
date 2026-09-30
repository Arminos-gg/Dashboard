"use client";

import { useMemo } from "react";
import { useLife } from "./store";
import { addDays, dateKey, hhmm, pad } from "./time";
import type { LunchPrefs } from "./types";

export const DEFAULT_LUNCH: LunchPrefs = {
  enabled: true,
  time: "12:00",
  minutes: 45,
  days: [1, 2, 3, 4, 5],
  name: "Lunch",
  sound: true,
  tabTitle: true,
  hud: true,
  menu: "",
  menuDate: "",
};

/** How long before lunch the hunger gauge starts filling. */
const RAMP_MS = 4 * 3600_000;

export function useLunch(): LunchPrefs {
  const raw = useLife((s) => s.prefs?.lunch);
  return useMemo(() => ({ ...DEFAULT_LUNCH, ...raw }), [raw]);
}

export function getLunch(): LunchPrefs {
  return { ...DEFAULT_LUNCH, ...useLife.getState().prefs?.lunch };
}

export function setLunch(patch: Partial<LunchPrefs>) {
  useLife.getState().setPrefs({ lunch: { ...getLunch(), ...patch } });
}

export type LunchPhase = "off" | "later" | "waiting" | "approach" | "final" | "eating";

export interface LunchState {
  phase: LunchPhase;
  start: Date;
  end: Date;
  /** ms until lunch starts (or, while eating, until it ends) */
  msLeft: number;
  /** 0 → 1: the hunger gauge before lunch, the plate emptying during it */
  progress: number;
  today: boolean;
}

function at(day: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function lunchState(now: Date, cfg: LunchPrefs): LunchState {
  const off: LunchState = { phase: "off", start: now, end: now, msLeft: 0, progress: 0, today: false };
  if (!cfg.enabled || !cfg.days.length) return off;
  for (let i = 0; i < 8; i++) {
    const day = addDays(now, i);
    if (!cfg.days.includes(day.getDay())) continue;
    const start = at(day, cfg.time);
    const end = new Date(start.getTime() + cfg.minutes * 60_000);
    if (now >= end) continue;
    const today = i === 0;
    if (now >= start) {
      return { phase: "eating", start, end, msLeft: end.getTime() - now.getTime(), progress: (now.getTime() - start.getTime()) / (end.getTime() - start.getTime()), today };
    }
    const msLeft = start.getTime() - now.getTime();
    const progress = Math.max(0, Math.min(1, 1 - msLeft / RAMP_MS));
    const phase: LunchPhase = !today ? "later" : msLeft <= 60_000 ? "final" : msLeft <= 15 * 60_000 ? "approach" : "waiting";
    return { phase, start, end, msLeft, progress, today };
  }
  return off;
}

/** 3725000 → "01:02:05"; under an hour → "02:05". */
export function fmtCountdown(ms: number, forceHours = false): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h || forceHours ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const LINES: [number, string[]][] = [
  [0.0, ["Breakfast still holding.", "Stomach telemetry nominal.", "All systems fed. For now."]],
  [0.3, ["Snack reserves depleting.", "First mention of food detected in the office.", "Coffee is not a meal. Coffee disagrees."]],
  [0.55, ["Hunger reactor at {pct}%.", "Menu speculation intensifies.", "Someone just opened the fridge. Twice."]],
  [0.75, ["Productivity entering low-fuel mode.", "“Is it lunch yet?” — overheard, {pct}% confidence.", "Stomach has filed a formal complaint."]],
  [0.9, ["Crew assembling near the kitchen.", "Keyboard input slowing. Cause: hunger.", "Jacket-on-chair-back protocol initiated."]],
];

/** A rotating status line; changes every ~40 s so it doesn't flicker. */
export function lunchQuip(st: LunchState, cfg: LunchPrefs, now: Date): string {
  const spin = Math.floor(now.getTime() / 40_000);
  const name = cfg.name || "Lunch";
  if (st.phase === "off") return cfg.enabled ? "No lunch days selected." : "Lunch countdown is off.";
  if (st.phase === "later") {
    const tomorrow = dateKey(addDays(now, 1)) === dateKey(st.start);
    return tomorrow ? `${name} is done for today. Tomorrow at ${cfg.time}.` : `No ${name.toLowerCase()} scheduled today. Stay strong.`;
  }
  if (st.phase === "eating") return `Refuelling in progress. Back on duty at ${hhmm(st.end)}.`;
  if (st.phase === "final") return `T-minus ${Math.ceil(st.msLeft / 1000)}. All crew to the kitchen.`;
  if (st.phase === "approach") return ["Final approach. Tray tables up.", "Go / no-go poll for lunch: GO.", "Save your work. Seriously."][spin % 3];
  const bucket = [...LINES].reverse().find(([min]) => st.progress >= min)![1];
  return bucket[spin % bucket.length].replace("{pct}", String(Math.round(st.progress * 100)));
}

export function todaysMenu(cfg: LunchPrefs, now = new Date()): string {
  return cfg.menuDate === dateKey(now) ? cfg.menu : "";
}

export const LUNCH_DAYS = [
  { d: 1, l: "M" },
  { d: 2, l: "T" },
  { d: 3, l: "W" },
  { d: 4, l: "T" },
  { d: 5, l: "F" },
  { d: 6, l: "S" },
  { d: 0, l: "S" },
];
