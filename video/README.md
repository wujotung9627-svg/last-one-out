# The demo video, made with Meta's models

The submission video is cut from one live game. Every photo in it was made by Meta's models during that game, and Muse Spark chose the trailer's shots and title cards after watching the recording.

| Step | Script | What it does |
|---|---|---|
| 1 | `record.mjs` | Plays one live English game in Chromium (the game server must be running with a key) and records the tab, picture and sound, with the page's own tab capture. Logs what is on screen, and when, to `events.json`. The roll call is answered with the game's Here button; the page never gets a real microphone. |
| 2 | `edit.mjs <run> pick` | Splits the recording into beats (one step forward to the next), makes contact sheets, and sends them with the timeline to **Muse Spark 1.3**, which picks the beats, trims them, and writes four title cards with an effect each. Cut points are then moved so none falls inside a line still being written, a speaker announcement or a scare. |
| 3 | `edit.mjs <run> build` | Renders the title cards (`titles.mjs`: liquid seeping, a crack, a chalk smear, a damp stain; frame by frame on a canvas, with synthesised sound), the "how it is made" cards from the run's own photos, depth maps and SAM 3.1 boxes (`cards.mjs`), and the end card, then joins everything with ffmpeg. |

Needs Node.js 22, ffmpeg, and Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`, or point `PLAYWRIGHT_FROM` at a `package.json` that already has it).

```bash
npm start                                   # the game, live, in another terminal
node video/record.mjs                       # -> video/out/run-<time>/
node video/edit.mjs video/out/run-<time> pick
node video/edit.mjs video/out/run-<time> build   # -> video/out/run-<time>/demo.mp4
```

A run costs about US$0.70 in model calls for the game and under US$0.10 for Muse Spark's edit. Recordings stay in `video/out/` (not committed).
