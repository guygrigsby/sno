/**
 * Tool executors for the Messages API tool-use loop.
 *
 * When build-phase agents return `tool_use` blocks, the adapter calls
 * these functions to execute the requested tool locally and return
 * a structured result.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execFile } from 'node:child_process';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/** Result shape returned by all tool executors. */
export interface ToolResult {
  output: string;
  error?: string;
  isError: boolean;
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

/** Sensitive env vars stripped from Bash subprocess environments. */
const SENSITIVE_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_OAUTH_TOKEN',
  'API_KEY',
  'SECRET_KEY',
  'AWS_SECRET_ACCESS_KEY',
  'GITHUB_TOKEN',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a sanitised copy of the current environment. */
function sanitisedEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  for (const key of SENSITIVE_ENV_VARS) {
    delete env[key];
  }
  return env;
}

/** Wrap an unknown thrown value into an Error. */
function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(String(err));
}

/** Return the `code` property when it exists (e.g. `ENOENT`). */
function errCode(err: unknown): string | undefined {
  if (err instanceof Error && 'code' in err) {
    return (err as NodeJS.ErrnoException).code;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// executeRead
// ---------------------------------------------------------------------------

/**
 * Read a file and optionally slice by line offset/limit.
 *
 * @param input.file_path - Absolute path to the file.
 * @param input.offset    - 0-based line number to start from.
 * @param input.limit     - Maximum number of lines to return.
 */
export async function executeRead(input: {
  file_path: string;
  offset?: number;
  limit?: number;
}): Promise<ToolResult> {
  try {
    const raw = await fs.readFile(input.file_path, 'utf-8');
    let lines = raw.split('\n');

    if (input.offset !== undefined && input.offset > 0) {
      lines = lines.slice(input.offset);
    }
    if (input.limit !== undefined && input.limit > 0) {
      lines = lines.slice(0, input.limit);
    }

    return { output: lines.join('\n'), isError: false };
  } catch (err: unknown) {
    const e = toError(err);
    return { output: '', error: e.message, isError: true };
  }
}

// ---------------------------------------------------------------------------
// executeWrite
// ---------------------------------------------------------------------------

/**
 * Write content to a file, creating parent directories as needed.
 *
 * @param input.file_path - Absolute path to the file.
 * @param input.content   - String content to write.
 */
export async function executeWrite(input: {
  file_path: string;
  content: string;
}): Promise<ToolResult> {
  try {
    await fs.mkdir(path.dirname(input.file_path), { recursive: true });
    await fs.writeFile(input.file_path, input.content, 'utf-8');
    return { output: `File written: ${input.file_path}`, isError: false };
  } catch (err: unknown) {
    const e = toError(err);
    return { output: '', error: e.message, isError: true };
  }
}

// ---------------------------------------------------------------------------
// executeEdit
// ---------------------------------------------------------------------------

/**
 * Replace a unique substring in a file.
 *
 * @param input.file_path  - Absolute path to the file.
 * @param input.old_string - The exact text to find (must appear exactly once).
 * @param input.new_string - The replacement text.
 */
export async function executeEdit(input: {
  file_path: string;
  old_string: string;
  new_string: string;
}): Promise<ToolResult> {
  try {
    const raw = await fs.readFile(input.file_path, 'utf-8');

    // Count occurrences.
    let count = 0;
    let searchFrom = 0;
    while (true) {
      const idx = raw.indexOf(input.old_string, searchFrom);
      if (idx === -1) break;
      count++;
      searchFrom = idx + input.old_string.length;
    }

    if (count === 0) {
      return { output: '', error: 'old_string not found in file', isError: true };
    }
    if (count > 1) {
      return {
        output: '',
        error: `old_string is not unique in file (found ${count} occurrences)`,
        isError: true,
      };
    }

    const updated = raw.replace(input.old_string, input.new_string);
    await fs.writeFile(input.file_path, updated, 'utf-8');
    return { output: `Edit applied to ${input.file_path}`, isError: false };
  } catch (err: unknown) {
    const e = toError(err);
    return { output: '', error: e.message, isError: true };
  }
}

// ---------------------------------------------------------------------------
// executeGrep
// ---------------------------------------------------------------------------

/**
 * Search file contents by regex pattern.
 *
 * Tries `rg` (ripgrep) first for speed, then falls back to a pure-Node
 * recursive search when `rg` is not installed.
 *
 * @param input.pattern - Regex pattern to search for.
 * @param input.path    - Directory or file to search in (defaults to cwd).
 * @param input.glob    - Glob filter for filenames (e.g. `*.ts`).
 */
export async function executeGrep(input: {
  pattern: string;
  path?: string;
  glob?: string;
}): Promise<ToolResult> {
  const searchPath = input.path ?? process.cwd();

  try {
    return await grepWithRipgrep(input.pattern, searchPath, input.glob);
  } catch (err: unknown) {
    // If rg is not available, fall back to Node.
    if (errCode(err) === 'ENOENT') {
      return grepFallback(input.pattern, searchPath, input.glob);
    }
    const e = toError(err);
    return { output: '', error: e.message, isError: true };
  }
}

/** Run ripgrep as a child process. */
function grepWithRipgrep(
  pattern: string,
  searchPath: string,
  glob?: string,
): Promise<ToolResult> {
  return new Promise((resolve, reject) => {
    const args = ['--no-heading', '--line-number'];
    if (glob) {
      args.push('--glob', glob);
    }
    args.push(pattern, searchPath);

    const child = execFile('rg', args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      // rg exits 1 when there are no matches — that is not an error.
      if (err && errCode(err) === 'ENOENT') {
        reject(err);
        return;
      }
      if (err && (err as NodeJS.ErrnoException).code !== undefined) {
        // Some other spawn error.
        reject(err);
        return;
      }
      // Exit code > 1 means a real error in rg.
      if (child.exitCode !== null && child.exitCode > 1) {
        resolve({ output: '', error: stderr || stdout, isError: true });
        return;
      }
      resolve({ output: stdout, isError: false });
    });
  });
}

/** Pure-Node recursive grep fallback. */
async function grepFallback(
  pattern: string,
  searchPath: string,
  glob?: string,
): Promise<ToolResult> {
  try {
    const regex = new RegExp(pattern);
    const results: string[] = [];

    const stat = await fs.stat(searchPath);
    if (stat.isFile()) {
      await grepFile(searchPath, regex, results);
    } else {
      await grepDir(searchPath, regex, results, glob);
    }

    return { output: results.join('\n'), isError: false };
  } catch (err: unknown) {
    const e = toError(err);
    return { output: '', error: e.message, isError: true };
  }
}

/** Grep a single file, appending matches to `results`. */
async function grepFile(filePath: string, regex: RegExp, results: string[]): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push(`${filePath}:${i + 1}:${lines[i]}`);
      }
    }
  } catch {
    // Skip files that can't be read (binary, permission, etc.).
  }
}

