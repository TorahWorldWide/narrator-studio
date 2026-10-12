# PROGRESS — narrator-studio (resume log)

Plan: ~/.hermes/plans/2026-10-12-narrator-studio.md (Fable 5.1). Executor: Opus 5.5.

## 0.1 scaffold — done 12.10.2026
- Vite app scaffolded; create-vite now ships Vite 8/React 19/TS 6, so deps were pinned to the plan's
  stack: vite 5.4, react 18.3, @vitejs/plugin-react 4.7, vitest 2.1, typescript 5.9, tsx, soundtouchjs 0.3.0.
- vite.config.ts = plan's exact config + `/// <reference types="vitest/config" />` (needed so `tsc -b`
  accepts the `test` key) + nojekyll plugin. Template oxlint kept (script `lint`), template assets removed.
- Next: 0.2 GitHub repo + Pages.
