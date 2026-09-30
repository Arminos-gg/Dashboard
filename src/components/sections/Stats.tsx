"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLife } from "@/lib/store";
import { buildDays, dayScore, liveDayStat, metricValue, momentumStreak, totalActivities, type Metric } from "@/lib/stats";
import { addDays, dateKey } from "@/lib/time";
import { useNow } from "@/components/ui/hooks";
import { SectionHead } from "@/components/ui/SectionHead";
import { MorphChart, type ChartView } from "@/components/charts/MorphChart";
import { Allocation } from "@/components/charts/Allocation";
import { Consistency } from "@/components/charts/Consistency";

gsap.registerPlugin(ScrollTrigger);

const RANGES = [7, 30, 90] as const;
const METRICS: { key: Metric; label: string; format: (v: number) => string; axis: (v: number) => string }[] = [
  { key: "completed", label: "Tasks completed", format: (v) => `${Math.round(v)}`, axis: (v) => `${Math.round(v)}` },
  { key: "focus", label: "Focus hours", format: (v) => `${v.toFixed(1)}h`, axis: (v) => `${v.toFixed(1)}H` },
  { key: "score", label: "Day score", format: (v) => `${Math.round(v)}`, axis: (v) => `${Math.round(v)}` },
];

/** Counts to its value with GSAP — once on entry, then whenever the value changes. */
function Count({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef({ v: 0 });
  const seen = useRef(false);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const run = () =>
      gsap.to(shown.current, {
        v: value,
        duration: 1.6,
        ease: "expo.out",
        overwrite: true,
        onUpdate: () => {
          node.textContent = shown.current.v.toFixed(decimals) + suffix;
        },
      });
    if (seen.current) {
      run();
      return;
    }
    node.textContent = (0).toFixed(decimals) + suffix;
    const st = ScrollTrigger.create({
      trigger: node,
      start: "top 90%",
      once: true,
      onEnter: () => {
        seen.current = true;
        run();
      },
    });
    return () => st.kill();
  }, [value, decimals, suffix]);
  return <span ref={el} />;
}

function Seg<T extends string | number>({
  options,
  value,
  onChange,
  label,
  render,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  render?: (v: T) => string;
}) {
  return (
    <div className="mono flex items-center gap-4" role="radiogroup" aria-label={label}>
      <span className="text-faint">{label}</span>
      {options.map((o) => (
        <button
          key={String(o)}
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className="relative pb-1 transition-colors"
          style={{ color: o === value ? "var(--ink)" : "var(--faint)" }}
        >
          {render ? render(o) : String(o)}
          {o === value && <motion.span layoutId={`seg-${label}`} className="absolute inset-x-0 -bottom-px h-px bg-[var(--accent)]" />}
        </button>
      ))}
    </div>
  );
}

