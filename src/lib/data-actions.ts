"use client";

import { pickPersisted, useLife, type PersistedLife } from "./store";
import { audio } from "./audio";
import { requestBriefing } from "./briefing-runner";
import { dateKey } from "./time";

/** Empties everything: tasks, events, habits, history, focus sessions, briefing and settings. */
export function clearAllData() {
  audio.stop();
  const s = useLife.getState();
  s.clearAll();
  s.pushLog("All data cleared", "accent");
  void requestBriefing("drift", true);
}

export function resetDemoData() {
  audio.stop();
  const s = useLife.getState();
  s.resetDemo();
  s.pushLog("Demo universe restored");
  void requestBriefing("flow", true);
}

export function exportData() {
  const blob = new Blob([JSON.stringify(pickPersisted(useLife.getState()), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `life-os-${dateKey()}.json`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  useLife.getState().pushLog("Backup exported");
}

/** Restores a file produced by exportData. Returns an error message, or null on success. */
export async function importData(file: File): Promise<string | null> {
  try {
    const data = JSON.parse(await file.text()) as Partial<PersistedLife>;
    if (!Array.isArray(data.tasks) || !Array.isArray(data.events) || !Array.isArray(data.habits)) {
      return "That file doesn't look like a Life/OS backup.";
    }
    audio.stop();
    const s = useLife.getState();
    s.applyRemote({ ...data, updatedAt: Date.now() });
    s.setUi({ highlightId: null });
    s.pushLog("Backup restored", "accent");
    void requestBriefing("flow", true);
    return null;
  } catch {
    return "Couldn't read that file.";
  }
}
