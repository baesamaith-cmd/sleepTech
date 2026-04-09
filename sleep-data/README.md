# Sleep Data Storage

This directory stores JSON files for each day of sleep data.

## Format

```
sleep-data/
  2026-04-09.json
  2026-04-10.json
  ...
```

Each file contains:

```json
{
  "2026-04-09": {
    "morning": { ... },
    "evening": { ... }
  }
}
```

## Storage Location

The JSON files are stored in a **separate private GitHub repo** specified by `SLEEP_DATA_REPO` env var.

## OpenClaw Integration

These JSON files are canonical data sources for OpenClaw-powered weekly summaries. The structure is optimized for easy parsing by AI summarization tools.