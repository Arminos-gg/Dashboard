import type { SVGProps } from "react";

/** Custom hairline iconography — drawn on a 24 grid, stroke only, no fills unless stated. */
const PATHS: Record<string, React.ReactNode> = {
  capture: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4M9.5 12h5M12 9.5v5" />
    </>
  ),
  focus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </>
  ),
  play: <path d="M8 5.5 18.5 12 8 18.5Z" />,
  pause: <path d="M9 5.5v13M15 5.5v13" />,
  next: <path d="M6.5 6 15 12l-8.5 6ZM17.5 6v12" />,
  stop: <path d="M7 7h10v10H7Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  undo: <path d="M8.5 8.5H15a4.5 4.5 0 0 1 0 9H9M8.5 8.5 11.5 5.5M8.5 8.5l3 3" />,
  reset: <path d="M18.5 12a6.5 6.5 0 1 1-2-4.7M18.5 5v3.3h-3.3" />,
  "sound-on": <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />,
  "sound-off": <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4ZM15.5 9.5l5 5M20.5 9.5l-5 5" />,
  rain: <path d="M8 4 5 13M13 7l-3 9M18 5l-3 9M11 17l-1.5 4.5M16 16l-1.2 3.5" />,
  drone: <path d="M2 12c2.5 0 2.5-6 5-6s2.5 12 5 12 2.5-12 5-12 2.5 6 5 6" />,
  brown: <path d="M2 13l2-3 1.5 5 2-8 2 9 1.5-5 2 3 1.5-6 2 8 1.5-4 2 2 2-1" />,
  orbit: (
    <>
      <ellipse cx="12" cy="12" rx="9.5" ry="4.5" transform="rotate(-18 12 12)" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="20" cy="8.8" r="1" fill="currentColor" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="6" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  moon: <path d="M15.5 3.5a8.5 8.5 0 1 0 5 12.5 7 7 0 0 1-5-12.5Z" />,
  partly: (
    <>
      <path d="M9 4v1.5M3.5 9.5H5M5.1 5.6l1 1M13.9 5.6l-1 1" />
      <path d="M6.6 11.5a3.5 3.5 0 0 1 6.3-2.6" />
      <path d="M7 19.5h10.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.2A3 3 0 0 0 7 19.5Z" />
    </>
  ),
  cloud: <path d="M6.5 18.5h11a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4 3.3 3.3 0 0 0-.8 6.6Z" />,
  fog: <path d="M3 8h13M6 12h15M3 16h11M16 16h3" />,
  drizzle: (
    <>
      <path d="M6.5 14.5h11a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4 3.3 3.3 0 0 0-.8 6.6Z" />
      <path d="M8 18v1M12 18v2M16 18v1" />
    </>
  ),
  snow: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M10 4.5l2 1.5 2-1.5M10 19.5l2-1.5 2 1.5" />,
  storm: (
    <>
      <path d="M6.5 13.5h11a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4 3.3 3.3 0 0 0-.8 6.6Z" />
      <path d="m12.5 13.5-2 4h3l-2 4" />
    </>
  ),
  breath: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1.5v2M12 20.5v2" />
    </>
  ),
  page: <path d="M12 6.5c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5M12 6.5c2-1.5 5-2 8-1.5v13c-3-.5-6 0-8 1.5M12 6.5v13" />,
  drop: <path d="M12 3.5c3.5 4.5 6 7.7 6 10.5a6 6 0 0 1-12 0c0-2.8 2.5-6 6-10.5Z" />,
  stride: <path d="M4 19h4M9 14.5h4M14 10h4M19 5.5h2M4 19l0-2M9 14.5v-2M14 10V8" />,
  spark: <path d="M12 2.5c.6 5 4.5 8.9 9.5 9.5-5 .6-8.9 4.5-9.5 9.5-.6-5-4.5-8.9-9.5-9.5 5-.6 8.9-4.5 9.5-9.5Z" />,
  diamond: <path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" />,
  "diamond-fill": <path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" fill="currentColor" />,
  arrow: <path d="M6.5 17.5 17.5 6.5M9 6.5h8.5V15" />,
  keyboard: <path d="M2.5 6.5h19v11h-19ZM6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7.5 14h9" />,
  cloud_sync: <path d="M6.5 18.5h11a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4 3.3 3.3 0 0 0-.8 6.6ZM12 11v5M10 14l2 2 2-2" />,
};

export type GlyphName = keyof typeof PATHS;

export function Glyph({
  name,
  size = 18,
  strokeWidth = 1.2,
  ...rest
}: { name: GlyphName | string; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
      {...rest}
    >
      {PATHS[name] ?? PATHS.spark}
    </svg>
  );
}
