"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type SelectOption<T extends string | number> = { value: T; label: string; icon?: ReactNode };

/**
 * Drop-down in the site's own style, replacing the native <select>. The list grows to fit
 * its options (no inner scrollbar) and opens upward when there's no room below.
 */
export function SelectField<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  placeholder = "—",
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  ariaLabel: string;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [up, setUp] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !button.current || !list.current) return;
    const r = button.current.getBoundingClientRect();
    const h = list.current.offsetHeight + 6;
    setUp(window.innerHeight - r.bottom < h && r.top > window.innerHeight - r.bottom);
  }, [open]);

  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const pick = (i: number) => {
    const o = options[i];
    if (o && o.value !== value) onChange(o.value);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} data-picker-open={open || undefined}>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              show();
            }
            return;
          }
          // an open list owns the keyboard — keep keys away from the global shortcuts
          e.stopPropagation();
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            setActive(e.key === "Home" ? 0 : options.length - 1);
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick(active);
          } else if (e.key === "Escape" || e.key === "Tab") {
            if (e.key === "Escape") e.preventDefault();
            setOpen(false);
          } else if (e.key.length === 1) {
            // type-ahead: jump to the next option starting with that letter
            const k = e.key.toLowerCase();
            const n = options.length;
            for (let step = 1; step <= n; step++) {
              const j = (active + step) % n;
              if (options[j].label.toLowerCase().startsWith(k)) {
                setActive(j);
                break;
              }
            }
          }
        }}
        className="field flex h-full w-full items-center gap-2 text-left"
      >
        {current?.icon}
        <span className={`min-w-0 flex-1 truncate ${current ? "" : "text-faint"}`}>{current?.label ?? placeholder}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="shrink-0 text-faint transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined }}>
          <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 z-40 w-full min-w-[160px] border border-[var(--line-strong)] bg-[#0b0b0d] py-1 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.9)] ${up ? "bottom-full mb-1" : "top-full mt-1"}`}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={String(o.value)}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus on the button so blur doesn't close first
                  pick(i);
                }}
                onMouseEnter={() => setActive(i)}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[14px]"
                style={{
                  color: selected ? "var(--accent)" : i === active ? "var(--ink)" : "var(--muted)",
                  background: i === active ? "rgb(255 255 255 / 0.06)" : "transparent",
                }}
              >
                {o.icon}
                <span className="flex-1 truncate">{o.label}</span>
                {selected && <span className="mono text-[10px] text-accent">●</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
