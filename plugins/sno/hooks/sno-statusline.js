#!/usr/bin/env node
// sno statusline — blue & white themed
// Shows: model | sno phase | current task | agent | directory | context usage

const fs = require('fs');
const path = require('path');

// Blue/white palette (ANSI)
const blue = '\x1b[34m';
const brightBlue = '\x1b[94m';
const white = '\x1b[97m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';
const cyan = '\x1b[36m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const blink = '\x1b[5m';

// Snowflake markers for sno phases
const PHASES = {
  learn:  '❄ learn',
  plan:   '❄ plan',
  build:  '❄ build',
  check:  '❄ check',
  ship:   '❄ ship',
  done:   '✓ done',
};

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const parts = [];

    // --- Model ---
    const model = data.model?.display_name || 'Claude';
    parts.push(`${dim}${model}${reset}`);

    // --- Sno phase ---
    const dir = data.workspace?.current_dir || data.cwd || process.cwd();
    const snoState = readSnoState(dir);
    if (snoState) {
      const phaseLabel = PHASES[snoState.phase] || snoState.phase;
      parts.push(`${brightBlue}${bold}${phaseLabel}${reset}`);

      // Task progress for build phase
      if (snoState.phase === 'build' && snoState.taskProgress) {
        const { done, total } = snoState.taskProgress;
        parts.push(`${dim}${done}/${total}${reset}`);
      }
    }

    // --- Current task (from todos) ---
    const session = data.session_id || '';
    const task = readCurrentTask(session);
    if (task) {
      parts.push(`${white}${bold}${task}${reset}`);
    }

    // --- Agent ---
    const agent = data.agent?.name;
    if (agent) {
      parts.push(`${cyan}⚙ ${agent}${reset}`);
    }

    // --- Worktree ---
    const worktree = data.worktree?.name;
    if (worktree) {
      parts.push(`${dim}wt:${worktree}${reset}`);
    }

    // --- Directory ---
    const dirname = path.basename(dir);
    parts.push(`${dim}${dirname}${reset}`);

    // --- Context window ---
    const remaining = data.context_window?.remaining_percentage;
    if (remaining != null) {
      const AUTO_COMPACT_BUFFER_PCT = 16.5;
      const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
      const used = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));

      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

      let ctx;
      if (used < 50) {
        ctx = `${brightBlue}${bar} ${used}%${reset}`;
      } else if (used < 65) {
        ctx = `${blue}${bar} ${used}%${reset}`;
      } else if (used < 80) {
        ctx = `${yellow}${bar} ${used}%${reset}`;
      } else {
        ctx = `${blink}${red}${bar} ${used}%${reset}`;
      }
      parts.push(ctx);
    }

    // --- Cost ---
    const cost = data.cost?.total_cost_usd;
    if (cost != null && cost > 0) {
      parts.push(`${dim}$${cost.toFixed(2)}${reset}`);
    }

    const sep = ` ${dim}│${reset} `;
    process.stdout.write(parts.join(sep));
  } catch (e) {
    // Silent fail
  }
});

/**
 * Read .sno/state.json from the working directory (or parent dirs).
 * Returns { phase, taskProgress? } or null.
 */
function readSnoState(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const statePath = path.join(dir, '.sno', 'state.json');
    try {
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        const result = { phase: state.phase || state.current_phase };
        if (!result.phase) return null;

        // Count task progress from plan.md
        if (result.phase === 'build') {
          const planPath = path.join(dir, '.sno', 'plan.md');
          if (fs.existsSync(planPath)) {
            const plan = fs.readFileSync(planPath, 'utf8');
            const done = (plan.match(/\[x\]/gi) || []).length;
            const pending = (plan.match(/\[ \]/g) || []).length;
            if (done + pending > 0) {
              result.taskProgress = { done, total: done + pending };
            }
          }
        }
        return result;
      }
    } catch (e) {
      return null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Read current in-progress task from Claude Code's todo system.
 */
function readCurrentTask(session) {
  if (!session) return null;
  const os = require('os');
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const todosDir = path.join(claudeDir, 'todos');
  if (!fs.existsSync(todosDir)) return null;
  try {
    const files = fs.readdirSync(todosDir)
      .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length > 0) {
      const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
      const inProgress = todos.find(t => t.status === 'in_progress');
      if (inProgress) return inProgress.activeForm || '';
    }
  } catch (e) {}
  return null;
}
