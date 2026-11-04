# ShqipFeed roadmap

| ID | Title | Status | Acceptance Criteria |
| --- | --- | --- | --- |
| `SETUP-01` | Onboard repo, `AGENTS.md`, `ROADMAP.md`, and `tests.html` | `done` | `AGENTS.md`, `docs/ROADMAP.md`, `.gitignore`, updated `README.md` exist; `tests.html` checks cards, unique ids, `sw.js` files, card/lesson audio files, and shows human audio coverage; no app behavior change. |
| `VERIFY-01` | "Mark verified" toggle saved per card on device | `done` | Already implemented in `app.js` / `data.js`. Toggle persists on the device; `cards.json` is never rewritten. |
| `HUMAN-AUDIO-01` | Harvest & normalize real human Albanian audio pool (`audio/human/` + `human_corpus_index.json`) | `done` | Every clip is a real human recording with speaker/origin, source and license recorded; normalized; indexed in `human_corpus_index.json`. |
| `ALIGN-CARDS-01` | Match or rewrite `cards.json` and `day.js` to 100% human audio + fix phonetics & Lego blocks | `proposed` | Every card and day line has a human recording; phonetics follow natural spoken Albanian; Lego blocks match the sentence. No card marked verified. |
| `UX-AUDIO-01` | Pure human playback in `app.js`, Family/Wife on-device voice recorder (`AUDIO-01`), Home Island Picker, and bug fixes | `proposed` | No `speechSynthesis` fallback; on-device recorder for family voices; island picker on home; listed bugs fixed. |
