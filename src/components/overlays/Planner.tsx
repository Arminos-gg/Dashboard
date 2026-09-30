"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { useLife } from "@/lib/store";
import { interpret } from "@/lib/ai.client";
import { parseLocal } from "@/lib/parse-local";
import { clearAllData, exportData, importData, resetDemoData } from "@/lib/data-actions";
import { ACTIVITIES } from "@/lib/seed";
import { habitStreak } from "@/lib/stats";
import { addDays, dateKey, fromDateKey, hhmm, pad, relativeDay } from "@/lib/time";
import { audio } from "@/lib/audio";
import { Glyph } from "@/components/ui/Glyph";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { TimeField } from "@/components/ui/TimeField";
import type { ActivityKey, CalEvent, Habit, HabitGlyph, Priority, Task } from "@/lib/types";

type Tab = "tasks" | "events" | "habits" | "data";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 3, label: "High" },
  { value: 2, label: "Normal" },
  { value: 1, label: "Low" },
];

const GLYPHS: { value: HabitGlyph; label: string }[] = [
  { value: "breath", label: "Mind" },
  { value: "page", label: "Read / write" },
  { value: "drop", label: "Water" },
  { value: "stride", label: "Move" },
  { value: "moon", label: "Sleep" },
  { value: "spark", label: "Other" },
];

const localIso = (day: string, time: string) => {
  const d = fromDateKey(day);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
};

function Label({ children }: { children: ReactNode }) {
  return <span className="mono mb-1.5 block text-faint">{children}</span>;
}

function AddButton({ children = "Add", className = "h-[42px]" }: { children?: ReactNode; className?: string }) {
  return (
    <button type="submit" className={`mono flex shrink-0 ${className} items-center justify-center gap-2 bg-[var(--accent)] px-5 text-[#0a0a0a] transition-opacity hover:opacity-85`}>
      <Glyph name="plus" size={14} strokeWidth={1.8} /> {children}
    </button>
  );
}

function IconButton({ label, onClick, name }: { label: string; onClick: () => void; name: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="grid h-9 w-9 shrink-0 place-items-center text-faint transition-colors hover:text-ink">
      <Glyph name={name} size={15} />
    </button>
  );
}

/** A text input that edits a record on blur / Enter, so typing doesn't spam the undo history. */
function CommitInput({ value, onCommit, className = "", placeholder, ariaLabel }: { value: string; onCommit: (v: string) => void; className?: string; placeholder?: string; ariaLabel: string }) {
  const [draft, setDraft] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setDraft(value);
  }
  const commit = () => {
    const v = draft.trim();
    if (v && v !== value) onCommit(v);
    else setDraft(value);
  };
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          e.stopPropagation();
        }
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`field ${className}`}
    />
  );
}

// ── quick add ─────────────────────────────────────────────────────────────

