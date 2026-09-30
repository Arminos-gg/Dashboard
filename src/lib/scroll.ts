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

let parkedAt = 0;

/** Call before the page content unmounts, while the scroll position is still real. */
export function rememberScroll() {
  parkedAt = window.scrollY;
}

/** A full-screen mode takes over: start it from the top. */
export function parkScroll() {
  window.scrollTo(0, 0);
  lenis?.scrollTo(0, { immediate: true, force: true });
}

/**
 * Coming back from a full-screen mode: the page was unmounted underneath, so the
 * smooth-scroll engine and every scroll-driven reveal must re-measure before anything
 * shows — then return to where the user was and nudge once so the browser repaints.
 */
export function unparkScroll() {
  const y = parkedAt;
  requestAnimationFrame(() => {
    lenis?.resize();
    ScrollTrigger.refresh();
    lenis?.scrollTo(y, { immediate: true, force: true });
    window.scrollTo(0, y);
    requestAnimationFrame(() => {
      window.scrollBy(0, 1);
      window.scrollBy(0, -1);
      ScrollTrigger.update();
    });
  });
}

export function lockScroll(locked: boolean) {
  if (!lenis) return;
  if (locked) lenis.stop();
  else lenis.start();
}