export function StatsSection() {
  const now = useNow(60_000);
  const history = useLife((s) => s.history);
  const tasks = useLife((s) => s.tasks);
  const sessions = useLife((s) => s.sessions);
  const events = useLife((s) => s.events);
  const habits = useLife((s) => s.habits);
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [metric, setMetric] = useState<Metric>("completed");
  const [view, setView] = useState<ChartView>("linear");

  useEffect(() => {
    const flip = () => setView((v) => (v === "linear" ? "radial" : "linear"));
    window.addEventListener("lifeos:flip-chart", flip);
    return () => window.removeEventListener("lifeos:flip-chart", flip);
  }, []);

  const todayStat = useMemo(
    () => liveDayStat(dateKey(now), tasks, sessions, events, undefined, now),
    [now, tasks, sessions, events],
  );

  const data = useMemo(() => {
    const span = buildDays(range + 6, history, todayStat, now);
    const days = span.slice(6);
    const values = days.map((d) => metricValue(d, metric, habits));
    const all = span.map((d) => metricValue(d, metric, habits));
    const avg = range > 7 ? days.map((_, i) => all.slice(i, i + 7).reduce((a, b) => a + b, 0) / 7) : null;
    const prev = buildDays(range * 2, history, todayStat, now).slice(0, range);
    const sum = (arr: typeof days, f: (d: (typeof days)[number]) => number) => arr.reduce((a, d) => a + f(d), 0);
    const ritualRate = (arr: typeof days) =>
      habits.length ? sum(arr, (d) => habits.filter((h) => h.log[d.date]).length) / (arr.length * habits.length) : 0;
    return {
      days,
      values,
      avg,
      dates: days.map((d) => d.date),
      tasks: sum(days, (d) => d.completed),
      tasksPrev: sum(prev, (d) => d.completed),
      focusH: sum(days, (d) => d.focusMin) / 60,
      focusPrev: sum(prev, (d) => d.focusMin) / 60,
      rituals: ritualRate(days) * 100,
      ritualsPrev: ritualRate(prev) * 100,
      score: (sum(days, (d) => dayScore(d, habits, d.date)) / days.length) * 100,
    };
  }, [range, metric, history, todayStat, habits, now]);

  const streak = useMemo(() => momentumStreak(history, todayStat, habits, now), [history, todayStat, habits, now]);
  const totals = useMemo(() => totalActivities(data.days), [data.days]);
  const m = METRICS.find((x) => x.key === metric)!;
  const delta = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : 0);

  const figures = [
    { label: "Momentum", value: streak, suffix: "", decimals: 0, note: "days in a row ≥ 50", d: null as number | null },
    { label: "Completed", value: data.tasks, suffix: "", decimals: 0, note: `tasks · ${range}d`, d: delta(data.tasks, data.tasksPrev) },
    { label: "Depth", value: data.focusH, suffix: "h", decimals: 1, note: `focus · ${range}d`, d: delta(data.focusH, data.focusPrev) },
    { label: "Rituals", value: data.rituals, suffix: "%", decimals: 0, note: `kept · ${range}d`, d: delta(data.rituals, data.ritualsPrev) },
  ];

  return (
    <section id="telemetry" className="relative px-frame py-[16vh]">
      <SectionHead index="03" title="Telemetry" italic="of the self" meta={`Mean day score ${Math.round(data.score)} · last ${range} days`} echo="Signal" />

      {/* one filter row scopes every chart below */}
      <div className="relative z-20 mt-[8vh] md:sticky md:top-16 flex flex-wrap gap-x-10 gap-y-3 border-y border-[var(--line)] bg-[rgb(5_5_6/0.86)] py-4 backdrop-blur-xl">
        <Seg label="Range" options={RANGES} value={range} onChange={setRange} render={(r) => `${r}D`} />
        <Seg label="Signal" options={METRICS.map((x) => x.key)} value={metric} onChange={setMetric} render={(k) => METRICS.find((x) => x.key === k)!.label.split(" ")[0]} />
        <Seg label="Form" options={["linear", "radial", "table"] as const} value={view} onChange={setView} />
      </div>

      <div className="mt-12 grid grid-cols-2 gap-y-10 border-b border-[var(--line)] pb-12 lg:grid-cols-4">
        {figures.map((f, i) => (
          <div key={f.label} className={`pr-6 ${i > 0 ? "lg:border-l lg:border-[var(--line)] lg:pl-8" : ""}`}>
            <div className="mono text-muted">{f.label}</div>
            <div className="figure mt-4 text-[clamp(56px,6.4vw,112px)]">
              <Count value={f.value} decimals={f.decimals} suffix={f.suffix} />
            </div>
            <div className="mono mt-3 flex gap-3 text-faint">
              <span>{f.note}</span>
              {f.d != null && (
                <span className={f.d >= 0 ? "text-accent" : "text-muted"}>
                  {f.d >= 0 ? "▲" : "▼"} {Math.abs(f.d)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <MorphChart values={data.values} avg={data.avg} dates={data.dates} view={view} format={m.format} axisFormat={m.axis} label={m.label} />
        <p className="mono mt-6 text-faint">
          Form morphs the same series between a timeline and a dial — press <span className="kbd">V</span> to flip.
        </p>
      </div>

      <div className="mt-[14vh] grid gap-20 xl:grid-cols-2">
        <div>
          <div className="mono mb-10 flex justify-between text-muted">
            <span>Allocation</span>
            <span className="text-faint">Where the hours went · {range}d</span>
          </div>
          <Allocation totals={totals} />
        </div>
        <div>
          <div className="mono mb-10 flex justify-between text-muted">
            <span>Consistency</span>
            <span className="text-faint">26 weeks · {addDays(now, -181).getFullYear() !== now.getFullYear() ? "rolling" : now.getFullYear()}</span>
          </div>
          <Consistency history={history} todayStat={todayStat} habits={habits} now={now} />
        </div>
      </div>
    </section>
  );
}
