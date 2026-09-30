"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  Briefing,
  CalEvent,
  CaptureResult,
  DayStat,
  FocusSession,
  FocusState,
  GeoLocation,
  Habit,
  HabitGlyph,
  LogLine,
  MoodKey,
  Priority,
  SoundKey,
  Task,
  Weather,
  Prefs,
} from "./types";
import { seedUniverse } from "./seed";
import { addDays, atTime, dateKey, fromDateKey, relativeDay, uid } from "./time";
import { liveDayStat } from "./stats";

export interface PersistedLife {
  profileName: string;
  tasks: Task[];
  events: CalEvent[];
  habits: Habit[];
  history: Record<string, DayStat>;
  sessions: FocusSession[];
  focus: FocusState;
  moodOverride: MoodKey | null;
  soundscape: SoundKey;
  volume: number;
  sfx: boolean;
  briefing: Briefing | null;
  location: GeoLocation | null;
  prefs: Prefs;
  lastActive: string;
  updatedAt: number;
}

type Snapshot = Pick<PersistedLife, "tasks" | "events" | "habits">;
export type SyncStatus = "off" | "connecting" | "cloud" | "error";

interface Ephemeral {
  log: LogLine[];
  syncStatus: SyncStatus;
  ai: { online: boolean; model: string | null } | null;
  weather: Weather | null;
  weatherFailed: boolean;
  captureOpen: boolean;
  shortcutsOpen: boolean;
  labOpen: boolean;
  plannerOpen: boolean;
  monitor: boolean;
  editLayout: boolean;
  highlightId: string | null;
  briefingBusy: boolean;
  undoStack: Snapshot[];
}

interface Actions {
  addTask: (t: Partial<Task> & { title: string }) => string;
  toggleTask: (id: string) => boolean;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  reorderOpen: (ids: string[]) => void;
  addEvent: (e: Omit<CalEvent, "id">) => string;
  removeEvent: (id: string) => void;
  updateEvent: (id: string, patch: Partial<CalEvent>) => void;
  toggleHabit: (id: string, day?: string) => boolean;
  addHabit: (name: string, glyph?: HabitGlyph) => string;
  removeHabit: (id: string) => void;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  commitCapture: (r: CaptureResult) => { id: string; kind: CaptureResult["kind"]; label: string };
  setMoodOverride: (m: MoodKey | null) => void;
  startFocus: (minutes: number, taskId?: string, intention?: string) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  extendFocus: (minutes: number) => void;
  endFocus: (completed: boolean) => number;
  closeFocus: () => void;
  setSoundscape: (s: SoundKey) => void;
  setVolume: (v: number) => void;
  setSfx: (on: boolean) => void;
  setBriefing: (b: Briefing) => void;
  setLocation: (l: GeoLocation) => void;
  setWeather: (w: Weather | null, failed?: boolean) => void;
  setProfileName: (n: string) => void;
  pushLog: (text: string, tone?: LogLine["tone"]) => void;
  undo: () => boolean;
  ensureToday: (now?: Date) => void;
  resetDemo: () => void;
  setPrefs: (patch: Partial<Prefs>) => void;
  clearAll: () => void;
  applyRemote: (p: Partial<PersistedLife>) => void;
  setUi: (
    patch: Partial<Pick<Ephemeral, "captureOpen" | "shortcutsOpen" | "labOpen" | "plannerOpen" | "monitor" | "editLayout" | "highlightId" | "syncStatus" | "ai" | "briefingBusy">>,
  ) => void;
}

export type LifeStore = PersistedLife & Ephemeral & Actions;

export const DEFAULT_PREFS: Prefs = {
  field: true,
  particles: true,
  rings: true,
  cursor: true,
  intro: true,
  echo: true,
  calm: false,
  rails: true,
  log: true,
  sectionNow: true,
  sectionToday: true,
  sectionTelemetry: true,
  sectionFocus: true,
  detail: false,
  hidden: [],
  monitorDim: 0,
  monitorSeconds: true,
  monitorWake: false,
};

const idleFocus: FocusState = { active: false, runningSince: null, elapsed: 0, durationMs: 25 * 60_000 };

function freshUniverse(): PersistedLife {
  const seed = seedUniverse();
  return {
    profileName: "",
    ...seed,
    sessions: [],
    focus: idleFocus,
    moodOverride: null,
    soundscape: "orbit",
    volume: 0.6,
    sfx: true,
    briefing: null,
    location: null,
    prefs: DEFAULT_PREFS,
    lastActive: dateKey(),
    updatedAt: Date.now(),
  };
}

export const PERSIST_KEYS: (keyof PersistedLife)[] = [
  "profileName", "tasks", "events", "habits", "history", "sessions", "focus", "moodOverride",
  "soundscape", "volume", "sfx", "briefing", "location", "prefs", "lastActive", "updatedAt",
];

export function pickPersisted(s: LifeStore): PersistedLife {
  const out = {} as Record<string, unknown>;
  for (const k of PERSIST_KEYS) out[k] = s[k];
  return out as unknown as PersistedLife;
}

