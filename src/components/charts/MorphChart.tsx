"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { AnimatePresence, motion } from "motion/react";
import { fromDateKey, relativeDay } from "@/lib/time";

const M = 120;
const LEVELS = [0.25, 0.5, 0.75, 1];
const DATE_TICKS = 5;
const GAP = 0.34; // radians left open at 6 o'clock in the dial

export type ChartView = "linear" | "radial" | "table";

interface Geom {
  w: number;
  h: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  cx: number;
  cy: number;
  r0: number;
  r1: number;
}

/** Catmull-Rom resample so every dataset has the same point count and can morph into any other. */
function resample(values: number[], out: Float32Array) {
  const n = values.length;
  if (n === 0) return out.fill(0);
  if (n === 1) return out.fill(values[0]);
  for (let j = 0; j < M; j++) {
    const x = (j / (M - 1)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(x));
    const t = x - i;
    const p0 = values[Math.max(0, i - 1)];
    const p1 = values[i];
    const p2 = values[i + 1];
    const p3 = values[Math.min(n - 1, i + 2)];
    const t2 = t * t;
    const t3 = t2 * t;
    const v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    out[j] = Math.max(0, v);
  }
  return out;
}

/**
 * The curvature morph: at T=0 the series lies on a straight baseline; as T grows
 * the baseline bends into an ever-tighter arc until it closes into a dial, with
 * values always extending along the local normal. Time runs clockwise from 6 o'clock.
 */
function project(u: number, v: number, T: number, g: Geom): [number, number] {
  const L = g.w - g.padL - g.padR;
  const Hh = g.h - g.padT - g.padB;
  const phiFinal = Math.PI * 2 - GAP;
  const S = L + (g.r0 * phiFinal - L) * T;
  const scale = Hh + (g.r1 - g.r0 - Hh) * T;
  const topX = g.padL + L / 2 + (g.cx - (g.padL + L / 2)) * T;
  const topY = g.h - g.padB + (g.cy - g.r0 - (g.h - g.padB)) * T;
  const phi = phiFinal * T;
  if (phi < 1e-5) {
    return [topX + (u - 0.5) * S, topY - v * scale];
  }
  const rho = S / phi;
  const a = (u - 0.5) * phi;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const oneMinusCos = 2 * Math.sin(a / 2) ** 2;
  const bx = topX + rho * sin;
  const by = topY + rho * oneMinusCos;
  return [bx + sin * v * scale, by - cos * v * scale];
}

