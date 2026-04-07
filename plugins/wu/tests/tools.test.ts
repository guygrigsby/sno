/**
 * Unit tests for tool executors — Read, Write, Edit, Grep, Glob, Bash, and the executeTool router.
 * Uses real filesystem operations with temporary directories for isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  executeRead,
  executeWrite,
  executeEdit,
  executeGrep,
  executeGlob,
  executeBash,
  executeTool,
} from '../lib/tools.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'wu-tools-test-'));
});

afterEach(async () => {
  fsSync.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// executeRead
// ---------------------------------------------------------------------------

describe('executeRead', () => {
  it('reads a file successfully', async () => {
    const filePath = path.join(tmpDir, 'hello.txt');
    await fs.writeFile(filePath, 'line1\nline2\nline3\n', 'utf-8');

    const result = await executeRead({ file_path: filePath });
    expect(result.isError).toBe(false);
    expect(result.output).toContain('line1');
    expect(result.output).toContain('line2');
    expect(result.output).toContain('line3');
  });

  it('returns error for nonexistent file', async () => {
    const result = await executeRead({ file_path: path.join(tmpDir, 'nope.txt') });
    expect(result.isError).toBe(true);
    expect(result.error).toBeDefined();
  });

  it('supports offset and limit', async () => {
    const filePath = path.join(tmpDir, 'lines.txt');
    await fs.writeFile(filePath, 'a\nb\nc\nd\ne\n', 'utf-8');

    const result = await executeRead({ file_path: filePath, offset: 1, limit: 2 });
    expect(result.isError).toBe(false);
    // offset=1 skips first line ('a'), limit=2 takes next two ('b', 'c')
    const lines = result.output.split('\n');
    expect(lines[0]).toBe('b');
    expect(lines[1]).toBe('c');
    expect(lines.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// executeWrite
// ---------------------------------------------------------------------------

describe('executeWrite', () => {
  it('creates file and parent dirs', async () => {
    const filePath = path.join(tmpDir, 'sub', 'deep', 'file.txt');
    const result = await executeWrite({ file_path: filePath, content: 'hello world' });

    expect(result.isError).toBe(false);
    expect(result.output).toContain('File written');
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('hello world');
  });

  it('overwrites existing file', async () => {
    const filePath = path.join(tmpDir, 'overwrite.txt');
    await fs.writeFile(filePath, 'old content', 'utf-8');

    const result = await executeWrite({ file_path: filePath, content: 'new content' });
    expect(result.isError).toBe(false);

    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('new content');
  });
});

// ---------------------------------------------------------------------------
// executeEdit
// ---------------------------------------------------------------------------

describe('executeEdit', () => {
  it('replaces unique string', async () => {
    const filePath = path.join(tmpDir, 'edit.txt');
    await fs.writeFile(filePath, 'foo bar baz\n', 'utf-8');

    const result = await executeEdit({
      file_path: filePath,
      old_string: 'bar',
      new_string: 'qux',
    });
    expect(result.isError).toBe(false);
    expect(result.output).toContain('Edit applied');

    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('foo qux baz\n');
  });

  it('errors on non-unique string', async () => {
    const filePath = path.join(tmpDir, 'dup.txt');
    await fs.writeFile(filePath, 'aaa bbb aaa\n', 'utf-8');

    const result = await executeEdit({
      file_path: filePath,
      old_string: 'aaa',
      new_string: 'ccc',
    });
    expect(result.isError).toBe(true);
    expect(result.error).toContain('not unique');
  });

  it('errors on not-found string', async () => {
    const filePath = path.join(tmpDir, 'miss.txt');
    await fs.writeFile(filePath, 'hello world\n', 'utf-8');

    const result = await executeEdit({
      file_path: filePath,
      old_string: 'xyz',
      new_string: 'abc',
    });
    expect(result.isError).toBe(true);
    expect(result.error).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// executeGrep
// ---------------------------------------------------------------------------

describe('executeGrep', () => {
  it('finds matching lines', async () => {
    const filePath = path.join(tmpDir, 'search.txt');
    await fs.writeFile(filePath, 'alpha\nbeta\ngamma\nalpha-beta\n', 'utf-8');

    const result = await executeGrep({ pattern: 'alpha', path: tmpDir });
    expect(result.isError).toBe(false);
    expect(result.output).toContain('alpha');
  });

  it('handles no matches gracefully', async () => {
    const filePath = path.join(tmpDir, 'empty-search.txt');
    await fs.writeFile(filePath, 'hello world\n', 'utf-8');

    const result = await executeGrep({ pattern: 'zzzznothere', path: tmpDir });
    // rg exits with code 1 for no matches which propagates as an error;
    // either way, the output should not contain the search pattern.
    expect(result.output).not.toContain('zzzznothere');
  });
});

// ---------------------------------------------------------------------------
// executeGlob
// ---------------------------------------------------------------------------

describe('executeGlob', () => {
  it('finds files by pattern', async () => {
    await fs.writeFile(path.join(tmpDir, 'one.ts'), 'a', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'two.ts'), 'b', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'three.js'), 'c', 'utf-8');

    const result = await executeGlob({ pattern: '*.ts', path: tmpDir });
    expect(result.isError).toBe(false);
    expect(result.output).toContain('one.ts');
    expect(result.output).toContain('two.ts');
    expect(result.output).not.toContain('three.js');
  });

  it('returns empty for no matches', async () => {
    const result = await executeGlob({ pattern: '*.xyz', path: tmpDir });
    expect(result.isError).toBe(false);
    expect(result.output.trim()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// executeBash
// ---------------------------------------------------------------------------

describe('executeBash', () => {
  it('runs simple command', async () => {
    const result = await executeBash({ command: 'echo hello' }, tmpDir);
    expect(result.isError).toBe(false);
    expect(result.output.trim()).toBe('hello');
  });

  it('uses projectRoot as cwd', async () => {
    const result = await executeBash({ command: 'pwd' }, tmpDir);
    expect(result.isError).toBe(false);
    // The resolved path might differ due to symlinks (e.g. /private/var vs /var on macOS)
    expect(result.output.trim()).toContain(path.basename(tmpDir));
  });

  it('strips sensitive env vars', async () => {
    const saved = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'super-secret-key-12345';
    try {
      const result = await executeBash(
        { command: 'echo "KEY=$ANTHROPIC_API_KEY"' },
        tmpDir,
      );
      expect(result.isError).toBe(false);
      // The key should not appear in output
      expect(result.output).not.toContain('super-secret-key-12345');
      expect(result.output.trim()).toBe('KEY=');
    } finally {
      if (saved !== undefined) {
        process.env['ANTHROPIC_API_KEY'] = saved;
      } else {
        delete process.env['ANTHROPIC_API_KEY'];
      }
    }
  });

  it('respects timeout', async () => {
    const result = await executeBash({ command: 'sleep 60', timeout: 500 }, tmpDir);
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// executeTool (router)
// ---------------------------------------------------------------------------

describe('executeTool', () => {
  it('dispatches to correct executor (Read)', async () => {
    const filePath = path.join(tmpDir, 'route-test.txt');
    await fs.writeFile(filePath, 'routed', 'utf-8');

    const result = await executeTool('Read', { file_path: filePath }, tmpDir);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('routed');
  });

  it('dispatches to correct executor (Write)', async () => {
    const filePath = path.join(tmpDir, 'route-write.txt');
    const result = await executeTool('Write', { file_path: filePath, content: 'written' }, tmpDir);
    expect(result.isError).toBe(false);

    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('written');
  });

  it('dispatches to correct executor (Bash)', async () => {
    const result = await executeTool('Bash', { command: 'echo routed-bash' }, tmpDir);
    expect(result.isError).toBe(false);
    expect(result.output.trim()).toBe('routed-bash');
  });

  it('returns error for unknown tool', async () => {
    const result = await executeTool('FakeTool', {}, tmpDir);
    expect(result.isError).toBe(true);
    expect(result.error).toContain('Unknown tool');
  });
});
