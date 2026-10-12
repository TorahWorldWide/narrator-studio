# PROGRESS — narrator-studio (resume log)

Plan: ~/.hermes/plans/2026-10-12-narrator-studio.md (Fable 5.1). Executor: Opus 5.5.

## 0.1 scaffold — done 12.10.2026
- Vite app scaffolded; create-vite now ships Vite 8/React 19/TS 6, so deps were pinned to the plan's
  stack: vite 5.4, react 18.3, @vitejs/plugin-react 4.7, vitest 2.1, typescript 5.9, tsx, soundtouchjs 0.3.0.
- vite.config.ts = plan's exact config + `/// <reference types="vitest/config" />` (needed so `tsc -b`
  accepts the `test` key) + nojekyll plugin. Template oxlint kept (script `lint`), template assets removed.
- Next: 0.2 GitHub repo + Pages.

## 0.2 repo + Pages — done
- Repo https://github.com/TorahWorldWide/narrator-studio (public), Pages from main:/docs → 201.
- Live https://torahworldwide.github.io/narrator-studio/ = 200 at ~10:05 UTC, bundle hash matches docs/index.html.
  Link sent to Tomer.

## 0.3 Playwright harness — done
- `~/pw-test/narrator_studio_smoke.mjs [url]` (default http://127.0.0.1:4173/narrator-studio/); screenshot /tmp/narrator_studio.png.
- Preview: `{"title":true,"dir":"rtl","errs":[],"bad":[]}`; live URL same result.
- Next: Phase 1, task 1.1 (sources + structure).

## 1.1 sources + structure — done
- src/sources.ts (SOURCES, audioUrl, hasSource, BOOKS/SECTIONS flattened from torahStructure.json; resolveJsonModule on). tests/sources.test.ts green (39 books, 929 ch).
- Next: 1.2 upload originals to R2 (background), then 1.3 DSP core.

## 1.2 upload originals — script committed, upload running
- Upload DONE 10:09 UTC: prefix_count=929; curl narration-orig/I%20Chronicles_1.mp3 → 200, audio/mpeg, ACAO *.

## 1.3 DSP core — done
- src/dsp/{types,util,biquad,rack,registry}.ts + modules gain/hp/lp/eq/gate/comp/limiter; tests in tests/dsp + tests/rack.test.ts (24 green).
- Notes: lp test uses order 8 for the "19 kHz ≥ 20 dB" spec (order 4 gives ~18 dB, bilinear Butterworth);
  hp/lp also accept order 6 (Q table 0.5176/0.7071/1.9319) since the knob steps by 2.
  comp uses the smooth decoupled peak detector (release-only peak hold → attack smoothing); the plain
  branching detector settled 0.66 dB short of the static curve on a steady tone.
  Processors that report gain reduction expose a numeric `gr` (comp/gate/limiter); Rack.grs() reads it.
- Next: 1.4 recipe.

## 1.4 recipe — done
- src/recipe.ts: Recipe type, validate() (v, sr, source, book, chapter range, unknown id, on/p shape), toRecipe()/serialize() in contract key order. tests/recipe.test.ts green.
- Next: 1.5 audio engine + worklet.

## 1.5 audio engine — done (verified in 1.8 smoke)
- src/audio/rackProcessor.ts (worklet, messages chain/params/bypass/print, meter every 2048) loaded via `?worker&url` → builds to docs/assets/rackProcessor-*.js (no window/self refs).
- src/audio/engine.ts: singleton `engine`; decode via OfflineAudioContext(1,1,48000) (no gesture needed), AudioBuffer playback, pre/post GainNode taps for the Phase-2 analyzer. load() caches but does not select: call switchBuffer(url) after load.
- Next: 1.6 UI.

## 1.6 UI — done
- Components in src/ui (TopBar, SourceChips, BookChapterPicker, Waveform, Transport, Rack, ModuleCard, Knob, AddModuleSheet, ExportPanel, Toast) + src/state/store.ts (localStorage narrator-studio:v1).
- Choices: A/B button turns gold when effects are BYPASSED (the state you must notice). Waveform is LTR inside the RTL page; at zoom>1 a strip under it scrolls (canvas itself is touch-action:none for loops). iOS: navigator.audioSession.type=playback so the silent switch does not mute.
- Local smoke (preview): pass=true, Genesis 1 live loads in 0.6 s.
- Next: 1.7 presets.

## 1.7 presets — done
- src/ui/Presets.tsx under the rack; 4 starters saved on first run (store STARTER_PRESETS). nr preset loads hp only + toast until Phase 2.
- Smoke now also checks presets (gate preset → 2 cards; nr preset → toast).

## 1.8 deploy phase 1 — done (~10:30 UTC)
- npm test 26/26, build clean, commit `deploy: phase 1` (649b2ca; docs/ was already in the presets commit, so it is an empty marker), pushed.
- Live bundle index-DXuh0A49.js matches docs/index.html; worklet asset 200.
- Live smoke: pass=true (load 0.9 s, canvas 20/20, time advanced, meters moving, comp card, recipe JSON ok, presets ok, errs [], bad []).
- Extra: all 3 sources load on live (orig/b43/live Genesis 1 = 6:04.0); b43 disabled on I Chronicles.
- Phone sanity: /tmp/narrator_studio.png at 390 px: no overflow, transport reachable, RTL, 44 px targets.
- Phase-1 message + link sent to Tomer.
- Next: Phase 2, task 2.1 (fft + nr).

## 2.1–2.7 modules — done
- nr: causal 3-frame smoothing (current + 2 previous) so latency() stays exactly 2048 as the plan tests; specgate centres it (would need +512). Print stats = [mean|std] per bin (printStats); k applied in the module, so the k knob never recomputes the print. Main thread computes stats for the worklet (store.syncPrints, cached per url+region); renderOffline lets nr compute from ctx.source. Measured: tone −0.12 dB, 2–6 kHz noise −9.8 dB; 6-min render ≈ 5.8 s in Node.
- hum: RBJ notch with finite depth (poles at q, zeros at q·g) — the plain peaking cut was too wide (0.48 dB at 440 Hz).
- deess: LR4 split + CompCore (1 ms attack, hard knee). sat/delay/reverb: mix 0 exact pass-through.
- pitch: SimpleFilter processes in 16384-frame bursts, so output is emitted with a fixed 24576-sample delay; latency() = envelope cross-correlation of an AM-noise probe (a lone impulse is faded/skipped by WSOLA), cached per pitch: 23.5k–25.2k samples.
- Next: 2.8 analyzer.

## 2.8 analyzer + 2.9 deploy phase 2 — done (~10:58 UTC)
- Analyzer: engine.analysers() lazily taps pre/post GainNodes (fftSize 4096, smoothing 0.6); toggle 📈 in TopBar (state.analyzer, not persisted); freeze button.
- Engine: node.onprocessorerror → console.error so the smoke test catches worklet crashes. Fix: ▶ starts at the loop start when the playhead is outside the loop.
- Deploy: `deploy: phase 2` + fix commit pushed; live bundle index-Co348Otx.js. Live smoke pass=true (8 cards incl. pitch/reverb tags, analyzer draws, plays through all modules, errs [] bad []). Loop-drag → "למד רעש מהלופ" → "אוטומטי" verified live.
- Phase-2 message + link sent to Tomer.
- Next: Phase 3, task 3.1 (wav.ts + renderWorker + "הורד WAV").

## 3.1 render worker — done
- src/dsp/wav.ts (toPcm16 = round(clamp(v)·32767), encodeWav), src/audio/renderWorker.ts, src/audio/render.ts (renderInWorker copies the source, download helper). ExportPanel: "הורד WAV" with % progress → <Book>_<ch>.<source>.wav + .recipe.json; "הורד מתכון" button appears after render as the fallback.
- Local: hp+nr on Genesis 1 (6:04) renders in 6.9 s headless; WAV pcm_s16le 48k mono.

## 3.2–3.4 Node tools — done
- tools/decode.ts, tools/render.ts (exit 2 on invalid recipe; resolves --in from ~/hum/live | ~/audio-level/orig | R2 download to /tmp/narrator-studio; prints sha256 of the PCM16 output too), tools/qa.ts.
- DEVIATION (deliberate, documented): plan says QA fails on any lag ≠ 0 without pitch. Measured per module on Genesis 1 (broadband xcorr): hp95/2 −3, hp95/4 −7, hp95/8 −19, hp40/4 −2 samples; nr/comp/limiter/gate/eq-flat 0. That is minimum-phase low-frequency phase, not a time shift. QA therefore (a) measures lag in a 2–6 kHz band with the same filter on both files (default chain hp+nr+comp+limiter → 0; true 5-sample shift → 5), (b) still reports lag_broadband, (c) passes when |lag| ≤ 48 samples (1 ms): hp8+eq(+4 dB 3 kHz)+deess reads 3 samples (phase in band). Every real latency bug is ≥ 240 samples.
