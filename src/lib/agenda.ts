import type { CalEvent, Habit, Task, Weather } from "./types";
import { dateKey, fmtMinutes, hhmm } from "./time";
import { habitStreak } from "./stats";

export function eventsOn(events: CalEvent[], key: string): CalEvent[] {
  return events
    .filter((e) => dateKey(new Date(e.start)) === key)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function currentEvent(events: CalEvent[], now: Date) {
  return events.find((e) => new Date(e.start) <= now && new Date(e.end) > now) ?? null;
}

export function nextEvent(events: CalEvent[], now: Date) {
  return (
    events
      .filter((e) => new Date(e.start) > now && dateKey(new Date(e.start)) === dateKey(now))
      .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null
  );
}

export interface Window {
  start: Date;
  end: Date;
  minutes: number;
}

/** Open stretches between now and the end of the working day. */
export function freeWindows(events: CalEvent[], now: Date, endHour = 22, minMinutes = 45): Window[] {
  const dayEnd = new Date(now);
  dayEnd.setHours(endHour, 0, 0, 0);
  const cursorStart = new Date(Math.ceil(now.getTime() / (5 * 60_000)) * 5 * 60_000);
  const busy = eventsOn(events, dateKey(now))
    .map((e) => ({ s: new Date(e.start), e: new Date(e.end) }))
    .filter((b) => b.e > cursorStart);
  const out: Window[] = [];
  let cursor = cursorStart;
  for (const b of busy) {
    if (b.s > cursor) {
      const minutes = (b.s.getTime() - cursor.getTime()) / 60_000;
      if (minutes >= minMinutes) out.push({ start: cursor, end: b.s, minutes });
    }
    if (b.e > cursor) cursor = b.e;
  }
  if (dayEnd > cursor) {
    const minutes = (dayEnd.getTime() - cursor.getTime()) / 60_000;
    if (minutes >= minMinutes) out.push({ start: cursor, end: dayEnd, minutes });
  }
  return out;
}

/** Overdue → due today → priority → time → manual order. */
export function rankTasks(tasks: Task[], now: Date): Task[] {
  const today = dateKey(now);
  const bucket = (t: Task) => (!t.dueDate ? 3 : t.dueDate < today ? 0 : t.dueDate === today ? 1 : 2);
  return tasks
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        bucket(a) - bucket(b) ||
        b.priority - a.priority ||
        (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99") ||
        a.order - b.order,
    );
}

export function theThree(tasks: Task[], now: Date): Task[] {
  const today = dateKey(now);
  return rankTasks(tasks, now)
    .filter((t) => t.dueDate && t.dueDate <= today)
    .slice(0, 3);
}

export interface Directive {
  id: string;
  kicker: string;
  lead: string;
  emph: string;
  tail: string;
  action?:
    | { type: "focus"; taskId?: string; minutes: number; label: string }
    | { type: "habit"; habitId: string; label: string }
    | { type: "complete"; taskId: string; label: string };
  score: number;
}

function niceWeather(w: Weather | null): boolean {
  if (!w) return false;
  const dry = w.code <= 3 && w.precipProb < 40;
  return w.isDay && dry && w.temp >= 10 && w.temp <= 28;
}

/** "What should I do now?" — deterministic, instant, explainable. */
export function directives(args: {
  now: Date;
  tasks: Task[];
  events: CalEvent[];
  habits: Habit[];
  weather: Weather | null;
}): Directive[] {
  const { now, tasks, events, habits, weather } = args;
  const out: Directive[] = [];
  const today = dateKey(now);
  const h = now.getHours();
  const ranked = rankTasks(tasks, now);
  const top = ranked[0];
  const current = currentEvent(events, now);
  const next = nextEvent(events, now);
  const windows = freeWindows(events, now);
  const nowWindow = windows.find((w) => w.start.getTime() - now.getTime() < 10 * 60_000);
  const openHabits = habits.filter((x) => !x.log[today]);
  const overdue = ranked.filter((t) => t.dueDate && t.dueDate < today);

  if (current) {
    out.push({
      id: `in-${current.id}`,
      kicker: "In progress",
      lead: "You're in",
      emph: current.title,
      tail: ` until ${hhmm(new Date(current.end))}. Be fully there.`,
      score: 96,
    });
  }

  if (next) {
    const mins = Math.round((new Date(next.start).getTime() - now.getTime()) / 60_000);
    if (mins <= 20) {
      out.push({
        id: `prep-${next.id}`,
        kicker: `T–${mins} min`,
        lead: "Close the loops. Prepare for",
        emph: next.title,
        tail: next.location ? ` — ${next.location}.` : ".",
        score: 100 - mins,
      });
    }
  }

  if (overdue[0]) {
    out.push({
      id: `overdue-${overdue[0].id}`,
      kicker: "Overdue",
      lead: "Clear the debt first:",
      emph: overdue[0].title,
      tail: ".",
      action: { type: "focus", taskId: overdue[0].id, minutes: 25, label: "Focus 25" },
      score: 78,
    });
  }

  if (h >= 21 || h < 5) {
    const tomorrowFirst = rankTasks(tasks, new Date(now.getTime() + 86_400_000))[0];
    out.push({
      id: "wind-down",
      kicker: "Evening protocol",
      lead: "Wind down. Tomorrow opens with",
      emph: tomorrowFirst?.title ?? "a clean slate",
      tail: ".",
      score: 90,
    });
  }

  if (nowWindow && top && h < 21) {
    const until = nowWindow.end;
    const mins = Math.min(90, Math.floor(nowWindow.minutes / 5) * 5);
    out.push({
      id: `window-${top.id}`,
      kicker: `Open window · ${fmtMinutes(nowWindow.minutes)}`,
      lead: `You're clear until ${hhmm(until)}. Spend it on`,
      emph: top.title,
      tail: ".",
      action: { type: "focus", taskId: top.id, minutes: Math.max(25, Math.min(mins, 50)), label: `Focus ${Math.max(25, Math.min(mins, 50))}` },
      score: 82,
    });
  } else if (top && h < 21) {
    out.push({
      id: `quick-${top.id}`,
      kicker: "Between commitments",
      lead: "A short run at",
      emph: top.title,
      tail: " fits before your next block.",
      action: { type: "focus", taskId: top.id, minutes: 25, label: "Focus 25" },
      score: 64,
    });
  }

  const walk = openHabits.find((x) => x.glyph === "stride");
  if (walk && niceWeather(weather)) {
    out.push({
      id: `walk-${walk.id}`,
      kicker: `${Math.round(weather!.temp)}° · clear`,
      lead: "The weather is on your side. Take",
      emph: walk.name.toLowerCase(),
      tail: " now.",
      action: { type: "habit", habitId: walk.id, label: "Log it" },
      score: 74,
    });
  }

  const ritual = [...openHabits].sort((a, b) => habitStreak(b, now) - habitStreak(a, now))[0];
  if (ritual) {
    const streak = habitStreak(ritual, now);
    out.push({
      id: `ritual-${ritual.id}`,
      kicker: streak > 1 ? `${streak}-day streak at stake` : "Ritual",
      lead: "Nothing urgent for a moment — a good time for",
      emph: ritual.name.toLowerCase(),
      tail: ".",
      action: { type: "habit", habitId: ritual.id, label: "Log it" },
      score: 58 + Math.min(streak, 20),
    });
  }

  if (!ranked.length) {
    out.push({
      id: "clear",
      kicker: "Manifest clear",
      lead: "Nothing is asking for you.",
      emph: "Rest is productive too",
      tail: ".",
      score: 40,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}
