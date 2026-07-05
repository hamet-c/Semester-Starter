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
import { buildIcs } from "@/lib/ics";
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

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

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

const pillBase =
  "rounded-[3px] px-[9px] py-1 font-mono text-[10px] transition-colors duration-[120ms]";
const pillIdle =
  "border border-edge text-text-soft hover:border-dash hover:text-text";

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

  const exportIcs = () => {
    const blob = new Blob([buildIcs(courses, events)], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "semester-calendar.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rise-in grid gap-4 lg:grid-cols-[1fr_224px]">
      {/* ── Calendar panel ─────────────────────────────── */}
      <div className="overflow-hidden rounded-[6px] border border-edge bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-3">
          {view === "month" ? (
            <div className="flex items-baseline gap-2.5">
              <h2 className="font-display text-[22px]">{format(cursor, "MMMM")}</h2>
              <span className="font-mono text-[12px] text-text-soft">
                {format(cursor, "yyyy.MM")}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2.5">
              <h2 className="font-display text-[22px]">Agenda</h2>
              {agendaGroups.length > 0 && (
                <span className="font-mono text-[12px] text-text-soft">
                  {format(parseISO(agendaGroups[0].date), "MMM d")} –{" "}
                  {format(parseISO(agendaGroups[agendaGroups.length - 1].date), "MMM d, yyyy")}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setView("month")}
              className={`${pillBase} ${
                view === "month" ? "bg-accent text-night" : pillIdle
              }`}
            >
              MONTH
            </button>
            <button
              type="button"
              onClick={() => setView("agenda")}
              className={`${pillBase} ${
                view === "agenda" ? "bg-accent text-night" : pillIdle
              }`}
            >
              AGENDA
            </button>
            {view === "month" && (
              <>
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setCursor((c) => addMonths(c, -1))}
                  className={`${pillBase} ${pillIdle} ml-2`}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setCursor(startOfMonth(new Date()))}
                  className={`${pillBase} ${pillIdle}`}
                >
                  TODAY
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setCursor((c) => addMonths(c, 1))}
                  className={`${pillBase} ${pillIdle}`}
                >
                  →
                </button>
              </>
            )}
          </div>
        </div>

        {view === "month" ? (
          <div>
            <div className="grid grid-cols-7 gap-px border-b border-edge bg-edge">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="bg-panel py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-text-faint"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-edge">
              {gridDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = byDay.get(key) ?? [];
                const inMonth = isSameMonth(day, cursor);
                const today = isToday(day);
                return (
                  <div
                    key={key}
                    className={`min-h-[90px] px-1.5 py-[5px] ${
                      inMonth ? "bg-cell" : "bg-cell-out"
                    }`}
                  >
                    <span
                      className={`inline-block pb-px font-mono text-[11px] ${
                        today
                          ? "border-b-2 border-accent text-accent"
                          : inMonth
                            ? "text-text"
                            : "text-text-faint"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-[5px] flex flex-col gap-[3px]">
                      {dayEvents.slice(0, 3).map((event) => {
                        const color = getColor(courseFor(event.courseId)?.color ?? "");
                        return (
                          <div
                            key={event.id + key}
                            title={`${courseFor(event.courseId)?.name ?? ""} — ${event.title} (${EVENT_TYPE_LABELS[event.type]})`}
                            className="truncate rounded-[3px] px-[5px] py-0.5 text-[10px] font-semibold leading-[1.2]"
                            style={{ backgroundColor: color.tint, color: "#10141b" }}
                          >
                            {event.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setView("agenda")}
                          className="text-left font-mono text-[9px] text-text-faint transition-colors duration-[120ms] hover:text-text-soft"
                        >
                          +{dayEvents.length - 3} MORE
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-h-[34rem] overflow-y-auto px-4 py-2">
            {agendaGroups.length === 0 && (
              <p className="py-8 text-center text-[11.5px] text-text-soft">
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
                  className={`flex gap-4 border-b border-edge-soft py-2.5 ${
                    past ? "opacity-45" : ""
                  }`}
                >
                  <div className="w-20 shrink-0 pt-0.5 text-right">
                    <div
                      className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                        today ? "text-accent" : "text-text-faint"
                      }`}
                    >
                      {format(date, "EEE")}
                    </div>
                    <div
                      className={`font-display text-[15px] leading-tight ${
                        today ? "text-accent" : ""
                      }`}
                    >
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
                            className="mt-[5px] h-3 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: color.tint }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] leading-snug">
                              {event.title}
                              {event.endDate && (
                                <span className="ml-2 font-mono text-[10px] text-text-soft">
                                  → {format(parseISO(event.endDate), "MMM d")}
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-text-soft">
                              <span className="font-mono text-[10px]" style={{ color: color.tint }}>
                                {course?.name}
                              </span>
                              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-faint">
                                {EVENT_TYPE_LABELS[event.type]}
                              </span>
                              {event.description && <span>{event.description}</span>}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Delete event"
                            onClick={() => onDeleteEvent(event.id)}
                            className="px-1 text-text-faint opacity-0 transition-opacity duration-[120ms] hover:text-accent group-hover:opacity-100"
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

      {/* ── Sidebar ────────────────────────────────────── */}
      <aside className="flex flex-col gap-3">
        <div className="rounded-[6px] border border-edge bg-panel p-[14px]">
          <h3 className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-faint">
            ▮ Courses
          </h3>
          <ul className="mt-[11px] flex flex-col gap-[9px]">
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
                    className={`flex min-w-0 flex-1 items-center gap-2 text-left transition-opacity duration-[120ms] ${
                      isHidden ? "opacity-40" : ""
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: color.tint }}
                    />
                    <span
                      className="truncate font-mono text-[11.5px]"
                      style={{ color: color.tint }}
                    >
                      {course.name}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-text-faint">
                      {count}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${course.name}`}
                    onClick={() => {
                      if (confirm(`Remove "${course.name}" and its ${count} events?`)) {
                        onRemoveCourse(course.id);
                      }
                    }}
                    className="text-text-faint opacity-0 transition-opacity duration-[120ms] hover:text-accent group-hover:opacity-100"
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
            className="mt-[13px] w-full rounded-[4px] border border-dashed border-dash p-2 text-center font-mono text-[9.5px] tracking-[0.08em] text-text-soft transition-colors duration-[120ms] hover:text-text"
          >
            + ADD SYLLABUS
          </button>
        </div>

        <div className="rounded-[6px] border border-edge bg-panel p-[14px]">
          <h3 className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-faint">
            ▮ Export
          </h3>
          <button
            type="button"
            onClick={exportIcs}
            disabled={!events.some((e) => e.included)}
            title="Download an .ics file, then import it into your calendar app"
            className="mt-[11px] w-full rounded-[4px] border border-edge p-2 text-center font-mono text-[9.5px] tracking-[0.08em] text-text-soft transition-colors duration-[120ms] hover:border-dash hover:text-text disabled:opacity-40"
          >
            ↓ DOWNLOAD .ICS
          </button>
          <p className="mt-2 text-[10.5px] leading-[1.5] text-text-soft">
            Imports into Google Calendar, Apple Calendar, and Outlook.
          </p>
        </div>

        <div className="rounded-[6px] border border-edge bg-panel p-[14px] text-[11px] leading-[1.55] text-text-soft">
          <span className="font-mono text-[9px] tracking-[0.12em] text-mint">TIP —</span>{" "}
          click a course to hide or show it. Agenda view lists the whole semester;
          past dates fade out.
        </div>

        <div className="px-0.5 font-mono text-[9px] tracking-[0.08em] text-text-faint">
          ● LOCAL ONLY — DATA NEVER LEAVES THIS MACHINE
        </div>
      </aside>
    </div>
  );
}
