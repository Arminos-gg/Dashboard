"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import { useLife } from "@/lib/store";
import { rankTasks } from "@/lib/agenda";
import { dateKey, relativeDay } from "@/lib/time";
import { audio } from "@/lib/audio";
import { burst } from "@/lib/sparks";
import { Glyph } from "@/components/ui/Glyph";
import type { Task } from "@/lib/types";

type Filter = "all" | "today" | "upcoming" | "someday" | "done";

function PriorityMarks({ p }: { p: Task["priority"] }) {
  return (
    <span className="flex items-end gap-[3px]" aria-label={`Priority ${p === 3 ? "high" : p === 2 ? "normal" : "low"}`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className="w-px" style={{ height: 4 + i * 3, background: i <= p ? "var(--accent)" : "var(--line-strong)" }} />
      ))}
    </span>
  );
}

function Row({ task, now, draggable }: { task: Task; now: Date; draggable: boolean }) {
  const controls = useDragControls();
  const highlight = useLife((s) => s.highlightId === task.id);
  const today = dateKey(now);
  const overdue = !task.done && task.dueDate && task.dueDate < today;

  const toggle = (e: React.MouseEvent) => {
    const s = useLife.getState();
    const done = s.toggleTask(task.id);
    if (done) {
      burst(e.clientX, e.clientY, 20);
      if (s.sfx) audio.chime(700);
      s.pushLog(`Done · ${task.title}`, "accent");
    } else if (s.sfx) audio.tick(0.8);
  };

  const content = (
    <div
      className="group relative grid grid-cols-[28px_1fr_auto] items-center gap-x-4 gap-y-1 py-4 md:grid-cols-[28px_1fr_140px_150px_28px_24px]"
      style={{ opacity: task.done ? 0.42 : 1 }}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[var(--accent)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: highlight ? [0.18, 0] : 0 }}
        transition={{ duration: 2.4 }}
      />
      <button
        onClick={toggle}
        className={task.done ? "text-accent" : "text-muted transition-colors hover:text-accent"}
        aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        data-cursor={task.done ? "Reopen" : "Done"}
      >
        <Glyph name={task.done ? "diamond-fill" : "diamond"} size={16} />
      </button>
      <div
        className={`min-w-0 transition-transform duration-500 [transition-timing-function:var(--ease-out)] group-hover:translate-x-1.5 ${draggable ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
        onPointerDown={(e) => draggable && controls.start(e)}
        data-cursor={draggable ? "Drag" : undefined}
      >
        <div className={`truncate text-[17px] md:text-[19px] ${task.done ? "line-through decoration-[var(--accent)]" : ""}`}>{task.title}</div>
        {task.notes && <div className="truncate text-[13px] text-faint">{task.notes}</div>}
      </div>
      <span className="mono hidden truncate text-faint md:block">{task.tags.map((t) => `#${t}`).join(" ") || "—"}</span>
      <span className={`mono text-right md:text-left ${overdue ? "text-accent" : "text-muted"}`}>
        {task.dueDate ? `${overdue ? "Overdue · " : ""}${relativeDay(task.dueDate, now)}${task.dueTime ? ` · ${task.dueTime}` : ""}` : "Someday"}
      </span>
      <span className="hidden md:block">
        <PriorityMarks p={task.priority} />
      </span>
      <button
        onClick={() => {
          const s = useLife.getState();
          s.removeTask(task.id);
          s.pushLog(`Removed · ${task.title} (Z to undo)`);
        }}
        className="hidden text-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 focus:opacity-100 md:block"
        aria-label={`Delete ${task.title}`}
        data-cursor="Delete"
      >
        <Glyph name="close" size={14} />
      </button>
    </div>
  );

  if (draggable) {
    return (
      <Reorder.Item
        value={task}
        dragListener={false}
        dragControls={controls}
        className="relative border-b border-[var(--line)]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: 40, filter: "blur(6px)" }}
        whileDrag={{ scale: 1.015, backgroundColor: "rgba(236,232,225,0.035)", boxShadow: "0 30px 60px -30px rgba(0,0,0,.9)" }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      >
        {content}
      </Reorder.Item>
    );
  }
  return (
    <motion.li
      layout
      className="relative border-b border-[var(--line)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, filter: "blur(6px)" }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      {content}
    </motion.li>
  );
}

export function Ledger({ now }: { now: Date }) {
  const tasks = useLife((s) => s.tasks);
  const reorderOpen = useLife((s) => s.reorderOpen);
  const highlightId = useLife((s) => s.highlightId);
  const setUi = useLife((s) => s.setUi);
  const [filter, setFilter] = useState<Filter>("all");
  const today = dateKey(now);

  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => setUi({ highlightId: null }), 2600);
    return () => window.clearTimeout(t);
  }, [highlightId, setUi]);

  const groups = useMemo(() => {
    const open = [...tasks].filter((t) => !t.done).sort((a, b) => a.order - b.order);
    return {
      all: open,
      today: open.filter((t) => t.dueDate && t.dueDate <= today),
      upcoming: open.filter((t) => t.dueDate && t.dueDate > today),
      someday: open.filter((t) => !t.dueDate),
      done: tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "")),
    };
  }, [tasks, today]);

  const list = groups[filter];
  const draggable = filter !== "done";
  const suggested = rankTasks(tasks, now)[0];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--line-strong)] pb-4">
        <div className="mono flex flex-wrap gap-x-6 gap-y-2" role="tablist" aria-label="Filter tasks">
          {(["all", "today", "upcoming", "someday", "done"] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className="relative pb-1 transition-colors"
              style={{ color: filter === f ? "var(--ink)" : "var(--faint)" }}
            >
              {f} <span className={filter === f ? "text-accent" : ""}>{groups[f].length}</span>
              {filter === f && <motion.span layoutId="ledger-tab" className="absolute inset-x-0 -bottom-0.5 h-px bg-[var(--accent)]" />}
            </button>
          ))}
        </div>
        <div className="mono hidden text-faint md:block">
          {draggable ? "Drag a title to reorder" : "Most recent first"} {suggested && "· "}
          {suggested && (
            <span>
              Suggested next: <span className="normal-case tracking-normal text-ink">{suggested.title}</span>
            </span>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="py-16 text-center">
          <p className="display text-[40px] text-faint">
            Nothing here. <em>Press K to capture, or E for the planner.</em>
          </p>
        </div>
      ) : draggable ? (
        <Reorder.Group
          axis="y"
          values={list}
          onReorder={(next: Task[]) => reorderOpen(next.map((t) => t.id))}
          as="ul"
        >
          <AnimatePresence initial={false}>
            {list.map((t) => (
              <Row key={t.id} task={t} now={now} draggable />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      ) : (
        <ul>
          <AnimatePresence initial={false}>
            {list.map((t) => (
              <Row key={t.id} task={t} now={now} draggable={false} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
