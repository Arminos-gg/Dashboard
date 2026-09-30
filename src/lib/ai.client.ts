"use client";

import type { Briefing, CaptureResult } from "./types";
import { parseLocal } from "./parse-local";
import { localBriefing } from "./briefing-local";
import { useLife } from "./store";
import { dateKey, hhmm, pad, weekday } from "./time";
import { eventsOn } from "./agenda";
import { habitStreak } from "./stats";
import { weatherLabel } from "./weather";
import { MOODS } from "./mood";

function localNowString(d = new Date()) {
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())} (${weekday(d)})`;
}

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};

async function postJson<T>(url: string, body: unknown, timeoutMs: number): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkAi() {
  try {
    const res = await fetch("/api/status", { cache: "no-store" });
    const j = await res.json();
    useLife.getState().setUi({ ai: j.ai });
  } catch {
    useLife.getState().setUi({ ai: { online: false, model: null } });
  }
}

/** Claude first (when configured), local parser as an instant fallback. */
export async function interpret(text: string): Promise<CaptureResult> {
  const ai = useLife.getState().ai;
  if (ai?.online) {
    const r = await postJson<{ result: CaptureResult }>(
      "/api/capture",
      { text, localNow: localNowString(), timeZone: tz() },
      15_000,
    );
    if (r?.result) return r.result;
  }
  return parseLocal(text);
}

export async function composeBriefing(moodKey: string): Promise<Briefing> {
  const s = useLife.getState();
  const now = new Date();
  const today = dateKey(now);
  const fallback = localBriefing({ now, tasks: s.tasks, events: s.events, habits: s.habits, weather: s.weather });
  if (!s.ai?.online) return fallback;

  const snapshot = {
    localNow: localNowString(now),
    timeZone: tz(),
    name: s.profileName || undefined,
    mood: MOODS[moodKey as keyof typeof MOODS]?.label ?? moodKey,
    tasks: s.tasks
      .filter((t) => !t.done)
      .slice(0, 30)
      .map((t) => ({
        title: t.title,
        due: t.dueDate ? `${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ""}` : null,
        priority: t.priority === 3 ? ("high" as const) : t.priority === 2 ? ("normal" as const) : ("low" as const),
        tags: t.tags.slice(0, 4),
      })),
    doneToday: s.tasks.filter((t) => t.doneAt && dateKey(new Date(t.doneAt)) === today).map((t) => t.title).slice(0, 30),
    events: eventsOn(s.events, today)
      .slice(0, 20)
      .map((e) => ({ title: e.title, start: hhmm(new Date(e.start)), end: hhmm(new Date(e.end)), location: e.location ?? null })),
    habits: s.habits.slice(0, 12).map((h) => ({ name: h.name, doneToday: !!h.log[today], streak: habitStreak(h, now) })),
    weather: s.weather
      ? {
          summary: weatherLabel(s.weather.code),
          temp: Math.round(s.weather.temp),
          hi: Math.round(s.weather.hi),
          lo: Math.round(s.weather.lo),
          precipProb: s.weather.precipProb,
          location: s.location?.label ?? "",
        }
      : null,
    focusMinutesToday: s.sessions.filter((x) => dateKey(new Date(x.start)) === today).reduce((a, x) => a + x.minutes, 0),
  };

  const r = await postJson<{ briefing: Omit<Briefing, "date" | "generatedAt" | "source"> }>("/api/briefing", snapshot, 45_000);
  if (!r?.briefing) return fallback;
  return { ...r.briefing, date: today, generatedAt: now.toISOString(), source: "claude" };
}
