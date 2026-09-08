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

## Export to other calendars

The calendar sidebar has a **↓ Download .ics** button that exports every event
as a standard iCalendar file. Import it into:

- **Google Calendar** — Settings → Import & export → Import
- **Apple Calendar** — File → Import (or double-click the file)
- **Outlook** — File → Open & Export → Import/Export

Events are exported as all-day entries with the course name in the title and
the event type in the description.

## AI parsing (recommended)

Out of the box the app uses rule-based date detection, which works but is
imperfect on messy syllabi. For much more accurate parsing, add a free
Google Gemini API key:

1. Get a key at https://aistudio.google.com/apikey (free tier, no card needed)
2. Copy `.env.local.example` to `.env.local` and paste the key as `AI_API_KEY`
3. Restart the dev server

The upload screen shows a green "AI READY" stamp when the key is active. Only
the syllabus text is sent to the AI provider; your calendar data never leaves
your machine.

### Using a different provider

The parser talks to any OpenAI-compatible chat-completions endpoint, so you
can point it elsewhere by adding two more variables to `.env.local`:

| Provider                | `AI_BASE_URL`                                              | `AI_MODEL` example         |
| ----------------------- | ---------------------------------------------------------- | -------------------------- |
| Google Gemini (default) | `https://generativelanguage.googleapis.com/v1beta/openai`  | `gemini-3.8-flash`         |
| Groq (free tier)        | `https://api.groq.com/openai/v1`                           | `llama-3.3-70b-versatile`  |
| OpenRouter              | `https://openrouter.ai/api/v1`                             | any model ending in `:free` |
| OpenAI                  | `https://api.openai.com/v1`                                | `gpt-5-mini`               |

`AI_MODEL` may be a comma-separated list; the parser tries each model in
order. The default is `gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash-lite`
because Gemini's free tier often answers "high demand" (HTTP 503) for the
newest Flash model at busy times. Flash-Lite is the fastest (a few seconds per
syllabus), so set `AI_MODEL=gemini-3.5-flash-lite` if you'd rather trade a
little accuracy for speed.

If every model fails, the app falls back to rule-based parsing and the warning
on the review screen names each model and the provider's reason.

## Smoke test

With the dev server running:

```bash
npm run test:e2e            # drives the full upload → review → calendar flow
```

(Uses Playwright with the system Edge browser; set `APP_URL` if the server
isn't on port 3000.)
