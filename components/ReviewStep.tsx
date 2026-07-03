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
    <div className="rise-in mx-auto max-w-4xl">
      <div className="paper-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink px-6 py-4">
          <div>
            <h2 className="font-display text-2xl">Check the dates</h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              Fix anything the parser got wrong, untick what you don&apos;t want.
            </p>
          </div>
          <span
            className="stamp"
            style={{ color: color.ink, backgroundColor: color.tint }}
          >
            {course.name}
          </span>
        </div>

        {response.warning && (
          <p className="border-b border-rule bg-accent-soft px-6 py-2.5 text-sm text-accent">
            {response.warning}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-ink-soft">
            No dates were found in this file. You can add events by hand below,
            or go back and try a cleaner copy of the syllabus.
          </p>
        ) : (
          <div className="max-h-[26rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-rule text-left">
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-2 py-2 font-normal text-ink-soft">Date</th>
                  <th className="px-2 py-2 font-normal text-ink-soft">What</th>
                  <th className="px-2 py-2 font-normal text-ink-soft">Type</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-dashed border-rule-soft transition-opacity ${
                      row.included ? "" : "opacity-40"
                    }`}
                  >
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(e) => update(row.id, { included: e.target.checked })}
                        className="h-4 w-4"
                        style={{ accentColor: "var(--color-accent)" }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => update(row.id, { date: e.target.value })}
                        className="tabular rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-rule focus:border-ink focus:outline-none"
                      />
                    </td>
                    <td className="w-full px-2 py-1.5">
                      <input
                        type="text"
                        value={row.title}
                        placeholder="Event title"
                        onChange={(e) => update(row.id, { title: e.target.value })}
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-rule focus:border-ink focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={row.type}
                        onChange={(e) => update(row.id, { type: e.target.value as EventType })}
                        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-rule focus:border-ink focus:outline-none"
                      >
                        {EVENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {EVENT_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink px-6 py-4">
          <button
            type="button"
            onClick={addRow}
            className="text-sm text-ink-soft underline decoration-dashed underline-offset-4 hover:text-ink"
          >
            + add an event by hand
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-ink px-4 py-2 text-sm hover:bg-paper"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={includedCount === 0}
              className="rounded-md border border-ink bg-ink px-4 py-2 text-sm text-card shadow-[3px_3px_0_rgba(35,38,47,0.25)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            >
              Add {includedCount} event{includedCount === 1 ? "" : "s"} to calendar →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
