"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { playIntro } from "@/lib/intro";
import { useMood } from "@/lib/useMood";

/** Boot sequence: a hairline draws the horizon, telemetry checks in, then the curtain lifts. */
export function Intro() {
  const root = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);
  const mood = useMood();

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => setGone(true) });
      if (!playIntro()) {
        tl.to(el, { opacity: 0, duration: 0.7, ease: "power2.out", delay: 0.05 });
        return;
      }
      const counter = { v: 0 };
      tl.from("[data-line]", { scaleX: 0, duration: 1.1, ease: "expo.inOut" })
        .from("[data-boot] > *", { opacity: 0, y: 10, stagger: 0.1, duration: 0.45, ease: "power2.out" }, "-=0.55")
        .to(
          counter,
          {
            v: 100,
            duration: 0.9,
            ease: "power2.inOut",
            onUpdate: () => {
              const c = el.querySelector("[data-count]");
              if (c) c.textContent = String(Math.round(counter.v)).padStart(3, "0");
            },
          },
          "<",
        )
        .to("[data-boot], [data-count-wrap]", { opacity: 0, y: -8, duration: 0.35 }, "+=0.1")
        .to("[data-line]", { scaleY: 400, opacity: 0, duration: 0.9, ease: "expo.in" }, "<")
        .to(el, { clipPath: "inset(0% 0% 100% 0%)", duration: 1, ease: "expo.inOut" }, "-=0.45");

      const skip = () => tl.progress(1);
      window.addEventListener("keydown", skip, { once: true });
      window.addEventListener("pointerdown", skip, { once: true });
      return () => {
        window.removeEventListener("keydown", skip);
        window.removeEventListener("pointerdown", skip);
      };
    }, el);
    return () => ctx.revert();
  }, []);

  if (gone) return null;

  return (
    <div ref={root} className="fixed inset-0 z-[100] grid place-items-center bg-[var(--void)]" style={{ clipPath: "inset(0% 0% 0% 0%)" }} aria-hidden>
      <div className="w-[min(80vw,720px)]">
        <div data-boot className="mono flex justify-between text-muted">
          <span className="text-ink">
            Life<span className="text-accent">/</span>OS
          </span>
          <span>Personal command</span>
        </div>
        <div data-line className="my-5 h-px w-full origin-left bg-[var(--ink)] opacity-60" />
        <div data-boot className="mono grid grid-cols-2 gap-y-1.5 text-faint sm:grid-cols-4">
          <span>Telemetry · ok</span>
          <span>Agenda · ok</span>
          <span>Interpreter · ok</span>
          <span>
            Mood · <span className="text-accent">{mood.label}</span>
          </span>
        </div>
        <div data-count-wrap className="mono mt-8 text-right text-faint">
          <span data-count className="text-ink">
            000
          </span>{" "}
          %
        </div>
      </div>
    </div>
  );
}
