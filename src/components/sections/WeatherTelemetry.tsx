"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";
import { useLife } from "@/lib/store";
import { reverseGeocode, weatherGlyph, weatherLabel } from "@/lib/weather";
import { hhmm } from "@/lib/time";
import { Glyph } from "@/components/ui/Glyph";

function SunArc({ now, sunrise, sunset }: { now: Date; sunrise: Date; sunset: Date }) {
  const W = 300;
  const H = 74;
  const base = H - 14;
  const t = (now.getTime() - sunrise.getTime()) / (sunset.getTime() - sunrise.getTime());
  const day = t >= 0 && t <= 1;
  const tc = Math.max(0, Math.min(1, t));
  const x = 12 + tc * (W - 24);
  const y = base - Math.sin(tc * Math.PI) * (base - 8);
  const arc = d3.range(0, 1.001, 0.02).map((u) => [12 + u * (W - 24), base - Math.sin(u * Math.PI) * (base - 8)] as [number, number]);
  const line = d3.line();
  const travelled = arc.filter(([ax]) => ax <= x);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Sunrise ${hhmm(sunrise)}, sunset ${hhmm(sunset)}`}>
      <line x1={0} x2={W} y1={base} y2={base} stroke="var(--line-strong)" />
      <path d={line(arc) ?? ""} fill="none" stroke="var(--line)" />
      {day && travelled.length > 1 && <path d={line(travelled) ?? ""} fill="none" stroke="var(--accent)" strokeWidth={1} />}
      {day ? (
        <>
          <circle cx={x} cy={y} r={3.5} fill="var(--accent)" />
          <circle cx={x} cy={y} r={9} fill="none" stroke="var(--accent)" opacity={0.35} />
        </>
      ) : (
        <circle cx={t < 0 ? 12 : W - 12} cy={base + 7} r={2.5} fill="none" stroke="var(--muted)" />
      )}
      <text x={12} y={H - 1} className="mono" fontSize={9} fill="var(--faint)" letterSpacing="0.15em">
        ↑ {hhmm(sunrise)}
      </text>
      <text x={W - 12} y={H - 1} textAnchor="end" className="mono" fontSize={9} fill="var(--faint)" letterSpacing="0.15em">
        {hhmm(sunset)} ↓
      </text>
    </svg>
  );
}

function HourStrip({ hourly }: { hourly: { time: string; temp: number; precip: number }[] }) {
  const W = 300;
  const H = 64;
  const data = hourly.slice(0, 13);
  const x = d3.scaleLinear().domain([0, data.length - 1]).range([14, W - 14]);
  const ext = d3.extent(data, (d) => d.temp) as [number, number];
  const y = d3.scaleLinear().domain([ext[0] - 1, ext[1] + 1]).range([H - 24, 8]);
  const line = d3
    .line<(typeof data)[number]>()
    .x((_, i) => x(i))
    .y((d) => y(d.temp))
    .curve(d3.curveCatmullRom.alpha(0.5));
  const summary = data.map((d) => `${new Date(d.time).getHours()}h ${Math.round(d.temp)}°`).join(", ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Next hours: ${summary}`}>
      {data.map((d, i) => (
        <rect
          key={d.time}
          x={x(i) - 1}
          width={2}
          y={H - 16 - (d.precip / 100) * 22}
          height={(d.precip / 100) * 22}
          fill="var(--accent)"
          opacity={0.35}
        />
      ))}
      <path d={line(data) ?? ""} fill="none" stroke="var(--ink)" strokeOpacity={0.7} strokeWidth={1} />
      {data.map((d, i) =>
        i % 3 === 0 ? (
          <g key={`l${d.time}`}>
            <circle cx={x(i)} cy={y(d.temp)} r={2} fill="var(--void)" stroke="var(--ink)" />
            <text x={x(i)} y={H - 3} textAnchor={i === 0 ? "start" : "middle"} dx={i === 0 ? -8 : 0} fontSize={9} fill="var(--faint)" className="mono" letterSpacing="0.1em">
              {i === 0 ? "NOW" : `${String(new Date(d.time).getHours()).padStart(2, "0")}`}
            </text>
            <text x={x(i)} y={y(d.temp) - 7} textAnchor="middle" fontSize={9.5} fill="var(--muted)" className="mono">
              {Math.round(d.temp)}°
            </text>
          </g>
        ) : null,
      )}
    </svg>
  );
}

