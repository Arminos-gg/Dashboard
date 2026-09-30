import type { Briefing, CalEvent, Habit, Task, Weather } from "./types";
import { dateKey, fmtMinutes, hhmm } from "./time";
import { eventsOn, freeWindows, theThree } from "./agenda";
import { habitStreak } from "./stats";
import { weatherLabel } from "./weather";

const numberWord = (n: number) =>
  ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][n] ?? String(n);

/** Deterministic briefing used when Claude is not configured or unreachable. */
export function localBriefing(args: {
  now: Date;
  tasks: Task[];
  events: CalEvent[];
  habits: Habit[];
  weather: Weather | null;
}): Briefing {
  const { now, tasks, events, habits, weather } = args;
  const key = dateKey(now);
  const three = theThree(tasks, now);
  const upcoming = eventsOn(events, key).filter((e) => new Date(e.end) > now);
  const windows = freeWindows(events, now);
  const best = [...windows].sort((a, b) => b.minutes - a.minutes)[0];
  const openHabits = habits.filter((h) => !h.log[key]);

  const headline =
    three.length === 0
      ? "A quiet manifest. Choose your own shape today."
      : `${numberWord(three.length)} thing${three.length === 1 ? "" : "s"} matter today.`;

  const p: string[] = [];
  if (upcoming.length) {
    const first = upcoming[0];
    p.push(
      `${upcoming.length === 1 ? "One commitment remains" : `${numberWord(upcoming.length)} commitments remain`} — next is ${first.title} at ${hhmm(new Date(first.start))}.` +
        (best ? ` The longest open stretch runs ${hhmm(best.start)}–${hhmm(best.end)} (${fmtMinutes(best.minutes)}); give it to ${three[0]?.title ?? "your deepest work"}.` : ""),
    );
  } else if (best) {
    p.push(`Your calendar is clear from ${hhmm(best.start)}. ${fmtMinutes(best.minutes)} of uninterrupted time — rare, spend it deliberately.`);
  }

  if (weather) {
    const label = weatherLabel(weather.code).toLowerCase();
    const rain = weather.precipProb >= 50;
    p.push(
      `${Math.round(weather.temp)}° and ${label}, peaking at ${Math.round(weather.hi)}°.` +
        (rain ? ` ${weather.precipProb}% chance of rain — keep outdoor plans flexible.` : " Good conditions to get outside at some point."),
    );
  }

  if (openHabits.length) {
    const guard = [...openHabits].sort((a, b) => habitStreak(b, now) - habitStreak(a, now))[0];
    const s = habitStreak(guard, now);
    p.push(
      `${openHabits.length} ritual${openHabits.length === 1 ? "" : "s"} still open.` +
        (s > 2 ? ` ${guard.name} carries a ${s}-day streak — protect it.` : ""),
    );
  } else if (habits.length) {
    p.push("Every ritual is logged. The rest of the day is a bonus.");
  }

  return {
    date: key,
    generatedAt: now.toISOString(),
    source: "local",
    headline,
    paragraphs: p.slice(0, 3),
    focusWindow: best ? { start: hhmm(best.start), end: hhmm(best.end), reason: "Longest uninterrupted stretch left today" } : null,
    nextMove: three[0] ? `Start with ${three[0].title}.` : "Pick one small thing and finish it.",
  };
}
