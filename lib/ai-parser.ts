import { z } from "zod";
import { format } from "date-fns";
import { EVENT_TYPES, type EventType, type ParsedEvent } from "./types";

/* ── Provider configuration ─────────────────────────────────────────
 * The parser talks to any OpenAI-compatible chat-completions endpoint
 * (Gemini, Groq, OpenRouter, OpenAI, a local server…). Defaults target
 * Google Gemini's free tier so the app costs nothing to run; set
 * AI_BASE_URL / AI_MODEL in .env.local to use a different provider.
 *
 * AI_MODEL accepts a comma-separated list. Models are tried in order:
 * the free tier sheds load from the newest Flash model at busy times
 * ("high demand", HTTP 503), so a fallback keeps parsing working. */

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODELS = "gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash-lite";

const TOTAL_BUDGET_MS = 105_000; // the parse route allows 120s in total
const ATTEMPT_TIMEOUT_MS = 45_000; // one hung model must not eat the whole budget
const MIN_ATTEMPT_MS = 8_000; // don't start an attempt that can't finish
const RETRY_DELAY_MS = 1_500;
const MAX_RETRIES_PER_MODEL = 1; // for transient errors (429 / 5xx / network)

function providerConfig() {
  return {
    apiKey: process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "",
    baseUrl: (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    models: (process.env.AI_MODEL || DEFAULT_MODELS)
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
  };
}

export function aiParserAvailable(): boolean {
  return Boolean(providerConfig().apiKey);
}

/* ── Output schema ──────────────────────────────────────────────────
 * RESPONSE_JSON_SCHEMA is what the model is asked to follow;
 * ExtractionSchema is the lenient check applied to what comes back, so
 * a small deviation (missing null field, odd type) is coerced instead
 * of failing the whole parse. Keep the two in step. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short human-readable name, e.g. 'Homework 3 due' or 'Midterm 1'",
          },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          endDate: {
            type: ["string", "null"],
            description: "End date in YYYY-MM-DD for multi-day items (e.g. spring break), otherwise null",
          },
          type: { type: "string", enum: [...EVENT_TYPES] },
          description: {
            type: ["string", "null"],
            description: "Extra detail worth keeping (chapters covered, submission method), otherwise null",
          },
        },
        required: ["title", "date", "endDate", "type", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["events"],
  additionalProperties: false,
};

const EventSchema = z.object({
  title: z.string().trim().min(1),
  date: z.string().trim(),
  endDate: z.string().nullish(),
  type: z.string(),
  description: z.string().nullish(),
});

const ExtractionSchema = z.object({ events: z.array(EventSchema) });

const SYSTEM_PROMPT = `You extract every dated item from a course syllabus so a student can put their whole semester on a calendar.

Include: assignment/homework/paper due dates, exams, quizzes, projects and presentations, assigned readings tied to a specific date, holidays and no-class days, and other dated course events (guest lectures, field trips, review sessions).

Rules:
- Resolve every date to YYYY-MM-DD. Use the reference date provided to infer the correct year for dates like "Sept 15" (a fall syllabus dated August 2026 means "Sept 15" is 2026-09-15).
- If a date range is given (e.g. "Spring Break Mar 9-13"), set date to the first day and endDate to the last day.
- Skip items with no resolvable calendar date (e.g. "TBD", "Week 3" with no date mapping).
- If the syllabus maps week numbers to dates elsewhere, use that mapping to resolve week-based items.
- One event per dated item; don't merge distinct assignments that share a date.
- Titles should be short and specific ("Essay 2 due", not "Essay 2 is due at 11:59pm via Canvas" — put details in description).

Respond with JSON only, no prose or markdown fences, in exactly this shape:
{"events":[{"title":"string","date":"YYYY-MM-DD","endDate":"YYYY-MM-DD or null","type":"one of ${EVENT_TYPES.join(" | ")}","description":"string or null"}]}`;

/* ── Request ────────────────────────────────────────────────────────*/

interface ChatCompletion {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
}

type Outcome =
  | { kind: "ok"; events: ParsedEvent[] }
  | { kind: "retry"; reason: string } // transient — try this model again
  | { kind: "next"; reason: string } // give up on this model
  | { kind: "no_schema" } // provider rejected json_schema — retry in plain JSON mode
  | { kind: "fatal"; reason: string }; // e.g. bad key — nothing else will work either

function errorMessage(err: unknown): string {
  if (err instanceof z.ZodError) return "unexpected JSON shape";
  return err instanceof Error ? err.message : String(err);
}

/** Pull the human-readable message out of a provider error body. */
function describeError(body: string): string {
  let msg = body;
  try {
    const json: unknown = JSON.parse(body);
    const obj = (Array.isArray(json) ? json[0] : json) as {
      error?: { message?: unknown };
      message?: unknown;
    };
    const candidate = obj?.error?.message ?? obj?.message;
    if (typeof candidate === "string") msg = candidate;
  } catch {
    // not JSON — use the raw text
  }
  msg = msg.replace(/\s+/g, " ").trim();
  return msg.length > 140 ? msg.slice(0, 137) + "..." : msg;
}

/** Models sometimes wrap JSON in ```json fences despite instructions. */
function stripFences(s: string): string {
  const m = s.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1] : s.trim();
}

