# ShqipFeed

Everyday Albanian for speaking with family. No account. The phrases are still drafts until a person from Albania checks them.

The chat preview is not the phone app. The phone app is:

https://wojcieszny.github.io/shqipfeed/

## Open it on a phone, with no signal

1. On the phone, open that address in the browser. Use Safari on an iPhone.
2. Leave it open until the page says it is saved. The clips are part of the save.
3. Add it to the home screen.
   - iPhone: Share, then **Add to Home Screen**.
   - Android: the Chrome menu, then **Install app** or **Add to Home screen**.
4. Open the icon. After that first visit it works with no signal.

Again, Got it, and the backup stay on that phone. **Save a copy** if you want the progress file. A second phone does not see it until you import the copy there.

## Open it in Antigravity later

This folder is the whole app. There is no build step.

1. In Antigravity, choose **Clone Repository**.
2. Paste `https://github.com/Wojcieszny/shqipfeed`.
3. Open that folder.

Edits pushed to `main` show up on the phone address after a minute. Open the site once while online so the phone picks up the new files.

## What the screens do

**Start** picks the next lines. Due lines come first, then a few new ones. **Got it** moves a line up a box. **Again** puts it back in box 1. After the new lines, one check asks what you say back.

**A day with Anila and Ilir** is a long listen. It does not move the boxes.

**Rules of Albanian** is the letter table, the sounds, and the grammar cards.

Settings holds the five boxes, Beginner or the full course, topics, reset, and the backup file.

## Files

| File | Job |
| --- | --- |
| `index.html` | The page. |
| `styles.css` | The look. |
| `app.js` | The screens and the playback. |
| `data.js` | Cards, progress, and the backup. |
| `cards.json` | The phrase bank. Every line is still `"verified": false`. |
| `day.js` | The Anila and Ilir conversation. |
| `rules.js` | The grammar and letter reference. |
| `audio/` | The clips. |
| `sw.js` | The offline save. It lists every file in this folder. |
| `manifest.json` | The home-screen name and icon. |

Progress is saved on the phone. It does not rewrite `cards.json`.
