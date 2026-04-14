# claude-cache-monitor

> 📺 **HNPulse Shorts** — 이 도구가 만들어진 배경 (캐시 TTL 1h→5m 변경 이슈):
> **[▶ Watch the Short](https://www.youtube.com/shorts/oSx2sg935nI)** · [All HNPulse Shorts](https://www.youtube.com/@HNPulseKR/shorts)
>
> [![HNPulse Short](https://img.youtube.com/vi/oSx2sg935nI/hqdefault.jpg)](https://www.youtube.com/shorts/oSx2sg935nI)

Prompt cache hit rate monitoring tool for Claude Code subscribers.

After Anthropic's silent cache TTL change (1h to 5m) in March 2026, subscription plan users have no way to check cache performance from the Console dashboard. This tool analyzes local session logs (`~/.claude/projects/`) to show cache hit rates, TTL distribution, and cost impact.

---

Claude Code 구독자를 위한 프롬프트 캐시 히트율 모니터링 도구.

2026년 3월 Anthropic의 캐시 TTL 변경(1h → 5m) 이후, 구독 플랜 사용자는 Console 대시보드에서 캐시 성능을 확인할 수 없습니다. 이 도구는 로컬 세션 로그(`~/.claude/projects/`)를 분석하여 캐시 히트율, TTL 분포, 비용 영향을 보여줍니다.

## Quick Start

```bash
# Run instantly (no install required)
npx claude-cache-monitor

# Last 7 days only
npx claude-cache-monitor --days 7

# JSON output (for pipelines)
npx claude-cache-monitor --format json

# CSV output (for spreadsheets)
npx claude-cache-monitor --format csv
```

## Hook Setup

Automatically logs cache stats on every tool call and alerts when hit rate drops below a threshold.

매 도구 호출마다 자동으로 캐시 통계를 기록하고, 히트율이 임계값 이하로 떨어지면 경고합니다.

```bash
# Install hook (default threshold 70%)
npx claude-cache-monitor --install-hook

# Custom threshold
npx claude-cache-monitor --install-hook --threshold 0.8

# Remove hook
npx claude-cache-monitor --uninstall-hook
```

When the hook is installed:
- Session-level stats are automatically recorded to `~/.claude/cache-stats.jsonl`
- A warning is displayed in Claude Code when hit rate falls below the threshold

## Output Example

```
  Claude Cache Monitor — Last 30 days
  ══════════════════════════════════════════════════

  Summary
  Sessions: 380  |  API calls: 10,813  |  Model: claude-sonnet
  Cache hit rate: 98.2%  |  Total input: 1957.94M tokens

  TTL Breakdown
  ┌────────────────────┬──────────────────┬──────────────────┐
  │                    │     5m Ephemeral │      1h Extended │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Cache writes       │    167.7K (0.5%) │    34.8M (99.5%) │
  └────────────────────┴──────────────────┴──────────────────┘

  Cost Impact (estimated)
  ┌──────────────────────────┬──────────────┐
  │ Actual cost              │      $793.93 │
  │ Without cache            │     $5958.52 │
  ├──────────────────────────┼──────────────┤
  │ Savings                  │ $5164.6 (86.7%) │
  │ Extra cost if 5m-only    │     +$239.99 │
  └──────────────────────────┴──────────────┘

  Daily Trend
  ┌────────────┬──────────┬─────────┬────────────┬────────────┬───────┐
  │ Date       │  HitRate │   Calls │       Read │      Write │   5m% │
  ├────────────┼──────────┼─────────┼────────────┼────────────┼───────┤
  │ 2026-04-10 │    98.5% │     341 │     88.98M │      1.35M │  0.0% │
  │ 2026-04-11 │    97.1% │     118 │      9.51M │      0.27M │  0.0% │
  │ 2026-04-12 │    91.7% │      77 │      2.69M │      0.22M │  0.0% │
  └────────────┴──────────┴─────────┴────────────┴────────────┴───────┘
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--days, -d` | Analysis period in days | 30 |
| `--format, -f` | Output format: `table`, `json`, `csv` | table |
| `--project, -p` | Filter by project directory | all |
| `--threshold` | Cache hit rate alert threshold (0.0-1.0) | 0.7 |
| `--install-hook` | Install Claude Code PostToolUse hook | - |
| `--uninstall-hook` | Remove hook | - |

## How It Works

Claude Code logs usage data for every API call into session JSONL files:

```
~/.claude/projects/<project-dir>/<session-id>.jsonl
```

Each API response contains these fields:
- `cache_read_input_tokens` — tokens read from cache (cheap, 0.1x)
- `cache_creation_input_tokens` — tokens written to cache (expensive, 1.25x~2x)
- `cache_creation.ephemeral_5m_input_tokens` — tokens created with 5-minute TTL
- `cache_creation.ephemeral_1h_input_tokens` — tokens created with 1-hour TTL

This tool deduplicates streaming chunks by `requestId` and aggregates by day/session.

## Key Findings

Cache TTL is determined by your subscription plan, not by user choice:

| Plan | Cache TTL | Controlled by |
|------|-----------|---------------|
| **Max** ($100~200/mo) | **1h automatic** | `tengu_prompt_cache_1h_config` feature flag |
| **Pro** ($20/mo) | **5m fixed** | Not configurable |
| **API key** | **5m default** (1h via beta header) | `cache_control.ttl` parameter |

## Platform Support

Works on **macOS**, **Windows**, and **Linux**. Requires Node.js >= 18.

Zero dependencies.

## Background

- [GitHub Issue #46829](https://github.com/anthropics/claude-code/issues/46829): Cache TTL regression analysis
- [HN Discussion](https://news.ycombinator.com/item?id=47736476): Community reaction (168 points, 142 comments)
- [HNPulse KR](https://www.youtube.com/@HNPulseKR): Hacker News tech deep-dives in Korean ([Shorts](https://www.youtube.com/@HNPulseKR/shorts))

## License

MIT

