import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSignalStorm, resetSignalStormForTests } from '../server/games/signal-storm.js';

function request(body = {}) {
  const payload = Buffer.from(JSON.stringify(body));
  return {
    method: 'POST',
    async *[Symbol.asyncIterator]() { yield payload; },
  };
}

async function call(roomId, action, body = {}) {
  let result;
  await handleSignalStorm({
    req: request(body),
    roomId,
    action,
    readJson: async (req) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    },
    json: (status, data) => { result = { status, data }; },
  });
  return result;
}

test.beforeEach(() => resetSignalStormForTests());

test('Signal Storm gives each role a different private clue and action panel', async () => {
  const nav = await call('crew-a', 'join', { name: 'Nav' });
  const engineer = await call('crew-a', 'join', { name: 'Eng' });
  assert.equal(nav.data.player.role, 'navigator');
  assert.equal(engineer.data.player.role, 'engineer');

  const started = await call('crew-a', 'start', { playerToken: nav.data.player.token });
  const engineerState = await call('crew-a', 'state', { playerToken: engineer.data.player.token });
  assert.match(started.data.room.crisis.clue, /SHIELDS/);
  assert.match(engineerState.data.room.crisis.clue, /LEFT/);
  assert.deepEqual(started.data.room.actions, ['LEFT', 'CENTER', 'RIGHT', 'DARK', 'RISE', 'SURFACE']);
  assert.deepEqual(engineerState.data.room.actions, ['SHIELDS', 'ENGINE', 'SONAR', 'COOLANT', 'BALLAST']);
  assert.equal(started.data.room.crisis.system, undefined);
  assert.equal(engineerState.data.room.crisis.route, undefined);
});

test('Signal Storm resolves only after both players lock and explains the outcome', async () => {
  const nav = (await call('crew-b', 'join', { name: 'Nav' })).data.player;
  const engineer = (await call('crew-b', 'join', { name: 'Eng' })).data.player;
  await call('crew-b', 'start', { playerToken: nav.token });

  const first = await call('crew-b', 'act', { playerToken: nav.token, choice: 'LEFT' });
  assert.equal(first.data.room.phase, 'active');
  assert.equal(first.data.room.submitted, true);
  assert.equal(first.data.room.teammateSubmitted, false);

  const second = await call('crew-b', 'act', { playerToken: engineer.token, choice: 'SHIELDS' });
  assert.equal(second.data.room.phase, 'resolved');
  assert.equal(second.data.room.outcome.won, true);
  assert.match(second.data.room.outcome.message, /left channel/i);
  assert.equal(second.data.room.hull, 3);
});

test('Signal Storm rejects duplicate choices and preserves causal failure text', async () => {
  const nav = (await call('crew-c', 'join', { name: 'Nav' })).data.player;
  const engineer = (await call('crew-c', 'join', { name: 'Eng' })).data.player;
  await call('crew-c', 'start', { playerToken: nav.token });
  await call('crew-c', 'act', { playerToken: nav.token, choice: 'RIGHT' });
  const duplicate = await call('crew-c', 'act', { playerToken: nav.token, choice: 'LEFT' });
  assert.equal(duplicate.status, 409);
  const result = await call('crew-c', 'act', { playerToken: engineer.token, choice: 'ENGINE' });
  assert.equal(result.data.room.outcome.won, false);
  assert.match(result.data.room.outcome.message, /Needed LEFT \+ SHIELDS/);
  assert.equal(result.data.room.hull, 2);
});

test('Signal Storm waits for both replay acknowledgements and prevents unilateral finished-state restarts', async () => {
  const nav = (await call('crew-d', 'join', { name: 'Nav' })).data.player;
  const engineer = (await call('crew-d', 'join', { name: 'Eng' })).data.player;
  await call('crew-d', 'start', { playerToken: nav.token });
  await call('crew-d', 'act', { playerToken: nav.token, choice: 'LEFT' });
  await call('crew-d', 'act', { playerToken: engineer.token, choice: 'SHIELDS' });

  const firstAck = await call('crew-d', 'ack', { playerToken: nav.token });
  assert.equal(firstAck.data.room.phase, 'resolved');
  assert.equal(firstAck.data.room.acknowledged, true);
  assert.equal(firstAck.data.room.teammateAcknowledged, false);

  const secondAck = await call('crew-d', 'ack', { playerToken: engineer.token });
  assert.equal(secondAck.data.room.phase, 'active');
  assert.equal(secondAck.data.room.stage, 2);

  const restart = await call('crew-d', 'start', { playerToken: nav.token });
  assert.equal(restart.status, 409);
});
