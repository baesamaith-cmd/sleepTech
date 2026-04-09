# Weekly Reports

Generate weekly sleep summaries from the JSON data.

## Process

1. Fetch sleep data from `sleep-data/` directory
2. Calculate weekly averages (sleep duration, quality)
3. Generate markdown report

## Output

Reports are saved as markdown files:
```
reports/weekly/2026-W15.md
```

## Future Enhancement

Auto-generate reports via GitHub Actions scheduled workflow.