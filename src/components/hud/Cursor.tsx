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

    const loop = () => {
      rx += (pointer.x - rx) * 0.2;
      ry += (pointer.y - ry) * 0.2;
      const target = hover.current ? 40 : 28;
      size += (target - size) * 0.18;
      const stretch = Math.min(pointer.speed, 1);
      const angle = stretch > 0.02 ? Math.atan2(pointer.vy, pointer.vx) : 0;
      if (ring.current) {
        ring.current.style.transform =
          `translate3d(${rx - size / 2}px, ${ry - size / 2}px, 0) rotate(${angle}rad) scale(${1 + stretch * 0.9}, ${1 - stretch * 0.42})`;
        ring.current.style.width = ring.current.style.height = `${size}px`;
        ring.current.style.opacity = pointer.active ? "1" : "0";
      }
      if (dot.current) {
        dot.current.style.transform = `translate3d(${pointer.x - 2}px, ${pointer.y - 2}px, 0)`;
        dot.current.style.opacity = pointer.active ? "1" : "0";
      }
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
        className="pointer-events-none fixed left-0 top-0 z-[90] rounded-full border border-[rgb(236_232_225/0.55)] mix-blend-difference"
      />
      <div ref={dot} className="pointer-events-none fixed left-0 top-0 z-[91] h-1 w-1 bg-[var(--ink)] mix-blend-difference" />
    </>
  );
}
