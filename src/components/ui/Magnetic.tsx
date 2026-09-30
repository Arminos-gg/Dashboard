"use client";

import { motion, useSpring } from "motion/react";
import { useRef, type ReactNode } from "react";

/** Pulls its content toward the cursor with a spring; releases with inertia. */
export function Magnetic({ children, strength = 0.28, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const cfg = { stiffness: 240, damping: 16, mass: 0.5 };
  const x = useSpring(0, cfg);
  const y = useSpring(0, cfg);
  return (
    <motion.span
      ref={ref}
      className={className}
      style={{ x, y, display: "inline-block" }}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}
