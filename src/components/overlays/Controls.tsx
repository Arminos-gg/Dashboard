"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { useLife } from "@/lib/store";
import { MOODS } from "@/lib/mood";
import { cloudConfigured } from "@/lib/sync";
import { reverseGeocode } from "@/lib/weather";
import { Glyph } from "@/components/ui/Glyph";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { clearAllData, resetDemoData } from "@/lib/data-actions";
import type { MoodKey } from "@/lib/types";

const KEYS: [string[], string][] = [
  [["K"], "Capture anything"],
  [["E"], "Planner — add & edit in a plain view"],
  [["F"], "Enter the focus chamber"],
  [["Space"], "Hold / resume focus"],
  [["Esc"], "Close · leave focus"],
  [["1", "4"], "Jump between sections"],
  [["N"], "Another suggestion"],
  [["B"], "Recompose the briefing"],
  [["V"], "Morph the chart"],
  [["M"], "Cycle the mood engine"],
  [["S"], "Sound effects on / off"],
  [["Z"], "Undo"],
  [["G"], "Monitor mode — for a second screen"],
  [["L"], "Edit layout — click to hide parts"],
  [["T"], "Lab — display switches & feature tests"],
  [["?"], "This panel"],
];

export function Controls() {
  const open = useLife((s) => s.shortcutsOpen);
  const setUi = useLife((s) => s.setUi);
  const name = useLife((s) => s.profileName);
  const setName = useLife((s) => s.setProfileName);
  const sfx = useLife((s) => s.sfx);
  const setSfx = useLife((s) => s.setSfx);
  const override = useLife((s) => s.moodOverride);
  const setMood = useLife((s) => s.setMoodOverride);
  const ai = useLife((s) => s.ai);
  const sync = useLife((s) => s.syncStatus);
  const location = useLife((s) => s.location);

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(async (p) => {
      const label = await reverseGeocode(p.coords.latitude, p.coords.longitude);
      useLife.getState().setLocation({ lat: p.coords.latitude, lon: p.coords.longitude, label, source: "geo" });
    });

  return (
    <Dialog.Root open={open} onOpenChange={(o) => setUi({ shortcutsOpen: o })}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div className="fixed inset-0 z-[60] bg-[rgb(3_3_4/0.75)] backdrop-blur-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
        </Dialog.Overlay>
        <Dialog.Content
          className="fixed inset-0 z-[61] overflow-y-auto px-[var(--gutter)] py-[12vh] outline-none"
          data-lenis-prevent
          onOpenAutoFocus={(e) => {
            // keep the keystroke that opened the panel out of the name field
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto grid max-w-[1280px] gap-16 lg:grid-cols-2"
          >
            <div>
              <Dialog.Title className="display text-[clamp(48px,6vw,96px)]">
                Controls <em className="text-accent">& keys</em>
              </Dialog.Title>
              <Dialog.Description className="mono mt-4 text-muted">Everything is reachable from the keyboard.</Dialog.Description>
              <ul className="mt-10">
                {KEYS.map(([k, label]) => (
                  <li key={label} className="flex items-center justify-between border-b border-[var(--line)] py-3">
                    <span className="text-[15px] text-muted">{label}</span>
                    <span className="flex items-center gap-1.5">
                      {k.map((x, i) => (
                        <span key={x} className="flex items-center gap-1.5">
                          {i > 0 && <span className="mono text-faint">–</span>}
                          <span className="kbd">{x}</span>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-12">
              <div>
                <div className="mono text-muted">Operator</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 40))}
                  placeholder="Your name"
                  className="display mt-3 w-full border-b border-[var(--line-strong)] bg-transparent pb-3 text-[40px] italic outline-none placeholder:text-faint focus:border-[var(--accent)] focus-visible:outline-none"
                />
              </div>

              <div>
                <div className="mono text-muted">Mood engine</div>
                <div className="mono mt-4 flex flex-wrap gap-x-6 gap-y-3">
                  {([null, "drift", "flow", "surge", "nocturne"] as (MoodKey | null)[]).map((k) => (
                    <button
                      key={k ?? "auto"}
                      onClick={() => setMood(k)}
                      className="transition-colors"
                      style={{ color: override === k ? "var(--accent)" : "var(--faint)" }}
                      aria-pressed={override === k}
                    >
                      {k ? MOODS[k].label : "Auto"}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[13px] text-faint">
                  Auto reads your load — open priorities, remaining events, the hour — and retunes colour, particles and tempo.
                </p>
              </div>

              <div className="mono grid gap-4">
                <div className="text-muted">Systems</div>
                <Row label="Sound effects">
                  <button onClick={() => setSfx(!sfx)} className="flex items-center gap-2 text-ink">
                    <Glyph name={sfx ? "sound-on" : "sound-off"} size={15} /> {sfx ? "On" : "Off"}
                  </button>
                </Row>
                <Row label="Location">
                  <button onClick={locate} className="flex items-center gap-2 text-ink">
                    <Glyph name="locate" size={14} /> {location?.label ?? "—"} {location?.source === "tz" && <span className="text-faint">(estimate)</span>}
                  </button>
                </Row>
                <Row label="Interpreter">
                  <span className={ai?.online ? "text-accent" : "text-ink"}>{ai?.online ? `Claude · ${ai.model}` : "Local parser"}</span>
                </Row>
                <Row label="Cloud sync">
                  <span className="text-ink">{cloudConfigured ? (sync === "cloud" ? "Supabase · live" : sync) : "Not configured"}</span>
                </Row>
              </div>

              <div className="mono flex flex-wrap items-center gap-4">
                <button
                  onClick={() => setUi({ shortcutsOpen: false, plannerOpen: true })}
                  className="border border-[var(--line-strong)] px-3 py-2 text-ink transition-colors hover:border-[var(--accent)]"
                >
                  Open planner (E)
                </button>
                <button
                  onClick={() => {
                    resetDemoData();
                    setUi({ shortcutsOpen: false });
                  }}
                  className="text-faint transition-colors hover:text-ink"
                >
                  Reset demo
                </button>
                <ConfirmButton
                  onConfirm={() => {
                    clearAllData();
                    setUi({ shortcutsOpen: false });
                  }}
                  confirmLabel="Yes, delete everything"
                >
                  Clear all data
                </ConfirmButton>
                <Dialog.Close className="ml-auto text-ink">Close ✕</Dialog.Close>
              </div>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
      <span className="text-faint">{label}</span>
      {children}
    </div>
  );
}