export function WeatherTelemetry({ now }: { now: Date }) {
  const weather = useLife((s) => s.weather);
  const failed = useLife((s) => s.weatherFailed);
  const location = useLife((s) => s.location);
  const setLocation = useLife((s) => s.setLocation);
  const pushLog = useLife((s) => s.pushLog);
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const label = await reverseGeocode(latitude, longitude);
        setLocation({ lat: latitude, lon: longitude, label, source: "geo" });
        pushLog(`Position fixed · ${label}`);
        setLocating(false);
      },
      () => {
        pushLog("Location denied — keeping estimate");
        setLocating(false);
      },
      { timeout: 10_000, maximumAge: 30 * 60_000 },
    );
  };

  const sun = useMemo(
    () => (weather ? { rise: new Date(weather.sunrise), set: new Date(weather.sunset) } : null),
    [weather],
  );

  return (
    <div className="relative border-l border-[var(--line)] pl-6 md:pl-8">
      <div className="mono flex items-center justify-between gap-4 text-muted">
        <span>
          Conditions <span className="text-faint">·</span> <span className="text-ink">{location?.label ?? "—"}</span>
        </span>
        <button
          onClick={locate}
          className="flex items-center gap-2 text-faint transition-colors hover:text-ink"
          aria-label="Use my location"
          data-cursor="Locate"
        >
          <Glyph name="locate" size={13} className={locating ? "animate-spin" : ""} />
          {location?.source === "geo" ? "Fixed" : "Est."}
        </button>
      </div>

      {weather ? (
        <>
          <div className="mt-5 flex items-end gap-5">
            <span className="figure text-[clamp(72px,7vw,112px)]">
              {Math.round(weather.temp)}
              <span className="align-top text-[0.45em] text-muted">°</span>
            </span>
            <div className="pb-3">
              <Glyph name={weatherGlyph(weather.code, weather.isDay)} size={26} className="text-accent" />
              <div className="display mt-2 text-[24px] italic leading-none">{weatherLabel(weather.code)}</div>
            </div>
          </div>
          <div className="mono mt-4 grid grid-cols-3 gap-2 text-faint">
            <span>
              Feels <span className="text-ink">{Math.round(weather.feels)}°</span>
            </span>
            <span>
              H <span className="text-ink">{Math.round(weather.hi)}°</span> L <span className="text-ink">{Math.round(weather.lo)}°</span>
            </span>
            <span>
              Rain <span className="text-ink">{weather.precipProb}%</span>
            </span>
            <span>
              Wind <span className="text-ink">{Math.round(weather.wind)}</span>
            </span>
            <span>
              Hum <span className="text-ink">{Math.round(weather.humidity)}%</span>
            </span>
          </div>
          <div className="mt-6">{weather.hourly.length > 3 && <HourStrip hourly={weather.hourly} />}</div>
          {sun && (
            <div className="mt-4">
              <SunArc now={now} sunrise={sun.rise} sunset={sun.set} />
            </div>
          )}
        </>
      ) : (
        <div className="mt-6">
          <div className="display text-[40px] italic leading-none text-faint">{failed ? "No signal." : "Listening…"}</div>
          <div className="mono mt-4 text-faint">
            {failed ? "Weather service unreachable — the rest of the instrument runs locally." : "Acquiring conditions"}
          </div>
          <div className={`mt-5 h-px w-full ${failed ? "bg-[var(--line)]" : "scan"}`} />
        </div>
      )}
    </div>
  );
}
