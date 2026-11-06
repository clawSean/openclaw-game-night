import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PANIC_GESTURES,
  dragOffset,
  leviathanPhase,
  timerPresentation,
} from '../public/games/panic-directors-cut.js';

test('Director Cut teaches every supported gesture before first play', () => {
  assert.deepEqual(PANIC_GESTURES, ['tap', 'hold', 'wait', 'drag']);
});

test('drag offsets stay anchored to the immutable pointer-down origin', () => {
  const origin = Object.freeze({ x: 120, y: 240 });
  assert.deepEqual(dragOffset(origin, { x: 145, y: 210 }), { x: 25, y: -30 });
  assert.deepEqual(dragOffset(origin, { x: 160, y: 260 }), { x: 40, y: 20 });
  assert.deepEqual(origin, { x: 120, y: 240 });
});

test('reduced motion timer is discrete while ordinary timer remains proportional', () => {
  assert.deepEqual(timerPresentation(1_500, 3_000, false), { scale: 0.5, label: '2 sec' });
  assert.deepEqual(timerPresentation(1_500, 3_000, true), { scale: 1, label: '2 sec' });
  assert.deepEqual(timerPresentation(0, 3_000, true), { scale: 0, label: '0 sec' });
});

test('leviathan finale exposes three distinct readable telegraphs', () => {
  assert.deepEqual([1, 2, 3].map((phase) => leviathanPhase(phase)?.label), [
    'EYE SEARCH',
    'TENTACLE CRUSH',
    'HULL BREACH',
  ]);
  assert.equal(leviathanPhase(4), null);
});

test('quality repair keeps pause, failure, label, and effect hooks in the shipped module', async () => {
  const source = await readFile(new URL('../public/games/panic-directors-cut.js', import.meta.url), 'utf8');
  assert.match(source, /visibilitychange/);
  assert.match(source, /Final miss:/);
  assert.match(source, /Blue diamond valve/);
  assert.match(source, /fx\.particles/);
  assert.match(source, /pdc-boss-track/);
});
