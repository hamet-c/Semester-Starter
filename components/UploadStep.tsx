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
    <div className="rise-in mx-auto max-w-[460px]">
      <div className="rounded-[6px] border border-edge bg-panel p-5">
        <h2 className="font-display text-[21px]">Add a syllabus</h2>
        <p className="mt-1 text-[11.5px] text-text-soft">
          One per course. Every date it mentions ends up on the calendar.
        </p>

        <div className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-text-faint">
          COURSE_NAME:
        </div>
        <input
          type="text"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="HIST 210 — Modern Europe"
          className="mt-1.5 w-full rounded-[4px] border border-edge bg-night px-2.5 py-2 font-mono text-[12px] text-text outline-none transition-colors duration-[120ms] placeholder:text-text-faint focus:border-dash"
        />

        <div className="mt-[13px] font-mono text-[9px] uppercase tracking-[0.16em] text-text-faint">
          COLOR:
        </div>
        <div className="mt-2 flex gap-[7px]">
          {COURSE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              onClick={() => setColorId(c.id)}
              className="h-[22px] w-[22px] rounded-[4px] transition-transform duration-[120ms] hover:scale-110"
              style={{
                backgroundColor: c.tint,
                boxShadow:
                  colorId === c.id
                    ? `0 0 0 2px var(--color-panel), 0 0 0 4px ${c.tint}`
                    : "none",
              }}
            />
          ))}
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
          className={`mt-4 cursor-pointer rounded-[6px] border bg-night p-[26px] text-center transition-colors duration-[120ms] ${
            dragging ? "border-solid border-mint" : "border-dashed border-dash"
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
              <p className="font-mono text-[13px] tracking-[0.04em]">
                &gt; READING SYLLABUS<span className="blink">_</span>
              </p>
              <p className="mt-[5px] text-[11px] text-text-soft">
                {aiEnabled
                  ? "Claude is extracting every date — this can take up to a minute."
                  : "Scanning for dates…"}
              </p>
            </div>
          ) : (
            <>
              <p className={`font-mono text-[13px] tracking-[0.04em] ${dragging ? "text-mint" : ""}`}>
                &gt; DROP SYLLABUS HERE<span className="blink">_</span>
              </p>
              <p className={`mt-[5px] text-[11px] ${dragging ? "text-mint" : "text-text-soft"}`}>
                or click to browse — .pdf · .docx · .txt
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-[4px] border border-accent/50 px-3 py-2 text-[11.5px] text-accent">
            {error}
          </p>
        )}

        <div className="mt-[14px] flex items-center justify-between border-t border-edge pt-2.5 font-mono text-[9.5px] tracking-[0.1em]">
          <span className="text-text-faint">PARSER</span>
          {aiEnabled === null ? (
            <span className="pulse-soft text-text-faint">● CHECKING…</span>
          ) : aiEnabled ? (
            <span className="text-mint">● AI READY</span>
          ) : (
            <span
              className="text-text-soft"
              title="Add ANTHROPIC_API_KEY to .env.local for AI parsing"
            >
              ● BASIC MODE — NO API KEY
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
