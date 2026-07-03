"use client";

import { useEffect, useState } from "react";
import UploadStep from "@/components/UploadStep";
import ReviewStep from "@/components/ReviewStep";
import CalendarView from "@/components/CalendarView";
import { loadData, saveData } from "@/lib/storage";
import type { Course, ParseResponse, SyllabusEvent } from "@/lib/types";

type Step = "upload" | "review" | "calendar";

interface Pending {
  course: Course;
  response: ParseResponse;
}

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<SyllabusEvent[]>([]);
  const [step, setStep] = useState<Step>("upload");
  const [pending, setPending] = useState<Pending | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);

  // Load saved data + parser status once on mount
  useEffect(() => {
    const data = loadData();
    setCourses(data.courses);
    setEvents(data.events);
    if (data.events.length > 0) setStep("calendar");
    setHydrated(true);

    fetch("/api/parse")
      .then((r) => r.json())
      .then((body) => setAiEnabled(Boolean(body.ai)))
      .catch(() => setAiEnabled(false));
  }, []);

  // Persist on every change after hydration
  useEffect(() => {
    if (hydrated) saveData({ courses, events });
  }, [courses, events, hydrated]);

  const handleParsed = (course: Course, response: ParseResponse) => {
    setPending({ course, response });
    setStep("review");
  };

  const handleConfirm = (newEvents: SyllabusEvent[]) => {
    if (!pending) return;
    setCourses((cs) => [...cs, pending.course]);
    setEvents((es) => [...es, ...newEvents]);
    setPending(null);
    setStep("calendar");
  };

  const handleCancelReview = () => {
    setPending(null);
    setStep("upload");
  };

  const deleteEvent = (id: string) =>
    setEvents((es) => es.filter((e) => e.id !== id));

  const removeCourse = (id: string) => {
    setCourses((cs) => cs.filter((c) => c.id !== id));
    setEvents((es) => es.filter((e) => e.courseId !== id));
  };

  const steps: Array<{ id: Step; n: string; label: string; enabled: boolean }> = [
    { id: "upload", n: "01", label: "Upload", enabled: true },
    { id: "review", n: "02", label: "Review", enabled: pending !== null },
    { id: "calendar", n: "03", label: "Calendar", enabled: events.length > 0 || step === "calendar" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* ── Masthead ─────────────────────────────────── */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Semester
            <span className="ml-2 inline-block -rotate-2 align-middle">
              <span className="stamp text-accent">est. {new Date().getFullYear()}</span>
            </span>
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Every syllabus, one calendar — due dates, exams, readings, all of it.
          </p>
        </div>

        <nav className="flex gap-1.5">
          {steps.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={!s.enabled}
              onClick={() => s.enabled && setStep(s.id)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                step === s.id
                  ? "border-ink bg-ink text-card"
                  : s.enabled
                    ? "border-rule hover:border-ink"
                    : "border-rule-soft text-ink-faint"
              }`}
            >
              <span className="tabular mr-1.5">{s.n}</span>
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Active step ──────────────────────────────── */}
      {!hydrated ? null : step === "upload" ? (
        <UploadStep
          courseCount={courses.length}
          aiEnabled={aiEnabled}
          onParsed={handleParsed}
        />
      ) : step === "review" && pending ? (
        <ReviewStep
          course={pending.course}
          response={pending.response}
          onConfirm={handleConfirm}
          onCancel={handleCancelReview}
        />
      ) : (
        <CalendarView
          courses={courses}
          events={events}
          onDeleteEvent={deleteEvent}
          onRemoveCourse={removeCourse}
          onAddSyllabus={() => setStep("upload")}
        />
      )}

      <footer className="mt-12 border-t border-dashed border-rule pt-4 text-center text-xs text-ink-faint">
        Runs locally — your syllabi and calendar never leave this machine
        {aiEnabled ? " (except the syllabus text sent to the Claude API for parsing)" : ""}.
      </footer>
    </div>
  );
}
