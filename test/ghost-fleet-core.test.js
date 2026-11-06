import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMANDS,
  createGame,
  playerView,
  publicView,
  resolveRound,
  submitQueue,
  validateQueue,
} from '../public/games/ghost-fleet-core.js';

function queueBoth(game, red, gold) {
  return submitQueue(submitQueue(game, 'red', red), 'gold', gold);
}

test('seeded board creation is deterministic, symmetric, and serialization-safe', () => {
  const first = createGame('night-one');
  const second = createGame('night-one');
  assert.deepEqual(first, second);
  assert.equal(first.size, 7);
  assert.equal(first.reefs.length, 8);
  for (const reef of first.reefs) {
    const [row, col] = reef.split(',').map(Number);
    assert.ok(first.reefs.includes(`${row},${first.size - 1 - col}`));
  }
  assert.equal(first.treasures.length, 7);
  for (const treasure of first.treasures) {
    const [row, col] = treasure.split(',').map(Number);
    assert.ok(first.treasures.includes(`${row},${first.size - 1 - col}`));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
});

test('queues require exactly three known commands and normalize case', () => {
  assert.deepEqual(validateQueue(['port', ' sail ', 'SONAR']).queue, ['PORT', 'SAIL', 'SONAR']);
  assert.equal(validateQueue(['SAIL']).valid, false);
  assert.equal(validateQueue(['SAIL', 'DANCE', 'ANCHOR']).valid, false);
  assert.equal(validateQueue('SAIL').valid, false);
  assert.deepEqual(COMMANDS, ['PORT', 'STARBOARD', 'SAIL', 'BROADSIDE', 'SONAR', 'ANCHOR']);
});

test('public view redacts secret queues while completed sonar locks are attributable', () => {
  let game = queueBoth(createGame('privacy'), ['SONAR', 'SAIL', 'PORT'], ['ANCHOR', 'STARBOARD', 'SAIL']);
  let publicState = publicView(game);
  assert.equal(publicState.players[0].locked, true);
  assert.equal('queue' in publicState.players[0], false);
  const redPlanning = playerView(game, 'red');
  assert.deepEqual(redPlanning.players.find((player) => player.id === 'red').queue, ['SONAR', 'SAIL', 'PORT']);
  assert.equal('queue' in redPlanning.players.find((player) => player.id === 'gold'), false);

  game = resolveRound(game);
  publicState = publicView(game);
  assert.equal(publicState.resolutionLog.some((event) => event.type === 'sonar'), true);
  assert.equal(publicState.resolution.beats[0].events.some((event) => event.type === 'sonar'), true);
  assert.equal(publicState.resolution.start.players.some((player) => 'queue' in player || 'intel' in player), false);
  assert.deepEqual(publicState.resolution.beats.map((beat) => beat.commands.red), ['SONAR', 'SAIL', 'PORT']);
  const redResolved = playerView(game, 'red');
  assert.equal(redResolved.resolutionLog.find((event) => event.type === 'sonar').lockAcquired, true);
  assert.equal(redResolved.players.find((player) => player.id === 'red').sonarLock, true);
});

test('sonar paints the rival so a later broadside reaches beyond normal range', () => {
  let game = createGame('sonar-lock');
  game.reefs = [];
  game.treasures = [];
  game.players[0].position = { row: 3, col: 1 };
  game.players[0].facing = 'N';
  game.players[1].position = { row: 3, col: 5 };
  game = queueBoth(game, ['SONAR', 'ANCHOR', 'BROADSIDE'], ['ANCHOR', 'ANCHOR', 'ANCHOR']);
  game = resolveRound(game);
  assert.equal(game.players[1].hull, 3);
  assert.equal(game.players[0].sonarLock, false);
  assert.equal(game.resolutionLog.find((event) => event.type === 'broadside-hit').sonarLocked, true);
});

test('turning and sailing resolve in three simultaneous beats with a causal log', () => {
  let game = createGame('movement');
  game.reefs = [];
  game.treasures = [];
  game = queueBoth(game, ['PORT', 'SAIL', 'STARBOARD'], ['STARBOARD', 'SAIL', 'PORT']);
  game = resolveRound(game);
  const red = game.players.find((player) => player.id === 'red');
  const gold = game.players.find((player) => player.id === 'gold');
  assert.equal(red.facing, 'E');
  assert.equal(gold.facing, 'W');
  assert.deepEqual(red.position, { row: 2, col: 1 });
  assert.deepEqual(gold.position, { row: 2, col: 5 });
  assert.equal(game.round, 2);
  assert.equal(game.phase, 'planning');
  assert.equal(game.resolutionLog.filter((event) => event.type === 'beat').length, 3);
  assert.equal(game.resolution.beats.length, 3);
  assert.deepEqual(game.resolution.start.players[0].position, { row: 3, col: 1 });
  assert.deepEqual(game.resolution.beats[1].players[0].position, { row: 2, col: 1 });
  assert.ok(game.resolutionLog.some((event) => event.type === 'move'));
});

test('same-target and swap collisions are simultaneous and damage both ships', () => {
  let sameTarget = createGame('collision');
  sameTarget.reefs = [];
  sameTarget.players[0].position = { row: 3, col: 2 };
  sameTarget.players[1].position = { row: 3, col: 4 };
  sameTarget = queueBoth(sameTarget, ['SAIL', 'ANCHOR', 'ANCHOR'], ['SAIL', 'ANCHOR', 'ANCHOR']);
  sameTarget = resolveRound(sameTarget);
  assert.deepEqual(sameTarget.players.map((player) => player.position), [{ row: 3, col: 2 }, { row: 3, col: 4 }]);
  assert.deepEqual(sameTarget.players.map((player) => player.hull), [3, 3]);
  assert.match(sameTarget.resolutionLog.find((event) => event.type === 'collision').cause, /same cell/);

  let swap = createGame('swap');
  swap.reefs = [];
  swap.players[0].position = { row: 3, col: 2 };
  swap.players[1].position = { row: 3, col: 3 };
  swap = queueBoth(swap, ['SAIL', 'ANCHOR', 'ANCHOR'], ['SAIL', 'ANCHOR', 'ANCHOR']);
  swap = resolveRound(swap);
  assert.deepEqual(swap.players.map((player) => player.hull), [3, 3]);
  assert.match(swap.resolutionLog.find((event) => event.type === 'collision').cause, /swap/);
});

test('an anchored ship blocks a ram without taking damage', () => {
  let game = createGame('anchor');
  game.reefs = [];
  game.players[0].position = { row: 3, col: 2 };
  game.players[1].position = { row: 3, col: 3 };
  game = queueBoth(game, ['SAIL', 'ANCHOR', 'ANCHOR'], ['ANCHOR', 'ANCHOR', 'ANCHOR']);
  game = resolveRound(game);
  assert.deepEqual(game.players.map((player) => player.hull), [3, 4]);
  assert.deepEqual(game.players[0].position, { row: 3, col: 2 });
  assert.ok(game.resolutionLog.some((event) => event.type === 'anchor-block'));
});

test('reef grounding is attributable and costs hull', () => {
  let game = createGame('reef');
  game.reefs = ['3,2'];
  game.treasures = [];
  game = queueBoth(game, ['SAIL', 'ANCHOR', 'ANCHOR'], ['ANCHOR', 'ANCHOR', 'ANCHOR']);
  game = resolveRound(game);
  const red = game.players.find((player) => player.id === 'red');
  assert.equal(red.hull, 3);
  assert.deepEqual(red.position, { row: 3, col: 1 });
  const event = game.resolutionLog.find((entry) => entry.type === 'grounding');
  assert.equal(event.cause, 'SAIL into reef');
  assert.equal(event.damage, 1);
});

test('broadside uses lateral range, reefs block fire, and mutual fire can draw', () => {
  let hit = createGame('broadside-hit');
  hit.reefs = [];
  hit.treasures = [];
  hit.players[0].position = { row: 3, col: 3 };
  hit.players[0].facing = 'N';
  hit.players[1].position = { row: 3, col: 5 };
  hit.players[1].hull = 1;
  hit = queueBoth(hit, ['BROADSIDE', 'ANCHOR', 'ANCHOR'], ['ANCHOR', 'ANCHOR', 'ANCHOR']);
  hit = resolveRound(hit);
  assert.equal(hit.phase, 'finished');
  assert.equal(hit.winner, 'red');
  assert.equal(hit.winReason, 'opponent-sunk');

  let blocked = createGame('broadside-blocked');
  blocked.reefs = ['3,4'];
  blocked.treasures = [];
  blocked.players[0].position = { row: 3, col: 3 };
  blocked.players[0].facing = 'N';
  blocked.players[1].position = { row: 3, col: 5 };
  blocked = queueBoth(blocked, ['BROADSIDE', 'ANCHOR', 'ANCHOR'], ['ANCHOR', 'ANCHOR', 'ANCHOR']);
  blocked = resolveRound(blocked);
  assert.equal(blocked.players[1].hull, 4);

  let draw = createGame('mutual');
  draw.reefs = [];
  draw.treasures = [];
  draw.players[0].position = { row: 3, col: 2 };
  draw.players[1].position = { row: 3, col: 4 };
  draw.players.forEach((player) => { player.facing = 'N'; player.hull = 1; });
  draw = queueBoth(draw, ['BROADSIDE', 'ANCHOR', 'ANCHOR'], ['BROADSIDE', 'ANCHOR', 'ANCHOR']);
  draw = resolveRound(draw);
  assert.equal(draw.winner, 'draw');
  assert.equal(draw.winReason, 'mutual-sinking');
});

test('treasure collection can end the game and unsubmitted rounds cannot resolve', () => {
  let game = createGame('treasure');
  game.reefs = [];
  game.treasures = ['3,2'];
  game.players[0].treasure = 2;
  game = queueBoth(game, ['SAIL', 'ANCHOR', 'ANCHOR'], ['ANCHOR', 'ANCHOR', 'ANCHOR']);
  game = resolveRound(game);
  assert.equal(game.winner, 'red');
  assert.equal(game.winReason, 'treasure');
  assert.equal(game.players[0].treasure, 3);
  assert.ok(game.resolutionLog.some((event) => event.type === 'treasure'));
  assert.throws(() => resolveRound(submitQueue(createGame('half'), 'red', ['SAIL', 'SAIL', 'SAIL'])), /Both players/);
});
