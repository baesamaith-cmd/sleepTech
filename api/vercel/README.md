# Vercel Functions Setup

## Deploy

```bash
npm install -g vercel
vercel --prod
```

## Environment Variables

Add in Vercel dashboard:

| Variable | Value |
|----------|-------|
| GITHUB_TOKEN | ghp_xxxxxxxxxxxx |
| SLEEP_DATA_REPO | your-org/sleep-data |

## Local Development

```bash
vercel dev
```

Then set env vars in `.env.local`:
```
GITHUB_TOKEN=your_token
SLEEP_DATA_REPO=owner/repo
```