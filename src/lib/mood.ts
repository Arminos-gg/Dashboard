import type { CalEvent, MoodKey, Task } from "./types";
import { dateKey } from "./time";

export interface Mood {
  key: MoodKey;
  label: string;
  line: string;
  /** deep, body, highlight — fed to the field shader */
  colors: [string, string, string];
  accent: string;
  /** 0..1 — drives particle speed, turbulence and UI tempo */
  energy: number;
}

export const MOODS: Record<MoodKey, Mood> = {
  drift: {
    key: "drift",
    label: "Drift",
    line: "Light manifest. Wide margins.",
    colors: ["#0d2420", "#46705c", "#cfe3c1"],
    accent: "#bfe0a8",
    energy: 0.28,
  },
  flow: {
    key: "flow",
    label: "Flow",
    line: "Steady cadence. Protect the momentum.",
    colors: ["#120f33", "#5847d8", "#c4bbff"],
    accent: "#ac9fff",
    energy: 0.5,
  },
  surge: {
    key: "surge",
    label: "Surge",
    line: "Heavy manifest. Move with precision.",
    colors: ["#2a0708", "#ff4a24", "#ffc27a"],
    accent: "#ff7043",
    energy: 0.95,
  },
  focus: {
    key: "focus",
    label: "Focus",
    line: "One thing. Everything else can wait.",
    colors: ["#021a20", "#0c8f8f", "#a6f5ea"],
    accent: "#62e8d6",
    energy: 0.12,
  },
  nocturne: {
    key: "nocturne",
    label: "Nocturne",
    line: "The day is closing. Land softly.",
    colors: ["#070a22", "#27348a", "#9aabff"],
    accent: "#9aabff",
    energy: 0.2,
  },
};

export const MOOD_ORDER: MoodKey[] = ["drift", "flow", "surge", "focus", "nocturne"];

export interface Load {
  score: number;
  openToday: number;
  highOpen: number;
  eventsLeft: number;
  overdue: number;
}

export function computeLoad(tasks: Task[], events: CalEvent[], now: Date): Load {
  const today = dateKey(now);
  let score = 0;
  let openToday = 0;
  let highOpen = 0;
  let overdue = 0;
  for (const t of tasks) {
    if (t.done) continue;
    const isToday = t.dueDate === today;
    const isOverdue = !!t.dueDate && t.dueDate < today;
    if (isToday || isOverdue) {
      openToday++;
      score += t.priority === 3 ? 3 : t.priority === 2 ? 2 : 1;
      if (t.priority === 3) highOpen++;
    }
    if (isOverdue) {
      overdue++;
      score += 2;
    }
  }
  let eventsLeft = 0;
  for (const e of events) {
    const end = new Date(e.end);
    if (dateKey(end) === today && end > now) {
      eventsLeft++;
      score += 1.5;
    }
  }
  return { score, openToday, highOpen, eventsLeft, overdue };
}

export function deriveMood(load: Load, focusActive: boolean, now: Date): MoodKey {
  if (focusActive) return "focus";
  const h = now.getHours();
  const late = h >= 22 || h < 5;
  if (late && load.score < 14) return "nocturne";
  if (load.score >= 14 || load.highOpen >= 3) return "surge";
  if (load.score >= 6) return "flow";
  return "drift";
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
