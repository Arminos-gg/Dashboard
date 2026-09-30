"use client";

import { DEFAULT_PREFS, useLife } from "./store";

/** Every element the layout editor can remove, with the name shown in the restore list. */
export const ELEMENTS: Record<string, string> = {
  "hud.brand": "Top bar · brand & mood",
  "hud.shortcuts": "Top bar · shortcuts",
  "hud.status": "Top bar · clock & status",
  "now.date": "Now · date line",
  "now.clock": "Now · clock",
  "now.greeting": "Now · greeting",
  "now.weather": "Now · weather",
  "now.weather.hourly": "Weather · next hours",
  "now.weather.sun": "Weather · sunrise & sunset",
  "now.directive": "Now · what now",
  "now.briefing": "Now · briefing",
  "today.head": "Agenda · heading",
  "today.ribbon": "Agenda · timeline",
  "today.three": "Agenda · the three",
  "today.rituals": "Agenda · rituals",
  "today.ledger": "Agenda · task list",
  "telemetry.head": "Telemetry · heading",
  "telemetry.filters": "Telemetry · filters",
  "telemetry.figures": "Telemetry · big numbers",
  "telemetry.chart": "Telemetry · trend chart",
  "telemetry.allocation": "Telemetry · time allocation",
  "telemetry.consistency": "Telemetry · consistency grid",
  "focus.head": "Focus · heading",
  "focus.durations": "Focus · durations",
  "focus.intention": "Focus · intention",
  "focus.soundscape": "Focus · soundscapes",
  footer: "Closing line",
  "monitor.header": "Monitor · header",
  "monitor.date": "Monitor · date",
  "monitor.clock": "Monitor · clock",
  "monitor.weather": "Monitor · weather",
  "monitor.agenda": "Monitor · now / next / later",
  "monitor.focus": "Monitor · focus timer",
  "monitor.timeline": "Monitor · timeline",
  "monitor.three": "Monitor · the three",
  "monitor.rituals": "Monitor · rituals",
  "monitor.whatnow": "Monitor · what now & briefing",
};

export const elementLabel = (id: string) => ELEMENTS[id] ?? id;

export function useHidden(): string[] {
  return useLife((s) => s.prefs?.hidden ?? DEFAULT_PREFS.hidden);
}

export function useIsHidden(id: string): boolean {
  return useLife((s) => (s.prefs?.hidden ?? []).includes(id));
}

export function hideElement(id: string) {
  const s = useLife.getState();
  const hidden = s.prefs?.hidden ?? [];
  if (hidden.includes(id)) return;
  s.setPrefs({ hidden: [...hidden, id] });
  s.pushLog(`Hidden · ${elementLabel(id)} (restore in the Lab)`);
}

export function showElement(id: string) {
  const s = useLife.getState();
  s.setPrefs({ hidden: (s.prefs?.hidden ?? []).filter((x) => x !== id) });
}

export function showAllElements() {
  useLife.getState().setPrefs({ hidden: [] });
}
