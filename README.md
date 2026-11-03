# Last One Out（值日生）

In Taiwan, the student on duty is the last one out: they stay after class to clean the room and lock the door.

Last One Out is a quiet horror walk through the school you remember, a school that never existed. Every time you come back, it has changed.

Built for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026), Indie Developer track.

## How it plays

1. Write your name and three things you remember about your school. The name stays in your browser.
2. Muse Spark turns the memories into visual details, and Muse Image takes three night-time photographs of that school: the corridor, a classroom door, the classroom.
3. You walk photo by photo. SAM 3.1 finds the doors in each photo, and those doors are what you click to walk on. It also finds the chalkboard, where your name slowly comes into focus.
4. Each time you come back around, you draw one of three face-down cards. Muse Spark deals them, pacing how far things drift. Muse Image edits all three photos to match the card, and Muse Spark looks at each edited photo to check the change really shows; if not, the edit is redone once.
5. After three cards comes one last walk at floor height. Then the classroom turns to afternoon light, and the night ends on a contact book page (聯絡簿) with what you remembered, what it became, and a teacher's note. You can save it with or without your name.

## Meta models

| Model | Where it is used |
|---|---|
| `muse-spark-1.3` | Memories into visual details; dealing and pacing the cards; checking each edited photo shows its change; the teacher's note |
| `muse-image-1.0` | Taking the first photographs and editing them after every card |
| `sam-3.1` | Finding doors (what you can walk through) and the chalkboard (where your name is written) |

## How it is built

```
browser (public/)                        server.mjs (Node, no packages)              Meta Model API
  title → walk → cards → ending   ──►   /api/school  memories → details → photos ──► muse-spark, muse-image, sam-3.1
  photo transitions, door spots          /api/deal    cards ready before you arrive ──► muse-spark
  name on the board (never sent)         /api/draw    edit → check → redo once     ──► muse-image, muse-spark, sam-3.1
  synthesised sound (audio.js)           /api/final   the floor-height walk
  contact book canvas (ending.js)        /api/ending  daylight photo + teacher's note
```

- The house style (an early-2000s flash snapshot of a clean, ordinary school at night with one red slipper) is fixed in `server.mjs`, so every photo looks like it came from the same camera.
- Sound is synthesised in the browser: footsteps on terrazzo, the 60 Hz fluorescent hum of Taiwan's mains, the school bell. No recordings.
- Without an API key the server runs in mock mode: labelled drawings stand in for photos, so the whole walk can be played offline.

## Status (2026-11-03)

- The whole walk runs end to end in mock mode, tested in Chrome.
- The calls to Muse Spark, Muse Image and SAM 3.1 are written against the public docs but have not yet run against the live API. Two formats are not documented and need checking with a key: whether SAM accepts an inline image (the code falls back to an uploaded file) and the exact image-edit response.
- Not built yet: speaking your memories (Muse Voice Transcribe), a parallax effect between photos.

This repository started on 2026-11-03 (Taipei time) as a different idea, mini-games generated from mutation cards, and changed direction the same day. Everything here was written during the hackathon; the commit history shows what was added and when.

## Run it

Needs Node.js 22.9 or newer. No packages to install.

```bash
cp .env.example .env   # then put your Meta Model API key in .env
npm run dev            # http://127.0.0.1:4310
```

## Safety

- The API key stays on the server. The browser never receives it.
- The player's name is written onto the board by the page itself and never sent to the server or a model.
- Model output is only ever shown as text or images; no model-written code runs.
- Every request to the model API refuses redirects, and a local spending cap stops calls once the estimated spend reaches `SPEND_CAP_USD`.
