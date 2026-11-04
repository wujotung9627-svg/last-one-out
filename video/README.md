# The demo video

The submission video is a recording of the judges' version (https://wujotung9627-svg.github.io/last-one-out/). Every photo in it was made by Meta's models in the night that version plays back. Muse Spark watched the recording and chose the trailer's shots and title cards.

| Step | Script | What it does |
|---|---|---|
| 1 | `record.mjs` | Plays the judges' version in English in Chromium, types the name "unknown", keeps the chalk lines that were kept that night, answers the roll call with the Here button, and records the tab, picture and sound, with the page's own tab capture. It logs what is on screen and when to `events.json`, and saves a picture of the contact book. The page never gets a real microphone. |
| 2 | `edit.mjs <run> pick` | Splits the recording into beats (one step forward to the next), makes contact sheets, and sends them with the timeline to **Muse Spark 1.3**. Muse Spark picks the beats, trims them, and writes four title cards. The script then moves any cut point that falls inside a line still being written, a speaker announcement or a scare, keeps the chalkboard choice, the teacher, the basketball and the roll call whole, removes repeated footage, and keeps the video under three minutes. |
| 3 | `edit.mjs <run> build` | Renders the title cards (`titles.mjs`: dripping red paint that flickers like a failing fluorescent tube, drawn frame by frame, with a synthesised hum), the "how it is made" cards from the night's own photos, depth maps and SAM 3.1 boxes (`cards.mjs`), and the end card, then joins everything with ffmpeg. |

Needs Node.js 22, ffmpeg, Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`, or point `PLAYWRIGHT_FROM` at a `package.json` that already has it), and a Meta Model API key in `.env` for Muse Spark's edit (under US$0.10).

```bash
node video/record.mjs                              # -> video/out/run-<time>/
node video/edit.mjs video/out/run-<time> pick
node video/edit.mjs video/out/run-<time> build     # -> video/out/run-<time>/demo.mp4
```

Recordings stay in `video/out/` (not committed).
