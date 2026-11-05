# Clawcade 🎮🦞

![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=000)
![Telegram](https://img.shields.io/badge/Telegram-Mini%20App-26A5E4?logo=telegram&logoColor=fff)

A touch-first, sea-themed arcade built for Telegram. Five games, one tiny Node server, no build step or runtime dependencies.

| Game | Loop |
| --- | --- |
| 🦞 Claw Four | Two-player connect four in a shared room |
| 🐙 Kraken Sequence | Repeat a growing memory pattern |
| 💣 Abyss Sweep | Clear a 5×5 minefield with safe first tap and flags |
| 🐚 Shell Shuffle | Match eight pairs in as few moves as possible |
| ⚡ Reef Reflex | Five-round reaction-time challenge |

The four solo games keep personal bests in browser storage. Telegram haptics and optional audio add feedback; ordinary browsers work too. Claw Four's shared room state is currently in memory and resets with the server process.

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
