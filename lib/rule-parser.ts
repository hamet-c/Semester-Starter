import * as chrono from "chrono-node";
import { format } from "date-fns";
import type { EventType, ParsedEvent } from "./types";

/** Keyword → event type classification, checked in priority order. */
const TYPE_RULES: Array<{ type: EventType; pattern: RegExp }> = [
  { type: "holiday", pattern: /\b(no class|no classes|holiday|break|recess|cancell?ed|university closed)\b/i },
  { type: "exam", pattern: /\b(final exam|midterm|exam|test)\b/i },
  { type: "quiz", pattern: /\bquiz(zes)?\b/i },
  { type: "project", pattern: /\b(project|presentation|proposal|demo)\b/i },
  { type: "assignment", pattern: /\b(due|homework|hw\s?\d|assignment|problem set|pset|essay|paper|lab report|submit|worksheet)\b/i },
  { type: "reading", pattern: /\b(read(ing)?s?|chapter|chapters|ch\.\s?\d|pp\.\s?\d)\b/i },
  { type: "class_event", pattern: /\b(lecture|guest speaker|field trip|review session|workshop|discussion|lab)\b/i },
];

function classify(text: string): EventType {
  for (const rule of TYPE_RULES) {
    if (rule.pattern.test(text)) return rule.type;
  }
  return "other";
}

/** Strip the matched date text and leftover separators from a line to form a title. */
function makeTitle(line: string, dateText: string): string {
  let title = line.replace(dateText, " ");
  title = title
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:•|,.\t]+/, "")
    .replace(/[\s\-–—:•|,\t]+$/, "")
    .trim();
  if (title.length > 120) title = title.slice(0, 117) + "...";
  return title;
}

/**
 * Rule-based extraction: scan each line for dates with chrono-node and use the
 * surrounding text as the event title. Works fully offline; less accurate than
 * the AI pass on messy or table-heavy syllabi.
 */
export function ruleParse(text: string, referenceDate: Date): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    // Skip lines that are unlikely to be schedule entries (URLs, emails, page numbers)
    if (/^(https?:\/\/|www\.|page \d+$)/i.test(line)) continue;

    const results = chrono.parse(line, referenceDate, { forwardDate: true });

    for (const result of results) {
      // Require at least a known month+day; bare years or weekday-only matches
      // ("Friday", "2026") generate too much noise.
      if (!result.start.isCertain("month") || !result.start.isCertain("day")) {
        continue;
      }

      const start = result.start.date();
      let end = result.end?.date() ?? null;
      // Chrono sometimes misreads phrases like "May 6 - Last day" as a range,
      // producing a backwards or implausibly long span. Syllabus ranges
      // (breaks, exam windows) are short — drop anything suspicious.
      if (end && (end < start || end.getTime() - start.getTime() > 21 * 86400000)) {
        end = null;
      }
      const date = format(start, "yyyy-MM-dd");
      const endDate = end ? format(end, "yyyy-MM-dd") : null;

      let title = makeTitle(line, result.text);
      if (title.length < 3) title = `Event on ${format(start, "MMM d")}`;

      const key = `${date}|${title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      events.push({
        title,
        date,
        endDate: endDate !== date ? endDate : null,
        type: classify(line),
        description: null,
        source: "rules",
      });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}
