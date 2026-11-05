import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 8799;
const origin = `http://127.0.0.1:${port}`;
let server;

async function request(path, body) {
  const response = await fetch(`${origin}${path}`, body === undefined ? {} : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

test.before(async () => {
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${origin}/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('test server did not start');
});

test.after(() => server?.kill('SIGTERM'));

test('Claw Four protects identity and requires mutual rematch consent', async () => {
  const one = await request('/api/rooms/test-set/join', { name: 'Red' });
  const two = await request('/api/rooms/test-set/join', { name: 'Gold' });
  assert.equal(one.status, 200);
  assert.equal(two.status, 200);
  assert.ok(one.json.player.token);
  assert.equal(JSON.stringify(two.json.room).includes(one.json.player.token), false);

  const collision = await request('/api/rooms/test-set/join', { name: 'Red' });
  assert.equal(collision.status, 409);

  const red = one.json.player.token;
  const gold = two.json.player.token;
  const moves = [
    [red, 0], [gold, 0], [red, 1], [gold, 1],
    [red, 2], [gold, 2], [red, 3],
  ];
  let room;
  for (const [playerToken, column] of moves) {
    ({ json: { room } } = await request('/api/rooms/test-set/move', { playerToken, column }));
  }
  assert.equal(room.status, 'finished');
  assert.equal(room.players[0].wins, 1);
  assert.equal(room.winningCells.length, 4);

  const firstReady = await request('/api/rooms/test-set/rematch', { playerToken: red });
  assert.equal(firstReady.json.room.status, 'finished');
  assert.equal(firstReady.json.room.rematchReady.length, 1);
  const secondReady = await request('/api/rooms/test-set/rematch', { playerToken: gold });
  assert.equal(secondReady.json.room.status, 'active');
  assert.equal(secondReady.json.room.round, 2);
  assert.equal(secondReady.json.room.currentPlayer.name, 'Gold');

  const setMoves = [
    [gold, 6], [red, 0], [gold, 6], [red, 1],
    [gold, 5], [red, 2], [gold, 5], [red, 3],
  ];
  for (const [playerToken, column] of setMoves) {
    ({ json: { room } } = await request('/api/rooms/test-set/move', { playerToken, column }));
  }
  assert.equal(room.status, 'set-finished');
  assert.equal(room.setWinner.name, 'Red');
  assert.deepEqual(room.players.map((player) => player.wins), [2, 0]);

  await request('/api/rooms/test-set/rematch', { playerToken: gold });
  const newSet = await request('/api/rooms/test-set/rematch', { playerToken: red });
  assert.equal(newSet.json.room.status, 'active');
  assert.equal(newSet.json.room.round, 1);
  assert.deepEqual(newSet.json.room.players.map((player) => player.wins), [0, 0]);

  const forbiddenReset = await request('/api/rooms/test-set/reset', {});
  assert.equal(forbiddenReset.status, 403);
  const reset = await request('/api/rooms/test-set/reset', { playerToken: red });
  assert.equal(reset.status, 200);
  assert.equal(reset.json.room.players.length, 0);
});
