import * as chrono from "chrono-node";
import { format } from "date-fns";
import type { EventType, ParsedEvent } from "./types";

/** Keyword → event type classification, checked in priority order. */
const TYPE_RULES: Array<{ type: EventType; pattern: RegExp }> = [
  { type: "holiday", pattern: /\b(no class(es)?|holiday|break|recess|cancell?ed|university closed)\b/i },
  { type: "exam", pattern: /\b(final exam|midterm|exam|test)\b/i },
  { type: "quiz", pattern: /\bquiz(zes)?\b/i },
  { type: "project", pattern: /\b(project|presentations?|proposal|demo)\b/i },
  { type: "assignment", pattern: /\b(due|homework|hw\s?\d|assignment|problem set|pset|essay|paper|lab report|submit|worksheet)\b/i },
  { type: "reading", pattern: /\b(read(ing)?s?|chapters?|chs?\.\s?\d+|pp\.\s?\d+|handout)\b/i },
  { type: "class_event", pattern: /\b(lecture|guest speaker|field trip|review session|workshop|discussion|lab)\b/i },
];

function classify(text: string): EventType {
  for (const rule of TYPE_RULES) {
    if (rule.pattern.test(text)) return rule.type;
  }
  return "other";
}

/* ── Term anchoring ─────────────────────────────────────────────────
 * Syllabi name their term ("Fall 2026", "Spring 2027 — 3 credits").
 * Anchoring the year to the document instead of the upload date keeps
 * every event in the right year no matter when the file is parsed. */

const SEASON_MID: Record<string, string> = {
  winter: "01-20",
  spring: "03-05",
  summer: "07-01",
  fall: "10-05",
  autumn: "10-05",
};

function termReference(text: string, fallback: Date): Date {
  const head = text.slice(0, 4000);
  const m =
    head.match(/\b(winter|spring|summer|fall|autumn)\s+(?:term\s+|semester\s+|quarter\s+)?(20\d{2})\b/i) ??
    head.match(/\b(20\d{2})\s+(winter|spring|summer|fall|autumn)\b/i);
  if (!m) return fallback;
  const season = (/^\d/.test(m[1]) ? m[2] : m[1]).toLowerCase();
  const year = /^\d/.test(m[1]) ? m[1] : m[2];
  return new Date(`${year}-${SEASON_MID[season]}T12:00:00`);
}

/** Pick the year that puts month/day closest to the term reference. */
function resolveYear(month: number, day: number, ref: Date): number {
  let best = ref.getFullYear();
  let bestDist = Infinity;
  for (const y of [ref.getFullYear() - 1, ref.getFullYear(), ref.getFullYear() + 1]) {
    const dist = Math.abs(new Date(y, month - 1, day, 12).getTime() - ref.getTime());
    if (dist < bestDist) {
      bestDist = dist;
      best = y;
    }
  }
  return best;
}

/* ── Structured schedule lines ──────────────────────────────────────
 * Most syllabus schedules are line- or table-shaped:
 *   "Sep 11 - Response paper 1 due"
 *   "1     Tu 1/19  Course overview        Ch. 1"
 *   "Week 8: Mar 9-13 — Spring Break"
 * Matching the shape directly (instead of letting a date library chew
 * on the whole line) keeps titles intact and avoids chrono's casual
 * matches ("Last day…" → yesterday). */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const M_RE =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const NAMED_DATE = `(${M_RE})\\.?\\s*(\\d{1,2})(?:\\s*[-–]\\s*(?:(${M_RE})\\.?\\s*)?(\\d{1,2}))?`;
const NUMERIC_DATE =
  "(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?(?:\\s*[-–]\\s*(\\d{1,2})/(\\d{1,2})(?:/\\d{2,4})?)?";
const WEEKDAY =
  "(?:(?:sun|mon|tues?|wed(?:nes)?|thur?s?|fri|satur?)(?:day)?|tu|th|su|sa|mo|we|fr|m|t|w|r|f)\\.?,?";

const STRUCTURED = new RegExp(
  "^(?:week\\s*\\d+(?:\\s*[-–]\\s*\\d+)?\\s*[.:)]?\\s+)?" + // "Week 3:" prefix
    "(?:\\d{1,2}\\s+)?" + // bare week-number column in tables
    `(?:${WEEKDAY}\\s+)?` + // weekday prefix ("Tu", "Thurs.")
    `(?:${NAMED_DATE}|${NUMERIC_DATE})` +
    "(?:\\s*[-–—:]\\s+|\\s*[-–—]\\s*|\\s{2,}|\\t+|,\\s+|\\s+)" + // date/title separator
    "(.*\\S)$",
  "i"
);

