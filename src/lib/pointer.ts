/**
 * Global cursor telemetry. Written from a single pointermove listener and read
 * imperatively by render loops (WebGL, cursor, typography) so nothing re-renders React.
 */
export const pointer = {
  /** px */
  x: 0,
  y: 0,
  /** 0..1 */
  u: 0.5,
  v: 0.5,
  /** smoothed velocity, px per frame-ish, signed */
  vx: 0,
  vy: 0,
  /** 0..1 eased speed */
  speed: 0,
  active: false,
  coarse: false,
};

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const scrollState = {
  /** px scrolled */
  y: 0,
  /** Lenis velocity */
  velocity: 0,
  /** 0..1 page progress */
  progress: 0,
};

let started = false;

export function startPointer() {
  if (started || typeof window === "undefined") return;
  started = true;
  pointer.coarse = window.matchMedia("(pointer: coarse)").matches;
  pointer.x = window.innerWidth / 2;
  pointer.y = window.innerHeight / 2;

  let lastX = pointer.x;
  let lastY = pointer.y;
  let rawVx = 0;
  let rawVy = 0;

  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => (pointer.active = false));

  // The spotlight (.glass) and the velocity skew read these as CSS variables. They are
  // written onto just those elements, never :root — a variable changed on :root makes
  // the browser recompute the style of every element on the page, every frame.
  let spot: HTMLElement[] = [];
  let skew: HTMLElement[] = [];
  let scanned = -Infinity;
  let lastMx = "";
  let lastMy = "";
  let lastVx = "";
  let skewEase = 0;
  const loop = (now: number) => {
    rawVx = pointer.x - lastX;
    rawVy = pointer.y - lastY;
    lastX = pointer.x;
    lastY = pointer.y;
    pointer.vx += (rawVx - pointer.vx) * 0.18;
    pointer.vy += (rawVy - pointer.vy) * 0.18;
    const target = Math.min(1, Math.hypot(pointer.vx, pointer.vy) / 42);
    pointer.speed += (target - pointer.speed) * (target > pointer.speed ? 0.25 : 0.06);
    pointer.u = pointer.x / window.innerWidth;
    pointer.v = pointer.y / window.innerHeight;

    if (now - scanned > 750) {
      scanned = now;
      spot = Array.from(document.querySelectorAll<HTMLElement>(".glass"));
      skew = Array.from(document.querySelectorAll<HTMLElement>(".velocity-skew"));
      lastMx = lastMy = lastVx = ""; // newly mounted elements need a first write
    }
    const mx = `${Math.round(pointer.x)}px`;
    const my = `${Math.round(pointer.y)}px`;
    skewEase += (Math.max(-1, Math.min(1, pointer.vx / 40)) - skewEase) * 0.08;
    const vx = Math.abs(skewEase) < 0.001 ? "0" : skewEase.toFixed(3);
    if (mx !== lastMx || my !== lastMy) {
      lastMx = mx;
      lastMy = my;
      for (const el of spot) {
        el.style.setProperty("--mx", mx);
        el.style.setProperty("--my", my);
      }
    }
    if (vx !== lastVx) {
      lastVx = vx;
      for (const el of skew) el.style.setProperty("--vx", vx);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
