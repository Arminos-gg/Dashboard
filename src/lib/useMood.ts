"use client";

import { useMemo } from "react";
import { useLife } from "./store";
import { computeLoad, deriveMood, MOODS } from "./mood";
import { useNow } from "@/components/ui/hooks";
import type { MoodKey } from "./types";

export function useMoodKey(): { key: MoodKey; auto: MoodKey; overridden: boolean } {
  const now = useNow(60_000);
  const tasks = useLife((s) => s.tasks);
  const events = useLife((s) => s.events);
  const focusActive = useLife((s) => s.focus.active);
  const override = useLife((s) => s.moodOverride);
  return useMemo(() => {
    const auto = deriveMood(computeLoad(tasks, events, now), focusActive, now);
    const key = focusActive ? "focus" : (override ?? auto);
    return { key, auto, overridden: !focusActive && !!override };
  }, [tasks, events, now, focusActive, override]);
}

export const useMood = () => MOODS[useMoodKey().key];
