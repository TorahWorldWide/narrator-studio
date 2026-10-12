import { spawn } from 'node:child_process';

/** Any audio file → mono Float32Array at 48 kHz (ffmpeg). */
export function decode(path: string, sr = 48000): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', String(sr), '-']);
    const chunks: Buffer[] = []; let err = '';
    p.stdout.on('data', (c: Buffer) => chunks.push(c));
    p.stderr.on('data', (c: Buffer) => { err += c.toString(); });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg decode failed (${code}): ${err.trim()}`));
      const buf = Buffer.concat(chunks);
      const out = new Float32Array(buf.length / 4);
      new Uint8Array(out.buffer).set(buf.subarray(0, out.length * 4));
      resolve(out);
    });
  });
}

/** WAV → MP3 in the site's format (64 kbps, 48 kHz, mono). */
export function encodeMp3(wavPath: string, mp3Path: string): Promise<void> {
  return run('ffmpeg', ['-v', 'error', '-y', '-i', wavPath, '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', '48000', '-ac', '1', mp3Path]);
}

export function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args); let err = '';
    p.stderr.on('data', (c: Buffer) => { err += c.toString(); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} failed (${code}): ${err.trim()}`))));
  });
}
