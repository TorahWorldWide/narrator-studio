import structure from './data/torahStructure.json';

export type SourceId = 'orig' | 'live' | 'b43';
export const HOST = 'https://audio.torah-worldwide.com';
export const SOURCES: Record<SourceId, { he: string; prefix: string; books: 'all' | string[] }> = {
  orig: { he: 'מקור', prefix: 'narration-orig', books: 'all' },
  live: { he: 'באתר היום', prefix: 'narration', books: 'all' },
  b43: { he: 'ב׳', prefix: 'narration-b43', books: ['Genesis'] },
};
export const SOURCE_IDS: SourceId[] = ['orig', 'live', 'b43'];
export const audioUrl = (s: SourceId, book: string, ch: number) =>
  `${HOST}/${SOURCES[s].prefix}/${encodeURIComponent(book)}_${ch}.mp3`;
export const hasSource = (s: SourceId, book: string) =>
  SOURCES[s].books === 'all' || SOURCES[s].books.includes(book);

export interface Book { english: string; hebrew: string; chapters: number; section: string }
export const BOOKS: Book[] = structure.sections.flatMap((sec) =>
  sec.books.map((b) => ({ english: b.english, hebrew: b.hebrew, chapters: b.chapters, section: sec.name })),
);
export const SECTIONS: string[] = structure.sections.map((s) => s.name);
export const bookByEnglish = (english: string) => BOOKS.find((b) => b.english === english);
