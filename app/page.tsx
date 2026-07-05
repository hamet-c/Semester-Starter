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

function termLabel(date: Date) {
  const m = date.getMonth();
  const term = m >= 7 ? "FALL" : m >= 4 ? "SUMMER" : "SPRING";
  return `${term}.${date.getFullYear()}`;
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

  const steps: Array<{ id: Step; label: string; enabled: boolean }> = [
    { id: "upload", label: "[01 UPLOAD]", enabled: true },
    { id: "review", label: "[02 REVIEW]", enabled: pending !== null },
    { id: "calendar", label: "[03 CALENDAR]", enabled: events.length > 0 || step === "calendar" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Header bar ───────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-[22px] py-[14px]">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-mono text-[15px] font-semibold tracking-[0.06em]">
            SEMESTER<span className="text-accent">//</span>
            {termLabel(new Date())}
          </h1>
          <p className="text-[11px] text-text-soft">every syllabus, one calendar</p>
        </div>

        <nav className="flex gap-1.5 font-mono text-[10px] tracking-[0.06em]">
          {steps.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={!s.enabled}
              onClick={() => s.enabled && setStep(s.id)}
              className={`px-[10px] py-[5px] transition-colors duration-[120ms] ${
                step === s.id
                  ? "border border-text bg-text text-night"
                  : s.enabled
                    ? "border border-edge text-text-soft hover:border-dash hover:text-text"
                    : "border border-edge-soft text-text-faint"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Active step ──────────────────────────────── */}
      <main className="mx-auto w-full max-w-[1124px] flex-1 px-[22px] py-[18px]">
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
      </main>

      {/* Calendar shows this line in its sidebar instead */}
      {step !== "calendar" && (
        <footer className="px-[22px] pb-[18px] text-center font-mono text-[9px] tracking-[0.08em] text-text-faint">
          ● LOCAL ONLY — DATA NEVER LEAVES THIS MACHINE
          {aiEnabled ? " (SYLLABUS TEXT IS SENT TO THE CLAUDE API FOR PARSING)" : ""}
        </footer>
      )}
    </div>
  );
}
