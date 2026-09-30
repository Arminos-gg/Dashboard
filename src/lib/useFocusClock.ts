"use client";

import { useEffect } from "react";
import { focusElapsed, useLife } from "./store";
import { audio } from "./audio";
import { burst } from "./sparks";
import { useNow } from "@/components/ui/hooks";

/**
 * Live readout of the running focus session. Whichever view is showing the timer
 * (the chamber or monitor mode) also closes the session when it reaches zero.
 */
export function useFocusClock() {
  const now = useNow(250);
  const focus = useLife((s) => s.focus);
  const done = focus.completed ?? null;
  const elapsed = Math.min(focusElapsed(focus, now.getTime()), focus.durationMs);
  const remaining = Math.max(0, focus.durationMs - elapsed);

  useEffect(() => {
    if (!focus.active || remaining > 0 || done != null) return;
    useLife.getState().endFocus(true);
    audio.chime(523.25);
    window.setTimeout(() => audio.chime(784), 280);
    burst(window.innerWidth / 2, window.innerHeight / 2, 60, 1.8);
  }, [focus.active, remaining, done]);

  return {
    focus,
    done,
    elapsed,
    remaining,
    progress: focus.durationMs ? elapsed / focus.durationMs : 0,
    paused: !focus.runningSince,
    mins: Math.floor(remaining / 60_000),
    secs: Math.floor((remaining % 60_000) / 1000),
  };
}