function monthNumber(name: string): number {
  return MONTHS[name.slice(0, 3).toLowerCase()];
}

function isRealDate(y: number, m: number, d: number): boolean {
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 && date.getDate() === d;
}

function cleanTitle(raw: string): string {
  let title = raw.replace(/\s+/g, " ").trim();
  // Collapse separator debris left where a date was removed (": ," etc.)
  title = title.replace(/\s*[,;:]\s*(?=[,;:.)])/g, "");
  title = title
    .replace(/^[-–—:•|,.\s]+/, "")
    .replace(/[-–—:•|,\s]+$/, "")
    .trim();
  if (title.length > 120) title = title.slice(0, 117) + "...";
  return title;
}

const MAX_SPAN_MS = 21 * 86400000;

interface DayDate {
  month: number;
  day: number;
  year: number | null; // explicit year, if the text had one
}

/** Lines that mention dates but are never calendar events. */
const NOISE_LINE =
  /\b(revised|updated|effective|copyright|printed|last modified)\b|©|^(https?:\/\/|www\.|page \d+$)/i;

export function ruleParse(text: string, referenceDate: Date): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const ref = termReference(text, referenceDate);
  const refYear = ref.getFullYear();

  const push = (
    start: DayDate,
    end: DayDate | null,
    rawTitle: string,
    line: string
  ) => {
    // Explicit years far from the term are references, not events ("in 2019")
    if (start.year !== null && Math.abs(start.year - refYear) > 1) return;
    const year = start.year ?? resolveYear(start.month, start.day, ref);
    if (!isRealDate(year, start.month, start.day)) return;
    const startDate = new Date(year, start.month - 1, start.day, 12);

    let endDate: string | null = null;
    if (end && isRealDate(year, end.month, end.day)) {
      let endYear = end.year ?? year;
      // Ranges that wrap the new year ("Dec 18 - Jan 2")
      if (end.year === null && end.month < start.month) endYear = year + 1;
      const endD = new Date(endYear, end.month - 1, end.day, 12);
      const span = endD.getTime() - startDate.getTime();
      if (span > 0 && span <= MAX_SPAN_MS) endDate = format(endD, "yyyy-MM-dd");
    }

    let title = cleanTitle(rawTitle);
    if (title.length < 3) title = `Event on ${format(startDate, "MMM d")}`;

    const date = format(startDate, "yyyy-MM-dd");
    const key = `${date}|${title.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    events.push({
      title,
      date,
      endDate,
      type: classify(line),
      description: null,
      source: "rules",
    });
  };

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    if (NOISE_LINE.test(line)) continue;

    // 1. Schedule-shaped lines: parse the date columns directly.
    const m = STRUCTURED.exec(line);
    if (m) {
      const [
        , nM, nD, nEndM, nEndD, // named date groups
        numM, numD, numY, numEndM, numEndD, // numeric date groups
        title,
      ] = m;
      let start: DayDate | null = null;
      let end: DayDate | null = null;
      if (nM) {
        start = { month: monthNumber(nM), day: Number(nD), year: null };
        if (nEndD) {
          end = { month: nEndM ? monthNumber(nEndM) : start.month, day: Number(nEndD), year: null };
        }
      } else if (numM && Number(numM) <= 12) {
        const year = numY ? Number(numY.length === 2 ? `20${numY}` : numY) : null;
        start = { month: Number(numM), day: Number(numD), year };
        if (numEndM && Number(numEndM) <= 12) {
          end = { month: Number(numEndM), day: Number(numEndD), year: null };
        }
      }
      if (start) {
        push(start, end, title, line);
        continue;
      }
    }

    // 2. Prose lines ("Final exam: Wednesday, May 12, 8:00am"): let chrono
    //    find the date, but ignore casual matches with no digit or month
    //    name ("last day", "tomorrow") — they produce phantom events.
    for (const result of chrono.parse(line, ref)) {
      if (!result.start.isCertain("month") || !result.start.isCertain("day")) continue;
      if (!/\d/.test(result.text) && !new RegExp(M_RE, "i").test(result.text)) continue;

      const start: DayDate = {
        month: result.start.get("month") as number,
        day: result.start.get("day") as number,
        year: result.start.isCertain("year") ? (result.start.get("year") as number) : null,
      };
      const end: DayDate | null =
        result.end && result.end.isCertain("day")
          ? {
              month: result.end.get("month") as number,
              day: result.end.get("day") as number,
              year: result.end.isCertain("year") ? (result.end.get("year") as number) : null,
            }
          : null;

      push(start, end, line.replace(result.text, " "), line);
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}
