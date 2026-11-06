import assert from 'node:assert/strict';

const cdpOrigin = process.env.CDP_ORIGIN || 'http://127.0.0.1:9223';
const appOrigin = process.env.APP_ORIGIN || 'http://127.0.0.1:8788';
const room = `ghost-replay-${Date.now()}`;

async function createPage(url, { reducedMotion = false } = {}) {
  const target = await (await fetch(`${cdpOrigin}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => { socket.onopen = resolve; });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id) { pending.get(payload.id)?.(payload); pending.delete(payload.id); }
    else if (payload.method === 'Runtime.exceptionThrown') errors.push(payload.params.exceptionDetails.text);
    else if (payload.method === 'Runtime.consoleAPICalled' && payload.params.type === 'error') errors.push(payload.params.args.map((argument) => argument.value || argument.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((resolve) => { const id = ++nextId; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.result.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
    return response.result.result.value;
  };
  const waitFor = async (expression, label, timeout = 8_000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor(`Boolean(document.querySelector('#ghostJoinButton'))`, 'Ghost Fleet mount');
  if (reducedMotion) {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await send('Page.reload');
    await waitFor(`Boolean(document.querySelector('#ghostJoinButton'))`, 'reduced-motion Ghost Fleet mount');
  }
  return { socket, send, evaluate, waitFor, errors };
}

async function join(page, name) {
  await page.evaluate(`(()=>{document.querySelector('#ghostName').value=${JSON.stringify(name)};document.querySelector('#ghostJoinButton').click()})()`);
}

const canvasChecksum = `(()=>{const data=document.querySelector('#ghostChart').getContext('2d').getImageData(0,0,700,700).data;let value=2166136261;for(let i=0;i<data.length;i+=4){value^=data[i]^data[i+1]^data[i+2];value=Math.imul(value,16777619)}return value>>>0})()`;
const first = await createPage(`${appOrigin}/?room=${room}&game=ghost-fleet`);
const second = await createPage(`${appOrigin}/?room=${room}&game=ghost-fleet`);
await join(first, 'Replay One');
await join(second, 'Replay Two');
await first.waitFor(`document.querySelector('#ghostStatus').textContent.includes('Start the duel')`, 'both captains');
await first.evaluate(`document.querySelector('#ghostStart').click()`);
await first.waitFor(`document.querySelector('#ghostRound').textContent==='1'`, 'round one');
await second.waitFor(`document.querySelector('#ghostRound').textContent==='1'`, 'partner round one');
const initialCanvas = await first.evaluate(canvasChecksum);

for (const command of ['SAIL', 'PORT', 'BROADSIDE']) await first.evaluate(`document.querySelector('[data-command="${command}"]').click()`);
for (const command of ['SAIL', 'STARBOARD', 'BROADSIDE']) await second.evaluate(`document.querySelector('[data-command="${command}"]').click()`);
await first.evaluate(`document.querySelector('#ghostLock').click()`);
await second.evaluate(`document.querySelector('#ghostLock').click()`);
await first.send('Page.bringToFront');

await first.waitFor(`document.querySelector('#ghostReveal').dataset.state==='playing' && document.querySelector('#ghostRevealStep').textContent==='ORDER 1 / 3'`, 'order one reveal');
assert.match(await first.evaluate(`document.querySelector('#ghostRedOrder').textContent`), /SAIL/);
assert.match(await first.evaluate(`document.querySelector('#ghostGoldOrder').textContent`), /SAIL/);
assert.equal(await first.evaluate(`document.querySelector('#ghostProgram').classList.contains('reveal-locked')`), true);
await new Promise((resolve) => setTimeout(resolve, 420));
const movingCanvas = await first.evaluate(canvasChecksum);
assert.notEqual(movingCanvas, initialCanvas, 'canvas must visibly change during simultaneous movement');
await first.waitFor(`document.querySelector('#ghostRevealStep').textContent==='ORDER 2 / 3'`, 'order two reveal');
await first.waitFor(`document.querySelector('#ghostRevealStep').textContent==='ORDER 3 / 3'`, 'order three reveal');
await first.waitFor(`document.querySelector('#ghostReveal').dataset.state==='complete'`, 'reveal completion');
assert.match(await first.evaluate(`document.querySelector('#ghostLog').textContent`), /ORDER 1: SAIL vs SAIL/);
assert.equal(await first.evaluate(`document.querySelector('#ghostProgram').classList.contains('reveal-locked')`), false);

const staleRoom = `${room}-stale`;
const stale = await createPage(`${appOrigin}/?room=${staleRoom}&game=ghost-fleet`);
await stale.evaluate(`localStorage.setItem(${JSON.stringify(`ghost-fleet:${staleRoom}:player`)},JSON.stringify({id:'gone',token:'expired',name:'Old Captain',role:'red'}));location.reload()`);
await stale.waitFor(`Boolean(document.querySelector('#ghostJoinButton')) && !document.querySelector('#ghostJoin').classList.contains('hidden')`, 'stale token recovery');
assert.equal(await stale.evaluate(`localStorage.getItem(${JSON.stringify(`ghost-fleet:${staleRoom}:player`)})`), null);
assert.match(await stale.evaluate(`document.querySelector('#toast').textContent`), /expired/i);

const reducedRoom = `${room}-reduced`;
const reducedFirst = await createPage(`${appOrigin}/?room=${reducedRoom}&game=ghost-fleet`, { reducedMotion: true });
const reducedSecond = await createPage(`${appOrigin}/?room=${reducedRoom}&game=ghost-fleet`, { reducedMotion: true });
await join(reducedFirst, 'Quiet One');
await join(reducedSecond, 'Quiet Two');
await reducedFirst.waitFor(`document.querySelector('#ghostStatus').textContent.includes('Start the duel')`, 'reduced-motion captains');
await reducedFirst.evaluate(`document.querySelector('#ghostStart').click()`);
await reducedFirst.waitFor(`document.querySelector('#ghostRound').textContent==='1'`, 'reduced-motion round');
await reducedSecond.waitFor(`document.querySelector('#ghostRound').textContent==='1'`, 'reduced-motion partner round');
for (let index = 0; index < 3; index += 1) await reducedFirst.evaluate(`document.querySelector('[data-command="ANCHOR"]').click()`);
for (let index = 0; index < 3; index += 1) await reducedSecond.evaluate(`document.querySelector('[data-command="ANCHOR"]').click()`);
await reducedFirst.evaluate(`document.querySelector('#ghostLock').click()`);
await reducedSecond.evaluate(`document.querySelector('#ghostLock').click()`);
await reducedFirst.waitFor(`document.querySelector('#ghostReveal').dataset.state==='complete'`, 'reduced-motion immediate summary');
assert.match(await reducedFirst.evaluate(`document.querySelector('#ghostLog').textContent`), /ORDER 1: ANCHOR vs ANCHOR[\s\S]*ORDER 2: ANCHOR vs ANCHOR[\s\S]*ORDER 3: ANCHOR vs ANCHOR/);
assert.equal(await reducedFirst.evaluate(`document.querySelector('#ghostProgram').classList.contains('reveal-locked')`), false);

for (const page of [first, second, stale, reducedFirst, reducedSecond]) {
  assert.deepEqual(page.errors, []);
  page.socket.close();
}

console.log('Ghost Fleet browser replay passed: three deterministic board beats, control gate, canvas movement, and stale-token recovery');
