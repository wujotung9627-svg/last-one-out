# Last One Out（值日生）

In Taiwan, the student on duty is the last one out: they stay after class to clean the room and lock the door.

Last One Out is a quiet horror walk through the school you remember, a school that never existed. Three sentences become a photo-real place you can step into, and every time you come back, it has changed. No 3D modelling, no hand-made art: every photograph is made and remade by Meta's models while you play. Chinese or English.

Built for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026), Indie Developer track.

## How it plays (about 6–10 minutes)

1. Write your name and three things you remember about your school. The name never leaves your browser.
2. Muse Spark turns the memories into visual details, and Muse Image takes three night-time photographs of that school: the corridor, a classroom door, the classroom. The student on duty's red bucket and a half-mopped wet floor are in every one.
3. You walk in 3D, photo by photo, through the doors SAM 3.1 found in each picture.
4. In the classroom, three half-erased lines of chalk are on the board SAM found. Erase two, keep one. Only the line you keep is ever revealed, and it changes the school: a light goes out, the corridor has no end, every desk is pushed away from yours.
5. The school drifts from small wrongness to bending space to what hurt (a teacher who never said your name, the classmates who left you out, the exam rankings), shown only through objects, shadows and space.
6. After three loops you walk once more at floor height. The moment your name on the board is clear, the bell rings and the night ends on a page of a Taiwanese contact book (聯絡簿): your diary, the change you saw, and a note from a teacher who finally noticed you.

## Meta models

| Model | Where it is used |
|---|---|
| `muse-spark-1.3` | Memories into visual details (and translations); dealing and pacing the chalk lines, with a separate edit for each photo; looking at every edited photo to check the change really shows; rewriting an edit the image model refused; the teacher's note in two languages |
| `muse-image-1.0` | The first photographs; editing the same photos loop after loop so the place stays recognisable while it drifts; redrawing each photo as a depth map for the 3D walk |
| `sam-3.1` | Finding the doors you walk through and the chalkboard where the choice and your name are written |

## How it is built

```
browser (public/)                          server.mjs (Node, no packages)              Meta Model API
  title (中文 / English) → walk → board ──► /api/school  memories → details → photos ──► muse-spark, muse-image, sam-3.1
  3D walk from depth maps (walk3d.js)      /api/deal    lines ready before you arrive ──► muse-spark
  chalk choice, name on the board          /api/draw    per-photo edit → check → redo ──► muse-image, muse-spark, sam-3.1
  synthesised sound (audio.js)             /api/final   the floor-height walk
  contact book canvas (ending.js)          /api/ending  daylight photo + teacher's note
```

- One fixed house style (an early-2000s flash snapshot of a clean, ordinary Taiwanese school at night, Taiwanese desks and chairs) lives in `server.mjs`, so every photo looks like the same camera took it.
- The 3D walk is plain WebGL2: each photo becomes a surface shaped by its depth map and the camera moves in. Later walks add a dolly zoom, breathing walls and a lens split. A depth map from Muse Image is used only if it really looks like one; otherwise the scene is treated as a box seen from inside.
- The image model refuses pictures of children, so classmates appear only through what they left (uniforms on chairs, bags on desks, shadows with nobody casting them). A refused edit is rewritten by Muse Spark without people and retried; if it is still refused, that photo stays as it was and the walk goes on.
- Every sound is synthesised in the browser: footsteps on terrazzo with a corridor slap-back, the 60 Hz hum of Taiwan's mains, the school bell, chalk, sliding and creaking doors, drips, a ball, distant children, a chair, papers, the school speaker.
- `scripts/build-demo.mjs` turns a finished, recorded walk into `docs/`, a static replay that needs no server and makes no model calls, in either language.

## Run it

Needs Node.js 22.9 or newer. No packages to install.

```bash
cp .env.example .env   # then put your Meta Model API key in .env
npm run dev            # http://127.0.0.1:4310
```

Without a key it runs in mock mode with labelled drawings, so the whole walk can be played offline.

## Built during the event

This repository started on 2026-11-03 (Taipei time) as a different idea, mini-games generated from mutation cards, and changed direction the same day. Everything here was written during the hackathon; the commit history shows what was added and when.

## Safety

- The API key stays on the server. The browser never receives it.
- The player's name is written onto the board and the contact book by the page itself and never sent to the server or a model.
- Model output is only shown as text and images; no model-written code runs.
- Every request to the model API refuses redirects, and a local spending cap stops calls once the estimated spend reaches `SPEND_CAP_USD`.
