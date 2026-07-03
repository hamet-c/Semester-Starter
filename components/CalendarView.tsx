"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { getColor } from "@/lib/colors";
import {
  EVENT_TYPE_LABELS,
  type Course,
  type SyllabusEvent,
} from "@/lib/types";

interface Props {
  courses: Course[];
  events: SyllabusEvent[];
  onDeleteEvent: (id: string) => void;
  onRemoveCourse: (id: string) => void;
  onAddSyllabus: () => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Expand multi-day events into one entry per day (capped for safety). */
function occurrencesByDay(events: SyllabusEvent[]): Map<string, SyllabusEvent[]> {
  const map = new Map<string, SyllabusEvent[]>();
  for (const event of events) {
    const start = parseISO(event.date);
    const end = event.endDate ? parseISO(event.endDate) : start;
    let day = start;
    for (let i = 0; i < 62 && day <= end; i++) {
      const key = format(day, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
      day = addDays(day, 1);
    }
  }
  return map;
}

export default function CalendarView({
  courses,
  events,
  onDeleteEvent,
  onRemoveCourse,
  onAddSyllabus,
}: Props) {
  const [cursor, setCursor] = useState(() => {
    const first = events.length
      ? [...events].sort((a, b) => a.date.localeCompare(b.date))[0]
      : null;
    const today = new Date();
    if (!first) return startOfMonth(today);
    const firstDate = parseISO(first.date);
    const last = [...events].sort((a, b) => b.date.localeCompare(a.date))[0];
    const lastDate = parseISO(last.date);
    // Start on today's month if the semester is in progress, else the first month
    return today >= firstDate && today <= lastDate
      ? startOfMonth(today)
      : startOfMonth(firstDate);
  });
  const [view, setView] = useState<"month" | "agenda">("month");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visibleEvents = useMemo(
    () => events.filter((e) => e.included && !hidden.has(e.courseId)),
    [events, hidden]
  );
  const byDay = useMemo(() => occurrencesByDay(visibleEvents), [visibleEvents]);

  const gridDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(cursor)),
      end: endOfWeek(endOfMonth(cursor)),
    });
  }, [cursor]);

  const agendaGroups = useMemo(() => {
    const sorted = [...visibleEvents].sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
    );
    const groups: Array<{ date: string; items: SyllabusEvent[] }> = [];
    for (const event of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.date === event.date) last.items.push(event);
      else groups.push({ date: event.date, items: [event] });
    }
    return groups;
  }, [visibleEvents]);

  const todayKey = format(new Date(), "yyyy-MM-dd");

  const toggleCourse = (id: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const courseFor = (id: string) => courses.find((c) => c.id === id);

  return (
    <div className="rise-in grid gap-6 lg:grid-cols-[1fr_240px]">
      {/* ── Main panel ─────────────────────────────────── */}
      <div className="paper-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink px-5 py-4">
          {view === "month" ? (
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl">{format(cursor, "MMMM")}</h2>
              <span className="tabular text-lg text-ink-soft">{format(cursor, "yyyy")}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl">Semester agenda</h2>
              {agendaGroups.length > 0 && (
                <span className="tabular text-sm text-ink-soft">
                  {format(parseISO(agendaGroups[0].date), "MMM d")} –{" "}
                  {format(parseISO(agendaGroups[agendaGroups.length - 1].date), "MMM d, yyyy")}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-ink text-xs">
              <button
                type="button"
                onClick={() => setView("month")}
                className={`px-3 py-1.5 ${view === "month" ? "bg-ink text-card" : "hover:bg-paper"}`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setView("agenda")}
                className={`border-l border-ink px-3 py-1.5 ${view === "agenda" ? "bg-ink text-card" : "hover:bg-paper"}`}
              >
                Agenda
              </button>
            </div>
            {view === "month" && (
              <div className="flex overflow-hidden rounded-md border border-ink text-sm">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setCursor((c) => addMonths(c, -1))}
                  className="px-2.5 py-1 hover:bg-paper"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setCursor(startOfMonth(new Date()))}
                  className="border-x border-ink px-2.5 py-1 text-xs hover:bg-paper"
                >
                  Today
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setCursor((c) => addMonths(c, 1))}
                  className="px-2.5 py-1 hover:bg-paper"
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>

        {view === "month" ? (
          <div>
            <div className="grid grid-cols-7 border-b border-rule">
              {WEEKDAYS.map((d) => (
                <div key={d} className="stamp border-0 py-2 text-center text-ink-faint">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {gridDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = byDay.get(key) ?? [];
                const inMonth = isSameMonth(day, cursor);
                const today = isToday(day);
                return (
                  <div
                    key={key}
                    className={`min-h-[6.5rem] border-b border-r border-rule-soft p-1.5 last:border-r-0 ${
                      inMonth ? "" : "bg-paper/50"
                    }`}
                  >
                    <span
                      className={`tabular inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        today
                          ? "border-2 border-accent font-bold text-accent"
                          : inMonth
                            ? "text-ink"
                            : "text-ink-faint"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 3).map((event) => {
                        const color = getColor(courseFor(event.courseId)?.color ?? "");
                        return (
                          <div
                            key={event.id + key}
                            title={`${courseFor(event.courseId)?.name ?? ""} — ${event.title} (${EVENT_TYPE_LABELS[event.type]})`}
                            className="truncate rounded px-1.5 py-0.5 text-[11px] leading-tight"
                            style={{
                              backgroundColor: color.tint,
                              color: color.ink,
                              borderLeft: `3px solid ${color.ink}`,
                            }}
                          >
                            {event.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setView("agenda")}
                          className="tabular text-[10px] text-ink-soft hover:text-ink"
                        >
                          +{dayEvents.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-h-[34rem] overflow-y-auto px-5 py-3">
            {agendaGroups.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-soft">
                Nothing to show — upload a syllabus or unhide a course.
              </p>
            )}
            {agendaGroups.map((group) => {
              const date = parseISO(group.date);
              const past = group.date < todayKey;
              const today = group.date === todayKey;
              return (
                <div
                  key={group.date}
                  className={`flex gap-4 border-b border-dashed border-rule-soft py-2.5 ${
                    past ? "opacity-45" : ""
                  }`}
                >
                  <div className="w-20 shrink-0 pt-0.5 text-right">
                    <div className={`tabular text-xs ${today ? "font-bold text-accent" : "text-ink-soft"}`}>
                      {format(date, "EEE")}
                    </div>
                    <div className={`font-display text-lg leading-tight ${today ? "text-accent" : ""}`}>
                      {format(date, "MMM d")}
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {group.items.map((event) => {
                      const course = courseFor(event.courseId);
                      const color = getColor(course?.color ?? "");
                      return (
                        <div key={event.id} className="group flex items-start gap-2.5">
                          <span
                            className="mt-1.5 h-3 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: color.ink }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug">
                              {event.title}
                              {event.endDate && (
                                <span className="tabular ml-2 text-xs text-ink-soft">
                                  → {format(parseISO(event.endDate), "MMM d")}
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                              <span style={{ color: color.ink }}>{course?.name}</span>
                              <span className="stamp text-ink-faint" style={{ fontSize: "9px" }}>
                                {EVENT_TYPE_LABELS[event.type]}
                              </span>
                              {event.description && <span>{event.description}</span>}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Delete event"
                            onClick={() => onDeleteEvent(event.id)}
                            className="px-1 text-ink-faint opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Sidebar: courses ───────────────────────────── */}
      <aside className="space-y-4">
        <div className="paper-card p-4">
          <h3 className="stamp inline-block text-ink-soft">Courses</h3>
          <ul className="mt-3 space-y-2">
            {courses.map((course) => {
              const color = getColor(course.color);
              const count = events.filter((e) => e.courseId === course.id && e.included).length;
              const isHidden = hidden.has(course.id);
              return (
                <li key={course.id} className="group flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCourse(course.id)}
                    title={isHidden ? "Show on calendar" : "Hide from calendar"}
                    className={`flex min-w-0 flex-1 items-center gap-2 text-left text-sm ${
                      isHidden ? "opacity-40" : ""
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border-2"
                      style={{ backgroundColor: color.tint, borderColor: color.ink }}
                    />
                    <span className="truncate">{course.name}</span>
                    <span className="tabular ml-auto text-xs text-ink-faint">{count}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${course.name}`}
                    onClick={() => {
                      if (confirm(`Remove "${course.name}" and its ${count} events?`)) {
                        onRemoveCourse(course.id);
                      }
                    }}
                    className="text-ink-faint opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onAddSyllabus}
            className="mt-4 w-full rounded-md border border-dashed border-ink-soft px-3 py-2 text-sm text-ink-soft hover:border-ink hover:text-ink"
          >
            + Add another syllabus
          </button>
        </div>

        <div className="paper-card rotate-[-0.6deg] p-4 text-xs leading-relaxed text-ink-soft">
          <p className="font-display text-sm text-ink">Tip</p>
          <p className="mt-1">
            Click a course to hide or show it. Switch to Agenda to see the whole
            semester as a list — past dates fade out automatically.
          </p>
        </div>
      </aside>
    </div>
  );
}
