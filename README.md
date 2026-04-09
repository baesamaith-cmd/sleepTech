# SleepTech MVP

**Recommended stack:** GitHub Pages for the mobile form frontend, Vercel Functions for the serverless API, and a separate private GitHub repo for canonical JSON storage.

## Why this stack

This is the simplest good MVP for your requirements.

- **GitHub Pages** keeps the frontend free, static, and easy to share from OpenClaw messages.
- **Vercel Functions** give you a tiny JavaScript API without running a server.
- **Private GitHub repo storage** keeps health-related data out of the public frontend repo and gives OpenClaw a repo-native source for later summaries.
- **No client secrets** because the GitHub token only lives in Vercel environment variables.

## What this MVP includes

- Mobile-friendly morning and evening check-in pages
- A simple shared frontend script and stylesheet
- A Vercel serverless endpoint for `POST /api/sleep-log`
- Input validation and date-based JSON storage shape
- Docs for OpenClaw morning/evening prompt templates
- Starter schema examples for future weekly summaries

## Folder structure

```text
pages/
  index.html
  morning.html
  evening.html
  assets/
    app.js
    styles.css

api/
  README.md
  vercel/
    README.md
    api/
      sleep-log.js

config/
  schema.examples.json

docs/
  openclaw-prompts.md

sleep-data/
  README.md

reports/
  weekly/
    README.md
```

## Data schema shape

Canonical storage is one file per date in the private data repo.

Example path:

```text
sleep-data/2026-04-09.json
```

Example document:

```json
{
  "date": "2026-04-09",
  "entries": {
    "morning": {
      "type": "morning",
      "date": "2026-04-09",
      "sleep_time": "22:30",
      "wake_time": "06:15",
      "sleep_quality": 4,
      "awakenings": 1,
      "memo": "Woke once around 3am.",
      "submitted_at": "2026-04-09T06:20:00Z"
    },
    "evening": {
      "type": "evening",
      "date": "2026-04-09",
      "caffeine": true,
      "exercise": false,
      "nap": false,
      "stress_or_condition": "Busy workday",
      "expected_bedtime": "23:00",
      "memo": "Trying to sleep earlier tonight.",
      "submitted_at": "2026-04-09T21:10:00Z"
    }
  },
  "metadata": {
    "last_updated_at": "2026-04-09T21:10:00Z",
    "source": "sleeptech-mvp"
  }
}
```

This shape is simple, readable, and good for later calculations such as:
- average sleep duration
- average sleep quality
- late bedtime pattern
- simple correlation-ready comparisons against caffeine, exercise, naps, and stress notes

A Markdown mirror can be added later, but JSON should stay canonical for MVP.

## Morning and evening message templates

See `docs/openclaw-prompts.md`.

## Implementation order

1. Create a **public frontend repo** for GitHub Pages, or publish the `pages/` folder from this repo.
2. Create a **separate private repo** for stored sleep logs.
3. Deploy `api/vercel/` to Vercel.
4. Set Vercel environment variables.
5. Replace `YOUR_VERCEL_APP` in the HTML files with the real Vercel deployment URL.
6. Publish the Pages frontend and copy the final morning/evening links into OpenClaw scheduled prompts.
7. Test one morning and one evening submission.
8. Confirm the JSON files land in the private repo with the expected date-based structure.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | Yes | GitHub token used by the serverless API to write into the private data repo |
| `SLEEP_DATA_REPO` | Yes | Target private repo in `owner/repo` format |
| `GITHUB_DATA_BRANCH` | No | Branch to write to, defaults to `main` |
| `API_BASE_URL` | Optional client config | Useful for local testing or custom deployment docs |

## Starter scaffold notes

- `pages/` is ready for GitHub Pages style static hosting.
- `api/vercel/api/sleep-log.js` is the MVP serverless endpoint.
- `config/schema.examples.json` documents the target payload shape.
- `sleep-data/README.md` and `reports/weekly/README.md` describe how private storage and reporting should evolve.

## Security constraints

- Default to a **private data repo**
- Never expose the GitHub token in client-side code
- Keep this as wellness logging only
- Do **not** present medical diagnosis, treatment advice, or risk scoring

## Local/dev setup

```bash
git init
# edit the HTML files to point at your deployed Vercel URL later
# deploy api/vercel to Vercel
# publish pages/ to GitHub Pages
```

## Files created in this scaffold

- `README.md`
- `pages/index.html`
- `pages/morning.html`
- `pages/evening.html`
- `pages/assets/app.js`
- `pages/assets/styles.css`
- `api/README.md`
- `api/vercel/README.md`
- `api/vercel/api/sleep-log.js`
- `config/schema.examples.json`
- `docs/openclaw-prompts.md`
- `sleep-data/README.md`
- `reports/weekly/README.md`
