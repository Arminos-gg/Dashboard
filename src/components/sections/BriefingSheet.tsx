"use client";

import { motion } from "motion/react";
import { useLife } from "@/lib/store";
import { hhmm } from "@/lib/time";
import { requestBriefing } from "@/lib/briefing-runner";

/** Words fade up one after another, like a teleprinter with manners. */
function Typed({ text, delay = 0 }: { text: string; delay?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="inline-block"
          initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: delay + i * 0.018, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </>
  );
}

export function BriefingSheet({ moodKey }: { moodKey: string }) {
  const b = useLife((s) => s.briefing);
  const busy = useLife((s) => s.briefingBusy);
  const ai = useLife((s) => s.ai);

  return (
    <aside className="glass p-6 md:p-8" aria-busy={busy}>
      <div className="mono flex items-center justify-between gap-4 text-muted">
        <span>
          Briefing <span className="text-faint">·</span>{" "}
          <span className="text-ink">{b?.source === "claude" ? "Claude" : "Local synthesis"}</span>
          {b && <span className="text-faint"> · {hhmm(new Date(b.generatedAt))}</span>}
        </span>
        <button
          onClick={() => requestBriefing(moodKey, true)}
          disabled={busy}
          className="flex items-center gap-2 text-faint transition-colors hover:text-ink disabled:opacity-40"
          data-cursor="Recompose"
        >
          <span className="kbd">B</span>
          <span className="hidden sm:inline">{busy ? "Composing" : "Recompose"}</span>
        </button>
      </div>
      <div className={`mt-4 h-px w-full ${busy ? "scan" : "bg-[var(--line)]"}`} />

      {b ? (
        <div key={b.generatedAt}>
          <h3 className="display mt-6 text-[clamp(28px,2.6vw,40px)] leading-[1.02]">
            <Typed text={b.headline} />
          </h3>
          {b.paragraphs.map((p, i) => (
            <p key={i} className="mt-4 text-[15px] leading-[1.6] text-[rgb(236_232_225/0.78)]">
              <Typed text={p} delay={0.25 + i * 0.35} />
            </p>
          ))}
          <div className="mono mt-7 grid gap-3 border-t border-[var(--line)] pt-5">
            {b.focusWindow && (
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-faint">Focus window</span>
                <span className="text-accent">
                  {b.focusWindow.start}–{b.focusWindow.end}
                </span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4">
              <span className="shrink-0 text-faint">Next move</span>
              <span className="text-right normal-case tracking-normal text-ink" style={{ fontFamily: "var(--font-sans)", fontSize: 13 }}>
                {b.nextMove}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className="display mt-6 text-[28px] text-faint">Composing today’s briefing…</p>
      )}
      {!ai?.online && (
        <p className="mono mt-6 text-faint">Set ANTHROPIC_API_KEY to let Claude write this.</p>
      )}
    </aside>
  );
}
