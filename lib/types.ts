export const EVENT_TYPES = [
  "assignment",
  "exam",
  "quiz",
  "project",
  "reading",
  "class_event",
  "holiday",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** An event as returned by the parser (server-side, not yet tied to a course). */
export interface ParsedEvent {
  title: string;
  date: string; // YYYY-MM-DD
  endDate: string | null;
  type: EventType;
  description: string | null;
  source: "ai" | "rules";
}

/** An event as stored on the client, attached to a course. */
export interface SyllabusEvent extends ParsedEvent {
  id: string;
  courseId: string;
  included: boolean;
}

export interface Course {
  id: string;
  name: string;
  color: string; // one of COURSE_COLORS keys
}

export interface ParseResponse {
  events: ParsedEvent[];
  parserUsed: "ai" | "rules";
  warning?: string;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  assignment: "Assignment",
  exam: "Exam",
  quiz: "Quiz",
  project: "Project",
  reading: "Reading",
  class_event: "Class event",
  holiday: "Holiday / No class",
  other: "Other",
};