function polyline(pts: [number, number][]) {
  let d = "";
  for (let i = 0; i < pts.length; i++) d += `${i ? "L" : "M"}${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return d;
}

export function MorphChart({
  values,
  avg,
  dates,
  view,
  format,
  axisFormat,
  label,
}: {
  values: number[];
  avg: number[] | null;
  dates: string[];
  view: ChartView;
  format: (v: number) => string;
  axisFormat: (v: number) => string;
  label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 960, h: 480 });

  const niceMax = useMemo(() => {
    const m = Math.max(1, d3.max(values) ?? 0, avg ? (d3.max(avg) ?? 0) : 0);
    return d3.scaleLinear().domain([0, m * 1.08]).nice(4).domain()[1] || 1;
  }, [values, avg]);

  const geom = useMemo<Geom>(() => {
    const { w, h } = size;
    const r1 = Math.min(w, h) * 0.46;
    return { w, h, padL: 44, padR: 16, padT: 28, padB: 40, cx: w / 2, cy: h / 2, r0: r1 * 0.36, r1 };
  }, [size]);

  // animated state
  const cur = useRef(new Float32Array(M));
  const vel = useRef(new Float32Array(M));
  const tgt = useRef(new Float32Array(M));
  const curAvg = useRef(new Float32Array(M));
  const tgtAvg = useRef(new Float32Array(M));
  const T = useRef(view === "radial" ? 1 : 0);
  const TV = useRef(0);
  const TT = useRef(view === "radial" ? 1 : 0);
  const hover = useRef<number | null>(null);
  const raf = useRef(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const first = useRef(true);

  const refs = useRef<{
    area?: SVGPathElement | null;
    line?: SVGPathElement | null;
    avg?: SVGPathElement | null;
    base?: SVGPathElement | null;
    grid: (SVGPathElement | null)[];
    vlabels: (SVGTextElement | null)[];
    dlabels: (SVGTextElement | null)[];
    dticks: (SVGPathElement | null)[];
    marker?: SVGGElement | null;
    mline?: SVGPathElement | null;
    mdot?: SVGCircleElement | null;
    end?: SVGCircleElement | null;
    endHalo?: SVGCircleElement | null;
    endText?: SVGTextElement | null;
  }>({ grid: [], vlabels: [], dlabels: [], dticks: [] });

  const draw = useCallback(() => {
    const g = geom;
    const t = Math.max(0, Math.min(1, T.current));
    const r = refs.current;
    const line: [number, number][] = [];
    const base: [number, number][] = [];
    const avgPts: [number, number][] = [];
    for (let j = 0; j < M; j++) {
      const u = j / (M - 1);
      line.push(project(u, cur.current[j], t, g));
      base.push(project(u, 0, t, g));
      avgPts.push(project(u, curAvg.current[j], t, g));
    }
    r.line?.setAttribute("d", polyline(line));
    r.base?.setAttribute("d", polyline(base));
    r.area?.setAttribute("d", polyline([...line, ...base.slice().reverse()]) + "Z");
    r.avg?.setAttribute("d", avg ? polyline(avgPts) : "");
    LEVELS.forEach((lv, k) => {
      const pts: [number, number][] = [];
      for (let j = 0; j < 64; j++) pts.push(project(j / 63, lv, t, g));
      r.grid[k]?.setAttribute("d", polyline(pts));
      const [lx, ly] = project(-0.012, lv, t, g);
      r.vlabels[k]?.setAttribute("transform", `translate(${lx.toFixed(1)} ${(ly + 3).toFixed(1)})`);
    });
    for (let k = 0; k < DATE_TICKS; k++) {
      const u = k / (DATE_TICKS - 1);
      const [ax, ay] = project(u, 0, t, g);
      const [bx, by] = project(u, -0.035, t, g);
      r.dticks[k]?.setAttribute("d", `M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`);
      const [lx, ly] = project(u, -0.1 - 0.02 * (1 - t), t, g);
      const lbl = r.dlabels[k];
      lbl?.setAttribute("transform", `translate(${lx.toFixed(1)} ${(ly + 4).toFixed(1)})`);
      // in the dial the first and last dates meet at the gap: push them to either side of it
      const edge = k === 0 ? "end" : k === DATE_TICKS - 1 ? "start" : "middle";
      lbl?.setAttribute("text-anchor", t > 0.6 ? edge : k === 0 ? "start" : k === DATE_TICKS - 1 ? "end" : "middle");
    }
    // endpoint (today)
    const [ex, ey] = line[M - 1];
    r.end?.setAttribute("cx", ex.toFixed(1));
    r.end?.setAttribute("cy", ey.toFixed(1));
    r.endHalo?.setAttribute("cx", ex.toFixed(1));
    r.endHalo?.setAttribute("cy", ey.toFixed(1));
    r.endText?.setAttribute("transform", `translate(${(ex + 10).toFixed(1)} ${(ey - 10).toFixed(1)})`);
    // hover marker
    const hi = hover.current;
    if (hi != null && r.marker) {
      const n = values.length;
      const u = n > 1 ? hi / (n - 1) : 1;
      const j = Math.round(u * (M - 1));
      const [px, py] = project(u, cur.current[j], t, g);
      const [qx, qy] = project(u, 0, t, g);
      const [tx, ty] = project(u, 1.02, t, g);
      r.marker.style.opacity = "1";
      r.mline?.setAttribute("d", `M${qx.toFixed(1)} ${qy.toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}`);
      r.mdot?.setAttribute("cx", px.toFixed(1));
      r.mdot?.setAttribute("cy", py.toFixed(1));
    } else if (r.marker) r.marker.style.opacity = "0";
  }, [geom, avg, values.length]);

  const kick = useCallback(() => {
    cancelAnimationFrame(raf.current);
    let last = performance.now();
    const k = 70;
    const c = 2 * Math.sqrt(k) * 0.82;
    const kt = 26;
    const ct = 2 * Math.sqrt(kt);
    const integrate = (dt: number) => {
      for (let j = 0; j < M; j++) {
        const x = cur.current[j];
        const a = (tgt.current[j] - x) * k - vel.current[j] * c;
        vel.current[j] += a * dt;
        cur.current[j] = x + vel.current[j] * dt;
        curAvg.current[j] += (tgtAvg.current[j] - curAvg.current[j]) * Math.min(1, dt * 7);
      }
      TV.current += ((TT.current - T.current) * kt - TV.current * ct) * dt;
      T.current += TV.current * dt;
    };
    const step = (now: number) => {
      // fixed substeps keep the springs stable and real-time even on slow frames
      let remaining = Math.min(0.12, (now - last) / 1000);
      last = now;
      while (remaining > 1e-6) {
        const h = Math.min(1 / 120, remaining);
        integrate(h);
        remaining -= h;
      }
      let moving = false;
      for (let j = 0; j < M; j++) {
        if (Math.abs(vel.current[j]) > 1e-4 || Math.abs(tgt.current[j] - cur.current[j]) > 1e-4) {
          moving = true;
          break;
        }
      }
      if (Math.abs(TT.current - T.current) > 1e-4 || Math.abs(TV.current) > 1e-4) moving = true;
      else {
        T.current = TT.current;
        TV.current = 0;
      }
      draw();
      if (moving) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [draw]);

  // data → targets
  useEffect(() => {
    const norm = values.map((v) => v / niceMax);
    resample(norm, tgt.current);
    if (avg) resample(avg.map((v) => v / niceMax), tgtAvg.current);
    else tgtAvg.current.fill(0);
    if (first.current) {
      // grow out of the baseline on first paint
      first.current = false;
      cur.current.fill(0);
      curAvg.current.fill(0);
    }
    kick();
  }, [values, avg, niceMax, kick]);

  useEffect(() => {
    if (view !== "table") TT.current = view === "radial" ? 1 : 0;
    kick();
  }, [view, kick]);

  useEffect(() => {
    draw();
  }, [draw, size]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setSize({ w, h: Math.max(340, Math.min(560, w * 0.52)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const setHover = (i: number | null) => {
    hover.current = i;
    setHovered(i);
    draw();
  };

  const onMove = (e: React.PointerEvent) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return;
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const t = Math.max(0, Math.min(1, T.current));
    let best = -1;
    let bd = Infinity;
    const n = values.length;
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) : 1;
      const j = Math.round(u * (M - 1));
      const [x, y] = project(u, cur.current[j] * 0.5, t, geom);
      const dd = (x - px) ** 2 + (y - py) ** 2;
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    }
    setHover(best >= 0 ? best : null);
  };

  const tickDates = Array.from({ length: DATE_TICKS }, (_, k) => dates[Math.round((k / (DATE_TICKS - 1)) * (dates.length - 1))]);
  const h = hovered ?? values.length - 1;
  const shownDate = dates[h];

  return (
    <div ref={wrap} className="relative">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
        <div aria-live="polite">
          <div className="mono text-faint">{hovered != null ? (shownDate ? relativeDay(shownDate) : "") : "Today"}</div>
          <div className="figure mt-1 text-[clamp(40px,4.2vw,64px)]">{format(values[h] ?? 0)}</div>
          <div className="mono mt-1 text-muted">{label}</div>
        </div>
        {/* a single series needs no legend; show it only when the mean line is drawn */}
        {avg && (
          <div className="mono flex items-center gap-5 text-faint">
            <span className="flex items-center gap-2">
              <span className="inline-block h-[1.5px] w-5 bg-[var(--accent)]" /> Daily
            </span>
            {avg && (
              <span className="flex items-center gap-2">
                <svg width="20" height="2" aria-hidden>
                  <line x1="0" x2="20" y1="1" y2="1" stroke="var(--ink)" strokeOpacity="0.6" strokeDasharray="3 3" />
                </svg>
                7-day mean
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative">
      <motion.div animate={{ opacity: view === "table" ? 0.06 : 1, filter: view === "table" ? "blur(6px)" : "blur(0px)" }} transition={{ duration: 0.6 }}>
        <svg
          ref={svg}
          width={size.w}
          height={size.h}
          className="block overflow-visible outline-none"
          tabIndex={0}
          role="img"
          aria-label={`${label} over ${values.length} days. Latest ${format(values[values.length - 1] ?? 0)}. Use arrow keys to inspect days.`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const cur0 = hover.current ?? values.length - 1;
              setHover(Math.max(0, Math.min(values.length - 1, cur0 + (e.key === "ArrowLeft" ? -1 : 1))));
            }
            if (e.key === "Escape") setHover(null);
          }}
          onBlur={() => setHover(null)}
          data-cursor="Inspect"
        >
          <defs>
            <linearGradient id="mc-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {LEVELS.map((lv, k) => (
            <path key={lv} ref={(el) => void (refs.current.grid[k] = el)} fill="none" stroke="var(--line)" />
          ))}
          <path ref={(el) => void (refs.current.base = el)} fill="none" stroke="var(--line-strong)" />
          {tickDates.map((_, k) => (
            <path key={k} ref={(el) => void (refs.current.dticks[k] = el)} stroke="var(--line-strong)" />
          ))}
          <path ref={(el) => void (refs.current.area = el)} fill="url(#mc-area)" />
          <path ref={(el) => void (refs.current.avg = el)} fill="none" stroke="var(--ink)" strokeOpacity={0.55} strokeDasharray="3 3" />
          <path ref={(el) => void (refs.current.line = el)} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
          {LEVELS.map((lv, k) => (
            <text
              key={`v${lv}`}
              ref={(el) => void (refs.current.vlabels[k] = el)}
              textAnchor="end"
              fontSize={9.5}
              fill="var(--faint)"
              className="mono"
              letterSpacing="0.1em"
            >
              {axisFormat(lv * niceMax)}
            </text>
          ))}
          {tickDates.map((d, k) => (
            <text
              key={`d${k}`}
              ref={(el) => void (refs.current.dlabels[k] = el)}
              textAnchor="middle"
              fontSize={9.5}
              fill="var(--faint)"
              className="mono"
              letterSpacing="0.12em"
            >
              {d ? fromDateKey(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase() : ""}
            </text>
          ))}
          <circle ref={(el) => void (refs.current.endHalo = el)} r={10} fill="none" stroke="var(--accent)" strokeOpacity={0.35} />
          <circle ref={(el) => void (refs.current.end = el)} r={3.5} fill="var(--accent)" />
          <text ref={(el) => void (refs.current.endText = el)} fontSize={9.5} className="mono" fill="var(--accent)" letterSpacing="0.14em">
            TODAY
          </text>
          <g ref={(el) => void (refs.current.marker = el)} style={{ opacity: 0, transition: "opacity .2s" }} pointerEvents="none">
            <path ref={(el) => void (refs.current.mline = el)} stroke="var(--ink)" strokeOpacity={0.35} />
            <circle ref={(el) => void (refs.current.mdot = el)} r={4.5} fill="var(--void)" stroke="var(--ink)" strokeWidth={1.5} />
          </g>
        </svg>
      </motion.div>

      <AnimatePresence>
        {view === "table" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="absolute inset-0 overflow-y-auto"
            data-lenis-prevent
          >
            <table className="mono w-full text-left">
              <thead className="sticky top-0 bg-[var(--void)] text-faint">
                <tr>
                  <th className="py-2 font-normal">Date</th>
                  <th className="py-2 text-right font-normal">{label}</th>
                  {avg && <th className="py-2 text-right font-normal">7-day mean</th>}
                </tr>
              </thead>
              <tbody>
                {values
                  .map((v, i) => ({ v, i }))
                  .reverse()
                  .map(({ v, i }) => (
                    <tr key={dates[i]} className="border-t border-[var(--line)] text-muted">
                      <td className="py-2">{relativeDay(dates[i])}</td>
                      <td className="py-2 text-right text-ink">{format(v)}</td>
                      {avg && <td className="py-2 text-right">{format(avg[i])}</td>}
                    </tr>
                  ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
