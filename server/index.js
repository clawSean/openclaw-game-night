import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { winningCells } from "../public/game-core.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const publicDir = join(rootDir, "public");
const port = Number(process.env.PORT || 8787);

const rooms = new Map();
const columns = 7;
const rows = 6;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function emptyBoard() {
  return Array.from({ length: rows }, () => Array(columns).fill(null));
}

function createRoom(id) {
  return {
    id,
    game: "claw-four",
    status: "lobby",
    players: [],
    board: emptyBoard(),
    turn: 0,
    starter: 0,
    round: 1,
    winner: null,
    setWinner: null,
    rematchReady: [],
    winningCells: [],
    updatedAt: new Date().toISOString(),
    history: []
  };
}

function publicRoom(room) {
  const publicPlayer = (player) => player && (({ token: privateToken, ...safe }) => safe)(player);
  return {
    ...room,
    players: room.players.map(publicPlayer),
    winner: publicPlayer(room.winner),
    setWinner: publicPlayer(room.setWinner),
    currentPlayer: publicPlayer(room.players[room.turn % Math.max(room.players.length, 1)] || null)
  };
}

function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, createRoom(id));
  return rooms.get(id);
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": contentTypes[".json"] });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function cleanName(value) {
  return String(value || "")
    .replace(/[^\w .'-]/g, "")
    .trim()
    .slice(0, 24);
}

function token() {
  return randomBytes(16).toString("hex");
}

function boardFull(board) {
  return board[0].every(Boolean);
}

async function handleApi(req, res, parts) {
  const roomId = parts[2];
  const action = parts[3] || "state";
  if (!roomId) return json(res, 400, { error: "missing room id" });

  const room = getRoom(roomId);

  if (req.method === "GET" && action === "state") {
    return json(res, 200, { room: publicRoom(room) });
  }

  if (req.method === "POST" && action === "join") {
    const body = await readJson(req);
    const name = cleanName(body.name) || `Player ${room.players.length + 1}`;
    let player = room.players.find((item) => item.token === body.resumeToken);
    if (!player) {
      if (room.players.length >= 2) return json(res, 409, { error: "Claw Four is full" });
      if (room.players.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        return json(res, 409, { error: "That display name is already in this room" });
      }
      player = { id: token().slice(0, 12), token: token(), name, mark: room.players.length === 0 ? "R" : "Y", wins: 0 };
      room.players.push(player);
      room.history.push({ at: new Date().toISOString(), type: "join", text: `${name} joined` });
    }
    if (room.players.length === 2 && room.status === "lobby") room.status = "active";
    room.updatedAt = new Date().toISOString();
    return json(res, 200, { player: { id: player.id, token: player.token, name: player.name, mark: player.mark }, room: publicRoom(room) });
  }

  if (req.method === "POST" && action === "move") {
    const body = await readJson(req);
    const player = room.players.find((item) => item.token === body.playerToken);
    const col = Number(body.column);
    if (!player) return json(res, 403, { error: "join first" });
    if (room.status !== "active") return json(res, 409, { error: "game is not active" });
    if (room.winner) return json(res, 409, { error: "game is finished" });
    if (room.players[room.turn % room.players.length]?.id !== player.id) {
      return json(res, 409, { error: "not your turn" });
    }
    if (!Number.isInteger(col) || col < 0 || col >= columns) {
      return json(res, 400, { error: "bad column" });
    }

    let placedRow = -1;
    for (let row = rows - 1; row >= 0; row -= 1) {
      if (!room.board[row][col]) {
        room.board[row][col] = player.mark;
        placedRow = row;
        break;
      }
    }
    if (placedRow === -1) return json(res, 409, { error: "column is full" });

    room.history.push({
      at: new Date().toISOString(),
      type: "move",
      text: `${player.name} dropped in column ${col + 1}`
    });

    room.winningCells = winningCells(room.board, placedRow, col, player.mark);
    if (room.winningCells.length) {
      room.winner = player;
      player.wins += 1;
      room.setWinner = player.wins >= 2 ? player : null;
      room.status = room.setWinner ? "set-finished" : "finished";
    } else if (boardFull(room.board)) {
      room.status = "finished";
      room.winner = { id: "draw", name: "Draw", mark: "D" };
    } else {
      room.turn += 1;
    }
    room.updatedAt = new Date().toISOString();
    return json(res, 200, { room: publicRoom(room) });
  }

  if (req.method === "POST" && action === "reset") {
    const body = await readJson(req);
    if (!room.players.some((item) => item.token === body.playerToken)) {
      return json(res, 403, { error: "join first" });
    }
    rooms.set(roomId, createRoom(roomId));
    return json(res, 200, { room: publicRoom(getRoom(roomId)) });
  }

  if (req.method === "POST" && action === "rematch") {
    const body = await readJson(req);
    const player = room.players.find((item) => item.token === body.playerToken);
    if (!player) return json(res, 403, { error: "join first" });
    if (room.players.length !== 2 || !["finished", "set-finished"].includes(room.status)) {
      return json(res, 409, { error: "finish this game before a rematch" });
    }
    if (!room.rematchReady.includes(player.id)) room.rematchReady.push(player.id);
    room.history.push({ at: new Date().toISOString(), type: "ready", text: `${player.name} is ready` });
    room.updatedAt = new Date().toISOString();
    if (room.rematchReady.length < 2) return json(res, 200, { room: publicRoom(room) });

    const newSet = room.status === "set-finished";
    if (newSet) room.players.forEach((item) => { item.wins = 0; });
    room.starter = room.starter === 0 ? 1 : 0;
    room.round = newSet ? 1 : room.round + 1;
    room.turn = room.starter;
    room.board = emptyBoard();
    room.winner = null;
    room.setWinner = null;
    room.rematchReady = [];
    room.winningCells = [];
    room.status = "active";
    room.history.push({ at: new Date().toISOString(), type: "rematch", text: `${newSet ? "A new set" : `Round ${room.round}`} started` });
    room.updatedAt = new Date().toISOString();
    return json(res, 200, { room: publicRoom(room) });
  }

  return json(res, 404, { error: "unknown route" });
}

async function serveStatic(req, res, pathname) {
  const safePath = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": contentTypes[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "api") return await handleApi(req, res, parts);
    return await serveStatic(req, res, url.pathname);
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`OpenClaw Game Night listening on http://localhost:${port}`);
});
