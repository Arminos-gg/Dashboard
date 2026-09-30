"use client";

import { useLife } from "./store";
import { composeBriefing } from "./ai.client";
import { localBriefing } from "./briefing-local";
import { dateKey } from "./time";

let inflight: Promise<void> | null = null;

/** Show a local briefing instantly, then upgrade it to Claude's when it lands. */
export function requestBriefing(moodKey: string, force = false): Promise<void> {
  if (inflight) return inflight;
  const s = useLife.getState();
  const now = new Date();
  const fresh =
    s.briefing &&
    s.briefing.date === dateKey(now) &&
    now.getTime() - new Date(s.briefing.generatedAt).getTime() < 4 * 3600_000 &&
    (s.briefing.source === "claude" || !s.ai?.online);
  if (fresh && !force) return Promise.resolve();

  inflight = (async () => {
    s.setUi({ briefingBusy: true });
    if (!s.briefing || s.briefing.date !== dateKey(now)) {
      s.setBriefing(localBriefing({ now, tasks: s.tasks, events: s.events, habits: s.habits, weather: s.weather }));
    }
    try {
      const b = await composeBriefing(moodKey);
      useLife.getState().setBriefing(b);
      useLife.getState().pushLog(b.source === "claude" ? "Briefing composed · Claude" : "Briefing composed · local");
    } finally {
      useLife.getState().setUi({ briefingBusy: false });
      inflight = null;
    }
  })();
  return inflight;
}
