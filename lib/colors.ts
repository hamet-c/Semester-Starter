/** Print-marker course palette: strong ink for text/borders, soft tint for fills. */
export const COURSE_COLORS = [
  { id: "vermilion", label: "Vermilion", ink: "#c13a1b", tint: "#f8e4dd" },
  { id: "cobalt", label: "Cobalt", ink: "#2855a5", tint: "#e2eaf7" },
  { id: "forest", label: "Forest", ink: "#2c6e49", tint: "#e0efe5" },
  { id: "ochre", label: "Ochre", ink: "#a06d05", tint: "#f6ecd4" },
  { id: "plum", label: "Plum", ink: "#79458f", tint: "#f0e5f5" },
  { id: "teal", label: "Teal", ink: "#0f766e", tint: "#dcefed" },
  { id: "rose", label: "Rose", ink: "#b03060", tint: "#f9e3ec" },
  { id: "umber", label: "Umber", ink: "#7c4a21", tint: "#f2e6da" },
] as const;

export type CourseColorId = (typeof COURSE_COLORS)[number]["id"];

export function getColor(id: string) {
  return COURSE_COLORS.find((c) => c.id === id) ?? COURSE_COLORS[0];
}
