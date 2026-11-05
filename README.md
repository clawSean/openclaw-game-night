# Clawcade 🎮🦞

![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=000)
![Telegram](https://img.shields.io/badge/Telegram-Mini%20App-26A5E4?logo=telegram&logoColor=fff)

A touch-first, sea-themed arcade built for Telegram. Five games, one tiny Node server, no build step or runtime dependencies.

| Game | Loop |
| --- | --- |
| 🦞 Claw Four | Two-player connect four in a shared room |
| 🐙 Kraken Sequence | Repeat a growing pattern as the tempo rises |
| 💣 Abyss Sweep | Deduce a no-guess 5×5 minefield and race the clock |
| 🐚 Shell Shuffle | Match eight pairs with move, time, and streak feedback |
| ⚡ Reef Reflex | Five reaction strikes with false-start stakes |

The four solo games keep native personal-best metrics in browser storage: level, clear time, moves, and reaction average. Telegram haptics and optional audio add feedback; ordinary browsers work too. Claw Four supports player-preserving rematches, but its shared room state is currently in memory and resets with the server process.

## Run

```sh
npm start
```

Open `http://127.0.0.1:8787/?room=my-room`. Add `&game=claw-four` (or any game ID) for a direct game link. Set `PORT` to override `8787`.

## Telegram launch

Use a normal URL button pointing to your BotFather Mini App direct link (`https://t.me/<bot>/<shortname>?startapp=<room>`). Telegram rejects true Web App buttons in group chats. A browser URL makes a useful fallback.

## Architecture

- `public/`: accessible single-page arcade, CSS, and vanilla JavaScript games.
- `server/index.js`: static serving and the Claw Four room API.
- No Telegram token or API credentials are needed in this app.

Room state is not durable yet, so avoid promising uninterrupted multiplayer games across service restarts. The solo games are entirely client-side.
