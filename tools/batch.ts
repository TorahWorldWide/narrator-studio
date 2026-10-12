// npm run batch -- --recipe r.json --source-dir ~/hum/live --out ~/studio-out/<name>/ [--only Genesis] [--mp3] [--keep-wav] [--jobs 2]
// Applies one recipe to every <Book>_<ch>.mp3 in a folder: render + qa per file (child processes, 2 at a time),
// writes report.jsonl and SUMMARY.md in --out. With --mp3 the shipped file is the MP3 (site format) and QA runs on it;
// the intermediate WAV is deleted unless --keep-wav (929 WAVs would need ~30 GB).
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BOOKS } from '../src/sources';
import { args, loadRecipe } from './render';

const TSX = resolve('node_modules/.bin/tsx');

function runJson(script: string, argv: string[]): Promise<{ code: number; json: any; err: string }> {
  return new Promise((res) => {
    const p = spawn(TSX, [script, ...argv]);
    let out = '', err = '';
    p.stdout.on('data', (c: Buffer) => { out += c.toString(); });
    p.stderr.on('data', (c: Buffer) => { err += c.toString(); });
    p.on('close', (code) => {
      let json: any = null;
      try { json = JSON.parse(out.trim().split('\n').pop() || 'null'); } catch { /* keep null */ }
      res({ code: code ?? 1, json, err: err.trim() });
    });
  });
}

const median = (a: number[]) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const order = new Map(BOOKS.map((b, i) => [b.english, i]));

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.recipe || !a['source-dir'] || !a.out) {
    console.error('usage: npm run batch -- --recipe r.json --source-dir DIR --out OUTDIR [--only Book] [--mp3] [--keep-wav] [--jobs 2]');
    process.exit(2);
  }
  const recipe = loadRecipe(a.recipe);
  const hasPitch = recipe.chain.some((c) => c.id === 'pitch' && c.on);
  const src = a['source-dir'], out = a.out, mp3 = a.mp3 === 'true', keepWav = a['keep-wav'] === 'true';
  const jobs = Math.max(1, Number(a.jobs) || 2);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'recipe.json'), JSON.stringify(recipe, null, 2));
  const files = readdirSync(src)
    .map((f) => /^(.+)_(\d+)\.mp3$/.exec(f))
    .filter((m): m is RegExpExecArray => !!m && order.has(m[1]) && (!a.only || m[1] === a.only))
    .sort((x, y) => (order.get(x[1])! - order.get(y[1])!) || (Number(x[2]) - Number(y[2])))
    .map((m) => m[0]);
  const report = join(out, 'report.jsonl');
  if (existsSync(report)) rmSync(report);
  console.log(`${files.length} files, ${jobs} at a time → ${out}`);
  const rows: any[] = [];
  const t0 = Date.now();
  let next = 0, done = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++];
      const base = f.replace(/\.mp3$/, '');
      const inPath = join(src, f), wav = join(out, `${base}.wav`), mp3Path = mp3 ? join(out, `${base}.mp3`) : undefined;
      const r = await runJson('tools/render.ts', ['--recipe', a.recipe, '--in', inPath, '--out', wav, ...(mp3Path ? ['--mp3', mp3Path] : [])]);
      let row: any = { file: f, ok: false };
      if (r.code !== 0 || !r.json) row.error = `render: ${r.err || `exit ${r.code}`}`;
      else {
        const shipped = mp3Path ?? wav;
        const q = await runJson('tools/qa.ts', ['--ref', inPath, '--out', shipped, '--recipe', a.recipe]);
        row = { file: f, shipped, ...q.json, render: { peakIn: r.json.peakIn, peakOut: r.json.peakOut, sha256_pcm16: r.json.sha256_pcm16 } };
        if (!q.json) row.error = `qa: ${q.err}`;
        row.ok = !!q.json?.ok;
        if (mp3Path && !keepWav) rmSync(wav, { force: true });
      }
      rows.push(row);
      appendFileSync(report, JSON.stringify(row) + '\n');
      done++;
      if (done % 10 === 0 || done === files.length) console.log(`${done}/${files.length}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  const bad = rows.filter((r) => !r.ok);
  const secs = (Date.now() - t0) / 1000;
  const md = [
    `# Batch — ${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}`,
    '',
    `- recipe: \`recipe.json\` (source ${recipe.source}; chain: ${recipe.chain.map((c) => `${c.id}${c.on ? '' : '(off)'}`).join(' → ') || 'empty'})`,
    `- input: \`${src}\`${a.only ? ` (only ${a.only})` : ''} · output: ${mp3 ? 'MP3 64k 48k mono' : 'WAV PCM16 48k mono'}`,
    `- files: ${rows.length} · ok: ${rows.length - bad.length} · failed: ${bad.length} · time: ${secs.toFixed(0)} s (${(secs / Math.max(1, rows.length)).toFixed(1)} s/file, ${jobs} jobs)`,
    `- length mismatches: ${rows.filter((r) => r.len_ref !== undefined && r.len_ref !== r.len_out).length} · lag > tolerance: ${hasPitch ? 'n/a (pitch in chain)' : rows.filter((r) => r.lag_samples !== undefined && Math.abs(r.lag_samples) > 48).length}`,
    `- max |lag| (2–6 kHz): ${Math.max(0, ...rows.map((r) => Math.abs(r.lag_samples ?? 0)))} samples · peak out max: ${Math.max(-200, ...rows.map((r) => r.peak_out ?? -200))} dBFS`,
    `- LUFS median: ${median(rows.map((r) => r.lufs_ref))} → ${median(rows.map((r) => r.lufs_out))}`,
    '',
    bad.length ? '## Failures\n\n' + bad.map((r) => `- ${r.file}: ${r.error ?? `len ${r.len_ref}→${r.len_out}, lag ${r.lag_samples}`}`).join('\n') : '## Failures\n\nnone',
    '',
  ].join('\n');
  writeFileSync(join(out, 'SUMMARY.md'), md);
  console.log(md);
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
