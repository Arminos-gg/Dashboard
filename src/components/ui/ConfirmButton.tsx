"use client";

import { useEffect, useState, type ReactNode } from "react";

const DANGER = "#ff6b5b";

/** Destructive action in two deliberate clicks: the first arms it, the second (within 4 s) fires. */
export function ConfirmButton({
  children,
  onConfirm,
  confirmLabel = "Click again to confirm",
  className = "",
}: {
  children: ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      onBlur={() => setArmed(false)}
      className={`mono flex items-center gap-2 border px-3 py-2 transition-colors ${className}`}
      style={{
        borderColor: armed ? DANGER : "rgb(255 107 91 / 0.45)",
        color: armed ? "#0a0a0a" : DANGER,
        background: armed ? DANGER : "transparent",
      }}
      aria-live="polite"
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
