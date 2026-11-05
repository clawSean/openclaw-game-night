import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expectedSequence,
  echoWakeStep,
  generateDeducibleBoard,
  hashSeed,
  reefClusters,
  reflectPearl,
  seededRandom,
  shiftReef,
  solveBoard,
  tideActionMatches,
  winningCells,
} from '../public/game-core.js';

test('seeded random streams are stable and distinct', () => {
  const first = seededRandom('clawcade');
  const second = seededRandom('clawcade');
  const other = seededRandom('other');
  const a = Array.from({ length: 8 }, first);
  assert.deepEqual(a, Array.from({ length: 8 }, second));
  assert.notDeepEqual(a, Array.from({ length: 8 }, other));
  assert.equal(hashSeed('clawcade'), hashSeed('clawcade'));
});

test('generated mine boards are safe, deterministic, and solver verified', () => {
  for (const config of [
    { size: 5, mineCount: 4, first: 12 },
    { size: 6, mineCount: 7, first: 14 },
    { size: 7, mineCount: 10, first: 24 },
  ]) {
    const one = generateDeducibleBoard({ ...config, seed: `depth-${config.size}` });
    const two = generateDeducibleBoard({ ...config, seed: `depth-${config.size}` });
    assert.deepEqual([...one.mines], [...two.mines]);
    assert.equal(one.mines.size, config.mineCount);
    assert.equal(one.mines.has(config.first), false);
    assert.equal(solveBoard({ ...config, mines: one.mines }).solved, true);
    assert.ok(one.opening <= Math.floor((config.size * config.size - config.mineCount) * .7));
  }
});

test('sequence transforms stay bounded and legible', () => {
  const sequence = [0, 3, 1, 2];
  assert.deepEqual(expectedSequence(sequence, 'normal'), [0, 3, 1, 2]);
  assert.deepEqual(expectedSequence(sequence, 'reverse'), [2, 1, 3, 0]);
  assert.deepEqual(sequence, [0, 3, 1, 2]);
});

test('tide actions require the intended input', () => {
  for (const action of ['tap', 'hold', 'wait']) {
    assert.equal(tideActionMatches(action, action), true);
  }
  assert.equal(tideActionMatches('hold', 'tap'), false);
  assert.equal(tideActionMatches('wait', 'tap'), false);
});

test('echo wakes advance visibly and erupt on the promised turn', () => {
  let state = { position: 24, wakes: [], pearls: [25], rocks: [] };
  state = echoWakeStep(state, [3, 4]);
  assert.equal(state.collected, true);
  assert.deepEqual(state.wakes, [{ cell: 24, turns: 3 }]);
  state = echoWakeStep(state, [2, 4]);
  state = echoWakeStep(state, [2, 3]);
  state = echoWakeStep(state, [3, 3]);
  assert.equal(state.hit, true);
  assert.deepEqual(state.erupted, [24]);
});

test('reef shifts wrap whole lines and clusters remain orthogonal', () => {
  const board = [0, 1, 2, 3, 1, 1, 2, 3, 0, 2, 2, 3, 0, 1, 0, 3];
  assert.deepEqual(shiftReef(board, 4, 'row', 0, 1).slice(0, 4), [3, 0, 1, 2]);
  assert.deepEqual(shiftReef(board, 4, 'column', 0, -1).filter((_, i) => i % 4 === 0), [1, 0, 0, 0]);
  assert.deepEqual(reefClusters([0, 0, 1, 2, 0, 3, 1, 2, 3, 3, 3, 2, 1, 1, 2, 2], 4).map((group) => group.length).sort(), [3, 4, 5]);
});

test('pearl reflections are deterministic at every wall', () => {
  assert.deepEqual(reflectPearl({ x: 95, y: 50, vx: 10, vy: 0 }, 100, 100, 5), { x: 95, y: 50, vx: -10, vy: 0 });
  assert.deepEqual(reflectPearl({ x: 50, y: 4, vx: 0, vy: -3 }, 100, 100, 5), { x: 50, y: 5, vx: 0, vy: 3 });
});

test('winning cells finds horizontal, vertical, and diagonal lines', () => {
  const empty = () => Array.from({ length: 6 }, () => Array(7).fill(null));
  const horizontal = empty();
  for (let column = 1; column <= 4; column += 1) horizontal[5][column] = 'R';
  assert.deepEqual(winningCells(horizontal, 5, 4, 'R'), [[5, 1], [5, 2], [5, 3], [5, 4]]);
  const vertical = empty();
  for (let row = 2; row <= 5; row += 1) vertical[row][3] = 'Y';
  assert.deepEqual(winningCells(vertical, 2, 3, 'Y'), [[2, 3], [3, 3], [4, 3], [5, 3]]);
  const diagonal = empty();
  diagonal[5][0] = diagonal[4][1] = diagonal[3][2] = diagonal[2][3] = 'R';
  assert.deepEqual(winningCells(diagonal, 2, 3, 'R'), [[2, 3], [3, 2], [4, 1], [5, 0]]);
});
