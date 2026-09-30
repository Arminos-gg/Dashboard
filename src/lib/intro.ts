"use client";

import { getPref } from "./prefs";

/** Evaluated once per page load: the full boot sequence plays only on the first visit of a session. */
export const firstBoot = (() => {
  if (typeof window === "undefined") return false;
  try {
    const seen = sessionStorage.getItem("lifeos:booted");
    sessionStorage.setItem("lifeos:booted", "1");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return !seen && !reduced;
  } catch {
    return false;
  }
})();

/** The full boot sequence plays on the first visit of a session, unless switched off in the Lab. */
export const playIntro = () => firstBoot && getPref("intro");

export const introDelay = () => (playIntro() ? 2.1 : 0.25);
