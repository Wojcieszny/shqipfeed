# ShqipFeed roadmap

| ID | Title | Status | Acceptance Criteria |
| --- | --- | --- | --- |
| `SETUP-01` | Onboard repo, `AGENTS.md`, `ROADMAP.md`, and `tests.html` | `done` | `AGENTS.md`, `docs/ROADMAP.md`, `.gitignore`, updated `README.md` exist; `tests.html` checks cards, unique ids, `sw.js` files, card/lesson audio files, and shows human audio coverage; no app behavior change. |
| `VERIFY-01` | "Mark verified" toggle saved per card on device | `done` | Already implemented in `app.js` / `data.js`. Toggle persists on the device; `cards.json` is never rewritten. |
| `HUMAN-AUDIO-01` | Harvest & normalize real human Albanian audio pool (`audio/human/` + `human_corpus_index.json`) | `done` | Every clip is a real human recording with speaker/origin, source and license recorded; normalized; indexed in `human_corpus_index.json`. |
| `ALIGN-CARDS-01` | Match or rewrite `cards.json` and day.js to 100% human audio + fix phonetics & Lego blocks | `done` | Every card and day line has a human recording; phonetics follow natural spoken Albanian; Lego blocks match the sentence. No card marked verified. |
| `UX-AUDIO-01` | Pure human playback in `app.js`, Family/Wife on-device voice recorder (`AUDIO-01`), Home Island Picker, and bug fixes | `done` | No `speechSynthesis` fallback; on-device recorder for family voices; island picker on home; listed bugs fixed. |
| `AUDIO-01` | On-device Family Voice recorder and Compare audio loopback | `done` | Users can record family voice override per card stored in base64; 1-tap Compare button loops 2.8s microphone recording against native human audio. |
| `ADAPTIVE-LOOP-01` | 40-Min Subway Engine: Adaptive Interleaved Micro-Checks, Hands-Free Kid Mode Player & 12-Island Curriculum Map | `done` | Interleaved micro-checks every 2-3 cards; Leitner box promotion/demotion; 80% Box 2+ Island unlock gate; hands-free conversation player with Kid Mode repetitions. |
| `CORPUS-SCENES-01` | Mine human audio pool: 10 Real-Life Family Scenes in `day.js` & 50 everyday conversation cards in `cards.json` | `done` | 10 real-life family scenes in `day.js` (100 turns total); 50 everyday cards added to `cards.json` with 100% human audio; phonetics, Lego blocks & lesson dialogs; `sw.js` cached < 1,500 files. |
