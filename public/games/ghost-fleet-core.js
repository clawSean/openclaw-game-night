import { seededRandom, shuffled } from '../game-core.js';

export const COMMANDS = Object.freeze([
  'PORT',
  'STARBOARD',
  'SAIL',
  'BROADSIDE',
  'SONAR',
  'ANCHOR',
]);

const FACINGS = Object.freeze(['N', 'E', 'S', 'W']);
const DELTAS = Object.freeze({
  N: [-1, 0],
  E: [0, 1],
  S: [1, 0],
  W: [0, -1],
});
const TREASURE_TO_WIN = 3;
const MAX_ROUNDS = 8;

const clone = (value) => JSON.parse(JSON.stringify(value));
const cellKey = ({ row, col }) => `${row},${col}`;
const sameCell = (left, right) => left.row === right.row && left.col === right.col;
const playerById = (state, id) => state.players.find((player) => player.id === id);
const opponentOf = (state, id) => state.players.find((player) => player.id !== id);

function turn(facing, amount) {
  const index = FACINGS.indexOf(facing);
  return FACINGS[(index + amount + FACINGS.length) % FACINGS.length];
}

function forward(position, facing) {
  const [rowDelta, colDelta] = DELTAS[facing];
  return { row: position.row + rowDelta, col: position.col + colDelta };
}

function isInside(state, position) {
  return position.row >= 0 && position.col >= 0 &&
    position.row < state.size && position.col < state.size;
}

function damage(player, amount = 1) {
  player.hull = Math.max(0, player.hull - amount);
}

function log(state, beat, type, actors, cause, effect, extra = {}) {
  state.resolutionLog.push({
    round: state.round,
    beat,
    type,
    actors: Array.isArray(actors) ? actors : [actors],
    cause,
    effect,
    ...extra,
  });
}

function visualSnapshot(state) {
  return {
    players: state.players.map(({ id, position, facing, hull, treasure, sonarLock }) => ({
      id,
      position: clone(position),
      facing,
      hull,
      treasure,
      sonarLock: Boolean(sonarLock),
    })),
    treasures: [...state.treasures],
  };
}

function generateBoard(seed, size, starts) {
  const random = seededRandom(`${seed}:ghost-fleet-board`);
  const startKeys = new Set(starts.map(cellKey));
  const reefCandidates = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < Math.floor(size / 2); col += 1) {
      const mirror = { row, col: size - 1 - col };
      const cell = { row, col };
      if (!startKeys.has(cellKey(cell)) && !startKeys.has(cellKey(mirror))) reefCandidates.push(cell);
    }
  }
  const reefSeeds = shuffled(reefCandidates, random).slice(0, 4);
  const reefs = reefSeeds.flatMap((cell) => [
    cellKey(cell),
    cellKey({ row: cell.row, col: size - 1 - cell.col }),
  ]);

  const blocked = new Set([...reefs, ...startKeys]);
  const treasureCandidates = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < Math.floor(size / 2); col += 1) {
      const key = cellKey({ row, col });
      const mirror = cellKey({ row, col: size - 1 - col });
      if (!blocked.has(key) && !blocked.has(mirror)) treasureCandidates.push({ row, col });
    }
  }
  const treasureSeeds = shuffled(treasureCandidates, random).slice(0, 3);
  const treasures = [
    cellKey({ row: Math.floor(size / 2), col: Math.floor(size / 2) }),
    ...treasureSeeds.flatMap((cell) => [
      cellKey(cell),
      cellKey({ row: cell.row, col: size - 1 - cell.col }),
    ]),
  ];
  return { reefs, treasures };
}

export function createGame(seed = 'ghost-fleet') {
  const normalizedSeed = String(seed);
  const size = 7;
  const starts = [{ row: 3, col: 1 }, { row: 3, col: 5 }];
  const board = generateBoard(normalizedSeed, size, starts);
  return {
    game: 'ghost-fleet',
    version: 1,
    seed: normalizedSeed,
    size,
    round: 1,
    phase: 'planning',
    winner: null,
    winReason: null,
    treasureToWin: TREASURE_TO_WIN,
    maxRounds: MAX_ROUNDS,
    reefs: board.reefs,
    treasures: board.treasures,
    players: [
      { id: 'red', position: starts[0], facing: 'E', hull: 4, treasure: 0, queue: null, intel: [], sonarLock: false },
      { id: 'gold', position: starts[1], facing: 'W', hull: 4, treasure: 0, queue: null, intel: [], sonarLock: false },
    ],
    resolutionLog: [],
    resolution: null,
  };
}