function toEvents(raw: z.infer<typeof ExtractionSchema>["events"]): ParsedEvent[] {
  return raw
    .filter((e) => DATE_RE.test(e.date))
    .map((e) => ({
      title: e.title,
      date: e.date,
      endDate: e.endDate && DATE_RE.test(e.endDate) ? e.endDate : null,
      type: (EVENT_TYPES as readonly string[]).includes(e.type) ? (e.type as EventType) : "other",
      description: e.description?.trim() || null,
      source: "ai" as const,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function attempt(
  model: string,
  useSchema: boolean,
  timeoutMs: number,
  userContent: string
): Promise<Outcome> {
  const { apiKey, baseUrl } = providerConfig();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: useSchema
          ? { type: "json_schema", json_schema: { name: "syllabus_events", schema: RESPONSE_JSON_SCHEMA } }
          : { type: "json_object" },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { kind: "next", reason: `no response within ${Math.round(timeoutMs / 1000)}s` };
    }
    return { kind: "retry", reason: `network error (${errorMessage(err)})` };
  }

  if (!res.ok) {
    const detail = `HTTP ${res.status}: ${describeError(await res.text())}`;
    if (res.status === 401 || res.status === 403) return { kind: "fatal", reason: detail };
    if (res.status === 400 && /api key/i.test(detail)) return { kind: "fatal", reason: detail };
    if (res.status === 400 && useSchema && /response_format|json_schema|schema/i.test(detail)) {
      return { kind: "no_schema" };
    }
    if (res.status === 429 || res.status >= 500) return { kind: "retry", reason: detail };
    return { kind: "next", reason: detail };
  }

  let body: ChatCompletion;
  try {
    body = (await res.json()) as ChatCompletion;
  } catch {
    return { kind: "next", reason: "response was not JSON" };
  }
  const choice = body.choices?.[0];
  if (choice?.finish_reason === "length") {
    return { kind: "next", reason: "response truncated (token limit reached)" };
  }
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return { kind: "next", reason: "empty response" };
  }
  try {
    const parsed = ExtractionSchema.parse(JSON.parse(stripFences(content)));
    return { kind: "ok", events: toEvents(parsed.events) };
  } catch (err) {
    return { kind: "next", reason: `unusable response (${errorMessage(err)})` };
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * AI extraction pass. Tries each configured model in order, retrying
 * transient failures once and falling back to plain JSON mode if a
 * provider rejects schema-enforced output. Throws with a per-model
 * summary when nothing works; the caller falls back to rule parsing.
 */
export async function aiParse(
  text: string,
  referenceDate: Date
): Promise<ParsedEvent[]> {
  const { models } = providerConfig();
  if (!aiParserAvailable()) {
    throw new Error("AI parser is not configured (set AI_API_KEY in .env.local)");
  }
  if (models.length === 0) throw new Error("AI_MODEL is empty");

  const userContent = `Reference date (today, for resolving years): ${format(referenceDate, "yyyy-MM-dd")}\n\nSyllabus text:\n\n${text}`;
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const failures: string[] = [];
  let useSchema = true;

  for (const model of models) {
    let retries = 0;
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining < MIN_ATTEMPT_MS) {
        failures.push("ran out of time");
        throw new Error(failures.join("; "));
      }

      const outcome = await attempt(model, useSchema, Math.min(ATTEMPT_TIMEOUT_MS, remaining), userContent);

      if (outcome.kind === "ok") return outcome.events;
      if (outcome.kind === "fatal") throw new Error(`${model}: ${outcome.reason}`);
      if (outcome.kind === "no_schema") {
        useSchema = false;
        continue;
      }
      if (outcome.kind === "retry" && retries < MAX_RETRIES_PER_MODEL) {
        retries++;
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      failures.push(`${model}: ${outcome.reason}`);
      break;
    }
  }

  throw new Error(failures.join("; "));
}
