# Clawcade 🎮🦞

![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=000)
![Telegram](https://img.shields.io/badge/Telegram-Mini%20App-26A5E4?logo=telegram&logoColor=fff)

A touch-first, sea-themed arcade built for Telegram. The current fifteen-cabinet
alpha preserves every original Telegram game and adds distinct upgraded or new
loops alongside them. See [`DESIGN.md`](DESIGN.md) for the hypotheses, reversal
conditions, and human evidence plan.

| Game | Loop |
| --- | --- |
| 🦞 Claw Four | Consent-based best-of-three duel in a shared room |
| 🐙 Kraken Sequence | Classic escalating Simon-style memory dive |
| 💣 Abyss Sweep | Compact fair Minesweeper-style reef clear |
| 🐚 Shell Shuffle | Timed matching with move and streak scoring |
| ⚡ Reef Reflex | Five-round reaction test with false-start penalties |
| 💣 Abyss Expedition | Solver-verified deduction boards with surface/descend commitment |
| 🐙 Kraken Current | Fixed four-cue Normal/Reverse memory trials |
| 👻 Echo Wake | Delayed spatial planning against your prior moves |
| ⚪ Pearl Ricochet | Deterministic bank-shot challenge |
| 🐚 Shell Shift | Whole-line board tactics with visible refills |
| 🚨 Clawcade Panic | Six authored rapid-fire microgame emergencies |
| 🪼 Tide Tell | Rule-switching tap/hold/wait reads with Calm/Deep pressure |
| ⚓ Signal Storm | Asymmetric two-player submarine crisis communication |
| ☠ Ghost Fleet | Secret three-order simultaneous naval tactics |
| 🎬 Panic: Director's Cut | Authored gesture comedy with a three-phase leviathan finale |

The solo prototypes keep native personal-best metrics and an anonymous,
session-scoped playtest trace in browser storage. The trace excludes Telegram
identity, player names, and init data and can be copied from the menu. Telegram
haptics and optional audio add redundant feedback; ordinary browsers work too.
Claw Four supports player-preserving sets, but its shared room state is currently
in memory and resets with the server process.

## Run

```sh
npm start
npm run check
```

The optional real-browser labs expect a local CDP-enabled browser at
`127.0.0.1:9223` and the app at `127.0.0.1:8788`:

```sh
npm run test:browser
npm run test:flagship
```

Open `http://127.0.0.1:8787/?room=my-room`. Add `&game=claw-four` (or any game ID) for a direct game link. Set `PORT` to override `8787`.

## Telegram launch

Use a normal URL button pointing to your BotFather Mini App direct link (`https://t.me/<bot>/<shortname>?startapp=<room>`). Telegram rejects true Web App buttons in group chats. A browser URL makes a useful fallback.

## Architecture

- `public/`: accessible single-page arcade, CSS, and vanilla JavaScript games.
- `server/index.js`: static serving plus Claw Four, Signal Storm, and Ghost Fleet room APIs.
- No Telegram token or API credentials are needed in this app.

Room state is not durable yet, so avoid promising uninterrupted multiplayer games across service restarts. The solo games are entirely client-side.
