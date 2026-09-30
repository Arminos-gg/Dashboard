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

  const root = document.documentElement;
  const loop = () => {
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

    root.style.setProperty("--mx", `${pointer.x.toFixed(1)}px`);
    root.style.setProperty("--my", `${pointer.y.toFixed(1)}px`);
    root.style.setProperty("--pu", (pointer.u * 2 - 1).toFixed(4));
    root.style.setProperty("--pv", (pointer.v * 2 - 1).toFixed(4));
    root.style.setProperty("--vel", pointer.speed.toFixed(4));
    root.style.setProperty("--vx", Math.max(-1, Math.min(1, pointer.vx / 40)).toFixed(4));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
