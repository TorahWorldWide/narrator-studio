# סטודיו קריין · Narrator Studio

**קישור:** https://torahworldwide.github.io/narrator-studio/

## עברית

סטודיו קטן לטלפון לעריכת הקלטות הקריין של התנ״ך. בוחרים הקלטה, מנגנים אותה דרך שרשרת אפקטים עם כפתורים
(כמו FL Studio), ושולחים להרמס **מתכון**. הרמס מריץ את המתכון הזה בדיוק על פרק אחד או על כל 929 הפרקים.

### איך משתמשים (בטלפון)
- **בוחרים הקלטה:** `מקור` (ההקלטה הגולמית) · `באתר היום` (מה שהאתר מנגן עכשיו) · `ב׳` (ניסיון #43, בראשית בלבד), ואז ספר ופרק (`‹ ›` לפרק הבא/הקודם).
- **מנגנים:** ▶ למטה. הקשה על צורת הגל קופצת לנקודה. גרירה על צורת הגל יוצרת **לופ**; את הקצוות מזיזים בידיות, ו-`× לופ` מבטל.
- **מוסיפים אפקטים:** `+ הוסף אפקט`. כפתור (knob): גוררים למעלה/למטה, הקשה כפולה מחזירה לברירת מחדל, הקשה על המספר מאפשרת להקליד ערך. ⏻ מכבה אפקט, ↑ ↓ משנים סדר, ↺ מאפס, ✕ מוחק.
- **משווים:** כפתור `עם אפקטים / בלי אפקטים` למטה (זהוב = אתה שומע בלי אפקטים). `📈 אנלייזר` מציג את התדרים: כחול = אחרי, אפור = לפני.
- **הפחתת רעש:** מסמנים לופ על קטע שקט בלבד ולוחצים `למד רעש מהלופ`, או משאירים `אוטומטי` (15% הרגעים השקטים בפרק).
- **ייצוא:** `⤓ ייצוא` ← `העתק מתכון` ושולחים להרמס בטלגרם. `הורד WAV` מוריד את הפרק המעובד לאוזן (ואיתו קובץ המתכון).
- פריסטים: `שמור כפריסט` שומר את השרשרת בטלפון. `טען` מחזיר אותה.

### מה זה מתכון
קובץ JSON קטן שמכיל רק את ההגדרות: איזה מקור, איזה פרק, אילו אפקטים, באיזה סדר ועם אילו ערכים. אין בו אודיו.
פרופיל הרעש מחושב מחדש מההקלטה עצמה בכל הרצה, כך שאותו מתכון עובד על כל פרק.

### ההבטחה
אותו קוד בדיוק רץ בטלפון (בזמן אמת), בהורדת ה-WAV ובכלי של הרמס. נבדק: בהינתן אותו אודיו מפוענח, התוצאה זהה
**ביט-לביט**. ההבדל היחיד הוא פענוח ה-MP3: הדפדפן ו-ffmpeg מפענחים שונה ברמה של עד ‎−115 dBFS (לא נשמע).
האורך והסנכרון לא זזים. אפקטים שמוסיפים השהיה (לימיטר, הפחתת רעש) מפוצים אוטומטית. **גובה (pitch)** ניסיוני:
הסנכרון עלול לזוז, ולכן הוא לא מיועד לאתר החי.

---

## English

A phone-first web app for editing the Tanakh narration recordings: pick a source × book × chapter, play it through
an FL-Studio-like rack with knobs in real time, loop a region, A/B-bypass, and export a **recipe JSON** that Hermes
applies bit-identically to any chapter with a Node CLI.

### Architecture
One DSP core in TypeScript (`src/dsp/`), three hosts:
1. `src/audio/rackProcessor.ts`, an AudioWorklet (real-time listening).
2. `src/audio/renderWorker.ts`, a Web Worker (in-browser render → WAV download).
3. `tools/render.ts`, a Node CLI (what Hermes runs).

All three call the same `Rack` in 128-sample blocks. `renderOffline` compensates module latency, so output
length and sample alignment equal the input's. Modules: gain, hp, lp, eq (4 bands), gate, comp, limiter (5 ms
lookahead), nr (spectral subtraction, port of `~/hum/scripts/specgate.py print`), hum (RBJ notches), deess (LR4
split + comp), sat, pitch (soundtouchjs, experimental), reverb (Freeverb, experimental), delay.

