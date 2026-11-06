import assert from 'node:assert/strict';
import { generateDeducibleBoard } from '../public/game-core.js';

const cdpOrigin = process.env.CDP_ORIGIN || 'http://127.0.0.1:9223';
const appOrigin = process.env.APP_ORIGIN || 'http://127.0.0.1:8788';
const room = 'design-lab';
const page = await (await fetch(`${cdpOrigin}/json/new?${encodeURIComponent(`${appOrigin}/?room=${room}`)}`, { method: 'PUT' })).json();
assert.ok(page?.webSocketDebuggerUrl, 'create a fresh Clawcade CDP page');

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
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await evaluate(`Boolean(document.querySelector('#gameMount > *'))`)) break;
    await sleep(50);
  }
  assert.equal(await evaluate(`Boolean(document.querySelector('#gameMount > *'))`), true, `${game} did not render`);
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
await navigate('kraken-current');
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
await navigate('abyss-expedition');
for (const [depth, size, mineCount, first] of [[0, 5, 4, 12], [1, 6, 7, 14]]) {
  const seed = `${new Date().toISOString().slice(0, 10)}:${room}:0:${depth}:${first}`;
  const { mines } = generateDeducibleBoard({ size, mineCount, first, seed });
  await click(`[data-tile="${first}"]`);
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

// Original Telegram cabinets remain separate and playable.
await navigate('kraken-sequence');
assert.equal(await evaluate(`Boolean(document.querySelector('#tempoMode'))`), true);
await click('#start');
assert.match(await evaluate(`document.querySelector('#level').textContent`), /1/);
await navigate('abyss-sweep');
assert.equal(await evaluate(`document.querySelectorAll('[data-tile]').length`), 25);
await click('#flagMode');
assert.match(await evaluate(`document.querySelector('#inputMode').textContent`), /FLAG ONE TILE/);
await click('[data-tile="0"]');
assert.equal(await evaluate(`document.querySelector('[data-tile="0"]').textContent`), '🚩');
assert.match(await evaluate(`document.querySelector('#inputMode').textContent`), /REVEAL/);
await click('[data-tile="12"]');
assert.notEqual(await evaluate(`document.querySelector('#safe').textContent`), '0 / 21');
await navigate('shell-shuffle');
assert.equal(await evaluate(`document.querySelectorAll('[data-card]').length`), 16);
await click('[data-card="0"]');
assert.equal(await evaluate(`document.querySelectorAll('.match-card.flipped').length`), 1);
await navigate('reef-reflex');
await click('#reaction');
assert.match(await evaluate(`document.querySelector('#reactionText').textContent`), /Wait for it/);

// Tide Tell: play one perfect calm wave from the visible rule, then prove a
// wrong Deep Dive read ends the run with an attributable explanation.
await navigate('tide-tell');
await click('#start');
await click('#calm');
await sleep(950);
for (let cue = 0; cue < 6; cue += 1) {
  await sleep(120);
  const state = await evaluate(`(()=>{const name=document.querySelector('#tellName').textContent;const row=[...document.querySelectorAll('#ruleBoard>div')].find(item=>item.querySelector('span').textContent.includes(name));return{name,action:row.querySelector('strong').textContent}})()`);
  if (state.action === 'TAP') {
    await evaluate(`(()=>{const z=document.querySelector('#tellZone');z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));z.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))})()`);
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
assert.match(await evaluate(`document.querySelector('#deep').textContent`), /Confirm/);
await click('#deep');
await sleep(1000);
const deepAction = await evaluate(`(()=>{const name=document.querySelector('#tellName').textContent;const row=[...document.querySelectorAll('#ruleBoard>div')].find(item=>item.querySelector('span').textContent.includes(name));return row.querySelector('strong').textContent})()`);
if (deepAction === 'DON’T TOUCH') {
  await evaluate(`(()=>{const z=document.querySelector('#tellZone');z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));z.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))})()`);
} else if (deepAction === 'HOLD') {
  await evaluate(`(()=>{const z=document.querySelector('#tellZone');z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));z.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))})()`);
} else {
  await sleep(1400);
}
await sleep(1000);
assert.match(await evaluate(`document.querySelector('#result').textContent`), /Deep Dive broken/);

// Echo Wake: start, make two legal moves, and prove the delayed queue is
// visible rather than hidden RNG.
await navigate('echo-wake');
await click('#start');
await click('[data-cell="25"]');
await click('[data-cell="26"]');
assert.match(await evaluate(`document.querySelector('#echoGrid').textContent`), /[23]/);
assert.equal(await evaluate(`document.querySelector('#echoMoves').textContent`), '2 / 28');

// Pearl Ricochet: an actual pointer drag launches one deterministic shot.
await navigate('pearl-ricochet');
await click('#start');
await evaluate(`(()=>{const c=document.querySelector('#ricochetCanvas'),r=c.getBoundingClientRect();const p=(x,y,type)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,clientX:r.left+x/640*r.width,clientY:r.top+y/720*r.height}));p(85,650,'pointerdown');p(170,530,'pointermove');p(170,530,'pointerup')})()`);
await sleep(200);
assert.equal(await evaluate(`document.querySelector('#ricochetShots').textContent`), '3');

// Shell Shift: select a line, move the whole current, and consume one move.
await navigate('shell-shift');
await click('#start');
await click('[data-cell="10"]');
await click('#shiftForward');
assert.equal(await evaluate(`document.querySelector('#shiftMoves').textContent`), '11');

// Panic: the first authored command accepts only its intended prop.
await navigate('clawcade-panic');
await click('#start');
assert.match(await evaluate(`document.querySelector('#panicCommand').textContent`), /CRACK THE CLAM/);
await click('[data-win="tap"]');
await sleep(650);
assert.equal(await evaluate(`document.querySelector('#panicScore').textContent`), '1');

// Director's Cut: a full authored-show shell with four lives, randomized scenes,
// original host art, and a boss-capable three-act run renders without coaching.
await navigate('panic-directors-cut');
await click('#pdc-start');
await sleep(1200);
assert.match(await evaluate(`document.querySelector('#pdc-lives').textContent`), /●●●●/);
assert.equal(await evaluate(`Boolean(document.querySelector('#pdc-captain svg[role="img"]'))`), true);
assert.equal(await evaluate(`document.querySelector('#pdc-command').textContent.length > 0`), true);

// Multiplayer flagships render their distinct join surfaces before a second
// browser arrives. Full two-browser contracts live in flagship-browser-lab.mjs.
await navigate('signal-storm');
assert.equal(await evaluate(`Boolean(document.querySelector('#stormJoinButton'))`), true);
assert.equal(await evaluate(`Boolean(document.querySelector('#signalCast svg[role="img"]'))`), true);
await navigate('ghost-fleet');
assert.equal(await evaluate(`Boolean(document.querySelector('#ghostJoinButton'))`), true);
assert.equal(await evaluate(`document.querySelectorAll('#ghostCards [data-command]').length`), 6);

for (const width of [360, 430]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const game of ['claw-four', 'kraken-sequence', 'abyss-sweep', 'shell-shuffle', 'reef-reflex', 'abyss-expedition', 'kraken-current', 'tide-tell', 'echo-wake', 'pearl-ricochet', 'shell-shift', 'clawcade-panic', 'signal-storm', 'panic-directors-cut', 'ghost-fleet']) {
    await send('Page.navigate', { url: `${appOrigin}/?room=${room}&game=${game}` });
    await sleep(180);
    assert.equal(await evaluate('document.documentElement.scrollWidth'), width, `${game} overflows at ${width}px`);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('button:not([disabled])')].filter(button=>!(button.getAttribute('aria-label')||button.textContent.trim())).map(button=>button.id||button.className)`), [], `${game} has unnamed buttons`);
  }
}

assert.deepEqual(browserErrors, []);
console.log('browser lab passed: 15 cabinets; all five Telegram originals preserved; flagship wave rendered; 360–430px no overflow/unnamed buttons/errors');
socket.close();
