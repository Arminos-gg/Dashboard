"use client";

import { useEffect, useRef, useState } from "react";
import { pointer } from "@/lib/pointer";
import { useLife } from "@/lib/store";
import { usePref } from "@/lib/prefs";

/**
 * A reticle that trails the pointer with inertia and stretches along its velocity
 * vector. Over anything clickable it opens up slightly — no labels, nothing in the way.
 */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const [enabled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches,
  );
  const hover = useRef(false);
  // the planner is a working surface: give it the ordinary system cursor
  const cursorPref = usePref("cursor");
  const busy = useLife((s) => s.plannerOpen || s.monitor || s.editLayout);
  const plain = busy || !cursorPref;

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.toggle("cursor-on", !plain);
  }, [enabled, plain]);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add("cursor-on");
    let rx = pointer.x;
    let ry = pointer.y;
    let size = 30;
    let raf = 0;

    const over = (e: PointerEvent) => {
      const t = e.target as Element | null;
      hover.current = !!t?.closest?.("a,button,[role=button],input,textarea,select,[data-hover],label");
    };
    window.addEventListener("pointerover", over, { passive: true });

    const last = { ring: "", dot: "", op: "" };
    const loop = () => {
      rx += (pointer.x - rx) * 0.2;
      ry += (pointer.y - ry) * 0.2;
      const target = hover.current ? 40 : 28;
      size += (target - size) * 0.18;
      const stretch = Math.min(pointer.speed, 1);
      const angle = stretch > 0.02 ? Math.atan2(pointer.vy, pointer.vx) : 0;
      // size is applied through scale (40px box) so the ring never triggers layout,
      // and nothing is written while the cursor rests
      const k = size / 40;
      const ringT = `translate3d(${(rx - 20).toFixed(1)}px, ${(ry - 20).toFixed(1)}px, 0) rotate(${angle.toFixed(3)}rad) scale(${(k * (1 + stretch * 0.9)).toFixed(3)}, ${(k * (1 - stretch * 0.42)).toFixed(3)})`;
      const dotT = `translate3d(${pointer.x - 2}px, ${pointer.y - 2}px, 0)`;
      const op = pointer.active ? "1" : "0";
      if (ringT !== last.ring || op !== last.op) {
        last.ring = ringT;
        if (ring.current) {
          ring.current.style.transform = ringT;
          ring.current.style.opacity = op;
        }
      }
      if (dotT !== last.dot || op !== last.op) {
        last.dot = dotT;
        if (dot.current) {
          dot.current.style.transform = dotT;
          dot.current.style.opacity = op;
        }
      }
      last.op = op;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerover", over);
      document.documentElement.classList.remove("cursor-on");
    };
  }, [enabled]);

  if (!enabled || plain) return null;

  return (
    <>
      <div
        ref={ring}
        className="pointer-events-none fixed left-0 top-0 z-[90] h-10 w-10 rounded-full will-change-transform border-[1.4px] border-[rgb(236_232_225/0.55)] mix-blend-difference"
      />
      <div ref={dot} className="pointer-events-none fixed left-0 top-0 z-[91] h-1 w-1 bg-[var(--ink)] will-change-transform mix-blend-difference" />
    </>
  );
}
