"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { reducedMotion } from "@/lib/pointer";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Editorial section header: an index, a huge serif title that rises out of a
 * line mask on entry, and a giant outlined echo word drifting on a slower plane.
 */
export function SectionHead({
  index,
  title,
  italic,
  meta,
  echo,
}: {
  index: string;
  title: string;
  italic?: string;
  meta?: ReactNode;
  echo?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || reducedMotion()) return;
    const ctx = gsap.context(() => {
      const h = el.querySelector("h2");
      if (h) {
        SplitText.create(h, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 115,
              rotate: 2,
              duration: 1.4,
              ease: "expo.out",
              stagger: 0.09,
              scrollTrigger: { trigger: el, start: "top 82%", once: true },
            }),
        });
      }
      gsap.from(el.querySelectorAll("[data-reveal]"), {
        opacity: 0,
        y: 14,
        duration: 1.1,
        ease: "power3.out",
        stagger: 0.07,
        scrollTrigger: { trigger: el, start: "top 82%", once: true },
      });
      const echoEl = el.querySelector("[data-echo]");
      if (echoEl) {
        gsap.fromTo(
          echoEl,
          { yPercent: 18 },
          { yPercent: -28, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } },
        );
      }
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="relative">
      {echo && (
        <div
          data-echo
          aria-hidden
          className="outline-text display pointer-events-none absolute -top-[6vw] right-[-2vw] select-none text-[clamp(140px,24vw,420px)] italic leading-none"
        >
          {echo}
        </div>
      )}
      <div data-reveal className="mono flex items-center gap-4 text-muted">
        <span className="text-accent">{index}</span>
        <span className="h-px w-10 bg-[var(--line-strong)]" />
        <span>{meta}</span>
      </div>
      <h2 className="display velocity-skew mt-5 text-[clamp(56px,9vw,156px)]">
        {title} {italic && <em className="text-accent">{italic}</em>}
      </h2>
    </div>
  );
}
