/**
 * Course palette for the dark "Night Desk" theme.
 * `tint` is the display color: chip fills (with near-black text), swatches,
 * legend text, and agenda markers. Every tint keeps at least 5.5:1 contrast
 * against both the page background (#0f1218) and the chip text (#10141b).
 * `ink` is a deeper shade of the same hue for borders or hover states.
 */
export const COURSE_COLORS = [
  { id: "vermilion", label: "Vermilion", ink: "#d92f3b", tint: "#ff4f5a" },
  { id: "cobalt", label: "Cobalt", ink: "#2f7fe6", tint: "#5aa9ff" },
  { id: "forest", label: "Forest", ink: "#22a35a", tint: "#4ade80" },
  { id: "ochre", label: "Ochre", ink: "#d99e0b", tint: "#ffc531" },
  { id: "plum", label: "Plum", ink: "#8f5cf0", tint: "#b98bff" },
  { id: "teal", label: "Teal", ink: "#12b39a", tint: "#2ee6c5" },
  { id: "rose", label: "Rose", ink: "#e6478c", tint: "#ff6fae" },
  { id: "umber", label: "Umber", ink: "#d9691f", tint: "#ff9142" },
] as const;

export type CourseColorId = (typeof COURSE_COLORS)[number]["id"];

export function getColor(id: string) {
  return COURSE_COLORS.find((c) => c.id === id) ?? COURSE_COLORS[0];
}
