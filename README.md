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

## Statusline Mode (new in v1.2.0)

Always-on one-line display in Claude Code's native statusline — no need to run commands manually.

Claude Code 내장 statusline에 한 줄로 상시 표시. 커맨드 수동 실행 불필요.

```bash
# Preview (prints one line)
npx claude-cache-monitor --statusline
#  → 🧠 97.5% · 1h · ⏱ 42:15 · 💰 $4.8K · 7d

# Verbose (longer labels)
npx claude-cache-monitor --statusline --verbose
#  → 🧠 97.5% · 1h TTL · ⏱ 42:15 left · 💰 $4.8K saved · 7d

# Hide the TTL countdown
npx claude-cache-monitor --statusline --no-timer

# No ANSI color (plain text)
npx claude-cache-monitor --statusline --no-color
```

### TTL countdown (v1.2.1)

Your subscription plan fixes the TTL bucket (5m for Pro, 1h for Max) — the actionable number isn't the bucket, it's **how much time is left on your last API call's cache entry**. The `⏱ MM:SS` segment is a live stopwatch:

구독 플랜이 TTL 값(Pro = 5분, Max = 1시간)을 고정하므로 의미 있는 수치는 "버킷"이 아니라 "마지막 API 호출의 캐시가 만료되기까지 몇 초"입니다. `⏱ MM:SS` 세그먼트가 그 스톱워치입니다:

- 🟢 &gt;30% remaining — plenty of time to send the next prompt within TTL
- 🟡 10–30% remaining — consider firing a cheap prompt soon to keep prefix cached
- 🔴 &lt;10% remaining or `EXPIRED` — next prompt will pay cache-write cost again

This enables the "5-minute rule" in practice: a quick dummy question before the timer hits zero resets the TTL and preserves the prefix cache.

### Enable in Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx claude-cache-monitor --statusline"
  }
}
```

Claude Code calls this every ~300ms and displays the output in the statusline bar. Colors are emitted when the terminal supports them:

- **Hit rate** — 🟢 ≥85% · 🟡 70–85% · 🔴 <70%
- **TTL** — 🟢 1h (good) · 🟡 5m (warning)

Statusline mode uses the last 7 days by default (override with `--days N`) and never emits multi-line errors, so your statusline stays clean even when there's no session data yet.

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
  Sessions: 380  |  API calls: 10,813  |  Model: claude-opus-new
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
| `--statusline` | Emit one-line output for Claude Code statusline API | - |
| `--verbose` | (with `--statusline`) use longer labels | - |
| `--no-timer` | (with `--statusline`) hide the TTL countdown | show |
| `--no-color` | Strip ANSI escape codes | - |

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

## Pricing (updated 2026-04 for Opus 4.7)

Cost estimates use current Anthropic pricing, auto-detected from the model id in session logs:

| Tier (internal id) | Matching models | Input | 5m Cache Write | 1h Cache Write | Cache Read | Output |
|---|---|---|---|---|---|---|
| `claude-opus-new` | Opus **4.5 / 4.6 / 4.7** | $5 | $6.25 | $10 | $0.50 | $25 |
| `claude-opus-legacy` | Opus 4 / 4.1 / 3 | $15 | $18.75 | $30 | $1.50 | $75 |
| `claude-sonnet` | Sonnet 3.7 / 4 / 4.5 / 4.6 | $3 | $3.75 | $6 | $0.30 | $15 |
| `claude-haiku-4-5` | Haiku 4.5 | $1 | $1.25 | $2 | $0.10 | $5 |
| `claude-haiku-3-5` | Haiku 3.5 | $0.80 | $1 | $1.6 | $0.08 | $4 |
| `claude-haiku-3` | Haiku 3 | $0.25 | $0.30 | $0.50 | $0.03 | $1.25 |

5m and 1h cache writes are now billed at separate rates (previously applied a single blended rate). Prior versions (≤ 1.0.x) used legacy Opus 4 pricing for all Opus models, over-estimating Opus 4.5+ costs by ~3x — **upgrade to 1.1.0 if you run Opus 4.5 or newer**.

Source: [Anthropic pricing documentation](https://docs.claude.com/en/docs/about-claude/pricing)

## Platform Support

Works on **macOS**, **Windows**, and **Linux**. Requires Node.js >= 18.

Zero dependencies.

## Background

- [GitHub Issue #46829](https://github.com/anthropics/claude-code/issues/46829): Cache TTL regression analysis
- [HN Discussion](https://news.ycombinator.com/item?id=47736476): Community reaction (168 points, 142 comments)
- [HNPulse KR](https://www.youtube.com/@HNPulseKR): Hacker News tech deep-dives in Korean ([Shorts](https://www.youtube.com/@HNPulseKR/shorts))

## License

MIT

