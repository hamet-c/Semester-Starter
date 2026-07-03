# Semester — syllabus to calendar

Upload your course syllabi (PDF, Word, or plain text) and get every due date,
exam, quiz, reading, and holiday on one semester calendar.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## How it works

1. **Upload** — name the course, pick a color, drop the syllabus file.
2. **Review** — the parser lists every date it found; fix titles/dates, untick
   anything you don't want.
3. **Calendar** — month grid and semester agenda, color-coded per course.
   Everything is saved in your browser (localStorage), so it survives reloads.

## AI parsing (recommended)

Out of the box the app uses rule-based date detection, which works but is
imperfect on messy syllabi. For much more accurate parsing:

1. Copy `.env.local.example` to `.env.local`
2. Paste your Anthropic API key (from https://platform.claude.com/)
3. Restart the dev server

The upload screen shows a green "AI parsing ready" stamp when the key is
active. Only the syllabus text is sent to the Claude API; your calendar data
never leaves your machine.

## Sample syllabi

Two test files live in `samples/` — try uploading
`samples/HIST210-syllabus.txt` or `samples/BIO201-syllabus.pdf`.

## Smoke test

With the dev server running:

```bash
npm run test:e2e            # drives the full upload → review → calendar flow
```

(Uses Playwright with the system Edge browser; set `APP_URL` if the server
isn't on port 3000.)
