# Last One Out（值日生）

In Taiwan, the student on duty is the last one out: they stay after class to clean the room and lock the door.

Last One Out is a quiet horror walk through a Taiwanese school at night, a school that never existed. Meta's models photographed it from three memories and a year, then kept changing it: you walk into the photos in 3D, three times, and every time you come back the school has changed around the memory you chose to keep. No 3D modelling and no hand-made art: every photo, every change and every scare was made by Meta's models.

**Play it: https://wujotung9627-svg.github.io/last-one-out/** (Chinese or English, about five minutes, in a desktop browser). Wear headphones. At the end someone calls your name: answer out loud (allow the microphone), or press Here.

This is the judges' version: one night that Meta's models generated live, played back in your browser. There is nothing to install, no key and no cost. The year (2008) and the three memories are that night's; you only type your name.

Built for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026), Indie Developer track.

## How it plays

1. Type your name. It never leaves your browser: the page itself writes it on the board, the papers, the ranking and the contact book.
2. The school speaker sends everyone home. You are alone with a half-mopped floor.
3. **Walk 1: corridor, classroom door, classroom.** Doors that stand open lead on; closed ones are locked, and the whole picture jolts when you try one. The classroom door opens the way Muse Image drew it open: the page shows that photo only where the door changed, so the door is the only thing that moves. In the classroom, three half-wiped lines of chalk are on the board, each grown out of one of the memories. Erase two; the one left is kept, and it decides how the next walk has changed. (In the judges' version, the line that was kept that night will not come off the board.)
4. **Walk 2: corridor, a different door, the teachers' office.** The speaker calls the student on duty to the office. A school shirt hangs from a window grille that was empty. When the door opens, it opens onto the corridor where you started, and your teacher is standing right there, its head on its shoulder, a cracked porcelain mask tied on with red string. In the office, your exam papers carry your name and a red score, and the class ranking pinned on the board has you last. Erase two more lines.
5. **Walk 3: corridor, door, classroom.** A basketball bounces out of the dark end of the corridor and rolls to your feet; while you watch it, someone is standing in the corridor. The classroom is full, every back turned to you. The speaker calls your name. You answer. Every head turns. The whole class slaps its desks, twice, and the lights go out. When they come back, everyone is gone and their shirts are folded on the chairs. Your name on the board is finally clear.
6. The bell. The classroom in afternoon light, and the teacher watching you from behind the door while the credits roll. When they end, nobody is there. The title, and below it tonight's page of a Taiwanese contact book (聯絡簿), dated in the school year and written from what you did: the lines you kept and wiped away, how long you took to answer the roll call, the locked doors you tried, and the teacher's note.

The camera's orange date stamp is a timeline: today on the first walk, halfway back on the second, the school year on the last.

## How Meta's models made it

| Model | What it did |
|---|---|
| `muse-spark-1.3` | Turned the three memories into a **memory bible**: era details, memory threads that return changed in later walks, the speaker's announcement and the exam scores. Wrote the three chalk lines for each board, each named after one of the memories, then **looked at the photos** and wrote how every room must change for each line. At the end it read what the player did that night and wrote the contact book's diary and the teacher's note. |
| `muse-image-1.0` | The first photographs, in one fixed house style; edits of the same photos walk after walk, so the place stays recognisable while it drifts; the teachers' office; both scares (the teacher in the corridor, the class that turns around); the figure that is only there while a light flickers; each classroom door standing open; the daylight ending; and a depth map of every photo for the 3D walk. |
| `sam-3.1` | Found the doors you can click (and which of them stand open), the chalkboard where the choice and your name are written, the exam papers and the bulletin board where your name and scores are placed, and the old television that fills with static at roll call. Inside each box, the page finds the object's own four corners, so the writing follows its perspective; when it is not sure, it draws nothing. Boxes that cannot be a way through (a sliver at the edge of the picture, a cupboard door) are not clickable. |
| `muse-voice-transcribe-1.0` | Heard the player's answer at roll call, and spoken memories, while the night was played live. |

## How it is built

The game was played live against the Meta Model API through a small Node server. While you walk, the server already renders all three versions of the next walk in the background and cancels the ones whose chalk lines you erase, so each walk starts as soon as its first photo and doors exist.

```
browser (public/)                                server.mjs (Node, no packages)                      Meta Model API
  title: name stays here; year, memories ──────► /api/school   memory bible → first walk ───────────► muse-spark, muse-image, sam-3.1
                                                    └─ in the background: all three versions of the next walk,
                                                       scares and flicker frames (the lines you did not keep are cancelled)
  chalkboard: keep one line ───────────────────► /api/draw     the kept version, already rendered ──► (background work above)
  spoken memory / roll-call answer (WAV) ──────► /api/transcribe ────────────────────────────────────► muse-voice-transcribe, muse-spark
  ending ──────────────────────────────────────► /api/ending   daylight photo + teacher's note ─────► muse-image, muse-spark
```

- A finished night is saved to `runs/<id>/`. `scripts/build-demo.mjs <run id>` turns it into `docs/`, the judges' version: a static page that plays the night back with no server and no model calls, in either language.
- `public/walk3d.js` (WebGL2) turns each photo and its depth map into a surface and moves the camera in; later walks add a dolly zoom, breathing walls and a lens split.
- `public/voice.js`: the speaker's lines are recorded voices played through a loudspeaker chain; your name can be spoken in your own voice if you say it on the title screen, and otherwise only by a voice that runs on your device. The microphone only listens for whether you answered.
- `public/audio.js`: recorded footsteps, doors, laughter and chimes (CC0, see `public/sounds/SOURCES.md`) with synthesised fallbacks, plus the fluorescent hum at Taiwan's 60 Hz, the school bell, chalk, a basketball (bounces and a rolling rumble that beats with each turn), the unison desk slap and the stingers.
- The basketball is drawn each frame as a lit sphere and rolls along the photo's floor in perspective, stopping short of anything the depth map says is in its way.
- `public/ending.js` draws the contact book: Taiwanese ROC date, subjects, diary on a manuscript grid, the teacher's note and seal, in Chinese or English.
- The image model refuses pictures of children, so the class is drawn as adult-sized figures in Taiwanese uniforms, seen from behind, whose faces are never shown (blank plaster ovals or heads wrapped in marked exam papers). Every scare prompt has fallbacks, and every edit is sent together with a plainer fallback and a change the model always accepts, so a refusal never adds a wait.
- `scripts/smoke.mjs` walks the whole game through the server in mock mode (no key, no model calls); CI runs it on every push.

## The demo video

The submission video is a recording of the judges' version, cut with the help of Muse Spark: it watched the recording and chose the trailer's shots and title cards. The "how it is made" cards show the night's own photos, depth maps and SAM 3.1 boxes. The scripts are in `video/` (see `video/README.md`).

## Built during the event

This repository started on 2026-11-03 (Taipei time). Everything here was written during the hackathon; the commit history shows what was added and when.

## Credits

Made by JO TUNG WU. Sounds: The Red Library on the Internet Archive (CC0); the basketball from the Free SFX channel (published as free to use; see `public/sounds/SOURCES.md`). Fonts: Bebas Neue, Caveat, Courier Prime, Iansui, LXGW WenKai TC, Ma Shan Zheng, Noto Serif TC; in the demo video also IM Fell English and Rubik Wet Paint (SIL Open Font License).

## Safety

- The judges' version makes no model calls and sends nothing anywhere. The player's name stays in the browser.
- In the live game, the API key stays on the server and the browser never receives it; the player's name is never sent to the server or a model, and the contact book is written from counts and times only (seconds to answer, doors tried, where you stayed longest).
- Model output is only shown as text and images; no model-written code runs.
- Every request to the model API refuses redirects, and a local spending cap stops calls once the estimated spend reaches `SPEND_CAP_USD`.