/** Recursively grep a directory. */
async function grepDir(
  dirPath: string,
  regex: RegExp,
  results: string[],
  glob?: string,
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const globRegex = glob ? globToRegex(glob) : null;

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden dirs and node_modules.
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      await grepDir(fullPath, regex, results, glob);
    } else if (entry.isFile()) {
      if (globRegex && !globRegex.test(entry.name)) continue;
      await grepFile(fullPath, regex, results);
    }
  }
}

/** Convert a simple glob pattern (e.g. `*.ts`) to a RegExp matching filenames. */
function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

// ---------------------------------------------------------------------------
// executeGlob
// ---------------------------------------------------------------------------

/**
 * Find files matching a glob pattern.
 *
 * @param input.pattern - Glob pattern (e.g. `** /*.ts`).
 * @param input.path    - Base directory (defaults to cwd).
 */
export async function executeGlob(input: {
  pattern: string;
  path?: string;
}): Promise<ToolResult> {
  const basePath = input.path ?? process.cwd();

  try {
    const matches = await collectGlob(basePath, input.pattern);
    return { output: matches.join('\n'), isError: false };
  } catch (err: unknown) {
    const e = toError(err);
    return { output: '', error: e.message, isError: true };
  }
}

/** Recursively collect files matching a simple glob pattern. */
async function collectGlob(basePath: string, pattern: string): Promise<string[]> {
  // Try Node 22+ fs.glob if available.
  if (typeof (fs as Record<string, unknown>).glob === 'function') {
    const results: string[] = [];
    // Node 22+ fs.glob returns an async iterable.
    const globFn = (fs as unknown as { glob(pat: string, opts: { cwd: string }): AsyncIterable<string> }).glob;
    for await (const entry of globFn(pattern, { cwd: basePath })) {
      results.push(path.join(basePath, entry));
    }
    return results;
  }

  // Fallback: recursive readdir with simple pattern matching.
  const globRegex = globToRegex(path.basename(pattern));
  const results: string[] = [];
  await walkForGlob(basePath, globRegex, results);
  return results;
}

