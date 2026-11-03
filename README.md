# Last One Out（值日生）

In Taiwan, the student on duty is the last one out: they stay after class to clean the room and lock the door.

Last One Out is a quiet horror walk through the school you remember, a school that never existed. Every time you come back, it has changed.

Built for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026), Indie Developer track.

## How it plays (planned)

1. Describe three things you remember about your school, typed or spoken.
2. Muse Image turns them into a night-time photograph of that school.
3. You walk the corridor photo by photo. SAM 3.1 finds the doors in each photo so you can walk through them.
4. Each time you come back around, you draw one of three face-down cards. The card changes something, and Muse Image edits the photos to match. Muse Spark paces how far things drift and checks that each new photo really shows the change.
5. On the last loop you finally read whose name is on the board.

## Meta models

| Model | Where it is used | Status |
|---|---|---|
| `muse-spark-1.3` | Dealing the cards, pacing the changes, checking each new photo | Card dealing built (first prototype); the rest planned |
| `muse-image-1.0` | Generating and editing the photographs | Planned |
| `sam-3.1` | Finding doors and objects so a photo becomes walkable | Planned |
| `muse-voice-transcribe-1.0` | Speaking your memories instead of typing them | Planned |

## Status

This repository started on 2026-11-03 (Taipei time) as a different idea, mini-games generated from mutation cards, and changed direction the same day. Built so far is the server foundation: the API key stays on the server, a local spending cap, mock mode, and the card-dealing call. The mini-game generation from that first prototype will be replaced.

## Built during the event

Everything in this repository was written during the hackathon. The commit history shows what was added and when.

## Run it

Needs Node.js 22.9 or newer. No packages to install.

```bash
cp .env.example .env   # then put your Meta Model API key in .env
npm run dev            # http://127.0.0.1:4310
```

Without a key it runs in mock mode with fixed sample content, so the interface can be tried offline.

## Safety

- The API key stays on the server. The browser never receives it.
- Anything the model writes runs in a sandboxed frame with a content policy that blocks all network access.
- A local spending cap stops model calls once the estimated spend reaches `SPEND_CAP_USD`.
- Planned: the player's name is written onto the board by the page itself and is never sent to a model.
