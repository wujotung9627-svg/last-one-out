# Last One Out（值日生）

In Taiwan, the student on duty is the last one out: they stay after class to clean the room and lock the door.

Last One Out is a quiet horror walk through the school you remember, a school that never existed. You write three things you remember and the year you were there; Meta's models photograph that school at night, and you walk into the photos in 3D. Every time you come back, the school has changed, and it remembers you better than you remember it. No 3D modelling, no hand-made art: every photograph is made and remade while you play. Chinese or English. **Wear headphones and allow the microphone: at the end, someone calls your name, and you answer.**

Built for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026), Indie Developer track.

## How it plays (about 5 minutes)

1. Write your name (it never leaves your browser), the year you were on duty, and three memories, typed, spoken into the microphone, or picked from a few suggestions.
2. The school speaker sends everyone home. You are alone with a half-mopped floor.
3. **Walk 1 — corridor, classroom door, classroom.** Doors that stand open lead on; closed ones are locked and rattle. The classroom door opens the way Muse Image drew it open: the page shows that photo only where the door changed, so the door is the only thing that moves. In the classroom, three half-wiped lines of chalk are on the board, each grown out of one of your memories. Erase two; the one left is kept, and it decides how the next walk has changed.
4. **Walk 2 — corridor, a different door, the teachers' office.** The speaker calls the student on duty to the office. A school shirt hangs from a window grille that was empty. When the door slides open, it opens onto the corridor where you started, and your teacher is standing right there, its head on its shoulder, a cracked porcelain mask tied on with red string. In the office, your exam papers carry your name and a red score, and the class ranking pinned on the board has you last. Erase two more lines.
5. **Walk 3 — corridor, door, classroom.** A basketball bounces out of the dark end of the corridor and rolls to your feet; while you watch it, someone is standing in the corridor. The classroom is full, every back turned to you. The speaker calls your name. You answer out loud. Every head turns. The whole class slaps its desks, twice, and the lights go out. When they come back, everyone is gone and their shirts are folded on the chairs. Your name on the board is finally clear.
6. The bell. The classroom in afternoon light, and the teacher watching you from behind the door while the credits roll. When they end, nobody is there. The title, and below it tonight's page of a Taiwanese contact book (聯絡簿), dated in your year and written from what you did: the lines you kept and wiped away, how long you took to answer the roll call, the locked doors you tried, your diary of the night, and the teacher's note.

The camera's orange date stamp is a timeline: today on the first walk, halfway back on the second, your school year on the last.

## Meta models

| Model | Where it is used |
|---|---|
| `muse-spark-1.3` | A quick first pass turns your memories into details for the first three photos, so the first walk is ready by the time the intro ends. The **memory bible** turns them into era details, memory threads that return changed in later walks, the speaker's announcement and your exam scores. It writes the three chalk lines, each named after one of your memories, then **looks at the photos** and writes how every room must change for each line. It turns your spoken memories into Traditional Chinese, and at the end it reads what you did that night and writes the contact book's diary and the teacher's note. |
| `muse-image-1.0` | The first photographs in one fixed house style; editing the same photos walk after walk so the place stays recognisable while it drifts; the teachers' office; both scares (the teacher in the corridor, the class that turns around); the figure that is only there while a light flickers; the classroom door standing open; the daylight ending; and a depth map of every photo for the 3D walk. |
| `sam-3.1` | Finding the doors you can click (and which of them stand open), the chalkboard where the choice and your name are written, the exam papers and the bulletin board where your name and scores are placed, and the old television that fills with static at roll call. Inside each box, the page finds the object's own four corners, so the writing follows its perspective; when it is not sure, it draws nothing. Boxes that cannot be a way through (a sliver at the edge of the picture, a cupboard door) are not clickable. |
| `muse-voice-transcribe-1.0` | Speaking your memories instead of typing them, and hearing your answer at roll call: if you say anything but "here", the speaker calls your name again. |

## How it is built

```
browser (public/)                                server.mjs (Node, no packages)                      Meta Model API
  title: name stays here; year, memories ──────► /api/school   memory bible → first walk ───────────► muse-spark, muse-image, sam-3.1
                                                    └─ in the background: all three versions of the next walk,
                                                       scares and flicker frames (the lines you did not keep are cancelled)
  chalkboard: keep one line ───────────────────► /api/draw     the kept version, already rendered ──► (background work above)
  spoken memory / roll-call answer (WAV) ──────► /api/transcribe ────────────────────────────────────► muse-voice-transcribe, muse-spark
  ending ──────────────────────────────────────► /api/ending   daylight photo + teacher's note ─────► muse-image, muse-spark
```

- `public/walk3d.js` (WebGL2) turns each photo and its depth map into a surface and moves the camera in; later walks add a dolly zoom, breathing walls and a lens split.
- `public/voice.js`: the speaker talks with a voice that runs on your device (online voices are skipped, so your name is never sent anywhere); the microphone hears whether you answered; recordings are turned into 16 kHz WAV for Muse Voice Transcribe.
- `public/audio.js`: recorded footsteps, doors, laughter and chimes (CC0, see `public/sounds/SOURCES.md`) with synthesised fallbacks, plus the fluorescent hum at Taiwan's 60 Hz, the school bell, chalk, a basketball (bounces and a rolling rumble that beats with each turn), the unison desk slap and the stingers.
- The basketball is drawn each frame as a lit sphere and rolls along the photo's floor in perspective, stopping short of anything the depth map says is in its way.
- `public/ending.js` draws the contact book: Taiwanese ROC date, subjects, diary on a manuscript grid, the teacher's note and seal, in Chinese or English.
- The image model refuses pictures of children, so the class is drawn as adult-sized figures in Taiwanese uniforms, seen from behind, whose faces are never shown (blank plaster ovals or heads wrapped in marked exam papers). Every scare prompt has fallbacks, and every edit is sent together with a plainer fallback and a change the model always accepts, so a refusal never adds a wait.
- `scripts/build-demo.mjs <run id>` turns a finished, recorded walk into `docs/`, a static replay that needs no server and makes no model calls, in either language.
- `scripts/smoke.mjs` walks the whole game through the API in mock mode; CI runs it on every push and pull request.

## Run it

Needs Node.js 22.9 or newer. No packages to install.

```bash
cp .env.example .env   # then put your Meta Model API key in .env
npm run dev            # http://127.0.0.1:4310
node scripts/smoke.mjs # the whole game in mock mode: no key, no cost
```

Without a key it runs in mock mode with labelled drawings, so the whole walk can be played offline. A full live game costs about US$0.70–0.90 in model calls.

## Built during the event

This repository started on 2026-11-03 (Taipei time). Everything here was written during the hackathon; the commit history shows what was added and when.

## Credits

Made by JO TUNG WU. Sounds: The Red Library on the Internet Archive (CC0); the basketball from the Free SFX channel (published as free to use; see `public/sounds/SOURCES.md`). Fonts: Bebas Neue, Caveat, Courier Prime, Iansui, LXGW WenKai TC, Ma Shan Zheng, Noto Serif TC (SIL Open Font License).

## Safety

- The API key stays on the server. The browser never receives it.
- The player's name is written onto the board, the papers, the ranking, the contact book and the credits by the page itself, and spoken by an on-device voice. It is never sent to the server or a model. The contact book is written from counts and times only (seconds to answer, doors tried, where you stayed longest).
- Model output is only shown as text and images; no model-written code runs.
- Every request to the model API refuses redirects, and a local spending cap stops calls once the estimated spend reaches `SPEND_CAP_USD`.
