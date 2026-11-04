# AGENTS.md — ShqipFeed rules

- Plain HTML/CSS/JS only for the app. No frameworks, no build step, no npm packages, no backend, no API keys in client code. (One-off local Python scripts in `scripts/` are allowed only when a ticket explicitly asks for audio harvesting or verification.)
- Read only the files a ticket names.
- Tests first: add or update a check in `tests.html` before changing code.
- Smallest change that meets the ticket. No refactors unless asked.
- Never mark any card `"verified": true` in `cards.json`. Only the owner's native-speaker reviewer does that on device.
- ZERO COMPUTER TTS RULE: Never generate or add synthetic computer voices (`edge-tts`, `sq-AL-AnilaNeural`, `sq-AL-IlirNeural`, or browser `speechSynthesis`). All audio in the app must be real human recordings.
- Never invent unverified AI Albanian text or speaker names. However, when a ticket instructs you to align cards with human audio, you MAY update/replace a card's sentence or word example to match a real, published human-recorded Albanian phrase from Wikimedia Commons, Lingua Libre, Common Voice, 50LANGUAGES, or Loecsen (private personal study use). Every audio file must have its speaker/origin + source + license recorded in `human.js` / `sources.js`.
- Phonetics must reflect natural spoken Albanian (silent final `-ë` dropped, accurate stress in CAPS).
- Any change to app files or audio files must bump `CACHE_VERSION` in `sw.js` and list exact current files there.
- Never touch secrets or keys. Never deploy, never merge to `main`. You may commit, push a branch, and open a PR.
- Workflow (low-cost): don't ask mid-task; put assumptions in the PR body.
- If the owner pastes a fix list, fix only those items, push, and stop.
- PR body headings exactly: `What changed` / `Tests added` / `Assumptions` / `Risks`