export function validateQueue(queue) {
  const errors = [];
  if (!Array.isArray(queue)) {
    return { valid: false, errors: ['Queue must be an array of three commands.'], queue: null };
  }
  if (queue.length !== 3) errors.push('Queue must contain exactly three commands.');
  const normalized = queue.map((command) => String(command).trim().toUpperCase());
  normalized.forEach((command, index) => {
    if (!COMMANDS.includes(command)) errors.push(`Command ${index + 1} is invalid: ${command || '(empty)'}.`);
  });
  return { valid: errors.length === 0, errors, queue: errors.length ? null : normalized };
}

export function submitQueue(game, playerId, queue) {
  if (game.phase !== 'planning') throw new Error('Ghost Fleet is not accepting commands.');
  const validation = validateQueue(queue);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const next = clone(game);
  const player = playerById(next, playerId);
  if (!player) throw new Error(`Unknown player: ${playerId}`);
  player.queue = validation.queue;
  return next;
}

function resolveTurns(state, beat, commands) {
  for (const player of state.players) {
    const command = commands[player.id];
    if (command !== 'PORT' && command !== 'STARBOARD') continue;
    const before = player.facing;
    player.facing = turn(player.facing, command === 'PORT' ? -1 : 1);
    log(state, beat, 'turn', player.id, command, `${before} → ${player.facing}`, {
      from: before,
      to: player.facing,
    });
  }
}

function resolveSonar(state, beat, commands) {
  for (const player of state.players) {
    if (commands[player.id] !== 'SONAR') continue;
    const opponent = opponentOf(state, player.id);
    player.sonarLock = true;
    log(state, beat, 'sonar', player.id, 'SONAR', `Painted ${opponent.id} for the next broadside`, {
      opponent: opponent.id,
      lockAcquired: true,
    });
  }
}

function blockedReason(state, position) {
  if (!isInside(state, position)) return 'edge of the chart';
  if (state.reefs.includes(cellKey(position))) return 'reef';
  return null;
}

function movementIntent(state, player, command) {
  if (command !== 'SAIL') return null;
  const target = forward(player.position, player.facing);
  return { player, from: clone(player.position), target, blocked: blockedReason(state, target) };
}

function movementCrash(state, beat, players, cause, effect) {
  players.forEach((player) => damage(player));
  log(state, beat, 'collision', players.map((player) => player.id), cause, effect, {
    damage: Object.fromEntries(players.map((player) => [player.id, 1])),
  });
}

function collectTreasure(state, beat, player) {
  const key = cellKey(player.position);
  const index = state.treasures.indexOf(key);
  if (index === -1) return;
  state.treasures.splice(index, 1);
  player.treasure += 1;
  log(state, beat, 'treasure', player.id, `Entered ${key}`, `Recovered treasure ${player.treasure}/${TREASURE_TO_WIN}`, {
    cell: key,
    total: player.treasure,
  });
}