/** Walk a directory tree collecting files whose names match `regex`. */
async function walkForGlob(
  dirPath: string,
  regex: RegExp,
  results: string[],
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return; // Skip directories we can't read.
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      await walkForGlob(fullPath, regex, results);
    } else if (entry.isFile()) {
      if (regex.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// executeBash
// ---------------------------------------------------------------------------

/**
 * Execute a bash command in a sandboxed subprocess.
 *
 * The working directory is pinned to `projectRoot` and sensitive
 * environment variables are stripped before spawning.
 *
 * @param input.command   - Shell command string.
 * @param input.timeout   - Timeout in ms (default 30 000).
 * @param projectRoot     - Working directory / sandbox root.
 */
export async function executeBash(
  input: { command: string; timeout?: number },
  projectRoot: string,
): Promise<ToolResult> {
  const timeoutMs = input.timeout ?? 30_000;

  return new Promise((resolve) => {
    const child = execFile(
      'bash',
      ['-c', input.command],
      {
        cwd: projectRoot,
        env: sanitisedEnv(),
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        const combined = (stdout ?? '') + (stderr ?? '');

        if (err && 'killed' in err && (err as Record<string, unknown>).killed) {
          resolve({ output: '', error: 'Command timed out', isError: true });
          return;
        }

        if (err) {
          // Non-zero exit code.
          resolve({ output: combined || err.message, isError: true });
          return;
        }

        resolve({ output: combined, isError: false });
      },
    );

    // Safety net — if the child never fires the callback, resolve on close.
    child.on('error', (err) => {
      resolve({ output: '', error: err.message, isError: true });
    });
  });
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Route a tool-use block to the correct executor.
 *
 * @param toolName    - The tool name from the `tool_use` content block.
 * @param input       - The structured input object.
 * @param projectRoot - The user's project root (used as sandbox cwd for Bash).
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  projectRoot: string,
): Promise<ToolResult> {
  switch (toolName) {
    case 'Read':
      return executeRead(input as Parameters<typeof executeRead>[0]);
    case 'Write':
      return executeWrite(input as Parameters<typeof executeWrite>[0]);
    case 'Edit':
      return executeEdit(input as Parameters<typeof executeEdit>[0]);
    case 'Grep':
      return executeGrep(input as Parameters<typeof executeGrep>[0]);
    case 'Glob':
      return executeGlob(input as Parameters<typeof executeGlob>[0]);
    case 'Bash':
      return executeBash(input as Parameters<typeof executeBash>[0], projectRoot);
    default:
      return { output: '', error: `Unknown tool: ${toolName}`, isError: true };
  }
}
