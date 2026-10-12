// npm run render -- --recipe r.json [--in in.mp3] --out out.wav [--mp3 out.mp3] [--source-dir DIR]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { renderOffline } from '../src/dsp/rack';
import { encodeWav, toPcm16 } from '../src/dsp/wav';
import { validate, type Recipe } from '../src/recipe';
import { audioUrl } from '../src/sources';
import { decode, encodeMp3 } from './decode';

export const DEFAULT_SOURCE_DIRS: Record<string, string> = {
  live: join(homedir(), 'hum', 'live'),
  orig: join(homedir(), 'audio-level', 'orig'),
};

export function args(argv: string[]) {
  const a: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'; }
  return a;
}

export function loadRecipe(path: string): Recipe {
  let obj: unknown;
  try { obj = JSON.parse(readFileSync(path, 'utf8')); } catch (e) {
    console.error(`recipe: cannot read/parse ${path}: ${(e as Error).message}`); process.exit(2);
  }
  const v = validate(obj);
  if (!v.ok) { console.error(`recipe invalid:\n  ${v.errors.join('\n  ')}`); process.exit(2); }
  return obj as Recipe;
}

/** Input file for a recipe: explicit, else the source folder, else (b43) a download into /tmp. */
export async function resolveInput(r: Recipe, explicit?: string, sourceDir?: string): Promise<string> {
  if (explicit) return explicit;
  const name = `${r.book}_${r.chapter}.mp3`;
  const dir = sourceDir ?? DEFAULT_SOURCE_DIRS[r.source];
  if (dir && existsSync(join(dir, name))) return join(dir, name);
  const tmp = join('/tmp/narrator-studio', r.source, name);
  if (!existsSync(tmp)) {
    const res = await fetch(audioUrl(r.source, r.book, r.chapter));
    if (!res.ok) throw new Error(`download ${audioUrl(r.source, r.book, r.chapter)}: HTTP ${res.status}`);
    mkdirSync(dirname(tmp), { recursive: true });
    writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  }
  return tmp;
}

const peak = (x: Float32Array) => { let m = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > m) m = a; } return m; };
const db = (v: number) => Number((v > 1e-10 ? 20 * Math.log10(v) : -200).toFixed(2));
export const pcmHash = (x: Float32Array) => createHash('sha256').update(new Uint8Array(toPcm16(x).buffer)).digest('hex');

export async function renderFile(r: Recipe, inPath: string, outPath: string, mp3Path?: string) {
  const src = await decode(inPath, r.sr);
  const out = renderOffline(src, r.chain, r.sr, 128);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, Buffer.from(encodeWav(out, r.sr, 'pcm16')));
  if (mp3Path) await encodeMp3(outPath, mp3Path);
  return { in: inPath, out: outPath, ...(mp3Path ? { mp3: mp3Path } : {}), len: out.length, peakIn: db(peak(src)), peakOut: db(peak(out)), latencyCompensated: true, sha256_pcm16: pcmHash(out), sha256_src_pcm16: pcmHash(src) };
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.recipe || !a.out) { console.error('usage: npm run render -- --recipe r.json [--in in.mp3] --out out.wav [--mp3 out.mp3] [--source-dir DIR]'); process.exit(2); }
  const r = loadRecipe(a.recipe);
  const inPath = await resolveInput(r, a.in, a['source-dir']);
  console.log(JSON.stringify(await renderFile(r, inPath, a.out, a.mp3)));
}

if (process.argv[1] && /render\.ts$/.test(process.argv[1])) main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
