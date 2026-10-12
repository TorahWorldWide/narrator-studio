/// <reference types="vite/client" />

declare module 'soundtouchjs' {
  export class SoundTouch {
    tempo: number; rate: number; pitch: number; pitchSemitones: number;
    stretch: { setParameters(sampleRate: number, sequenceMs: number, seekWindowMs: number, overlapMs: number): void };
  }
  export interface SourceLike { extract(target: Float32Array, numFrames: number, position: number): number }
  export class SimpleFilter {
    constructor(source: SourceLike, pipe: SoundTouch, callback?: () => void);
    extract(target: Float32Array, numFrames: number): number;
  }
}
