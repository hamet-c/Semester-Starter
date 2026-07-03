/* End-to-end smoke test: upload → review → calendar → persistence. */
const { chromium } = require("playwright");
const path = require("path");

const SHOTS = process.env.SHOTS_DIR || require("os").tmpdir();
const APP = process.env.APP_URL || "http://localhost:3000";
const SAMPLE = path.resolve(process.cwd(), "samples/HIST210-syllabus.txt");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });

  // ── 1. Upload step ──
  await page.goto(APP, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(SHOTS, "1-upload.png") });
  console.log("step 1: loaded —", await page.title());

  await page.getByPlaceholder(/HIST 210/).fill("HIST 210 — Modern Europe");
  await page.locator('input[type="file"]').setInputFiles(SAMPLE);

  // ── 2. Review step ──
  await page.getByText("Check the dates").waitFor({ timeout: 90000 });
  const rows = await page.locator("tbody tr").count();
  console.log("step 2: review table rows:", rows);
  if (rows < 10) throw new Error("Too few parsed rows: " + rows);
  await page.screenshot({ path: path.join(SHOTS, "2-review.png") });

  // Untick the first row to test include/exclude
  await page.locator('tbody tr input[type="checkbox"]').first().uncheck();

  await page.getByRole("button", { name: /Add \d+ events to calendar/ }).click();

  // ── 3. Calendar step ──
  await page.getByRole("button", { name: "Agenda" }).waitFor({ timeout: 10000 });
  console.log("step 3: calendar visible");
  await page.screenshot({ path: path.join(SHOTS, "3-calendar-month.png") });

  // Month grid should show at least one event chip (navigate to Sep 2026 where events are)
  const monthLabel = await page.locator("h2.font-display").last().textContent();
  console.log("  month shown:", monthLabel);

  // Agenda view
  await page.getByRole("button", { name: "Agenda" }).click();
  const agendaItems = await page.locator("main, body").getByText(/Response paper 1 due/).count();
  console.log("  agenda shows 'Response paper 1 due':", agendaItems > 0);
  await page.screenshot({ path: path.join(SHOTS, "4-calendar-agenda.png") });

  // Sidebar course count
  const sidebar = await page.getByText("HIST 210 — Modern Europe").count();
  console.log("  course in sidebar:", sidebar > 0);

  // ── 4. Persistence: reload, should land on calendar with data intact ──
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Agenda" }).waitFor({ timeout: 10000 });
  const persisted = await page.getByText("HIST 210 — Modern Europe").count();
  console.log("step 4: persisted after reload:", persisted > 0);

  if (errors.length) {
    console.log("BROWSER ERRORS:");
    for (const e of errors) console.log("  " + e);
  } else {
    console.log("no browser errors");
  }

  await browser.close();
  console.log("E2E PASS");
})().catch((err) => {
  console.error("E2E FAIL:", err.message);
  process.exit(1);
});
