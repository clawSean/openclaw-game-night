import { createServer } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { handleGhostFleet, resetGhostFleetForTests } from '../server/games/ghost-fleet.js';

let server;
let origin;

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

before(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    const roomId = parts[0];
    const action = parts[1];
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    try {
      await handleGhostFleet({ req, json, readJson, roomId, action });
    } catch (error) {
      json(500, { error: error.message });
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

beforeEach(() => resetGhostFleetForTests());

async function post(room, action, body = {}) {
  const response = await fetch(`${origin}/${room}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function joinPair(room = 'duel') {
  const red = await post(room, 'join', { name: 'Ada' });
  const gold = await post(room, 'join', { name: 'Grace' });
  assert.equal(red.status, 200);
  assert.equal(gold.status, 200);
  return { red: red.body.player, gold: gold.body.player };
}

test('join assigns persistent roles, resume returns the same captain, and rooms cap at two', async () => {
  const { red, gold } = await joinPair('join');
  assert.equal(red.role, 'red');
  assert.equal(gold.role, 'gold');

  const resumed = await post('join', 'join', { name: 'Ignored', resumeToken: red.token });
  assert.equal(resumed.status, 200);
  assert.deepEqual(resumed.body.player, red);
  assert.equal(resumed.body.room.you.role, 'red');
  assert.equal(resumed.body.room.players.some((player) => 'token' in player), false);

  const full = await post('join', 'join', { name: 'Third' });
  assert.equal(full.status, 409);
  assert.match(full.body.error, /two captains/);
});

test('start requires two players and state requires a private token', async () => {
  const solo = await post('start', 'join', { name: 'Solo' });
  const early = await post('start', 'start', { playerToken: solo.body.player.token });
  assert.equal(early.status, 409);

  const unauthorized = await post('start', 'state', {});
  assert.equal(unauthorized.status, 403);

  const second = await post('start', 'join', { name: 'Second' });
  const started = await post('start', 'start', { playerToken: solo.body.player.token });
  assert.equal(started.status, 200);
  assert.equal(started.body.room.phase, 'planning');
  assert.equal(started.body.room.fleet.seed, 'start:match:1');
  assert.deepEqual(started.body.room.players.map((player) => player.role), ['red', 'gold']);

  const duplicate = await post('start', 'start', { playerToken: second.body.player.token });
  assert.equal(duplicate.status, 409);
});

test('queues stay private until resolution and completed sonar locks become attributable', async () => {
  const { red, gold } = await joinPair('privacy');
  await post('privacy', 'start', { playerToken: red.token });

  const invalid = await post('privacy', 'queue', { playerToken: red.token, queue: ['SAIL'] });
  assert.equal(invalid.status, 400);

  const redLocked = await post('privacy', 'queue', {
    playerToken: red.token,
    queue: ['SONAR', 'SAIL', 'ANCHOR'],
  });
  assert.equal(redLocked.status, 200);
  const redPrivate = redLocked.body.room.fleet.players.find((player) => player.id === 'red');
  const goldFromRed = redLocked.body.room.fleet.players.find((player) => player.id === 'gold');
  assert.deepEqual(redPrivate.queue, ['SONAR', 'SAIL', 'ANCHOR']);
  assert.equal('queue' in goldFromRed, false);

  const goldBefore = await post('privacy', 'state', { playerToken: gold.token });
  const redFromGold = goldBefore.body.room.fleet.players.find((player) => player.id === 'red');
  assert.equal(redFromGold.locked, true);
  assert.equal('queue' in redFromGold, false);
  assert.equal(goldBefore.body.room.fleet.resolutionLog.some((event) => event.type === 'sonar'), false);

  const resolvedForGold = await post('privacy', 'lock', {
    playerToken: gold.token,
    queue: ['STARBOARD', 'ANCHOR', 'ANCHOR'],
  });
  assert.equal(resolvedForGold.status, 200);
  assert.equal(resolvedForGold.body.room.phase, 'planning');
  assert.equal(resolvedForGold.body.room.fleet.round, 2);
  assert.equal(resolvedForGold.body.room.fleet.resolutionLog.some((event) => event.type === 'sonar'), true);
  assert.equal(resolvedForGold.body.room.fleet.resolution.beats[0].events.some((event) => event.type === 'sonar'), true);
  assert.equal(resolvedForGold.body.room.fleet.resolution.start.players.some((item) => 'queue' in item), false);
  assert.equal(resolvedForGold.body.room.fleet.players.find((player) => player.id === 'gold').intel.length, 0);

  const resolvedForRed = await post('privacy', 'state', { playerToken: red.token });
  const sonar = resolvedForRed.body.room.fleet.resolutionLog.find((event) => event.type === 'sonar');
  assert.equal(sonar.lockAcquired, true);
  assert.equal(resolvedForRed.body.room.fleet.players.find((player) => player.id === 'red').sonarLock, true);
});

test('second lock resolves once, duplicate locks reject, and rematch needs both captains', async () => {
  const { red, gold } = await joinPair('rematch');
  await post('rematch', 'start', { playerToken: red.token });

  for (let round = 1; round <= 8; round += 1) {
    const first = await post('rematch', 'queue', {
      playerToken: red.token,
      queue: ['ANCHOR', 'ANCHOR', 'ANCHOR'],
    });
    assert.equal(first.status, 200);
    const duplicate = await post('rematch', 'queue', {
      playerToken: red.token,
      queue: ['SAIL', 'SAIL', 'SAIL'],
    });
    assert.equal(duplicate.status, 409);
    const second = await post('rematch', 'queue', {
      playerToken: gold.token,
      queue: ['ANCHOR', 'ANCHOR', 'ANCHOR'],
    });
    assert.equal(second.status, 200);
    assert.equal(second.body.room.phase, round === 8 ? 'finished' : 'planning');
  }

  const redReady = await post('rematch', 'rematch', { playerToken: red.token });
  assert.equal(redReady.status, 200);
  assert.equal(redReady.body.room.phase, 'finished');
  assert.deepEqual(redReady.body.room.rematchReady, [red.id]);

  const goldReady = await post('rematch', 'rematch', { playerToken: gold.token });
  assert.equal(goldReady.status, 200);
  assert.equal(goldReady.body.room.phase, 'planning');
  assert.equal(goldReady.body.room.match, 2);
  assert.equal(goldReady.body.room.fleet.seed, 'rematch:match:2');
  assert.deepEqual(goldReady.body.room.players.map((player) => player.role), ['red', 'gold']);
  assert.equal(goldReady.body.room.players.find((player) => player.id === red.id).name, 'Ada');
});
