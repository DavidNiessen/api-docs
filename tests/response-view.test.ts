import { describe, expect, it } from 'vitest';
import {
  responseDisplay,
  responseLanguage,
} from '../apps/reader/src/response-view.js';

describe('response presentation', () => {
  it('uses response MIME types for syntax highlighting', () => {
    for (const mime of [
      'application/json',
      'Application/Problem+Json; charset=utf-8',
    ])
      expect(responseLanguage(mime)).toBe('json');
    expect(responseLanguage('application/soap+xml')).toBe('xml');
    expect(responseLanguage('text/html; charset=utf-8')).toBe('html');
    expect(responseLanguage('text/plain')).toBe('plaintext');
    expect(responseLanguage('')).toBe('plaintext');
  });
  it('formats JSON without rounding numbers or changing the original response', () => {
    const raw =
      '{"id":9007199254740993,"nested":{"value":1.234567890123456789,"huge":1e400}}';
    const display = responseDisplay(raw, 'json');
    expect(display).toContain('\n');
    expect(display).toContain('9007199254740993');
    expect(display).toContain('1.234567890123456789');
    expect(display).toContain('1e400');
    expect(raw).not.toContain('\n');
  });
  it('preserves text, empty responses and JSON that cannot be safely formatted', () => {
    for (const raw of [
      '',
      '{bad',
      '{"key":1,"key":2}',
      '  text\r\n🌍\n',
      ' '.repeat(1048577),
    ])
      expect(responseDisplay(raw, 'json')).toBe(raw);
    expect(responseDisplay('  plain text\n', 'plaintext')).toBe(
      '  plain text\n',
    );
  });
});
