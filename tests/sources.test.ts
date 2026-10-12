import { describe, it, expect } from 'vitest';
import { audioUrl, hasSource, BOOKS } from '../src/sources';

describe('sources', () => {
  it('builds encoded URLs that keep spaces', () => {
    expect(audioUrl('live', 'I Chronicles', 1)).toBe('https://audio.torah-worldwide.com/narration/I%20Chronicles_1.mp3');
    expect(audioUrl('orig', 'Genesis', 50)).toBe('https://audio.torah-worldwide.com/narration-orig/Genesis_50.mp3');
  });
  it('limits b43 to Genesis', () => {
    expect(hasSource('b43', 'Exodus')).toBe(false);
    expect(hasSource('b43', 'Genesis')).toBe(true);
    expect(hasSource('live', 'Exodus')).toBe(true);
  });
  it('flattens 39 books / 929 chapters', () => {
    expect(BOOKS.length).toBe(39);
    expect(BOOKS.reduce((a, b) => a + b.chapters, 0)).toBe(929);
    expect(BOOKS[0].section).toBe('תורה');
  });
});
