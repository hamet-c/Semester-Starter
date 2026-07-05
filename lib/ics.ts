import { addDays, format, parseISO } from "date-fns";
import { EVENT_TYPE_LABELS, type Course, type SyllabusEvent } from "./types";

/** Escape text values per RFC 5545 §3.3.11. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold content lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

const dateValue = (isoDate: string) => isoDate.replace(/-/g, "");

/**
 * Build an iCalendar file from the stored events — all-day VEVENTs, one per
 * calendar entry. The result imports into Google Calendar, Apple Calendar,
 * and Outlook.
 */
export function buildIcs(courses: Course[], events: SyllabusEvent[]): string {
  const courseName = (id: string) =>
    courses.find((c) => c.id === id)?.name ?? "";
  const stamp =
    new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Semester//Syllabus Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Semester",
  ];

  for (const event of events) {
    if (!event.included) continue;
    const course = courseName(event.courseId);
    // DTEND is exclusive: the day after the (last) day of the event.
    const lastDay = event.endDate ?? event.date;
    const dtEnd = format(addDays(parseISO(lastDay), 1), "yyyyMMdd");
    const description = [
      [course, EVENT_TYPE_LABELS[event.type]].filter(Boolean).join(" · "),
      event.description ?? "",
    ]
      .filter(Boolean)
      .join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@semester-local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateValue(event.date)}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${escapeText(course ? `${event.title} (${course})` : event.title)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `CATEGORIES:${escapeText(EVENT_TYPE_LABELS[event.type])}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
