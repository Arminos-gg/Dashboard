import * as chrono from "chrono-node";
import type { CaptureResult } from "./types";
import { dateKey, pad } from "./time";

const LEADS =
  /^(please\s+)?(remind me (to|that|about)|remember to|don'?t forget (to)?|i (need|have|want) to|i should|todo:?|task:?|add( a)? (task|reminder)( to)?|note to self:?)\s+/i;
const EVENT_WORDS =
  /\b(meeting|meet|appointment|lunch|dinner|breakfast|brunch|coffee with|drinks|interview|flight|class|lecture|session|sync|standup|stand-up|call with|doctor|dentist|haircut|party|concert|workshop|date with)\b/i;
const HABIT_WORDS = /\b(every ?day|daily|each (morning|evening|day|night)|every (morning|evening|night)|habit|ritual)\b/i;
const HIGH = /\b(urgent|asap|important|critical|high priority|must)\b|!!+/i;
const LOW = /\b(maybe|someday|sometime|low priority|whenever|if time)\b/i;
const DURATION = /\bfor\s+(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/i;

const TAG_HINTS: [RegExp, string][] = [
  [/\b(call|phone|email|reply|text|message|write to)\b/i, "comms"],
  [/\b(gym|run|walk|yoga|swim|workout|train|doctor|dentist)\b/i, "health"],
  [/\b(buy|groceries|pick up|shop|order)\b/i, "errands"],
  [/\b(memo|report|deck|review|meeting|client|invoice|ship|deploy|pr)\b/i, "work"],
  [/\b(flight|hotel|trip|book|pack|passport)\b/i, "travel"],
  [/\b(read|learn|study|course)\b/i, "learning"],
  [/\b(pay|bill|tax|renew|insurance|bank)\b/i, "admin"],
  [/\b(mom|dad|family|birthday|friend|dinner|lunch|brunch|coffee|drinks|party)\b/i, "social"],
];

function tidy(title: string): string {
  let t = title
    .replace(/#[\w-]+/g, "")
    .replace(DURATION, "")
    .replace(HABIT_WORDS, "")
    .replace(/\b(urgent|asap|important|critical|high priority|low priority|maybe|someday|sometime|whenever|if time)\b/gi, "")
    .replace(/!+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\b(at|on|by|in|for|to|from|around|this|next|the)\s*$/i, "")
    .replace(/^[,.;:\-–—\s]+|[,.;:\-–—\s]+$/g, "")
    .trim();
  if (!t) t = title.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function parseLocal(raw: string, now: Date = new Date()): CaptureResult {
  const text = raw.trim().replace(LEADS, "");
  const isHabit = HABIT_WORDS.test(text);
  const results = isHabit ? [] : chrono.parse(text, now, { forwardDate: true });
  const hit = results[0];

  let date: string | null = null;
  let time: string | null = null;
  let title = text;

  if (hit) {
    const d = hit.start.date();
    const hasTime = hit.start.isCertain("hour");
    if (hasTime) {
      let h = d.getHours();
      // "at 3" almost always means the afternoon in a personal planner
      if (!hit.start.isCertain("meridiem") && h >= 1 && h <= 7) {
        h += 12;
        d.setHours(h);
        // chrono may have rolled "at 7" to tomorrow morning; 19:00 today is the better read
        if (!hit.start.isCertain("day")) {
          const today = new Date(now);
          today.setHours(h, d.getMinutes(), 0, 0);
          if (today > now) d.setTime(today.getTime());
        }
      }
      time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    date = dateKey(d);
    title = (text.slice(0, hit.index) + " " + text.slice(hit.index + hit.text.length)).trim();
  }

  const tags = Array.from(new Set([...text.matchAll(/#([\w-]+)/g)].map((m) => m[1].toLowerCase())));
  if (!tags.length) {
    for (const [re, tag] of TAG_HINTS) if (re.test(text)) {
      tags.push(tag);
      break;
    }
  }

  const dm = text.match(DURATION);
  let durationMinutes: number | null = null;
  if (dm) {
    const n = parseFloat(dm[1].replace(",", "."));
    durationMinutes = Math.round(/^h/i.test(dm[2]) ? n * 60 : n);
  }

  const isEvent = !isHabit && !!time && (EVENT_WORDS.test(text) || !!durationMinutes);

  return {
    kind: isHabit ? "habit" : isEvent ? "event" : "task",
    title: tidy(isHabit ? text.replace(HABIT_WORDS, "") : title),
    date: isHabit ? null : date,
    time: isHabit ? null : time,
    durationMinutes: isEvent ? durationMinutes ?? 60 : durationMinutes,
    priority: HIGH.test(text) ? "high" : LOW.test(text) ? "low" : "normal",
    tags,
    notes: null,
    source: "local",
  };
}
