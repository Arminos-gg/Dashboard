import type { GeoLocation, Weather } from "./types";

export type WeatherGlyph = "sun" | "moon" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";

const CODES: Record<number, [string, WeatherGlyph]> = {
  0: ["Clear", "sun"],
  1: ["Mostly clear", "partly"],
  2: ["Partly cloudy", "partly"],
  3: ["Overcast", "cloud"],
  45: ["Fog", "fog"],
  48: ["Rime fog", "fog"],
  51: ["Light drizzle", "drizzle"],
  53: ["Drizzle", "drizzle"],
  55: ["Dense drizzle", "drizzle"],
  56: ["Freezing drizzle", "drizzle"],
  57: ["Freezing drizzle", "drizzle"],
  61: ["Light rain", "rain"],
  63: ["Rain", "rain"],
  65: ["Heavy rain", "rain"],
  66: ["Freezing rain", "rain"],
  67: ["Freezing rain", "rain"],
  71: ["Light snow", "snow"],
  73: ["Snow", "snow"],
  75: ["Heavy snow", "snow"],
  77: ["Snow grains", "snow"],
  80: ["Showers", "rain"],
  81: ["Showers", "rain"],
  82: ["Violent showers", "rain"],
  85: ["Snow showers", "snow"],
  86: ["Snow showers", "snow"],
  95: ["Thunderstorm", "storm"],
  96: ["Thunderstorm, hail", "storm"],
  99: ["Thunderstorm, hail", "storm"],
};

export const weatherLabel = (code: number) => CODES[code]?.[0] ?? "Unknown";
export const weatherGlyph = (code: number, isDay = true): WeatherGlyph => {
  const g = CODES[code]?.[1] ?? "cloud";
  return g === "sun" && !isDay ? "moon" : g;
};

/** Rough city per time zone so the first paint has a sky without asking for location. */
const TZ_CITIES: Record<string, [number, number, string]> = {
  "Europe/Vienna": [48.2082, 16.3738, "Vienna"],
  "Europe/Berlin": [52.52, 13.405, "Berlin"],
  "Europe/Zurich": [47.3769, 8.5417, "Zürich"],
  "Europe/Paris": [48.8566, 2.3522, "Paris"],
  "Europe/London": [51.5072, -0.1276, "London"],
  "Europe/Madrid": [40.4168, -3.7038, "Madrid"],
  "Europe/Rome": [41.9028, 12.4964, "Rome"],
  "Europe/Amsterdam": [52.3676, 4.9041, "Amsterdam"],
  "Europe/Lisbon": [38.7223, -9.1393, "Lisbon"],
  "Europe/Stockholm": [59.3293, 18.0686, "Stockholm"],
  "America/New_York": [40.7128, -74.006, "New York"],
  "America/Chicago": [41.8781, -87.6298, "Chicago"],
  "America/Denver": [39.7392, -104.9903, "Denver"],
  "America/Los_Angeles": [34.0522, -118.2437, "Los Angeles"],
  "America/Toronto": [43.6532, -79.3832, "Toronto"],
  "America/Sao_Paulo": [-23.5505, -46.6333, "São Paulo"],
  "Asia/Tokyo": [35.6762, 139.6503, "Tokyo"],
  "Asia/Singapore": [1.3521, 103.8198, "Singapore"],
  "Asia/Dubai": [25.2048, 55.2708, "Dubai"],
  "Asia/Kolkata": [28.6139, 77.209, "Delhi"],
  "Australia/Sydney": [-33.8688, 151.2093, "Sydney"],
};

export function locationFromTimeZone(): GeoLocation {
  let tz = "Europe/Vienna";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz;
  } catch {
    /* noop */
  }
  const [lat, lon, label] = TZ_CITIES[tz] ?? TZ_CITIES["Europe/Vienna"];
  return { lat, lon, label, source: "tz" };
}

export async function fetchWeather(loc: GeoLocation, signal?: AbortSignal): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day` +
    `&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max` +
    `&hourly=temperature_2m,precipitation_probability&forecast_days=2&timezone=auto`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const j = await res.json();
  const nowIdx = Math.max(
    0,
    (j.hourly.time as string[]).findIndex((t) => new Date(t) > new Date()) - 1,
  );
  const hourly = (j.hourly.time as string[]).slice(nowIdx, nowIdx + 14).map((t, i) => ({
    time: t,
    temp: j.hourly.temperature_2m[nowIdx + i],
    precip: j.hourly.precipitation_probability[nowIdx + i] ?? 0,
  }));
  return {
    fetchedAt: Date.now(),
    temp: j.current.temperature_2m,
    feels: j.current.apparent_temperature,
    code: j.current.weather_code,
    isDay: !!j.current.is_day,
    wind: j.current.wind_speed_10m,
    humidity: j.current.relative_humidity_2m,
    hi: j.daily.temperature_2m_max[0],
    lo: j.daily.temperature_2m_min[0],
    precipProb: j.daily.precipitation_probability_max[0] ?? 0,
    sunrise: j.daily.sunrise[0],
    sunset: j.daily.sunset[0],
    hourly,
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    const j = await res.json();
    return j.city || j.locality || j.principalSubdivision || formatCoords(lat, lon);
  } catch {
    return formatCoords(lat, lon);
  }
}

export function formatCoords(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
}
