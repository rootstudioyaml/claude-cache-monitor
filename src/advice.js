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
    title: '요청당 입력 토큰이 평소보다 매우 큽니다 (1M 컨텍스트 의심)',
    explain:
      'Opus 4.7부터 1M 컨텍스트가 표준 가격으로 풀리면서 Max 플랜은 자동으로 1M로 승격됩니다. ' +
      '한 번 컨텍스트가 200k를 넘으면 long-context 단가가 적용되고 캐시 재사용도 어려워집니다.',
    actions: () => [
      {
        label: '1M 컨텍스트 OFF (환경변수)',
        commands: disable1mEnvSnippet(),
      },
      {
        label: '세션 내 토글',
        commands: [`단축키 ${toggleShortcut()} 로 즉시 On/Off`],
      },
      {
        label: '⚠ 알려진 버그 #31640',
        commands: [
          '/model 로 200k 선택해도 컨텍스트가 1M에 머무는 케이스가 있습니다.',
          '확실히 끄려면 위 환경변수를 설정한 뒤 Claude Code를 재시작하세요.',
        ],
      },
    ],
  },
  LOW_HIT_RATE: {
    title: '캐시 히트율이 낮습니다',
    explain:
      '캐시 히트율이 떨어지면 같은 프롬프트 prefix를 매번 다시 작성하게 되어 입력 비용이 커집니다.',
    actions: () => [
      {
        label: '세션을 너무 자주 새로 열지 않았는지 확인',
        commands: ['한 작업은 같은 세션에서 이어가세요 (컨텍스트 전환 = 캐시 미스)'],
      },
      {
        label: '프롬프트 prefix 안정화',
        commands: ['시스템 프롬프트·도구 정의가 요청마다 바뀌면 캐시가 매번 무효화됩니다'],
      },
    ],
  },
  BUCKET_5M_DOMINANT: {
    title: '5분 TTL 쓰기가 대부분입니다',
    explain:
      'Pro 플랜은 5분 TTL로 고정됩니다. 5분 이상 간격이 벌어지면 캐시가 만료되어 재작성 비용이 발생합니다.',
    actions: () => [
      {
        label: '5분 규칙',
        commands: [
          '5분 안에 아무 프롬프트라도 보내면 prefix 캐시가 유지됩니다',
          '긴 작업이 필요하면 Max 플랜으로 1h TTL 자동 적용',
        ],
      },
    ],
  },
  HIGH_OUTPUT_RATIO: {
    title: 'Output 비중이 비정상적으로 높습니다',
    explain:
      'Output 토큰은 입력보다 5배 이상 비쌉니다. 에이전트가 장문을 반복 생성하지 않는지 확인하세요.',
    actions: () => [
      {
        label: '출력 길이 제한',
        commands: [
          '불필요한 전체 파일 쓰기·재생성 지양 (Edit 툴 활용)',
          '긴 문서·README 생성 요청을 스크립트화해서 줄이세요',
        ],
      },
    ],
  },
  HIGH_REQUEST_COUNT: {
    title: '세션의 API 호출 수가 평소의 3배 이상입니다',
    explain:
      '툴 호출이 과도하거나 루프/재시도가 많으면 호출당 prefix 재전송으로 입력 비용이 폭증합니다.',
    actions: () => [
      {
        label: '병렬/일괄 처리',
        commands: ['독립적인 조사는 한 메시지에 여러 도구 호출로 묶으세요'],
      },
      {
        label: '루프 감지',
        commands: ['같은 테스트·검색을 반복하는 에이전트 루프가 없는지 확인'],
      },
    ],
  },
  FREQUENT_CACHE_REBUILD: {
    title: '캐시 쓰기가 읽기보다 많습니다',
    explain:
      '캐시를 만들고 재사용하지 못하고 있습니다. 세션이 자주 끊기거나 TTL이 만료된 후 새로 시작한 경우 흔합니다.',
    actions: () => [
      {
        label: '세션 지속 시간 확인',
        commands: ['한 작업은 같은 Claude Code 세션에서 이어가세요'],
      },
    ],
  },
};

/**
 * For the statusline: the single most relevant short chip (1~2 words).
 * Priority reflects what a user can act on *right now*.
 */
export function chipForIssues(issues, contextWindow) {
  if (contextWindow?.size === '1M') return '⚠ 1M컨텍스트';
  const codes = issues.map((i) => i.code);
  if (codes.includes('LARGE_INPUT_PER_REQUEST')) return '⚠ 입력폭주';
  if (codes.includes('BUCKET_5M_DOMINANT')) return '⚠ 5m TTL';
  if (codes.includes('LOW_HIT_RATE')) return '⚠ 캐시미스';
  if (codes.includes('FREQUENT_CACHE_REBUILD')) return '⚠ 재작성';
  if (codes.includes('HIGH_OUTPUT_RATIO')) return '⚠ 출력과다';
  if (codes.includes('HIGH_REQUEST_COUNT')) return '⚠ 호출폭주';
  return null;
}
