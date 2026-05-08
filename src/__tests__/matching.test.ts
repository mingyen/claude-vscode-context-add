import { describe, it, expect } from 'vitest';
import {
  matchesClaudeTerminalName,
  toRelativePath,
  formatLineRef,
  sanitizePathForTerminal,
} from '../matching';

describe('matchesClaudeTerminalName', () => {
  it('matches exact "Claude Code"', () => {
    expect(matchesClaudeTerminalName('Claude Code')).toBe(true);
  });

  it('matches names containing "claude" case-insensitively', () => {
    expect(matchesClaudeTerminalName('My Claude Session')).toBe(true);
    expect(matchesClaudeTerminalName('CLAUDE')).toBe(true);
    expect(matchesClaudeTerminalName('claude')).toBe(true);
  });

  it('matches semver version patterns', () => {
    expect(matchesClaudeTerminalName('2.1.63')).toBe(true);
    expect(matchesClaudeTerminalName('0.0.1')).toBe(true);
    expect(matchesClaudeTerminalName('10.20.30')).toBe(true);
  });

  it('rejects non-matching names', () => {
    expect(matchesClaudeTerminalName('bash')).toBe(false);
    expect(matchesClaudeTerminalName('zsh')).toBe(false);
    expect(matchesClaudeTerminalName('node')).toBe(false);
    expect(matchesClaudeTerminalName('Python')).toBe(false);
  });

  it('rejects version-like strings that are not exact semver', () => {
    expect(matchesClaudeTerminalName('v2.1.63')).toBe(false);
    expect(matchesClaudeTerminalName('2.1')).toBe(false);
    expect(matchesClaudeTerminalName('2.1.63.4')).toBe(false);
  });

  it('matches custom patterns', () => {
    expect(matchesClaudeTerminalName('my-ai-tool', ['my-ai'])).toBe(true);
    expect(matchesClaudeTerminalName('special-term', ['^special'])).toBe(true);
  });

  it('custom patterns are case-insensitive', () => {
    expect(matchesClaudeTerminalName('MyTool', ['mytool'])).toBe(true);
  });

  it('skips invalid regex in custom patterns', () => {
    expect(matchesClaudeTerminalName('bash', ['[invalid'])).toBe(false);
  });
});

describe('toRelativePath', () => {
  it('returns path relative to first matching workspace folder', () => {
    const result = toRelativePath(
      '/projects/myapp/src/index.ts',
      ['/projects/myapp'],
    );
    expect(result).toBe('src/index.ts');
  });

  it('tries multiple workspace folders and uses first match', () => {
    const result = toRelativePath(
      '/projects/backend/src/app.ts',
      ['/projects/frontend', '/projects/backend'],
    );
    expect(result).toBe('src/app.ts');
  });

  it('returns absolute path when file is outside all workspace folders', () => {
    const result = toRelativePath(
      '/tmp/scratch.ts',
      ['/projects/myapp'],
    );
    expect(result).toBe('/tmp/scratch.ts');
  });

  it('returns absolute path when no workspace folders', () => {
    const result = toRelativePath('/tmp/scratch.ts', []);
    expect(result).toBe('/tmp/scratch.ts');
  });

  it('handles file at workspace root', () => {
    const result = toRelativePath(
      '/projects/myapp/package.json',
      ['/projects/myapp'],
    );
    expect(result).toBe('package.json');
  });

  it('returns absolute path when file is in a different workspace folder', () => {
    // Simulates: terminal CWD is repo-a, file is in repo-b
    const result = toRelativePath(
      '/projects/repo-b/src/utils.ts',
      ['/projects/repo-a'],
    );
    expect(result).toBe('/projects/repo-b/src/utils.ts');
  });
});

describe('formatLineRef', () => {
  it('formats single line reference', () => {
    expect(formatLineRef('src/index.ts', 5, 5)).toBe('@src/index.ts:5');
  });

  it('formats multi-line reference', () => {
    expect(formatLineRef('src/index.ts', 5, 10)).toBe('@src/index.ts:5-10');
  });

  it('handles line 1', () => {
    expect(formatLineRef('file.ts', 1, 1)).toBe('@file.ts:1');
  });
});

describe('sanitizePathForTerminal', () => {
  it('passes normal paths through unchanged', () => {
    expect(sanitizePathForTerminal('src/index.ts')).toBe('src/index.ts');
    expect(sanitizePathForTerminal('/abs/path/to/file.ts')).toBe('/abs/path/to/file.ts');
  });

  it('strips embedded LF', () => {
    expect(sanitizePathForTerminal('evil\n; rm -rf ~\n.txt'))
      .toBe('evil; rm -rf ~.txt');
  });

  it('strips embedded CR', () => {
    expect(sanitizePathForTerminal('foo\rbar.ts')).toBe('foobar.ts');
  });

  it('strips other C0 control characters', () => {
    expect(sanitizePathForTerminal('a\x00b\x07c.ts')).toBe('abc.ts');
  });

  it('preserves tab characters', () => {
    expect(sanitizePathForTerminal('a\tb.ts')).toBe('a\tb.ts');
  });
});