function QuickAdd({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const preview = useMemo(() => (text.trim() ? parseLocal(text) : null), [text]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = text.trim();
    if (!raw || busy) return;
    setBusy(true);
    const r = await interpret(raw);
    const s = useLife.getState();
    const filed = s.commitCapture(r);
    s.setUi({ highlightId: filed.id });
    s.pushLog(`Added · ${r.title} — ${filed.label}`, "accent");
    if (s.sfx) audio.chime(990);
    setRecent((l) => [`${r.kind === "event" ? "Event" : r.kind === "habit" ? "Habit" : "Task"} · ${r.title} — ${filed.label}`, ...l].slice(0, 3));
    setText("");
    setBusy(false);
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={submit} className="border border-[var(--line-strong)] bg-[rgb(255_255_255/0.02)] p-4 md:p-5">
      <Label>Quick add — type it like you’d say it</Label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. dentist friday 10:30 · call Alex tomorrow at 3 · read every day"
          className="field h-[46px] flex-1 text-[16px]"
          aria-label="Quick add"
          disabled={busy}
        />
        <AddButton className="h-[46px]">{busy ? "Adding…" : "Add"}</AddButton>
      </div>
      <div className="mt-3 min-h-[20px] text-[13px] text-muted">
        {preview ? (
          <span>
            Will add a <b className="font-medium text-ink">{preview.kind}</b>: “{preview.title}”
            {preview.kind === "habit" ? " · every day" : preview.date ? ` · ${relativeDay(preview.date)}${preview.time ? ` ${preview.time}` : ""}` : " · no date"}
            {preview.priority !== "normal" ? ` · ${preview.priority} priority` : ""}
          </span>
        ) : recent.length ? (
          <span className="text-faint">Just added: {recent.join("   ·   ")}</span>
        ) : (
          <span className="text-faint">Or use the forms below for full control.</span>
        )}
      </div>
    </form>
  );
}

// ── tasks ─────────────────────────────────────────────────────────────────

function AddTaskForm() {
  const today = dateKey();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<Priority>(2);
  const [tags, setTags] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const s = useLife.getState();
    const id = s.addTask({
      title: title.trim(),
      dueDate: date || undefined,
      dueTime: date && time ? time : undefined,
      priority,
      tags: tags.split(/[,\s]+/).map((t) => t.replace(/^#/, "").toLowerCase()).filter(Boolean),
    });
    s.setUi({ highlightId: id });
    s.pushLog(`Task added · ${title.trim()}`, "accent");
    setTitle("");
    setTime("");
    setTags("");
  };

  return (
    <form onSubmit={submit} className="grid gap-3 border border-[var(--line)] p-4 sm:grid-cols-2 lg:grid-cols-[1fr_150px_132px_120px_150px_auto] lg:items-end">
      <label className="sm:col-span-2 lg:col-span-1">
        <Label>New task</Label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" className="field h-[42px] w-full" required />
      </label>
      <label>
        <Label>Date (optional)</Label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field h-[42px] w-full" />
      </label>
      <label>
        <Label>Time</Label>
        <TimeField value={time} onChange={setTime} disabled={!date} className="h-[42px] w-full" ariaLabel="Time" />
      </label>
      <label>
        <Label>Priority</Label>
        <select value={priority} onChange={(e) => setPriority(Number(e.target.value) as Priority)} className="field h-[42px] w-full">
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <Label>Tags</Label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="work, home" className="field h-[42px] w-full" />
      </label>
      <AddButton />
    </form>
  );
}

function TaskRow({ task }: { task: Task }) {
  const s = useLife.getState;
  const overdue = !task.done && task.dueDate && task.dueDate < dateKey();
  return (
    <li className="grid grid-cols-[36px_1fr_36px] items-center gap-x-3 gap-y-2 border-b border-[var(--line)] py-3 lg:grid-cols-[36px_1fr_150px_132px_120px_150px_36px]">
      <button
        type="button"
        onClick={() => s().toggleTask(task.id)}
        aria-label={task.done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
        className={`grid h-9 w-9 place-items-center border transition-colors ${task.done ? "border-[var(--accent)] bg-[var(--accent)] text-[#0a0a0a]" : "border-[var(--line-strong)] text-transparent hover:border-[var(--accent)] hover:text-muted"}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M5 12.5 10 17 19 7" />
        </svg>
      </button>
      <CommitInput
        value={task.title}
        onCommit={(v) => s().updateTask(task.id, { title: v })}
        ariaLabel="Task title"
        className={`h-9 w-full ${task.done ? "text-faint line-through" : ""}`}
      />
      <div className="col-start-3 row-start-1 lg:col-start-7">
        <IconButton label={`Delete “${task.title}”`} name="close" onClick={() => s().removeTask(task.id)} />
      </div>
      <div className="col-span-3 col-start-1 grid grid-cols-2 gap-2 pl-[48px] sm:grid-cols-4 lg:contents lg:pl-0">
        <input
          type="date"
          value={task.dueDate ?? ""}
          onChange={(e) => s().updateTask(task.id, { dueDate: e.target.value || undefined, dueTime: e.target.value ? task.dueTime : undefined })}
          aria-label="Due date"
          className={`field h-9 w-full ${overdue ? "!border-[var(--accent)] text-accent" : ""}`}
        />
        <TimeField
          value={task.dueTime ?? ""}
          disabled={!task.dueDate}
          onChange={(v) => s().updateTask(task.id, { dueTime: v || undefined })}
          ariaLabel="Due time"
          className="h-9 w-full"
        />
        <select
          value={task.priority}
          onChange={(e) => s().updateTask(task.id, { priority: Number(e.target.value) as Priority })}
          aria-label="Priority"
          className="field h-9 w-full"
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <CommitInput
          value={task.tags.join(", ")}
          onCommit={(v) => s().updateTask(task.id, { tags: v.split(/[,\s]+/).map((t) => t.replace(/^#/, "").toLowerCase()).filter(Boolean) })}
          placeholder="tags"
          ariaLabel="Tags"
          className="h-9 w-full"
        />
      </div>
    </li>
  );
}

function TasksTab() {
  const tasks = useLife((s) => s.tasks);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const list = useMemo(() => {
    const f = tasks.filter((t) => (filter === "all" ? true : filter === "done" ? t.done : !t.done));
    return [...f].sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
        (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99") ||
        b.priority - a.priority ||
        a.createdAt.localeCompare(b.createdAt),
    );
  }, [tasks, filter]);
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="space-y-6">
      <AddTaskForm />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: `Open (${tasks.length - doneCount})` },
            { value: "done", label: `Done (${doneCount})` },
            { value: "all", label: `All (${tasks.length})` },
          ]}
        />
        {doneCount > 0 && (
          <button
            type="button"
            onClick={() => {
              const s = useLife.getState();
              s.tasks.filter((t) => t.done).forEach((t) => s.removeTask(t.id));
              s.pushLog(`Removed ${doneCount} completed tasks (Z to undo)`);
            }}
            className="mono text-faint transition-colors hover:text-ink"
          >
            Remove completed
          </button>
        )}
      </div>
      <div className="mono hidden grid-cols-[36px_1fr_150px_110px_120px_150px_36px] gap-x-3 border-b border-[var(--line-strong)] pb-2 text-faint lg:grid">
        <span />
        <span>Task</span>
        <span>Date</span>
        <span>Time</span>
        <span>Priority</span>
        <span>Tags</span>
        <span />
      </div>
      {list.length ? (
        <ul>
          {list.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      ) : (
        <Empty>{filter === "done" ? "Nothing completed yet." : "No tasks yet — add one above."}</Empty>
      )}
    </div>
  );
}

// ── events ────────────────────────────────────────────────────────────────

function AddEventForm() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(dateKey());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [activity, setActivity] = useState<ActivityKey>("meetings");
  const [location, setLocation] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    const s = useLife.getState();
    const startIso = localIso(date, start || "09:00");
    let endIso = localIso(date, end || start || "10:00");
    if (endIso <= startIso) endIso = new Date(new Date(startIso).getTime() + 60 * 60_000).toISOString();
    const id = s.addEvent({ title: title.trim(), start: startIso, end: endIso, activity, location: location.trim() || undefined });
    s.setUi({ highlightId: id });
    s.pushLog(`Event added · ${title.trim()} — ${relativeDay(date)} ${start}`, "accent");
    setTitle("");
    setLocation("");
  };

  return (
    <form onSubmit={submit} className="grid gap-3 border border-[var(--line)] p-4 sm:grid-cols-2 lg:grid-cols-[1fr_150px_128px_128px_140px_150px_auto] lg:items-end">
      <label className="sm:col-span-2 lg:col-span-1">
        <Label>New event</Label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting, lunch, gym…" className="field h-[42px] w-full" required />
      </label>
      <label>
        <Label>Date</Label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field h-[42px] w-full" required />
      </label>
      <label>
        <Label>Start</Label>
        <TimeField value={start} onChange={setStart} required className="h-[42px] w-full" ariaLabel="Start" />
      </label>
      <label>
        <Label>End</Label>
        <TimeField value={end} onChange={setEnd} required className="h-[42px] w-full" ariaLabel="End" />
      </label>
      <label>
        <Label>Type</Label>
        <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityKey)} className="field h-[42px] w-full">
          {ACTIVITIES.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <Label>Place</Label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="optional" className="field h-[42px] w-full" />
      </label>
      <AddButton />
    </form>
  );
}

function EventRow({ ev }: { ev: CalEvent }) {
  const s = useLife.getState;
  const start = new Date(ev.start);
  const end = new Date(ev.end);
  const day = dateKey(start);
  const setTimes = (nextDay: string, nextStart: string, nextEnd: string) => {
    const sIso = localIso(nextDay, nextStart);
    let eIso = localIso(nextDay, nextEnd);
    if (eIso <= sIso) eIso = new Date(new Date(sIso).getTime() + (end.getTime() - start.getTime() || 3600_000)).toISOString();
    s().updateEvent(ev.id, { start: sIso, end: eIso });
  };
  return (
    <li className="grid grid-cols-[1fr_36px] items-center gap-x-3 gap-y-2 border-b border-[var(--line)] py-3 lg:grid-cols-[1fr_150px_128px_128px_140px_150px_36px]">
      <CommitInput value={ev.title} onCommit={(v) => s().updateEvent(ev.id, { title: v })} ariaLabel="Event title" className="h-9 w-full" />
      <div className="col-start-2 row-start-1 lg:col-start-7">
        <IconButton label={`Delete “${ev.title}”`} name="close" onClick={() => s().removeEvent(ev.id)} />
      </div>
      <div className="col-span-2 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:contents">
        <input type="date" value={day} onChange={(e) => e.target.value && setTimes(e.target.value, hhmm(start), hhmm(end))} aria-label="Date" className="field h-9 w-full" />
        <TimeField value={hhmm(start)} onChange={(v) => setTimes(day, v, hhmm(end))} required ariaLabel="Start" className="h-9 w-full" />
        <TimeField value={hhmm(end)} onChange={(v) => setTimes(day, hhmm(start), v)} required ariaLabel="End" className="h-9 w-full" />
        <select value={ev.activity} onChange={(e) => s().updateEvent(ev.id, { activity: e.target.value as ActivityKey })} aria-label="Type" className="field h-9 w-full">
          {ACTIVITIES.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
        <CommitInput value={ev.location ?? ""} onCommit={(v) => s().updateEvent(ev.id, { location: v })} placeholder="place" ariaLabel="Place" className="h-9 w-full" />
      </div>
    </li>
  );
}

function EventsTab() {
  const events = useLife((s) => s.events);
  const [showPast, setShowPast] = useState(false);
  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.end) >= now);
  const past = events.filter((e) => new Date(e.end) < now).reverse();
  const groups = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of upcoming) {
      const k = dateKey(new Date(e.start));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [upcoming]);

  return (
    <div className="space-y-6">
      <AddEventForm />
      {groups.length === 0 && <Empty>No upcoming events — add one above.</Empty>}
      {groups.map(([day, list]) => (
        <section key={day}>
          <h3 className="display text-[26px]">
            {relativeDay(day)} <span className="mono align-middle text-faint">{fromDateKey(day).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
          </h3>
          <ul className="mt-2">
            {list.map((e) => (
              <EventRow key={e.id} ev={e} />
            ))}
          </ul>
        </section>
      ))}
      {past.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowPast((v) => !v)} className="mono text-faint transition-colors hover:text-ink">
            {showPast ? "Hide" : "Show"} past events ({past.length})
          </button>
          {showPast && (
            <ul className="mt-2 opacity-60">
              {past.map((e) => (
                <EventRow key={e.id} ev={e} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── habits ────────────────────────────────────────────────────────────────

function HabitRow({ habit, days }: { habit: Habit; days: Date[] }) {
  const s = useLife.getState;
  const streak = habitStreak(habit);
  return (
    <li className="grid grid-cols-[130px_1fr_36px] items-center gap-3 border-b border-[var(--line)] py-3 lg:grid-cols-[130px_1fr_auto_90px_36px]">
      <select value={habit.glyph} onChange={(e) => s().updateHabit(habit.id, { glyph: e.target.value as HabitGlyph })} aria-label="Icon" className="field h-9 w-full">
        {GLYPHS.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>
      <CommitInput value={habit.name} onCommit={(v) => s().updateHabit(habit.id, { name: v })} ariaLabel="Habit name" className="h-9 w-full" />
      <div className="col-start-3 row-start-1 lg:col-start-5">
        <IconButton label={`Delete “${habit.name}”`} name="close" onClick={() => s().removeHabit(habit.id)} />
      </div>
      <div className="col-span-3 flex gap-1.5 lg:col-span-1">
        {days.map((d) => {
          const k = dateKey(d);
          const on = !!habit.log[k];
          const isToday = k === dateKey();
          return (
            <button
              key={k}
              type="button"
              onClick={() => s().toggleHabit(habit.id, k)}
              aria-pressed={on}
              aria-label={`${habit.name} on ${d.toDateString()}: ${on ? "done" : "not done"}`}
              className="mono flex h-9 w-10 flex-col items-center justify-center border text-[9px] leading-tight transition-colors"
              style={{
                borderColor: on ? "var(--accent)" : isToday ? "var(--ink)" : "var(--line-strong)",
                background: on ? "var(--accent)" : "transparent",
                color: on ? "#0a0a0a" : "var(--muted)",
              }}
            >
              <span>{d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</span>
              <span>{d.getDate()}</span>
            </button>
          );
        })}
      </div>
      <span className="mono col-span-3 text-muted lg:col-span-1">
        <span className="text-ink">{streak}</span> day streak
      </span>
    </li>
  );
}

function HabitsTab() {
  const habits = useLife((s) => s.habits);
  const [name, setName] = useState("");
  const [glyph, setGlyph] = useState<HabitGlyph | "">("");
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6)), []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const s = useLife.getState();
    s.addHabit(name.trim(), glyph || undefined);
    s.pushLog(`Ritual added · ${name.trim()}`, "accent");
    setName("");
    setGlyph("");
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="grid gap-3 border border-[var(--line)] p-4 sm:grid-cols-[1fr_170px_auto] sm:items-end">
        <label>
          <Label>New daily habit</Label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meditate, stretch, read…" className="field h-[42px] w-full" required />
        </label>
        <label>
          <Label>Icon</Label>
          <select value={glyph} onChange={(e) => setGlyph(e.target.value as HabitGlyph)} className="field h-[42px] w-full">
            <option value="">Pick automatically</option>
            {GLYPHS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <AddButton />
      </form>
      <p className="text-[13px] text-faint">Tap a day to mark it done or undone — the last seven days are shown, today outlined.</p>
      {habits.length ? (
        <ul>
          {habits.map((h) => (
            <HabitRow key={h.id} habit={h} days={days} />
          ))}
        </ul>
      ) : (
        <Empty>No habits yet — add one above.</Empty>
      )}
    </div>
  );
}

// ── data ──────────────────────────────────────────────────────────────────

function DataTab() {
  const tasks = useLife((s) => s.tasks);
  const events = useLife((s) => s.events);
  const habits = useLife((s) => s.habits);
  const history = useLife((s) => s.history);
  const sessions = useLife((s) => s.sessions);
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const counts = [
    ["Tasks", `${tasks.filter((t) => !t.done).length} open · ${tasks.filter((t) => t.done).length} done`],
    ["Events", String(events.length)],
    ["Habits", String(habits.length)],
    ["Days of history", String(Object.keys(history).length)],
    ["Focus sessions", String(sessions.length)],
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <h3 className="display text-[30px]">What’s stored</h3>
        <p className="mt-2 text-[14px] text-muted">Everything lives in this browser (and in Supabase, if cloud sync is configured).</p>
        <dl className="mt-5">
          {counts.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-[var(--line)] py-2.5 text-[15px]">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={exportData} className="mono flex items-center gap-2 border border-[var(--line-strong)] px-3 py-2 text-muted transition-colors hover:border-[var(--accent)] hover:text-ink">
            Export backup (.json)
          </button>
          <button type="button" onClick={() => file.current?.click()} className="mono flex items-center gap-2 border border-[var(--line-strong)] px-3 py-2 text-muted transition-colors hover:border-[var(--accent)] hover:text-ink">
            Import backup
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const err = await importData(f);
              setMessage(err ?? "Backup restored.");
            }}
          />
        </div>
        {message && <p className="mt-3 text-[13px] text-muted">{message}</p>}
      </div>

      <div>
        <h3 className="display text-[30px]">Start over</h3>
        <div className="mt-5 space-y-6">
          <div className="border border-[rgb(255_107_91/0.35)] p-5">
            <div className="text-[16px]">Clear all data</div>
            <p className="mt-1 text-[14px] text-muted">
              Deletes every task, event, habit, focus session and the whole history. Display settings are kept. This can’t be undone — export a backup first if you might want it back.
            </p>
            <div className="mt-4">
              <ConfirmButton onConfirm={() => { clearAllData(); setMessage("All data cleared."); }} confirmLabel="Yes, delete everything">
                <Glyph name="close" size={13} /> Clear all data
              </ConfirmButton>
            </div>
          </div>
          <div className="border border-[var(--line)] p-5">
            <div className="text-[16px]">Reset demo data</div>
            <p className="mt-1 text-[14px] text-muted">Replaces everything with the sample day and six months of example history.</p>
            <div className="mt-4">
              <ConfirmButton onConfirm={() => { resetDemoData(); setMessage("Demo data restored."); }} confirmLabel="Yes, replace with demo">
                <Glyph name="reset" size={13} /> Reset demo
              </ConfirmButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── shell ─────────────────────────────────────────────────────────────────

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className="mono border px-3 py-2"
          style={{
            borderColor: value === o.value ? "var(--accent)" : "var(--line)",
            color: value === o.value ? "var(--ink)" : "var(--faint)",
            background: value === o.value ? "rgb(255 255 255 / 0.04)" : "transparent",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-[15px] text-faint">{children}</p>;
}

export function Planner() {
  const open = useLife((s) => s.plannerOpen);
  const setUi = useLife((s) => s.setUi);
  const openTasks = useLife((s) => s.tasks.filter((x) => !x.done).length);
  const eventCount = useLife((s) => s.events.length);
  const habitCount = useLife((s) => s.habits.length);
  const counts = { t: openTasks, e: eventCount, h: habitCount };
  const [tab, setTab] = useState<Tab>("tasks");
  const quick = useRef<HTMLInputElement>(null);
  const now = new Date();

  // Ctrl/⌘+K (or K) inside the planner jumps to quick add instead of opening the capture overlay
  useEffect(() => {
    const focusQuick = () => quick.current?.focus();
    window.addEventListener("lifeos:planner-quick", focusQuick);
    return () => window.removeEventListener("lifeos:planner-quick", focusQuick);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => setUi({ plannerOpen: o })}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div className="fixed inset-0 z-[62] bg-[rgb(4_4_5/0.94)] backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
        </Dialog.Overlay>
        <Dialog.Content
          className="fixed inset-0 z-[63] overflow-y-auto outline-none"
          data-lenis-prevent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            quick.current?.focus();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-24 pt-8 md:pt-12"
          >
            <header className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="mono text-accent">Planner · {relativeDay(dateKey(now))}, {pad(now.getHours())}:{pad(now.getMinutes())}</div>
                <Dialog.Title className="display mt-2 text-[clamp(40px,5vw,72px)] leading-none">
                  Plan <em className="text-accent">plainly.</em>
                </Dialog.Title>
                <Dialog.Description className="mt-3 max-w-[60ch] text-[15px] text-muted">
                  A calm, readable view for adding and editing everything. Changes appear on the dashboard instantly.
                </Dialog.Description>
              </div>
              <div className="flex flex-col items-end gap-3">
                <Dialog.Close className="mono flex items-center gap-2 border border-[var(--line-strong)] px-4 py-2.5 text-ink transition-colors hover:border-[var(--accent)]">
                  Back to dashboard <span className="kbd">E</span> <span className="kbd">Esc</span>
                </Dialog.Close>
                <p className="mono max-w-[340px] text-right text-faint" style={{ fontSize: 10 }}>
                  Shortcuts work as usual — add <span className="text-muted">Ctrl</span> while typing in a field: Ctrl+E close · Ctrl+K quick add ·
                  Ctrl+G monitor · Ctrl+L layout · Ctrl+M mood
                </p>
              </div>
            </header>

            <div className="mt-8">
              <QuickAdd inputRef={quick} />
            </div>

            <div className="sticky top-0 z-10 -mx-[var(--gutter)] mt-8 border-b border-[var(--line)] bg-[rgb(4_4_5/0.96)] px-[var(--gutter)] py-3">
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: "tasks", label: `Tasks (${counts.t})` },
                  { value: "events", label: `Events (${counts.e})` },
                  { value: "habits", label: `Habits (${counts.h})` },
                  { value: "data", label: "Data" },
                ]}
              />
            </div>

            <div className="mt-6">
              {tab === "tasks" && <TasksTab />}
              {tab === "events" && <EventsTab />}
              {tab === "habits" && <HabitsTab />}
              {tab === "data" && <DataTab />}
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
