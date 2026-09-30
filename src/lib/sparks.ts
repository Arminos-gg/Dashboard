"use client";

import { calmMotion } from "./prefs";

/** Hairline spark bursts drawn on a single overlay canvas. */
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  len: number;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
const sparks: Spark[] = [];
let color = "#ffffff";
let running = false;

export function mountSparks(el: HTMLCanvasElement) {
  canvas = el;
  ctx = el.getContext("2d");
  const resize = () => {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);
  return () => window.removeEventListener("resize", resize);
}

function frame() {
  if (!ctx || !canvas) {
    running = false;
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = color;
  ctx.lineCap = "butt";
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life++;
    s.vx *= 0.93;
    s.vy = s.vy * 0.93 + 0.06;
    s.x += s.vx;
    s.y += s.vy;
    const k = 1 - s.life / s.max;
    if (k <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = k * k;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * s.len, s.y - s.vy * s.len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (sparks.length) requestAnimationFrame(frame);
  else running = false;
}

export function burst(x: number, y: number, count = 22, power = 1) {
  if (typeof window === "undefined") return;
  if (calmMotion()) return;
  color = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#fff";
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const v = (2.5 + Math.random() * 5.5) * power;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 26 + Math.random() * 22, len: 2.2 + Math.random() * 2 });
  }
  if (!running) {
    running = true;
    requestAnimationFrame(frame);
  }
}

export function burstFrom(el: Element | null, count?: number) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, count);
}
