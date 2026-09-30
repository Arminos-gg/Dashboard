"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { pad } from "@/lib/time";

const SLOTS = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`);

/** "930", "9:30", "21", "9pm", "9:30 am" → "HH:MM"; "" → ""; anything else → null. */
export function parseTime(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  const m = t.match(/^(\d{1,2})(?:[:.h]?(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3];
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (h === 12) h = 0;
    if (ap.startsWith("p")) h += 12;
  }
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/**
 * 24-hour time input in the site's own style: type freely ("930", "9pm") or pick from
 * a quarter-hour list that opens on focus. Replaces the browser's native time picker.
 */
export function TimeField({
  value,
  onChange,
  disabled,
  required,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [last, setLast] = useState(value);
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  if (value !== last) {
    setLast(value);
    setDraft(value);
  }

  // narrow the list to what's been typed, e.g. "1" → 01:xx, 10:xx … 19:xx
  const options = useMemo(() => {
    const q = draft.replace(/\D/g, "");
    if (!q || draft === value) return SLOTS;
    const hits = SLOTS.filter((s) => {
      const digits = s.replace(":", "");
      return digits.startsWith(q) || digits.startsWith(`0${q}`);
    });
    return hits.length ? hits : SLOTS;
  }, [draft, value]);

  // open on the current value, centred
  useEffect(() => {
    if (!open || !list.current) return;
    const idx = options.findIndex((s) => s >= (value || "09:00"));
    const el = list.current.children[Math.max(0, idx)] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "center" });
  }, [open, options, value]);

  const commit = (v: string) => {
    const parsed = parseTime(v);
    if (parsed === null || (required && !parsed)) {
      setDraft(value);
    } else {
      setDraft(parsed);
      if (parsed !== value) onChange(parsed);
    }
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className={`relative ${className}`}>
      <input
        value={draft}
        disabled={disabled}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        inputMode="numeric"
        placeholder="--:--"
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => {
              const next = Math.max(0, Math.min(options.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
              (list.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
              return next;
            });
          } else if (e.key === "Enter") {
            e.preventDefault();
            commit(active >= 0 ? options[active] : draft);
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setDraft(value);
            setOpen(false);
          }
        }}
        className="field h-full w-full font-[var(--font-mono)] tabular-nums tracking-[0.06em]"
        style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}
      />
      {open && !disabled && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          data-lenis-prevent
          className="absolute left-0 top-full z-40 mt-1 max-h-[232px] w-full min-w-[112px] overflow-y-auto border border-[var(--line-strong)] bg-[#0b0b0d] py-1 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.9)]"
        >
          {options.map((s, i) => {
            const selected = s === value;
            return (
              <li
                key={s}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus in the input until we commit
                  commit(s);
                }}
                onMouseEnter={() => setActive(i)}
                className="mono cursor-pointer px-3 py-1.5 tabular-nums"
                style={{
                  fontSize: 13,
                  letterSpacing: "0.08em",
                  color: selected ? "var(--accent)" : i === active ? "var(--ink)" : "var(--muted)",
                  background: i === active ? "rgb(255 255 255 / 0.06)" : "transparent",
                }}
              >
                {s}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
