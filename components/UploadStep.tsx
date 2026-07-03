"use client";

import { useCallback, useRef, useState } from "react";
import { COURSE_COLORS } from "@/lib/colors";
import type { Course, ParseResponse } from "@/lib/types";

interface Props {
  courseCount: number;
  aiEnabled: boolean | null; // null = still checking
  onParsed: (course: Course, response: ParseResponse) => void;
}

export default function UploadStep({ courseCount, aiEnabled, onParsed }: Props) {
  const [courseName, setCourseName] = useState("");
  const [colorId, setColorId] = useState(
    COURSE_COLORS[courseCount % COURSE_COLORS.length].id as string
  );
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!courseName.trim()) {
        setError("Give the course a name first (e.g. BIO 201) so events can be color-coded.");
        return;
      }
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      if (!["pdf", "docx", "txt", "md"].includes(ext)) {
        setError("Unsupported file type — upload a .pdf, .docx, or .txt syllabus.");
        return;
      }

      setParsing(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/parse", { method: "POST", body: form });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.error ?? "Parsing failed.");
        }
        const course: Course = {
          id: crypto.randomUUID(),
          name: courseName.trim(),
          color: colorId,
        };
        onParsed(course, body as ParseResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong while parsing.");
      } finally {
        setParsing(false);
      }
    },
    [courseName, colorId, onParsed]
  );

  return (
    <div className="rise-in mx-auto max-w-2xl">
      <div className="paper-card p-6 sm:p-8">
        <h2 className="font-display text-2xl">Add a syllabus</h2>
        <p className="mt-1 text-sm text-ink-soft">
          One syllabus per course. Every date it mentions ends up on your calendar.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="stamp text-ink-soft">Course name</span>
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g. HIST 210 — Modern Europe"
              className="mt-2 w-full rounded-md border border-ink bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>

          <div>
            <span className="stamp text-ink-soft">Color</span>
            <div className="mt-2 flex gap-1.5">
              {COURSE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => setColorId(c.id)}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.tint,
                    borderColor: c.ink,
                    boxShadow: colorId === c.id ? `0 0 0 2px var(--color-card), 0 0 0 4px ${c.ink}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-6 cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
            dragging
              ? "border-accent bg-accent-soft"
              : "border-rule bg-paper/60 hover:border-ink-soft"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          {parsing ? (
            <div className="pulse-soft">
              <p className="font-display text-lg">Reading the syllabus…</p>
              <p className="mt-1 text-sm text-ink-soft">
                {aiEnabled
                  ? "Claude is extracting every date — this can take up to a minute."
                  : "Scanning for dates…"}
              </p>
            </div>
          ) : (
            <>
              <p className="font-display text-lg">Drop the syllabus here</p>
              <p className="mt-1 text-sm text-ink-soft">
                or click to browse — <span className="tabular">.pdf · .docx · .txt</span>
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-accent bg-accent-soft px-3 py-2 text-sm text-accent">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-dashed border-rule pt-4">
          <span className="text-xs text-ink-soft">
            Parsing mode
          </span>
          {aiEnabled === null ? (
            <span className="stamp text-ink-faint">checking…</span>
          ) : aiEnabled ? (
            <span className="stamp" style={{ color: "#2c6e49" }}>
              ● AI parsing ready
            </span>
          ) : (
            <span className="stamp text-ink-soft" title="Add ANTHROPIC_API_KEY to .env.local for AI parsing">
              basic mode — no API key
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
