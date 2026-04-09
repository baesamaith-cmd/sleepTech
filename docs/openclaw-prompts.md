# OpenClaw message templates

Use these as the scheduled prompts OpenClaw sends with GitHub Pages form links.

Replace:
- `https://YOUR_PAGES_SITE/pages/morning.html` with your real GitHub Pages morning URL
- `https://YOUR_PAGES_SITE/pages/evening.html` with your real GitHub Pages evening URL

## Morning prompt template

```text
Good morning ☀️

How was your sleep?
Please fill in your morning check-in here:
https://YOUR_PAGES_SITE/pages/morning.html

Today’s fields:
- sleep time
- wake time
- sleep quality
- awakenings
- memo
```

## Evening prompt template

```text
Good evening 🌙

Before bed, log today’s sleep-related factors here:
https://YOUR_PAGES_SITE/pages/evening.html

Tonight’s fields:
- caffeine
- exercise
- nap
- stress or condition
- expected bedtime
- memo
```

## Suggested OpenClaw schedule

- Morning prompt: 07:00 local time
- Evening prompt: 21:00 local time

## Weekly summary prompt for OpenClaw

```text
Read the last 7 daily JSON files from the private sleep-data repo.

Generate a simple weekly summary including:
1. Average sleep duration
2. Average sleep quality
3. Late bedtime pattern
4. Notable factors from caffeine, exercise, naps, and stress_or_condition
5. Any obvious correlation-ready observations without making medical claims

Do not provide diagnosis or treatment advice.
```
