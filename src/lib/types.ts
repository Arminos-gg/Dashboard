export type Priority = 1 | 2 | 3; // 3 = high

export type ActivityKey =
  | "deep"
  | "meetings"
  | "learning"
  | "movement"
  | "admin"
  | "leisure";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  /** Local date key YYYY-MM-DD */
  dueDate?: string;
  /** Local time HH:MM (24h) */
  dueTime?: string;
  priority: Priority;
  tags: string[];
  done: boolean;
  doneAt?: string;
  createdAt: string;
  order: number;
}

export interface CalEvent {
  id: string;
  title: string;
  /** ISO datetime */
  start: string;
  /** ISO datetime */
  end: string;
  location?: string;
  activity: ActivityKey;
}

export interface Habit {
  id: string;
  name: string;
  glyph: HabitGlyph;
  /** date key -> completions */
  log: Record<string, number>;
}

export type HabitGlyph = "breath" | "page" | "drop" | "stride" | "moon" | "spark";

export interface DayStat {
  date: string;
  completed: number;
  focusMin: number;
  activities: Record<ActivityKey, number>;
}

export interface FocusSession {
  id: string;
  start: string;
  minutes: number;
  taskId?: string;
}

export interface FocusState {
  active: boolean;
  /** epoch ms when the current run segment started (null when paused) */
  runningSince: number | null;
  /** ms accumulated across previous run segments */
  elapsed: number;
  durationMs: number;
  taskId?: string;
  intention?: string;
  /** set when a session ran to completion; the chamber shows a closing view until dismissed */
  completed?: number;
}

export type SoundKey = "rain" | "drone" | "brown" | "orbit";

export type MoodKey = "drift" | "flow" | "surge" | "focus" | "nocturne";

export interface Briefing {
  date: string;
  generatedAt: string;
  source: "claude" | "local";
  headline: string;
  paragraphs: string[];
  focusWindow: { start: string; end: string; reason: string } | null;
  nextMove: string;
}

export interface Weather {
  fetchedAt: number;
  temp: number;
  feels: number;
  code: number;
  isDay: boolean;
  wind: number;
  humidity: number;
  hi: number;
  lo: number;
  precipProb: number;
  sunrise: string;
  sunset: string;
  hourly: { time: string; temp: number; precip: number }[];
}

export interface GeoLocation {
  lat: number;
  lon: number;
  label: string;
  source: "tz" | "geo";
}

export interface LogLine {
  id: string;
  at: number;
  text: string;
  tone?: "accent" | "muted";
}

/** Normalised result of turning free text into a life item. */
export interface CaptureResult {
  kind: "task" | "event" | "habit";
  title: string;
  date: string | null;
  time: string | null;
  durationMinutes: number | null;
  priority: "high" | "normal" | "low";
  tags: string[];
  notes: string | null;
  source: "claude" | "local";
}

/** Display preferences — which effects, HUD pieces and sections are shown. */
export interface Prefs {
  field: boolean;
  particles: boolean;
  rings: boolean;
  cursor: boolean;
  intro: boolean;
  echo: boolean;
  calm: boolean;
  rails: boolean;
  log: boolean;
  sectionNow: boolean;
  sectionToday: boolean;
  sectionTelemetry: boolean;
  sectionFocus: boolean;
  /** extra numbers and labels; off = the minimal default */
  detail: boolean;
  /** element ids removed with the click-to-hide layout editor */
  hidden: string[];
  /** monitor mode */
  monitorDim: 0 | 1 | 2;
  monitorSeconds: boolean;
  monitorWake: boolean;
  /** the lunch countdown (older saves may lack it — read through useLunch) */
  lunch?: LunchPrefs;
}

export interface LunchPrefs {
  enabled: boolean;
  /** "HH:MM" */
  time: string;
  minutes: number;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  name: string;
  sound: boolean;
  tabTitle: boolean;
  hud: boolean;
  /** what's for lunch; only shown on menuDate */
  menu: string;
  menuDate: string;
}
