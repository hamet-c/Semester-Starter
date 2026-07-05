"use client";

import { useMemo, useState } from "react";
import { getColor } from "@/lib/colors";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  type Course,
  type EventType,
  type ParseResponse,
  type SyllabusEvent,
} from "@/lib/types";

interface Row {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  type: EventType;
  description: string | null;
  included: boolean;
}

interface Props {
  course: Course;
  response: ParseResponse;
  onConfirm: (events: SyllabusEvent[]) => void;
  onCancel: () => void;
}

export default function ReviewStep({ course, response, onConfirm, onCancel }: Props) {
  const color = getColor(course.color);
  const [rows, setRows] = useState<Row[]>(() =>
    response.events.map((e) => ({
      id: crypto.randomUUID(),
      title: e.title,
      date: e.date,
      endDate: e.endDate,
      type: e.type,
      description: e.description,
      included: true,
    }))
  );

  const includedCount = useMemo(() => rows.filter((r) => r.included).length, [rows]);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        id: crypto.randomUUID(),
        title: "",
        date: new Date().toISOString().slice(0, 10),
        endDate: null,
        type: "assignment",
        description: null,
        included: true,
      },
    ]);

  const confirm = () => {
    const events: SyllabusEvent[] = rows
      .filter((r) => r.included && r.title.trim() && r.date)
      .map((r) => ({
        id: r.id,
        courseId: course.id,
        title: r.title.trim(),
        date: r.date,
        endDate: r.endDate,
        type: r.type,
        description: r.description,
        source: response.parserUsed,
        included: true,
      }));
    onConfirm(events);
  };

  return (
    <div className="rise-in mx-auto max-w-[520px]">
      <div className="overflow-hidden rounded-[6px] border border-edge bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-[14px]">
          <div>
            <h2 className="font-display text-[19px]">Check the dates</h2>
            <p className="mt-0.5 text-[11px] text-text-soft">
              Fix anything the parser got wrong, untick what you don&apos;t want.
            </p>
          </div>
          <span
            className="rounded-[3px] px-2 py-1 font-mono text-[10px]"
            style={{ backgroundColor: color.tint, color: "#10141b" }}
          >
            {course.name}
          </span>
        </div>

        {response.warning && (
          <p className="border-b border-edge px-4 py-2.5 text-[11px] text-accent">
            {response.warning}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[11.5px] text-text-soft">
            No dates were found in this file. You can add events by hand below,
            or go back and try a cleaner copy of the syllabus.
          </p>
        ) : (
          <div className="max-h-[26rem] overflow-y-auto px-4 pb-0.5 pt-1.5">
            {rows.map((row) => (
              <div
                key={row.id}
                data-review-row
                className={`flex items-baseline gap-2.5 border-b border-edge-soft py-[7px] font-mono transition-opacity duration-[120ms] ${
                  row.included ? "" : "opacity-40"
                }`}
              >
                <label className="relative cursor-pointer select-none text-[11px]">
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={(e) => update(row.id, { included: e.target.checked })}
                    className="absolute inset-0 cursor-pointer appearance-none"
                  />
                  <span aria-hidden className={row.included ? "text-mint" : "text-text-faint"}>
                    {row.included ? "[x]" : "[ ]"}
                  </span>
                </label>
                <input
                  type="date"
                  value={row.date}
                  onChange={(e) => update(row.id, { date: e.target.value })}
                  className="w-[82px] shrink-0 rounded-[3px] border border-transparent bg-transparent font-mono text-[11px] text-text-soft transition-colors duration-[120ms] hover:border-edge focus:border-dash focus:outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                />
                <input
                  type="text"
                  value={row.title}
                  placeholder="Event title"
                  onChange={(e) => update(row.id, { title: e.target.value })}
                  className="min-w-0 flex-1 rounded-[3px] border border-transparent bg-transparent px-1 font-sans text-[12.5px] text-text transition-colors duration-[120ms] placeholder:text-text-faint hover:border-edge focus:border-dash focus:outline-none"
                />
                <select
                  value={row.type}
                  onChange={(e) => update(row.id, { type: e.target.value as EventType })}
                  className="max-w-[110px] appearance-none rounded-[3px] border border-transparent bg-transparent font-mono text-[9px] uppercase tracking-[0.08em] text-text-faint transition-colors duration-[120ms] hover:border-edge focus:border-dash focus:outline-none"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EVENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge px-4 py-3">
          <button
            type="button"
            onClick={addRow}
            className="font-mono text-[10px] tracking-[0.06em] text-text-soft transition-colors duration-[120ms] hover:text-text"
          >
            + ADD EVENT BY HAND
          </button>
          <div className="flex gap-2 font-mono text-[10.5px]">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-[4px] border border-edge px-3 py-[7px] text-text-soft transition-colors duration-[120ms] hover:border-dash hover:text-text"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={includedCount === 0}
              className="rounded-[4px] bg-accent px-3 py-[7px] font-semibold text-night transition-colors duration-[120ms] hover:bg-accent-bright disabled:opacity-40"
            >
              COMMIT {includedCount} EVENT{includedCount === 1 ? "" : "S"} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
