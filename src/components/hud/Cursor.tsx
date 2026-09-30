"use client";

import { useEffect, useRef, useState } from "react";
import { pointer } from "@/lib/pointer";

/**
 * A reticle that trails the pointer with inertia and stretches along its velocity
 * vector. Interactive elements expand it; [data-cursor] elements give it a label.
 */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [enabled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches,
  );
  const hover = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add("cursor-on");
    let rx = pointer.x;
    let ry = pointer.y;
    let size = 30;
    let raf = 0;

    const over = (e: PointerEvent) => {
      const t = e.target as Element | null;
      const labelled = t?.closest?.("[data-cursor]");
      setLabel(labelled?.getAttribute("data-cursor") ?? null);
      hover.current = !!t?.closest?.("a,button,[role=button],input,textarea,select,[data-hover],label");
    };
    window.addEventListener("pointerover", over, { passive: true });

    const loop = () => {
      rx += (pointer.x - rx) * 0.2;
      ry += (pointer.y - ry) * 0.2;
      const labelled = !!ring.current?.dataset.label;
      const target = labelled ? 86 : hover.current ? 46 : 30;
      size += (target - size) * 0.18;
      const stretch = labelled ? 0 : Math.min(pointer.speed, 1);
      const angle = stretch > 0.02 ? Math.atan2(pointer.vy, pointer.vx) : 0;
      if (ring.current) {
        ring.current.style.transform =
          `translate3d(${rx - size / 2}px, ${ry - size / 2}px, 0) rotate(${angle}rad) scale(${1 + stretch * 0.9}, ${1 - stretch * 0.42})`;
        ring.current.style.width = ring.current.style.height = `${size}px`;
        ring.current.style.opacity = pointer.active ? "1" : "0";
      }
      if (dot.current) {
        dot.current.style.transform = `translate3d(${pointer.x - 2}px, ${pointer.y - 2}px, 0)`;
        dot.current.style.opacity = pointer.active && !labelled ? "1" : "0";
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

  if (!enabled) return null;

  return (
    <>
      <div
        ref={ring}
        data-label={label ?? ""}
        className="pointer-events-none fixed left-0 top-0 z-[90] grid place-items-center rounded-full border mix-blend-difference transition-[background-color,border-color] duration-300"
        style={{
          borderColor: label ? "transparent" : "rgb(236 232 225 / 0.55)",
          backgroundColor: label ? "var(--accent)" : "transparent",
          mixBlendMode: label ? "normal" : "difference",
        }}
      >
        <span
          className="mono whitespace-nowrap text-[9px] text-black transition-opacity duration-200"
          style={{ opacity: label ? 1 : 0, letterSpacing: "0.16em" }}
        >
          {label}
        </span>
      </div>
      <div ref={dot} className="pointer-events-none fixed left-0 top-0 z-[91] h-1 w-1 bg-[var(--ink)] mix-blend-difference" />
    </>
  );
}
