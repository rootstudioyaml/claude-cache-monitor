import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join, isAbsolute } from 'node:path';
import { homedir } from 'node:os';

const CLAUDE_DIR = join(homedir(), '.claude', 'projects');

/**
 * Parse a single session JSONL file.
 * Deduplicates by requestId (last-write-wins for streaming chunks).
 */
export async function parseSessionFile(filePath) {
  const requests = new Map();
  let sessionId = null;
  let firstTimestamp = null;
  let lastTimestamp = null;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const ts = entry.timestamp;
    if (ts) {
      if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts;
      if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts;
    }

    if (!sessionId && entry.sessionId) {
      sessionId = entry.sessionId;
    }

    const msg = entry.message;
    if (!msg?.usage || !msg.id) continue;

    const usage = msg.usage;
    const cc = usage.cache_creation || {};
    const reqId = entry.requestId || msg.id;

    requests.set(reqId, {
      requestId: reqId,
      model: msg.model || 'unknown',
      inputTokens: usage.input_tokens || 0,
      cacheCreationTokens: usage.cache_creation_input_tokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      ephemeral5mTokens: cc.ephemeral_5m_input_tokens || 0,
      ephemeral1hTokens: cc.ephemeral_1h_input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
    });
  }

  const reqs = [...requests.values()];
  const totals = reqs.reduce(
    (acc, r) => {
      acc.input += r.inputTokens;
      acc.cacheCreation += r.cacheCreationTokens;
      acc.cacheRead += r.cacheReadTokens;
      acc.ephemeral5m += r.ephemeral5mTokens;
      acc.ephemeral1h += r.ephemeral1hTokens;
      acc.output += r.outputTokens;
      return acc;
    },
    { input: 0, cacheCreation: 0, cacheRead: 0, ephemeral5m: 0, ephemeral1h: 0, output: 0 },
  );

  return {
    sessionId,
    filePath,
    startTime: firstTimestamp ? new Date(firstTimestamp) : null,
    endTime: lastTimestamp ? new Date(lastTimestamp) : null,
    requestCount: reqs.length,
    requests: reqs,
    totals,
    model: reqs[0]?.model || 'unknown',
  };
}

/**
 * Find the most recent user-message timestamp in a session JSONL.
 * Used for statusline mode so the agent's own tool calls don't reset the TTL
 * countdown — only the user's actual prompts (type === "user") do.
 *
 * @param {string} filePath absolute path to the session JSONL
 * @returns {Promise<Date|null>}
 */
export async function getLastUserMessageTime(filePath) {
  let lastUserTs = null;
  try {
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'user' && entry.timestamp) {
          lastUserTs = entry.timestamp;
        }
      } catch {
        // ignore malformed lines
      }
    }
  } catch {
    return null;
  }
  return lastUserTs ? new Date(lastUserTs) : null;
}

/**
 * Discover all session JSONL files under ~/.claude/projects/
 */
export async function discoverSessionFiles(options = {}) {
  const { projectFilter, days = 30, excludeSessionPath } = options;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const files = [];
  // Resolve the excluded session to an absolute path so equality checks are exact.
  // Use path.isAbsolute() so Windows paths like C:\... are recognized too.
  const excludeAbs = excludeSessionPath
    ? (isAbsolute(excludeSessionPath) ? excludeSessionPath : join(process.cwd(), excludeSessionPath))
    : null;

  let projectDirs;
  try {
    projectDirs = await readdir(CLAUDE_DIR);
  } catch {
    return files;
  }

  for (const projDir of projectDirs) {
    if (projectFilter && !projDir.includes(projectFilter)) continue;

    const projPath = join(CLAUDE_DIR, projDir);
    let entries;
    try {
      entries = await readdir(projPath);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.endsWith('.jsonl')) continue;
      const fp = join(projPath, entry);
      if (excludeAbs && fp === excludeAbs) continue;
      try {
        const s = await stat(fp);
        if (s.mtimeMs >= cutoff) {
          files.push({ path: fp, projectDir: projDir, mtime: s.mtimeMs });
        }
      } catch {
        continue;
      }
    }
  }

  return files.sort((a, b) => a.mtime - b.mtime);
}

/**
 * Parse all sessions with concurrency control
 */
export async function parseAllSessions(options = {}) {
  const files = await discoverSessionFiles(options);
  const concurrency = 10;
  const results = [];

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const parsed = await Promise.all(
      batch.map(async (f) => {
        try {
          const session = await parseSessionFile(f.path);
          session.projectDir = f.projectDir;
          return session;
        } catch {
          return null;
        }
      }),
    );
    results.push(...parsed.filter(Boolean));
  }

  return results.filter((s) => s.requestCount > 0);
}
