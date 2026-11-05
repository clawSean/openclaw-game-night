import assert from 'node:assert/strict';
import { generateDeducibleBoard } from '../public/game-core.js';

const cdpOrigin = process.env.CDP_ORIGIN || 'http://127.0.0.1:9223';
const appOrigin = process.env.APP_ORIGIN || 'http://127.0.0.1:8788';
const room = 'design-lab';
const pages = await (await fetch(`${cdpOrigin}/json/list`)).json();
const page = pages.find((candidate) => candidate.type === 'page' && candidate.url.includes('8788'));
assert.ok(page, 'open the local Clawcade page in a CDP-enabled browser first');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => { socket.onopen = resolve; });
let nextId = 0;
const pending = new Map();
const browserErrors = [];
socket.onmessage = (message) => {
  const payload = JSON.parse(message.data);
  if (payload.id) {
    pending.get(payload.id)?.(payload);
    pending.delete(payload.id);
  } else if (payload.method === 'Runtime.exceptionThrown') {
    browserErrors.push(payload.params.exceptionDetails.text);
  } else if (payload.method === 'Runtime.consoleAPICalled' && payload.params.type === 'error') {
    browserErrors.push(payload.params.args.map((argument) => argument.value || argument.description).join(' '));
  }
};

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
}
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.result.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
  return response.result.result.value;
}
async function navigate(game) {
  await send('Page.navigate', { url: `${appOrigin}/?room=${room}&game=${game}` });
  await sleep(250);
  assert.equal(await evaluate('document.documentElement.scrollWidth'), 390, `${game} must not overflow`);
}
async function click(selector) {
  let found = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    found = await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    if (found) break;
    await sleep(50);
  }
  assert.equal(found, true, `missing ${selector}`);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
}

await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

// Kraken: complete Normal, Reverse, and one scored trial from observed cues.
await navigate('kraken-sequence');
await click('#start');
for (let trial = 0; trial < 3; trial += 1) {
  await evaluate(`window.__krakenCues=[];window.__krakenObserver=new MutationObserver(ms=>ms.forEach(m=>{if(m.target.classList.contains('lit'))window.__krakenCues.push(Number(m.target.dataset.pad))}));document.querySelectorAll('[data-pad]').forEach(p=>window.__krakenObserver.observe(p,{attributes:true,attributeFilter:['class']}))`);
  await sleep(3000);
  const { cues, mode } = await evaluate(`window.__krakenObserver.disconnect();({cues:window.__krakenCues.slice(0,4),mode:document.querySelector('#mode').textContent.toLowerCase()})`);
  assert.equal(cues.length, 4);
  const answer = mode === 'reverse' ? [...cues].reverse() : cues;
  for (const pad of answer) {
    await evaluate(`document.querySelector('[data-pad="${pad}"]').click()`);
    await sleep(80);
  }
  await sleep(1000);
}
assert.equal(await evaluate(`document.querySelector('#lives').textContent`), '3');

// Abyss: deterministically clear two solver-verified depths, then surface.
await navigate('abyss-sweep');
for (const [depth, size, mineCount, first] of [[0, 5, 4, 12], [1, 6, 7, 14]]) {
  const seed = `${new Date().toISOString().slice(0, 10)}:${room}:0:${depth}:${first}`;
  const { mines } = generateDeducibleBoard({ size, mineCount, first, seed });
  await evaluate(`document.querySelector('[data-tile="${first}"]').click()`);
  for (let cell = 0; cell < size * size; cell += 1) {
    if (!mines.has(cell) && cell !== first) await evaluate(`document.querySelector('[data-tile="${cell}"]')?.click()`);
  }
  await sleep(120);
  if (depth === 0) {
    assert.equal(await evaluate(`Boolean(document.querySelector('#descend'))`), true);
    await click('#descend');
  }
}
assert.equal(await evaluate(`Boolean(document.querySelector('#surface'))`), true);
await click('#surface');
assert.match(await evaluate(`document.querySelector('#result').textContent`), /Depth banked/);

// Tide Tell: play one perfect calm wave from the visible rule, then prove a
// wrong Deep Dive read ends the run with an attributable explanation.
await navigate('tide-tell');
await click('#start');
await click('#calm');
for (let cue = 0; cue < 6; cue += 1) {
  await sleep(120);
  const state = await evaluate(`(()=>{const name=document.querySelector('#tellName').textContent;const row=[...document.querySelectorAll('#ruleBoard>div')].find(item=>item.querySelector('span').textContent.includes(name));return{name,action:row.querySelector('strong').textContent}})()`);
  if (state.action === 'TAP') {
    await evaluate(`const z=document.querySelector('#tellZone');z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));z.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))`);
    await sleep(450);
  } else if (state.action === 'HOLD') {
    await evaluate(`document.querySelector('#tellZone').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);
    await sleep(520);
    await evaluate(`document.querySelector('#tellZone').dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))`);
    await sleep(450);
  } else {
    await sleep(1900);
    await sleep(450);
  }
}
assert.equal(await evaluate(`Boolean(document.querySelector('#deep'))`), true);
await click('#deep');
await sleep(150);
const deepAction = await evaluate(`(()=>{const name=document.querySelector('#tellName').textContent;const row=[...document.querySelectorAll('#ruleBoard>div')].find(item=>item.querySelector('span').textContent.includes(name));return row.querySelector('strong').textContent})()`);
if (deepAction === 'DON’T TOUCH') {
  await evaluate(`const z=document.querySelector('#tellZone');z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));z.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))`);
} else if (deepAction === 'HOLD') {
  await evaluate(`const z=document.querySelector('#tellZone');z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));z.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))`);
} else {
  await sleep(1400);
}
await sleep(1000);
assert.match(await evaluate(`document.querySelector('#result').textContent`), /Deep Dive broken/);

for (const width of [360, 430]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const game of ['claw-four', 'abyss-sweep', 'kraken-sequence', 'tide-tell']) {
    await send('Page.navigate', { url: `${appOrigin}/?room=${room}&game=${game}` });
    await sleep(180);
    assert.equal(await evaluate('document.documentElement.scrollWidth'), width, `${game} overflows at ${width}px`);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('button:not([disabled])')].filter(button=>!(button.getAttribute('aria-label')||button.textContent.trim())).map(button=>button.id||button.className)`), [], `${game} has unnamed buttons`);
  }
}

assert.deepEqual(browserErrors, []);
console.log('browser lab passed: Kraken 3 trials; Abyss 2 depths + surface; Tide calm clear + deep failure; Claw/API set contract; 360–430px no overflow/unnamed buttons/errors');
socket.close();
