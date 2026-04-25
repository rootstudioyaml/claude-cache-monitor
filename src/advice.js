/**
 * Human-readable advice for each diagnostic issue code.
 * Platform-specific commands are selected from process.platform.
 */

function platformKind() {
  if (process.platform === 'win32') return 'win';
  // WSL shows up as 'linux' but $WSL_DISTRO_NAME is set — treat as linux either way.
  return 'posix';
}

function disable1mEnvSnippet() {
  if (platformKind() === 'win') {
    return [
      'setx CLAUDE_CODE_DISABLE_1M_CONTEXT 1',
      '(PowerShell) $env:CLAUDE_CODE_DISABLE_1M_CONTEXT = "1"',
    ];
  }
  return [
    "echo 'export CLAUDE_CODE_DISABLE_1M_CONTEXT=1' >> ~/.zshrc && source ~/.zshrc",
    '(bash) echo \'export CLAUDE_CODE_DISABLE_1M_CONTEXT=1\' >> ~/.bashrc && source ~/.bashrc',
  ];
}

function toggleShortcut() {
  return platformKind() === 'win' ? 'Alt + P' : '⌥ P (mac) / Alt + P (linux)';
}

export const ISSUE_MESSAGES = {
  LARGE_INPUT_PER_REQUEST: {
    title: 'Per-request input tokens are unusually large (1M context suspected)',
    explain:
      'Since Opus 4.7, 1M context is priced at the standard rate, and Max plans auto-promote ' +
      'sessions to 1M. Once context goes past 200k, long-context pricing kicks in and cache reuse drops.',
    actions: () => [
      {
        label: 'Disable 1M context (env var)',
        commands: disable1mEnvSnippet(),
      },
      {
        label: 'In-session toggle',
        commands: [`Press ${toggleShortcut()} to toggle on/off instantly`],
      },
      {
        label: '⚠ Known bug #31640',
        commands: [
          '/model 200k selection sometimes does not stick — context stays at 1M.',
          'To force off: set the env var above and restart Claude Code.',
        ],
      },
    ],
  },
  LOW_HIT_RATE: {
    title: 'Cache hit rate is low',
    explain:
      'A low hit rate means the same prompt prefix is being rewritten on every call, ' +
      'inflating input cost.',
    actions: () => [
      {
        label: 'Avoid opening fresh sessions too often',
        commands: ['Continue the same task in the same session (context switching = cache miss)'],
      },
      {
        label: 'Stabilize the prompt prefix',
        commands: ['System prompts / tool definitions that change per request invalidate the cache every time'],
      },
    ],
  },
  BUCKET_5M_DOMINANT: {
    title: 'Most cache writes are landing in the 5-minute TTL bucket',
    explain:
      'Pro plan is locked to 5m TTL. Gaps longer than 5 minutes expire the cache and force ' +
      'a costly rebuild.',
    actions: () => [
      {
        label: 'The 5-minute rule',
        commands: [
          'Sending any prompt within 5 minutes keeps the prefix cache warm',
          'Upgrade to Max for the 1h TTL bucket on long tasks',
        ],
      },
    ],
  },
  HIGH_OUTPUT_RATIO: {
    title: 'Output share is abnormally high',
    explain:
      'Output tokens are 5x+ pricier than input. Check whether the agent is regenerating ' +
      'long content unnecessarily.',
    actions: () => [
      {
        label: 'Cap output length',
        commands: [
          'Avoid full-file rewrites — prefer the Edit tool',
          'Move long doc/README generation requests into scripts to shrink output',
        ],
      },
    ],
  },
  HIGH_REQUEST_COUNT: {
    title: 'API calls in this session are 3x+ the baseline',
    explain:
      'Excessive tool calls or retry/loop patterns rebroadcast the prefix on every call, ' +
      'spiking input cost.',
    actions: () => [
      {
        label: 'Parallel / batch processing',
        commands: ['Bundle independent investigations into one message with multiple tool calls'],
      },
      {
        label: 'Watch for loops',
        commands: ['Check that the agent is not repeating the same test/search in a loop'],
      },
    ],
  },
  FREQUENT_CACHE_REBUILD: {
    title: 'Cache writes outweigh cache reads',
    explain:
      'The cache is being created but not reused. Common when sessions are short-lived or ' +
      'restarted after TTL expiry.',
    actions: () => [
      {
        label: 'Check session continuity',
        commands: ['Continue one task in one Claude Code session'],
      },
    ],
  },
};

/**
 * For the statusline: the single most relevant short chip (1~2 words).
 * Priority reflects what a user can act on *right now*.
 * Kept short and English-only — these ride along on a single-line statusline
 * shown to a global audience.
 */
export function chipForIssues(issues, contextWindow) {
  if (contextWindow?.size === '1M') return '⚠ 1M ON';
  const codes = issues.map((i) => i.code);
  if (codes.includes('LARGE_INPUT_PER_REQUEST')) return '⚠ Input spike';
  if (codes.includes('BUCKET_5M_DOMINANT')) return '⚠ 5m TTL';
  if (codes.includes('LOW_HIT_RATE')) return '⚠ Cache miss';
  if (codes.includes('FREQUENT_CACHE_REBUILD')) return '⚠ Rebuild churn';
  if (codes.includes('HIGH_OUTPUT_RATIO')) return '⚠ Output heavy';
  if (codes.includes('HIGH_REQUEST_COUNT')) return '⚠ Call surge';
  return null;
}
