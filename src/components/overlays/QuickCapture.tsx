"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { useLife } from "@/lib/store";
import { parseLocal } from "@/lib/parse-local";
import { interpret } from "@/lib/ai.client";
import { relativeDay } from "@/lib/time";
import { audio } from "@/lib/audio";
import { burst } from "@/lib/sparks";
import type { CaptureResult } from "@/lib/types";

const EXAMPLES = [
  "remind me to call Alex tomorrow at 3",
  "lunch with Mara friday 1pm for 90 min",
  "urgent: send the invoice to Nord by thursday",
  "meditate every morning",
  "book the Lisbon flights next week #travel",
];

function Token({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="mono text-faint">{label}</div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.35 }}
          className={`display mt-2 truncate text-[clamp(20px,2vw,30px)] ${accent ? "text-accent" : "text-ink"}`}
        >
          {value}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function QuickCapture() {
  const open = useLife((s) => s.captureOpen);
  const setUi = useLife((s) => s.setUi);
  const ai = useLife((s) => s.ai);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "interpreting" | "filed">("idle");
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [ex, setEx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setEx((n) => (n + 1) % EXAMPLES.length), 3200);
    return () => window.clearInterval(t);
  }, [open]);

  const preview = useMemo(() => (text.trim() ? parseLocal(text) : null), [text]);
  const shown = result ?? preview;

  const reset = () => {
    setText("");
    setResult(null);
    setPhase("idle");
  };

  const submit = async (keepOpen: boolean) => {
    const raw = text.trim();
    if (!raw || phase === "interpreting") return;
    setPhase("interpreting");
    const r = await interpret(raw);
    setResult(r);
    setPhase("filed");
    await new Promise((res) => window.setTimeout(res, keepOpen ? 250 : 650));
    const s = useLife.getState();
    const filed = s.commitCapture(r);
    s.pushLog(`Filed · ${r.title} — ${filed.label}${r.source === "claude" ? " · Claude" : ""}`, "accent");
    s.setUi({ highlightId: filed.id });
    if (s.sfx) audio.chime(990);
    const box = input.current?.getBoundingClientRect();
    if (box) burst(box.left + Math.min(box.width, 40 + raw.length * 18), box.top + box.height / 2, 28, 1.2);
    reset();
    if (!keepOpen) setUi({ captureOpen: false });
    else input.current?.focus();
  };

  const whenLabel = (r: CaptureResult | null) => {
    if (!r) return "—";
    if (r.kind === "habit") return "Every day";
    if (!r.date) return "Unscheduled";
    return `${relativeDay(r.date)}${r.time ? ` · ${r.time}` : ""}${r.kind === "event" && r.durationMinutes ? ` · ${r.durationMinutes}m` : ""}`;
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setUi({ captureOpen: o });
        if (!o) reset();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-[60] bg-[rgb(3_3_4/0.72)] backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        </Dialog.Overlay>
        <Dialog.Content
          className="fixed inset-x-0 top-[18vh] z-[61] px-[var(--gutter)] outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            input.current?.focus();
          }}
          data-lenis-prevent
        >
          <motion.div
            initial={{ opacity: 0, y: 30, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-[1280px]"
          >
            <div className="mono flex items-center justify-between text-muted">
              <Dialog.Title className="font-normal">Capture — say it the way you think it</Dialog.Title>
              <span>
                Interpreter · <span className={ai?.online ? "text-accent" : "text-ink"}>{ai?.online ? "Claude" : "Local"}</span>
              </span>
            </div>
            <Dialog.Description className="sr-only">
              Type a task, event or habit in natural language, then press Enter to file it.
            </Dialog.Description>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(false);
              }}
              className="relative mt-8"
            >
              <input
                ref={input}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setResult(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.shiftKey) {
                    e.preventDefault();
                    void submit(true);
                  }
                }}
                placeholder={EXAMPLES[ex]}
                aria-label="Capture"
                className="display w-full bg-transparent pb-5 text-[clamp(34px,5.4vw,92px)] italic leading-[1.05] text-ink caret-[var(--accent)] outline-none focus-visible:outline-none placeholder:text-[rgb(236_232_225/0.18)]"
                autoComplete="off"
                spellCheck={false}
                disabled={phase === "interpreting"}
              />
              <div className={`h-px w-full ${phase === "interpreting" ? "scan" : "bg-[var(--line-strong)]"}`} />
            </form>

            <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-5">
              <div className="col-span-2">
                <Token label="What" value={shown?.title || "—"} />
              </div>
              <Token label="When" value={whenLabel(shown)} accent={!!shown?.date} />
              <Token label="Kind" value={shown ? shown.kind : "—"} />
              <Token
                label={phase === "filed" && result ? `Priority · via ${result.source}` : "Priority"}
                value={shown ? `${shown.priority}${shown.tags.length ? ` · #${shown.tags[0]}` : ""}` : "—"}
              />
            </div>

            <div className="mono mt-12 flex flex-wrap gap-x-8 gap-y-3 text-faint">
              <span className="flex items-center gap-2">
                <span className="kbd">↵</span> File it
              </span>
              <span className="flex items-center gap-2">
                <span className="kbd">⇧</span>
                <span className="kbd">↵</span> File & keep going
              </span>
              <span className="flex items-center gap-2">
                <span className="kbd">Esc</span> Dismiss
              </span>
              <span className="text-faint">{phase === "interpreting" ? "Interpreting…" : phase === "filed" ? "Filed." : ""}</span>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
