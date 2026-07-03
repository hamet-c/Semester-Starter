import type { Course, SyllabusEvent } from "./types";

const KEY = "syllabus-calendar-v1";

export interface StoredData {
  courses: Course[];
  events: SyllabusEvent[];
}

export function loadData(): StoredData {
  if (typeof window === "undefined") return { courses: [], events: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { courses: [], events: [] };
    const parsed = JSON.parse(raw) as StoredData;
    return {
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { courses: [], events: [] };
  }
}

export function saveData(data: StoredData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
}