function resolveMovement(state, beat, commands) {
  const [left, right] = state.players;
  const leftIntent = movementIntent(state, left, commands[left.id]);
  const rightIntent = movementIntent(state, right, commands[right.id]);

  for (const intent of [leftIntent, rightIntent].filter(Boolean)) {
    if (!intent.blocked) continue;
    damage(intent.player);
    log(state, beat, 'grounding', intent.player.id, `SAIL into ${intent.blocked}`, 'Stayed in place and lost 1 hull', {
      from: cellKey(intent.from),
      target: cellKey(intent.target),
      damage: 1,
    });
  }

  const leftCanMove = leftIntent && !leftIntent.blocked;
  const rightCanMove = rightIntent && !rightIntent.blocked;
  if (leftCanMove && rightCanMove) {
    if (sameCell(leftIntent.target, rightIntent.target)) {
      movementCrash(state, beat, [left, right], 'Both ships sailed into the same cell', 'Both stayed and lost 1 hull');
      return;
    }
    if (sameCell(leftIntent.target, rightIntent.from) && sameCell(rightIntent.target, leftIntent.from)) {
      movementCrash(state, beat, [left, right], 'Ships attempted to swap cells', 'Both stayed and lost 1 hull');
      return;
    }
    left.position = leftIntent.target;
    right.position = rightIntent.target;
    log(state, beat, 'move', [left.id, right.id], 'Both SAIL paths were clear', 'Both ships advanced', {
      moves: {
        [left.id]: { from: cellKey(leftIntent.from), to: cellKey(leftIntent.target) },
        [right.id]: { from: cellKey(rightIntent.from), to: cellKey(rightIntent.target) },
      },
    });
    collectTreasure(state, beat, left);
    collectTreasure(state, beat, right);
    return;
  }

  const single = leftCanMove ? leftIntent : rightCanMove ? rightIntent : null;
  if (!single) return;
  const other = opponentOf(state, single.player.id);
  if (sameCell(single.target, other.position)) {
    if (commands[other.id] === 'ANCHOR') {
      damage(single.player);
      log(state, beat, 'anchor-block', [single.player.id, other.id], `${single.player.id} sailed into an anchored ship`, `${single.player.id} stayed and lost 1 hull`, {
        damage: { [single.player.id]: 1, [other.id]: 0 },
      });
    } else {
      movementCrash(state, beat, [single.player, other], `${single.player.id} rammed an occupied cell`, 'Both stayed and lost 1 hull');
    }
    return;
  }
  single.player.position = single.target;
  log(state, beat, 'move', single.player.id, 'SAIL path was clear', `${cellKey(single.from)} → ${cellKey(single.target)}`, {
    from: cellKey(single.from),
    to: cellKey(single.target),
  });
  collectTreasure(state, beat, single.player);
}

function broadsideRay(state, player, enhanced = false) {
  const directions = player.facing === 'N' || player.facing === 'S'
    ? [[0, -1], [0, 1]]
    : [[-1, 0], [1, 0]];
  const cells = [];
  for (const [rowDelta, colDelta] of directions) {
    for (let distance = 1; distance <= (enhanced ? 6 : 3); distance += 1) {
      const cell = {
        row: player.position.row + rowDelta * distance,
        col: player.position.col + colDelta * distance,
      };
      if (!isInside(state, cell) || state.reefs.includes(cellKey(cell))) break;
      cells.push(cellKey(cell));
    }
  }
  return cells;
}

function resolveBroadsides(state, beat, commands) {
  const hits = [];
  for (const player of state.players) {
    if (commands[player.id] !== 'BROADSIDE') continue;
    const opponent = opponentOf(state, player.id);
    const sonarLocked = Boolean(player.sonarLock);
    const ray = broadsideRay(state, player, sonarLocked);
    const hit = ray.includes(cellKey(opponent.position));
    log(state, beat, hit ? 'broadside-hit' : 'broadside-miss', player.id, sonarLocked ? 'SONAR-LOCKED BROADSIDE' : 'BROADSIDE', hit ? `Hit ${opponent.id}` : 'No ship in the firing lanes', {
      target: opponent.id,
      ray,
      damage: hit ? 1 : 0,
      sonarLocked,
    });
    player.sonarLock = false;
    if (hit) hits.push(opponent);
  }
  hits.forEach((player) => damage(player));
}

function decideWinner(state, beat) {
  const sunk = state.players.filter((player) => player.hull <= 0);
  const rich = state.players.filter((player) => player.treasure >= TREASURE_TO_WIN);
  if (sunk.length === 2 || rich.length === 2) {
    state.phase = 'finished';
    state.winner = 'draw';
    state.winReason = sunk.length === 2 ? 'mutual-sinking' : 'simultaneous-treasure';
  } else if (sunk.length === 1) {
    state.phase = 'finished';
    state.winner = opponentOf(state, sunk[0].id).id;
    state.winReason = 'opponent-sunk';
  } else if (rich.length === 1) {
    state.phase = 'finished';
    state.winner = rich[0].id;
    state.winReason = 'treasure';
  }
  if (state.phase === 'finished') {
    log(state, beat, 'game-over', state.winner === 'draw' ? state.players.map((player) => player.id) : state.winner, state.winReason, state.winner === 'draw' ? 'Draw' : `${state.winner} wins`);
    return true;
  }
  return false;
}

