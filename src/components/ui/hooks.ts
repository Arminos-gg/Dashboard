"use client";

import { useEffect, useState } from "react";

/** A clock that re-renders on the given cadence, aligned to the wall clock. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const tick = () => {
      setNow(new Date());
      timer = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 5);
    };
    timer = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 5);
    return () => window.clearTimeout(timer);
  }, [intervalMs]);
  return now;
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}
