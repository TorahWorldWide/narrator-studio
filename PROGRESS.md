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
- tools/upload_orig.py (resumable, 8 threads) started ~10:04 UTC in background, log /tmp/upload_orig.log. Verify count==929 + curl ACAO before 1.6.

## 1.3 DSP core — done
- src/dsp/{types,util,biquad,rack,registry}.ts + modules gain/hp/lp/eq/gate/comp/limiter; tests in tests/dsp + tests/rack.test.ts (24 green).
- Notes: lp test uses order 8 for the "19 kHz ≥ 20 dB" spec (order 4 gives ~18 dB, bilinear Butterworth);
  hp/lp also accept order 6 (Q table 0.5176/0.7071/1.9319) since the knob steps by 2.
  comp uses the smooth decoupled peak detector (release-only peak hold → attack smoothing); the plain
  branching detector settled 0.66 dB short of the static curve on a steady tone.
  Processors that report gain reduction expose a numeric `gr` (comp/gate/limiter); Rack.grs() reads it.
- Next: 1.4 recipe.
