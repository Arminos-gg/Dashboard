"use client";

import type { ReactNode } from "react";
import { useIsHidden } from "@/lib/layout";

/**
 * Wraps a piece of the interface so the layout editor can remove it. Hidden
 * elements render nothing; in edit mode the controller outlines and hides them.
 */
export function Hideable({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const hidden = useIsHidden(id);
  if (hidden) return null;
  return (
    <div data-hide={id} className={className}>
      {children}
    </div>
  );
}
