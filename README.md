# Mutation Forge

Bring a game idea, draw a mutation card, and play an original browser game about a minute later.

Built for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026). Indie Developer track, problem statement "Build for Your World".

## How it works

1. You describe a game idea.
2. Muse Spark names the familiar game type it resembles and deals three mutation cards. Each card changes a core rule of play: controls, goal, physics, time, perspective, or who you are.
3. You pick a card. Muse Spark writes a complete single-file game with that rule at its core.
4. The game runs in a sandboxed frame. If it throws an error, the error goes back to Muse Spark, which repairs the game (up to twice).

## Meta models used

| Model | Where it is used | Status |
|---|---|---|
| `muse-spark-1.3` | Dealing mutation cards, writing the game, repairing runtime errors | Built |
| `muse-image-1.0` | Character and scene art for each game | Planned |
| `sam-3.1` | Cutting characters out of the generated art so they become sprites | Planned |
| `muse-voice-transcribe-1.0` | Speaking your idea instead of typing it | Planned |

## Built during the event

Everything in this repository was written during the hackathon. The first commit is dated 2026-11-03 (Taipei time). The commit history shows what was added and when.

## Run it

Needs Node.js 22.9 or newer. No packages to install.

```bash
cp .env.example .env   # then put your Meta Model API key in .env
npm run dev            # http://127.0.0.1:4310
```

Without a key it runs in mock mode, with three fixed cards and one sample game, so the interface can be tried offline.

## Safety

- The API key stays on the server. The browser never receives it.
- Each generated game is served from its own URL with a sandbox and a content policy that blocks all network access, so a generated game cannot reach the internet or the page around it.
- A local spending cap stops model calls once the estimated spend reaches `SPEND_CAP_USD`.
