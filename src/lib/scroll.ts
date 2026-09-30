"use client";

import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollState } from "./pointer";

let lenis: Lenis | null = null;

export function startSmoothScroll(): Lenis {
  if (lenis) return lenis;
  gsap.registerPlugin(ScrollTrigger);
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
  lenis.on("scroll", (l: Lenis) => {
    scrollState.y = l.scroll;
    scrollState.velocity = l.velocity;
    scrollState.progress = l.limit > 0 ? l.scroll / l.limit : 0;
    ScrollTrigger.update();
  });
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: "smooth" });
}

export function lockScroll(locked: boolean) {
  if (!lenis) return;
  if (locked) lenis.stop();
  else lenis.start();
}
