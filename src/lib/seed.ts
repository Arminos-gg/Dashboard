import type { ActivityKey, CalEvent, DayStat, Habit, Task } from "./types";
import { addDays, atTime, dateKey, uid } from "./time";

export const ACTIVITIES: { key: ActivityKey; label: string }[] = [
  { key: "deep", label: "Deep work" },
  { key: "meetings", label: "Meetings" },
  { key: "learning", label: "Learning" },
  { key: "movement", label: "Movement" },
  { key: "admin", label: "Admin" },
  { key: "leisure", label: "Leisure" },
];

/** Small deterministic PRNG so the demo universe is stable per install. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const HISTORY_DAYS = 26 * 7;

export function seedUniverse(now = new Date()) {
  const rnd = mulberry32(Math.floor(now.getTime() / 86_400_000) * 7919);
  const range = (a: number, b: number) => a + rnd() * (b - a);
  const today = dateKey(now);
  const tomorrow = dateKey(addDays(now, 1));
  const inDays = (n: number) => dateKey(addDays(now, n));

  // ── history ──────────────────────────────────────────────
  const history: Record<string, DayStat> = {};
  for (let i = HISTORY_DAYS; i >= 1; i--) {
    const d = addDays(now, -i);
    const key = dateKey(d);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const trend = 1 - i / HISTORY_DAYS; // gets better over time
    const wave = Math.sin(i / 9) * 0.18;
    const vigor = Math.max(0.15, 0.55 + trend * 0.35 + wave + range(-0.2, 0.2));
    const deep = weekend ? range(0, 90) * vigor : range(90, 320) * vigor;
    history[key] = {
      date: key,
      completed: Math.round(weekend ? range(0, 4) * vigor : range(2, 10) * vigor),
      focusMin: Math.round(deep * range(0.7, 1)),
      activities: {
        deep: Math.round(deep),
        meetings: Math.round(weekend ? range(0, 20) : range(40, 230)),
        learning: Math.round(range(10, 80) * vigor),
        movement: Math.round(range(0, 1) > 0.35 ? range(25, 95) : 0),
        admin: Math.round(weekend ? range(0, 40) : range(20, 90)),
        leisure: Math.round(weekend ? range(160, 420) : range(40, 200)),
      },
    };
  }

  // ── habits ───────────────────────────────────────────────
  const habitDefs: { name: string; glyph: Habit["glyph"]; p: number; streak: number; doneToday: boolean }[] = [
    { name: "Meditate", glyph: "breath", p: 0.78, streak: 17, doneToday: true },
    { name: "Read 20 pages", glyph: "page", p: 0.7, streak: 12, doneToday: false },
    { name: "Hydrate 2L", glyph: "drop", p: 0.85, streak: 23, doneToday: false },
    { name: "Walk 8k", glyph: "stride", p: 0.62, streak: 4, doneToday: false },
    { name: "Screens off 23:00", glyph: "moon", p: 0.5, streak: 2, doneToday: false },
  ];
  const habits: Habit[] = habitDefs.map((h) => {
    const log: Record<string, number> = {};
    for (let i = HISTORY_DAYS; i >= 1; i--) {
      const key = dateKey(addDays(now, -i));
      if (i <= h.streak || rnd() < h.p) log[key] = 1;
    }
    // make sure the streak is broken right before it started
    delete log[dateKey(addDays(now, -(h.streak + 1)))];
    if (h.doneToday) log[today] = 1;
    return { id: uid(), name: h.name, glyph: h.glyph, log };
  });

  // ── calendar ─────────────────────────────────────────────
  const ev = (day: string, s: string, e: string, title: string, activity: ActivityKey, location?: string): CalEvent => ({
    id: uid(),
    title,
    start: atTime(day, s).toISOString(),
    end: atTime(day, e).toISOString(),
    activity,
    location,
  });
  const events: CalEvent[] = [
    ev(today, "09:30", "10:00", "Studio standup", "meetings", "Room 4"),
    ev(today, "11:00", "12:15", "Design review — Atlas", "meetings", "North wing"),
    ev(today, "13:00", "14:00", "Lunch with Mara", "leisure", "Café Sperl"),
    ev(today, "16:30", "17:30", "Strength session", "movement", "Studio gym"),
    ev(today, "19:30", "21:30", "Dinner — Lena & Jonas", "leisure", "Mochi"),
    ev(tomorrow, "10:00", "10:45", "Dentist", "admin", "Dr. Weiss"),
    ev(tomorrow, "15:00", "16:00", "Investor call", "meetings"),
  ];

  // ── tasks ────────────────────────────────────────────────
  const created = new Date(now.getTime() - 3 * 3600_000).toISOString();
  let order = 0;
  const t = (title: string, priority: Task["priority"], tags: string[], dueDate?: string, dueTime?: string, done = false): Task => ({
    id: uid(),
    title,
    priority,
    tags,
    dueDate,
    dueTime,
    done,
    doneAt: done ? new Date(now.getTime() - range(1, 3) * 3600_000).toISOString() : undefined,
    createdAt: created,
    order: order++,
  });
  const tasks: Task[] = [
    t("Finalise the Q4 investor memo", 3, ["work"], today, "15:00"),
    t("Call Alex about the lease", 3, ["comms"], today),
    t("Book flights to Lisbon", 2, ["travel"], today),
    t("Reply to Studio Nord", 2, ["comms"], today),
    t("Review Mara's portfolio draft", 2, ["work"], tomorrow),
    t("Renew passport", 2, ["admin"], inDays(5)),
    t("Plan the Sunday long run", 1, ["health"], inDays(2)),
    t("Buy film for the Leica", 1, ["errands"]),
    t("Inbox to zero", 1, ["admin"], today, undefined, true),
    t("Water the olive tree", 1, ["home"], today, undefined, true),
  ];

  return { history, habits, events, tasks };
}