export function focusElapsed(f: FocusState, now = Date.now()): number {
  return f.elapsed + (f.runningSince ? now - f.runningSince : 0);
}

const PRIORITY_MAP: Record<CaptureResult["priority"], Priority> = { high: 3, normal: 2, low: 1 };

function guessGlyph(name: string): HabitGlyph {
  const n = name.toLowerCase();
  if (/(medit|breath|yoga|calm)/.test(n)) return "breath";
  if (/(read|book|page|write|journal)/.test(n)) return "page";
  if (/(water|hydrat|drink)/.test(n)) return "drop";
  if (/(walk|run|step|gym|workout|stretch|swim|bike)/.test(n)) return "stride";
  if (/(sleep|bed|screen|night|phone)/.test(n)) return "moon";
  return "spark";
}

export const useLife = create<LifeStore>()(
  persist(
    (set, get) => {
      const snap = (): Snapshot => {
        const s = get();
        return { tasks: s.tasks, events: s.events, habits: s.habits };
      };
      const mutate = (fn: (s: LifeStore) => Partial<LifeStore>, undoable = true) =>
        set((s) => ({
          ...fn(s),
          ...(undoable ? { undoStack: [...s.undoStack.slice(-19), snap()] } : {}),
          updatedAt: Date.now(),
        }));

      return {
        ...freshUniverse(),
        log: [],
        syncStatus: "off",
        ai: null,
        weather: null,
        weatherFailed: false,
        captureOpen: false,
        shortcutsOpen: false,
        labOpen: false,
        plannerOpen: false,
        monitor: false,
        editLayout: false,
        highlightId: null,
        briefingBusy: false,
        undoStack: [],

        addTask: (t) => {
          const id = uid();
          mutate((s) => ({
            tasks: [
              {
                id,
                title: t.title,
                notes: t.notes,
                dueDate: t.dueDate,
                dueTime: t.dueTime,
                priority: t.priority ?? 2,
                tags: t.tags ?? [],
                done: false,
                createdAt: new Date().toISOString(),
                order: Math.min(0, ...s.tasks.map((x) => x.order)) - 1,
              },
              ...s.tasks,
            ],
          }));
          return id;
        },

        toggleTask: (id) => {
          let nowDone = false;
          mutate((s) => ({
            tasks: s.tasks.map((t) => {
              if (t.id !== id) return t;
              nowDone = !t.done;
              return { ...t, done: nowDone, doneAt: nowDone ? new Date().toISOString() : undefined };
            }),
          }));
          return nowDone;
        },

        updateTask: (id, patch) =>
          mutate((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

        removeTask: (id) => mutate((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

        reorderOpen: (ids) =>
          mutate(
            (s) => ({
              tasks: s.tasks.map((t) => {
                const i = ids.indexOf(t.id);
                return i === -1 ? t : { ...t, order: i };
              }),
            }),
            false,
          ),

        addEvent: (e) => {
          const id = uid();
          mutate((s) => ({
            events: [...s.events, { ...e, id }].sort((a, b) => a.start.localeCompare(b.start)),
          }));
          return id;
        },

        removeEvent: (id) => mutate((s) => ({ events: s.events.filter((e) => e.id !== id) })),

        updateEvent: (id, patch) =>
          mutate((s) => ({
            events: s.events
              .map((e) => (e.id === id ? { ...e, ...patch } : e))
              .sort((a, b) => a.start.localeCompare(b.start)),
          })),

        toggleHabit: (id, day = dateKey()) => {
          let on = false;
          mutate((s) => ({
            habits: s.habits.map((h) => {
              if (h.id !== id) return h;
              const log = { ...h.log };
              on = !log[day];
              if (on) log[day] = 1;
              else delete log[day];
              return { ...h, log };
            }),
          }));
          return on;
        },

        addHabit: (name, glyph) => {
          const id = uid();
          mutate((s) => ({ habits: [...s.habits, { id, name, glyph: glyph ?? guessGlyph(name), log: {} }] }));
          return id;
        },

        removeHabit: (id) => mutate((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

        updateHabit: (id, patch) =>
          mutate((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),

        commitCapture: (r) => {
          const api = get();
          if (r.kind === "habit") {
            const id = api.addHabit(r.title);
            return { id, kind: "habit", label: "Daily ritual" };
          }
          if (r.kind === "event" && r.date) {
            const time = r.time ?? "09:00";
            const start = atTime(r.date, time);
            const end = new Date(start.getTime() + (r.durationMinutes ?? 60) * 60_000);
            const tags = r.tags.map((t) => t.toLowerCase());
            const activity = tags.some((t) => /(gym|run|health|sport|walk)/.test(t))
              ? "movement"
              : tags.some((t) => /(learn|study|class|read)/.test(t))
                ? "learning"
                : tags.some((t) => /(social|dinner|lunch|family|friends|leisure)/.test(t))
                  ? "leisure"
                  : "meetings";
            const id = api.addEvent({ title: r.title, start: start.toISOString(), end: end.toISOString(), activity });
            return { id, kind: "event", label: `${relativeDay(r.date)} · ${time}` };
          }
          const id = api.addTask({
            title: r.title,
            dueDate: r.date ?? undefined,
            dueTime: r.time ?? undefined,
            priority: PRIORITY_MAP[r.priority],
            tags: r.tags,
            notes: r.notes ?? undefined,
          });
          const when = r.date ? `${relativeDay(r.date)}${r.time ? ` · ${r.time}` : ""}` : "Unscheduled";
          return { id, kind: "task", label: when };
        },

        setMoodOverride: (m) => set({ moodOverride: m, updatedAt: Date.now() }),

        startFocus: (minutes, taskId, intention) =>
          set({
            focus: { active: true, runningSince: Date.now(), elapsed: 0, durationMs: minutes * 60_000, taskId, intention },
            updatedAt: Date.now(),
          }),

        pauseFocus: () =>
          set((s) =>
            s.focus.runningSince
              ? { focus: { ...s.focus, elapsed: focusElapsed(s.focus), runningSince: null }, updatedAt: Date.now() }
              : {},
          ),

        resumeFocus: () =>
          set((s) =>
            s.focus.active && !s.focus.runningSince
              ? { focus: { ...s.focus, runningSince: Date.now() }, updatedAt: Date.now() }
              : {},
          ),

        extendFocus: (minutes) =>
          set((s) => ({ focus: { ...s.focus, durationMs: s.focus.durationMs + minutes * 60_000 }, updatedAt: Date.now() })),

        endFocus: (completed) => {
          const s = get();
          const ms = Math.min(focusElapsed(s.focus), s.focus.durationMs);
          const minutes = Math.round(ms / 60_000);
          const sessions =
            minutes >= 1
              ? [...s.sessions, { id: uid(), start: new Date(Date.now() - ms).toISOString(), minutes, taskId: s.focus.taskId }]
              : s.sessions;
          set({
            focus: completed
              ? { ...s.focus, runningSince: null, elapsed: ms, completed: minutes }
              : { ...idleFocus, durationMs: s.focus.durationMs },
            sessions,
            updatedAt: Date.now(),
          });
          if (minutes >= 1) get().pushLog(`Focus logged · ${minutes} min`, "accent");
          return minutes;
        },

        closeFocus: () =>
          set((s) => ({ focus: { ...idleFocus, durationMs: s.focus.durationMs }, updatedAt: Date.now() })),

        setSoundscape: (soundscape) => set({ soundscape, updatedAt: Date.now() }),
        setVolume: (volume) => set({ volume, updatedAt: Date.now() }),
        setSfx: (sfx) => set({ sfx, updatedAt: Date.now() }),
        setBriefing: (briefing) => set({ briefing, updatedAt: Date.now() }),
        setLocation: (location) => set({ location, updatedAt: Date.now() }),
        setWeather: (weather, failed = false) => set({ weather, weatherFailed: failed }),
        setProfileName: (profileName) => set({ profileName, updatedAt: Date.now() }),

        pushLog: (text, tone) =>
          set((s) => ({ log: [...s.log.slice(-5), { id: uid(), at: Date.now(), text, tone }] })),

        undo: () => {
          const s = get();
          const prev = s.undoStack[s.undoStack.length - 1];
          if (!prev) return false;
          set({ ...prev, undoStack: s.undoStack.slice(0, -1), updatedAt: Date.now() });
          return true;
        },

        ensureToday: (now = new Date()) => {
          const s = get();
          const today = dateKey(now);
          if (s.lastActive >= today) return;
          const history = { ...s.history };
          let cursor = fromDateKey(s.lastActive);
          // finalize every day we missed, up to (not including) today
          for (let i = 0; i < 400 && dateKey(cursor) < today; i++) {
            const key = dateKey(cursor);
            history[key] = liveDayStat(key, s.tasks, s.sessions, s.events, history[key]);
            cursor = addDays(cursor, 1);
          }
          set({ history, lastActive: today, briefing: null, updatedAt: Date.now() });
        },

        // display preferences are settings, not data: both resets keep them
        resetDemo: () => set((s) => ({ ...freshUniverse(), prefs: s.prefs, undoStack: [], log: [] })),

        setPrefs: (patch) => set((s) => ({ prefs: { ...DEFAULT_PREFS, ...s.prefs, ...patch }, updatedAt: Date.now() })),

        /** Wipes every record — tasks, events, habits, history, sessions, briefing and settings. */
        clearAll: () =>
          set((s) => ({
            ...freshUniverse(),
            tasks: [],
            events: [],
            habits: [],
            history: {},
            sessions: [],
            briefing: null,
            undoStack: [],
            log: [],
            highlightId: null,
            prefs: s.prefs,
          })),

        applyRemote: (p) => set({ ...p }),

        setUi: (patch) => set(patch),
      };
    },
    {
      name: "life-os",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => pickPersisted(s),
    },
  ),
);
