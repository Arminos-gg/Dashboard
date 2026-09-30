"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLife } from "@/lib/store";
import { elementLabel, hideElement, showAllElements, useHidden } from "@/lib/layout";

/**
 * Layout editor: every [data-hide] element gets an outline, the one under the
 * pointer is highlighted, and a click removes it. Removed elements are listed in
 * the Lab for restoring.
 */
export function EditLayout() {
  const on = useLife((s) => s.editLayout);
  const setUi = useLife((s) => s.setUi);
  const hidden = useHidden();
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const current = useRef<HTMLElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.edit = on ? "on" : "off";
    if (!on) return;
    const find = (t: EventTarget | null) => (t instanceof Element ? (t.closest("[data-hide]") as HTMLElement | null) : null);
    const inBar = (t: EventTarget | null) => t instanceof Element && !!t.closest("[data-edit-bar]");

    const move = (e: PointerEvent) => {
      const el = inBar(e.target) ? null : find(e.target);
      if (el !== current.current) {
        current.current?.removeAttribute("data-hide-hover");
        el?.setAttribute("data-hide-hover", "");
        current.current = el;
      }
      setHover(el ? { id: el.dataset.hide!, x: e.clientX, y: e.clientY } : null);
    };
    // capture phase: the click never reaches the element's own buttons
    const click = (e: MouseEvent) => {
      if (inBar(e.target)) return;
      const el = find(e.target);
      e.preventDefault();
      e.stopPropagation();
      if (!el) return;
      el.removeAttribute("data-hide-hover");
      current.current = null;
      setHover(null);
      hideElement(el.dataset.hide!);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setUi({ editLayout: false });
      }
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("click", click, true);
    window.addEventListener("keydown", key, true);
    return () => {
      current.current?.removeAttribute("data-hide-hover");
      current.current = null;
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("click", click, true);
      window.removeEventListener("keydown", key, true);
    };
  }, [on, setUi]);

  return (
    <AnimatePresence>
      {on && (
        <>
          {hover && (
            <div
              className="mono pointer-events-none fixed z-[96] bg-[var(--accent)] px-2 py-1 text-[#0a0a0a]"
              style={{ left: hover.x + 14, top: hover.y + 16 }}
            >
              Hide · {elementLabel(hover.id)}
            </div>
          )}
          <motion.div
            data-edit-bar
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-6 z-[95] flex justify-center px-4"
          >
            <div className="mono flex flex-wrap items-center justify-center gap-4 border border-[var(--accent)] bg-[rgb(7_7_9/0.95)] px-5 py-3 text-muted backdrop-blur-xl">
              <span className="text-accent">Edit layout</span>
              <span className="normal-case tracking-normal" style={{ fontSize: 13 }}>
                Click any outlined element to hide it
              </span>
              <span className="text-faint">{hidden.length} hidden</span>
              {hidden.length > 0 && (
                <button onClick={() => showAllElements()} className="text-muted transition-colors hover:text-ink">
                  Restore all
                </button>
              )}
              <button
                onClick={() => setUi({ editLayout: false })}
                className="flex items-center gap-2 border border-[var(--line-strong)] px-3 py-1.5 text-ink transition-colors hover:border-[var(--accent)]"
              >
                Done <span className="kbd">Esc</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
