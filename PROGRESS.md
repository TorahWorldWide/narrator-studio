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
