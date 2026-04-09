# SleepTech API

Serverless backend using Vercel Functions.

## Setup

```bash
cd api/vercel
npm install
vercel dev
```

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/sleep-log | Submit sleep data |

## Environment Variables

Set these in Vercel dashboard:

- `GITHUB_TOKEN` - GitHub PAT with repo scope
- `SLEEP_DATA_REPO` - Format: `owner/repo`
- `API_BASE_URL` - Optional override