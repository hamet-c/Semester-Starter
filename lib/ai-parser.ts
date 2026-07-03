import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { format } from "date-fns";
import type { ParsedEvent } from "./types";

const EventSchema = z.object({
  title: z.string().describe("Short human-readable name, e.g. 'Homework 3 due' or 'Midterm 1'"),
  date: z.string().describe("Date in YYYY-MM-DD format"),
  endDate: z
    .string()
    .nullable()
    .describe("End date in YYYY-MM-DD for multi-day items (e.g. spring break), otherwise null"),
  type: z.enum([
    "assignment",
    "exam",
    "quiz",
    "project",
    "reading",
    "class_event",
    "holiday",
    "other",
  ]),
  description: z
    .string()
    .nullable()
    .describe("Extra detail worth keeping (chapters covered, submission method), otherwise null"),
});

const ExtractionSchema = z.object({
  events: z.array(EventSchema),
});

const SYSTEM_PROMPT = `You extract every dated item from a course syllabus so a student can put their whole semester on a calendar.

Include: assignment/homework/paper due dates, exams, quizzes, projects and presentations, assigned readings tied to a specific date, holidays and no-class days, and other dated course events (guest lectures, field trips, review sessions).

Rules:
- Resolve every date to YYYY-MM-DD. Use the reference date provided to infer the correct year for dates like "Sept 15" (a fall syllabus dated August 2026 means "Sept 15" is 2026-09-15).
- If a date range is given (e.g. "Spring Break Mar 9-13"), set date to the first day and endDate to the last day.
- Skip items with no resolvable calendar date (e.g. "TBD", "Week 3" with no date mapping).
- If the syllabus maps week numbers to dates elsewhere, use that mapping to resolve week-based items.
- One event per dated item; don't merge distinct assignments that share a date.
- Titles should be short and specific ("Essay 2 due", not "Essay 2 is due at 11:59pm via Canvas" — put details in description).`;

export function aiParserAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * AI extraction pass using Claude with structured outputs — the schema
 * guarantees valid JSON, so no manual parsing/repair is needed.
 * Throws on failure; the caller falls back to rule-based results.
 */
export async function aiParse(
  text: string,
  referenceDate: Date
): Promise<ParsedEvent[]> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Reference date (today, for resolving years): ${format(referenceDate, "yyyy-MM-dd")}\n\nSyllabus text:\n\n${text}`,
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("AI response was truncated (max_tokens reached)");
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("AI response could not be parsed against the schema");
  }

  return parsed.events
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map((e) => ({
      ...e,
      endDate: e.endDate && /^\d{4}-\d{2}-\d{2}$/.test(e.endDate) ? e.endDate : null,
      source: "ai" as const,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
