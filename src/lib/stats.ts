import type { ActivityKey, CalEvent, DayStat, FocusSession, Habit, Task } from "./types";
import { addDays, dateKey } from "./time";

const emptyActivities = (): Record<ActivityKey, number> => ({
  deep: 0,
  meetings: 0,
  learning: 0,
  movement: 0,
  admin: 0,
  leisure: 0,
});

/** Stats for a day computed from live data (tasks, sessions, events), merged over an optional baseline. */
export function liveDayStat(
  key: string,
  tasks: Task[],
  sessions: FocusSession[],
  events: CalEvent[],
  base?: DayStat,
  now: Date = new Date(),
): DayStat {
  const completed = tasks.filter((t) => t.doneAt && dateKey(new Date(t.doneAt)) === key).length;
  const focusMin = sessions
    .filter((s) => dateKey(new Date(s.start)) === key)
    .reduce((a, s) => a + s.minutes, 0);
  const activities = emptyActivities();
  for (const e of events) {
    const start = new Date(e.start);
    if (dateKey(start) !== key || start > now) continue;
    const end = new Date(Math.min(new Date(e.end).getTime(), now.getTime()));
    activities[e.activity] += Math.max(0, (end.getTime() - start.getTime()) / 60_000);
  }
  activities.deep += focusMin;
  if (!base) return { date: key, completed, focusMin, activities };
  const merged = { ...base.activities };
  for (const k of Object.keys(activities) as ActivityKey[]) merged[k] = Math.max(merged[k], activities[k]);
  return {
    date: key,
    completed: Math.max(base.completed, completed),
    focusMin: Math.max(base.focusMin, focusMin),
    activities: merged,
  };
}

export function habitStreak(h: Habit, now: Date = new Date()): number {
  let d = new Date(now);
  // today counts if done; otherwise the streak is still alive from yesterday
  if (!h.log[dateKey(d)]) d = addDays(d, -1);
  let n = 0;
  while (h.log[dateKey(d)] && n < 2000) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function habitsDoneOn(habits: Habit[], key: string): number {
  return habits.reduce((a, h) => a + (h.log[key] ? 1 : 0), 0);
}

/** 0..1 composite of tasks, rituals and depth for one day. */
export function dayScore(stat: DayStat | undefined, habits: Habit[], key: string): number {
  const c = stat ? Math.min(stat.completed / 6, 1) : 0;
  const hb = habits.length ? habitsDoneOn(habits, key) / habits.length : 0;
  const f = stat ? Math.min(stat.focusMin / 180, 1) : 0;
  return 0.45 * c + 0.35 * hb + 0.2 * f;
}

export interface Series {
  date: string;
  value: number;
}

export type Metric = "completed" | "focus" | "score";

export function buildDays(
  days: number,
  history: Record<string, DayStat>,
  todayStat: DayStat,
  now: Date = new Date(),
): DayStat[] {
  const out: DayStat[] = [];
  for (let i = days - 1; i >= 1; i--) {
    const key = dateKey(addDays(now, -i));
    out.push(history[key] ?? { date: key, completed: 0, focusMin: 0, activities: emptyActivities() });
  }
  out.push(todayStat);
  return out;
}

export function metricValue(d: DayStat, metric: Metric, habits: Habit[]): number {
  if (metric === "completed") return d.completed;
  if (metric === "focus") return d.focusMin / 60;
  return dayScore(d, habits, d.date) * 100;
}

/** Days in a row (ending today, or yesterday if today is still open) scoring ≥ 0.5. */
export function momentumStreak(
  history: Record<string, DayStat>,
  todayStat: DayStat,
  habits: Habit[],
  now: Date = new Date(),
): number {
  const today = dateKey(now);
  let n = dayScore(todayStat, habits, today) >= 0.5 ? 1 : 0;
  let d = addDays(now, -1);
  for (let i = 0; i < 2000; i++) {
    const key = dateKey(d);
    const st = history[key];
    if (!st || dayScore(st, habits, key) < 0.5) break;
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function totalActivities(days: DayStat[]): Record<ActivityKey, number> {
  const t = emptyActivities();
  for (const d of days) for (const k of Object.keys(t) as ActivityKey[]) t[k] += d.activities[k] ?? 0;
  return t;
}