function decideRoundLimit(state) {
  if (state.round < MAX_ROUNDS) return false;
  const [left, right] = state.players;
  const leftScore = [left.treasure, left.hull];
  const rightScore = [right.treasure, right.hull];
  state.phase = 'finished';
  if (leftScore[0] === rightScore[0] && leftScore[1] === rightScore[1]) {
    state.winner = 'draw';
  } else {
    state.winner = leftScore[0] !== rightScore[0]
      ? (leftScore[0] > rightScore[0] ? left.id : right.id)
      : (leftScore[1] > rightScore[1] ? left.id : right.id);
  }
  state.winReason = 'round-limit';
  log(state, 3, 'game-over', state.winner === 'draw' ? [left.id, right.id] : state.winner, 'Round 8 completed', state.winner === 'draw' ? 'Draw' : `${state.winner} wins on treasure, then hull`);
  return true;
}

export function resolveRound(game) {
  if (game.phase !== 'planning') throw new Error('Ghost Fleet cannot resolve from this phase.');
  if (game.players.some((player) => !player.queue)) throw new Error('Both players must lock three commands.');
  const state = clone(game);
  state.phase = 'resolving';
  state.resolutionLog = [];
  const queues = Object.fromEntries(state.players.map((player) => [player.id, [...player.queue]]));
  state.resolution = { round: state.round, start: visualSnapshot(state), beats: [] };

  for (let beat = 0; beat < 3; beat += 1) {
    const eventStart = state.resolutionLog.length;
    const commands = Object.fromEntries(state.players.map((player) => [player.id, queues[player.id][beat]]));
    log(state, beat + 1, 'beat', state.players.map((player) => player.id), 'Simultaneous command reveal', `${commands.red} vs ${commands.gold}`, { commands });
    resolveTurns(state, beat + 1, commands);
    resolveSonar(state, beat + 1, commands);
    resolveMovement(state, beat + 1, commands);
    resolveBroadsides(state, beat + 1, commands);
    const finished = decideWinner(state, beat + 1);
    state.resolution.beats.push({
      beat: beat + 1,
      commands,
      ...visualSnapshot(state),
      events: state.resolutionLog.slice(eventStart).map(clone),
    });
    if (finished) break;
  }

  state.players.forEach((player) => { player.queue = null; });
  if (state.phase !== 'finished' && !decideRoundLimit(state)) {
    state.round += 1;
    state.phase = 'planning';
  }
  return state;
}

function sanitizedResolution(resolution, viewerId) {
  if (!resolution) return null;
  return {
    round: resolution.round,
    start: clone(resolution.start),
    beats: resolution.beats.map((beat) => ({
      ...clone(beat),
      events: beat.events.filter((event) => !event.privateFor || event.privateFor === viewerId).map(clone),
    })),
  };
}

function sanitizedPlayers(state, viewerId) {
  return state.players.map((player) => ({
    id: player.id,
    position: clone(player.position),
    facing: player.facing,
    hull: player.hull,
    treasure: player.treasure,
    sonarLock: Boolean(player.sonarLock),
    locked: Boolean(player.queue),
    ...(viewerId === player.id ? { queue: player.queue ? [...player.queue] : null, intel: clone(player.intel) } : {}),
  }));
}

export function publicView(game) {
  return {
    ...clone(game),
    players: sanitizedPlayers(game, null),
    resolutionLog: game.resolutionLog.filter((event) => !event.privateFor).map(clone),
    resolution: sanitizedResolution(game.resolution, null),
  };
}

export function playerView(game, playerId) {
  if (!playerById(game, playerId)) throw new Error(`Unknown player: ${playerId}`);
  return {
    ...clone(game),
    players: sanitizedPlayers(game, playerId),
    resolutionLog: game.resolutionLog
      .filter((event) => !event.privateFor || event.privateFor === playerId)
      .map(clone),
    resolution: sanitizedResolution(game.resolution, playerId),
  };
}
