import { randomBytes } from 'node:crypto';
import {
  createGame,
  playerView,
  publicView,
  resolveRound,
  submitQueue,
  validateQueue,
} from '../../public/games/ghost-fleet-core.js';

const rooms = new Map();

function token() {
  return randomBytes(16).toString('hex');
}

function cleanName(value) {
  return String(value || '')
    .replace(/[^\w .'-]/g, '')
    .trim()
    .slice(0, 24);
}

function nowIso() {
  return new Date().toISOString();
}

function createRoom(id) {
  return {
    id,
    game: 'ghost-fleet',
    phase: 'lobby',
    players: [],
    match: 1,
    fleet: null,
    rematchReady: [],
    history: [],
    updatedAt: nowIso(),
  };
}

function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, createRoom(id));
  return rooms.get(id);
}

function findPlayer(room, body) {
  const candidate = body.playerToken || body.resumeToken;
  return room.players.find((player) => player.token === candidate);
}

function beginMatch(room) {
  room.fleet = createGame(`${room.id}:match:${room.match}`);
  room.phase = room.fleet.phase;
  room.rematchReady = [];
  room.updatedAt = nowIso();
  room.history.push({ at: room.updatedAt, type: 'start', match: room.match, text: `Match ${room.match} started` });
}

function safeRoster(room) {
  return room.players.map(({ token: privateToken, ...player }) => ({
    ...player,
    locked: Boolean(room.fleet?.players.find((fleetPlayer) => fleetPlayer.id === player.role)?.queue),
    rematchReady: room.rematchReady.includes(player.id),
  }));
}

function roomView(room, player) {
  const fleet = room.fleet
    ? (player ? playerView(room.fleet, player.role) : publicView(room.fleet))
    : null;
  return {
    id: room.id,
    game: room.game,
    phase: room.phase,
    match: room.match,
    players: safeRoster(room),
    you: player ? { id: player.id, name: player.name, role: player.role } : null,
    fleet,
    rematchReady: [...room.rematchReady],
    recent: room.history.slice(-8),
    updatedAt: room.updatedAt,
  };
}

function playerReceipt(player) {
  return { id: player.id, token: player.token, name: player.name, role: player.role };
}

export async function handleGhostFleet({ req, json, readJson, roomId, action }) {
  const room = getRoom(roomId);
  const body = req.method === 'POST' ? await readJson(req) : {};
  let player = findPlayer(room, body);

  if (req.method === 'POST' && action === 'join') {
    const name = cleanName(body.name) || `Captain ${room.players.length + 1}`;
    if (!player) {
      if (room.players.length >= 2) return json(409, { error: 'Ghost Fleet already has two captains' });
      if (room.players.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        return json(409, { error: 'That captain name is already in this room' });
      }
      player = {
        id: token().slice(0, 12),
        token: token(),
        name,
        role: room.players.length === 0 ? 'red' : 'gold',
      };
      room.players.push(player);
      room.updatedAt = nowIso();
      room.history.push({ at: room.updatedAt, type: 'join', player: player.id, text: `${name} joined the ${player.role} fleet` });
    }
    return json(200, { player: playerReceipt(player), room: roomView(room, player) });
  }

  if (!player) return json(403, { error: 'Join Ghost Fleet first' });

  if (req.method === 'POST' && action === 'state') {
    return json(200, { room: roomView(room, player) });
  }

  if (req.method === 'POST' && action === 'start') {
    if (room.players.length !== 2) return json(409, { error: 'Two captains are required' });
    if (room.phase !== 'lobby') return json(409, { error: 'This match has already started' });
    beginMatch(room);
    return json(200, { room: roomView(room, player) });
  }

  if (req.method === 'POST' && (action === 'queue' || action === 'lock')) {
    if (!room.fleet || room.phase !== 'planning') return json(409, { error: 'Ghost Fleet is not accepting commands' });
    const fleetPlayer = room.fleet.players.find((item) => item.id === player.role);
    if (fleetPlayer?.queue) return json(409, { error: 'Your three commands are already locked' });
    const validation = validateQueue(body.queue);
    if (!validation.valid) return json(400, { error: validation.errors.join(' ') });
    room.fleet = submitQueue(room.fleet, player.role, validation.queue);
    room.updatedAt = nowIso();
    room.history.push({ at: room.updatedAt, type: 'lock', player: player.id, round: room.fleet.round, text: `${player.name} locked three commands` });
    if (room.fleet.players.every((item) => item.queue)) {
      room.fleet = resolveRound(room.fleet);
      room.phase = room.fleet.phase;
      room.updatedAt = nowIso();
      room.history.push({
        at: room.updatedAt,
        type: 'resolve',
        round: room.fleet.round,
        text: room.phase === 'finished'
          ? `${room.fleet.winner === 'draw' ? 'The fleets drew' : `${room.fleet.winner} won`} (${room.fleet.winReason})`
          : `Round ${room.fleet.round - 1} resolved`,
      });
    }
    return json(200, { room: roomView(room, player) });
  }

  if (req.method === 'POST' && action === 'rematch') {
    if (!room.fleet || room.phase !== 'finished') return json(409, { error: 'Finish this match before requesting a rematch' });
    if (!room.rematchReady.includes(player.id)) {
      room.rematchReady.push(player.id);
      room.updatedAt = nowIso();
      room.history.push({ at: room.updatedAt, type: 'ready', player: player.id, text: `${player.name} requested a rematch` });
    }
    if (room.rematchReady.length === 2) {
      room.match += 1;
      beginMatch(room);
    }
    return json(200, { room: roomView(room, player) });
  }

  return json(404, { error: 'Unknown Ghost Fleet route' });
}

export function resetGhostFleetForTests() {
  rooms.clear();
}
