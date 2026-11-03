# Last One Out（值日生）

In Taiwan, the student on duty is the last one out: they stay after class to clean the room and lock the door.

Last One Out is a quiet horror walk through the school you remember, a school that never existed. You write three things you remember and the year you were there; Meta's models photograph that school at night, and you walk into the photos in 3D. Every time you come back, the school has changed, and it remembers you better than you remember it. No 3D modelling, no hand-made art: every photograph is made and remade while you play. Chinese or English. **Wear headphones and allow the microphone: at the end, someone calls your name, and you answer.**

Built for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026), Indie Developer track.

## How it plays (about 5 minutes)

1. Write your name (it never leaves your browser), the year you were on duty, and three memories, typed, spoken into the microphone, or picked from a few suggestions.
2. The school speaker sends everyone home. You are alone with a half-mopped floor.
3. **Walk 1 — corridor, classroom door, classroom.** Only one door opens; the others are locked and rattle. In the classroom, three half-erased lines of chalk are on the board. Erase two, keep one. Only the line you keep is ever revealed, and it decides how the next walk has changed.
4. **Walk 2 — corridor, a different door, the teachers' office.** The speaker calls the student on duty to the office. A school shirt hangs from a window grille that was empty. When the door slides open, it opens onto the corridor where you started, and your teacher is standing right there. In the office, your exam papers carry your name and a red score, and the class ranking has you last. Keep one more line.
5. **Walk 3 — corridor, door, classroom, at the height you were then.** The classroom is full, every back turned to you. The speaker calls your name. You answer out loud. Every head turns. The whole class slaps its desks, twice, and the lights go out. When they come back, everyone is gone and their shirts are folded on the chairs. Your name on the board is finally clear.
6. The bell. The classroom in afternoon light, a page of a Taiwanese contact book (聯絡簿) dated in your year, a note from the teacher who never said your name, and the credits.

The camera's orange date stamp is a timeline: today on the first walk, halfway back on the second, your school year on the last.

## Meta models

| Model | Where it is used |
|---|---|
| `muse-spark-1.3` | The **memory bible**: one call turns your memories and year into era details, per-room visual details, memory threads that return changed in later walks, your teacher's clothes, the speaker's announcement and your exam scores. It **looks at the photos** before writing the three chalk lines, so every edit names what is really in the picture. It rewrites any edit the image model refuses, turns your spoken memories into Traditional Chinese, and writes the teacher's note in both languages. |
| `muse-image-1.0` | The first photographs in one fixed house style; editing the same photos walk after walk so the place stays recognisable while it drifts; the teachers' office; both scares (the teacher in the corridor, the class that turns around); the figure that is only there while a light flickers; the daylight ending; and a depth map of every photo for the 3D walk. |
| `sam-3.1` | Finding the doors you can click, the chalkboard where the choice and your name are written, the exam papers and the bulletin board where your name and scores are placed, and the old television that fills with static at roll call. |
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
- `public/audio.js`: recorded footsteps, doors, laughter and chimes (CC0, see `public/sounds/SOURCES.md`) with synthesised fallbacks, plus the fluorescent hum at Taiwan's 60 Hz, the school bell, chalk, a ball, the unison desk slap and the stingers.
- `public/ending.js` draws the contact book: Taiwanese ROC date, subjects, diary on a manuscript grid, the teacher's note and seal, in Chinese or English.
- The image model refuses pictures of children, so the class is drawn as adult-sized figures in Taiwanese uniforms, seen from behind, whose faces are never shown (blank plaster ovals or heads wrapped in marked exam papers). Every scare prompt has fallbacks, and a refused edit is rewritten by Muse Spark and retried.
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

Made by Jojo. Sounds: The Red Library on the Internet Archive (CC0). Fonts: Bebas Neue, Caveat, Courier Prime, Iansui, LXGW WenKai TC, Ma Shan Zheng, Noto Serif TC (SIL Open Font License).

## Safety

- The API key stays on the server. The browser never receives it.
- The player's name is written onto the board, the papers, the ranking, the contact book and the credits by the page itself, and spoken by an on-device voice. It is never sent to the server or a model.
- Model output is only shown as text and images; no model-written code runs.
- Every request to the model API refuses redirects, and a local spending cap stops calls once the estimated spend reaches `SPEND_CAP_USD`.