### The recipe (v1)
```jsonc
{ "v": 1, "app": "narrator-studio", "created": "…Z", "source": "live|orig|b43", "book": "Genesis", "chapter": 1,
  "sr": 48000, "note": "", "chain": [ { "id": "hp", "on": true, "p": { "freq": 95, "order": 4 } }, … ] }
```
Unknown `id` → the CLI refuses (exit 2). Missing params → module defaults. `nr.print` is `"auto"` (quietest 15% of
frames) or `[t0, t1]` seconds, and is re-derived from the source at render time.

### How Hermes applies a recipe (Tomer pastes the JSON → save as `r.json`)
```bash
cd ~/narrator-studio
# 1. one chapter (input resolved from the recipe: live → ~/hum/live, orig → ~/audio-level/orig, b43 → R2 download)
npm run render -- --recipe r.json --out /tmp/out.wav [--mp3 /tmp/out.mp3] [--in some.mp3]
# 2. check it (length, lag in the 2–6 kHz band, peaks, LUFS; exit 1 on failure)
npm run qa -- --ref <input.mp3> --out /tmp/out.wav --recipe r.json
# 3. the whole corpus (or --only Genesis): render + qa per file, report.jsonl + SUMMARY.md
npm run batch -- --recipe r.json --source-dir ~/hum/live --out ~/studio-out/<name>/ --mp3
```
A corpus run (≈ 929 × 7 s at 2 jobs ≈ 1 h on the VM) belongs on Tomer's PC when it is reachable (heavy-job rule);
otherwise the VM. Nothing goes to the live site (`narration/` on R2) without Tomer's ear and his word.

### Parity: the promise and its limits
- **DSP is bit-identical** between the browser worker and Node: `~/pw-test/narrator_studio_parity.mjs` feeds
  both the same ffmpeg-decoded audio and compares SHA-256 of the PCM16 output (identical).
- **MP3 decoding differs by decoder**: Chrome vs ffmpeg 4.4 on `Genesis_1.mp3` differ by at most 1.8e-6
  (−115 dBFS, RMS −143 dB), with the same length. So "what he heard" and "what Hermes renders" differ only below
  audibility.
- **QA lag**: minimum-phase filters (hp, eq, de-esser crossover) move the cross-correlation peak by a few samples
  of phase, not time (hp 95 Hz/4: −7 samples broadband, 0 in 2–6 kHz). QA therefore measures lag in the 2–6 kHz
  band and passes at |lag| ≤ 48 samples (1 ms). Every real latency bug is ≥ 240 samples.
- **nr** smoothing is causal over 3 frames (latency exactly 2048). specgate's centred smoothing would need one
  more hop.
- **pitch** latency is measured per setting (≈ 23.5k–25.2k samples) by envelope cross-correlation, so the lag
  check is skipped for chains with pitch. Not for the live site.

### Where the sources live
`https://audio.torah-worldwide.com/` (R2 bucket `torah-audio`, CORS `*`):
`narration/<Book>_<ch>.mp3` (live, 929), `narration-orig/` (raw originals, 929, uploaded by
`tools/upload_orig.py`), `narration-b43/` (direction ב׳, Genesis 1–50). Local copies: `~/hum/live`,
`~/audio-level/orig`.

### Development
```bash
npm i
npm test                 # vitest: DSP, rack, recipe, wav
npm run build            # → docs/ (GitHub Pages serves main:/docs)
npm run preview          # http://127.0.0.1:4173/narrator-studio/
node ~/pw-test/narrator_studio_smoke.mjs [url]   # e2e smoke (390 px phone)
node ~/pw-test/narrator_studio_parity.mjs        # browser == Node
```
Deploy = build, commit, push (never force-push; history is the rollback). `PROGRESS.md` is the resume log.
