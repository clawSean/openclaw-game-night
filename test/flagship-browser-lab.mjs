import assert from 'node:assert/strict';

const cdpOrigin = process.env.CDP_ORIGIN || 'http://127.0.0.1:9223';
const appOrigin = process.env.APP_ORIGIN || 'http://127.0.0.1:8788';
const room = `flagship-${Date.now()}`;

async function createPage(url) {
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
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor(`Boolean(document.querySelector('#gameMount > *'))`, 'game mount');
  return { target, socket, send, evaluate, waitFor, errors };
}

async function join(page, input, button, name) {
  await page.evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(input)});input.value=${JSON.stringify(name)};input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector(${JSON.stringify(button)}).click()})()`);
}

const signalOne = await createPage(`${appOrigin}/?room=${room}-signal&game=signal-storm`);
const signalTwo = await createPage(`${appOrigin}/?room=${room}-signal&game=signal-storm`);
await join(signalOne, '#stormName', '#stormJoinButton', 'Captain One');
await join(signalTwo, '#stormName', '#stormJoinButton', 'Engineer Two');
await signalOne.waitFor(`document.querySelector('#stormStatus').textContent.includes('2 / 2')`, 'Signal Storm crew');
await signalOne.evaluate(`document.querySelector('#stormStart').click()`);
await signalOne.waitFor(`document.querySelector('#signalStage').dataset.phase==='active' && document.querySelector('#stormRole').textContent.includes('NAVIGATOR')`, 'Navigator role');
await signalTwo.waitFor(`document.querySelector('#signalStage').dataset.phase==='active' && document.querySelector('#stormRole').textContent.includes('ENGINEER')`, 'Engineer role');
assert.match(await signalOne.evaluate(`document.querySelector('#stormClue').textContent`), /SHIELDS/);
assert.match(await signalTwo.evaluate(`document.querySelector('#stormClue').textContent`), /LEFT/);
await signalOne.evaluate(`document.querySelector('[data-storm-action="LEFT"]').click()`);
await signalTwo.evaluate(`document.querySelector('[data-storm-action="SHIELDS"]').click()`);
await signalOne.evaluate(`document.querySelector('#stormConfirm').click()`);
await signalTwo.evaluate(`document.querySelector('#stormConfirm').click()`);
await signalOne.waitFor(`document.querySelector('#signalStage').dataset.phase==='resolved'`, 'Signal Storm resolution');
await signalTwo.waitFor(`document.querySelector('#signalStage').dataset.phase==='resolved'`, 'Signal Storm partner resolution');
assert.match(await signalOne.evaluate(`document.querySelector('#stormStatus').textContent`), /left channel/i);
assert.match(await signalOne.evaluate(`document.querySelector('#stormTutorial').textContent`), /CAUSE REPLAY/);
await signalOne.evaluate(`document.querySelector('#stormAck').click()`);
await signalTwo.evaluate(`document.querySelector('#stormAck').click()`);
await signalOne.waitFor(`document.querySelector('#stormStage').textContent.startsWith('2')`, 'Signal Storm mutual replay acknowledgement');
assert.equal(await signalOne.evaluate(`document.documentElement.scrollWidth`), 390);
assert.equal(await signalTwo.evaluate(`document.documentElement.scrollWidth`), 390);

const ghostOne = await createPage(`${appOrigin}/?room=${room}-ghost&game=ghost-fleet`);
const ghostTwo = await createPage(`${appOrigin}/?room=${room}-ghost&game=ghost-fleet`);
await join(ghostOne, '#ghostName', '#ghostJoinButton', 'Admiral One');
await join(ghostTwo, '#ghostName', '#ghostJoinButton', 'Admiral Two');
await ghostOne.waitFor(`document.querySelector('#ghostStatus').textContent.includes('Start the duel')`, 'Ghost Fleet captains');
await ghostOne.evaluate(`document.querySelector('#ghostStart').click()`);
await ghostOne.waitFor(`document.querySelector('#ghostRound').textContent==='1'`, 'Ghost Fleet round one');
await ghostTwo.waitFor(`document.querySelector('#ghostRound').textContent==='1'`, 'Ghost Fleet partner round one');
for (const command of ['SAIL', 'PORT', 'BROADSIDE']) await ghostOne.evaluate(`document.querySelector('[data-command="${command}"]').click()`);
for (const command of ['SAIL', 'STARBOARD', 'BROADSIDE']) await ghostTwo.evaluate(`document.querySelector('[data-command="${command}"]').click()`);
await ghostOne.evaluate(`document.querySelector('#ghostLock').click()`);
await ghostOne.waitFor(`document.querySelector('#ghostLock').textContent.toLowerCase().includes('locked')`, 'first Ghost Fleet lock');
await ghostTwo.evaluate(`document.querySelector('#ghostLock').click()`);
await ghostOne.waitFor(`document.querySelector('#ghostRound').textContent==='2'`, 'simultaneous Ghost Fleet resolution');
await ghostTwo.waitFor(`document.querySelector('#ghostRound').textContent==='2'`, 'partner Ghost Fleet resolution');
await ghostOne.waitFor(`document.querySelector('#ghostReveal').dataset.state==='playing' && document.querySelector('#ghostRevealStep').textContent.includes('ORDER')`, 'Ghost Fleet board reveal');
assert.match(await ghostOne.evaluate(`document.querySelector('#ghostRedOrder').textContent`), /RED · .*SAIL/);
assert.match(await ghostOne.evaluate(`document.querySelector('#ghostGoldOrder').textContent`), /GOLD · .*SAIL/);
assert.equal(await ghostOne.evaluate(`document.querySelector('#ghostProgram').classList.contains('reveal-locked')`), true);
await ghostOne.waitFor(`document.querySelectorAll('#ghostLog li').length>0`, 'Ghost Fleet reveal log');
await ghostTwo.waitFor(`document.querySelectorAll('#ghostLog li').length>0`, 'partner Ghost Fleet reveal log');
assert.match(await ghostOne.evaluate(`document.querySelector('#ghostLog').textContent`), /ORDER 1/);
await ghostOne.waitFor(`document.querySelector('#ghostReveal').dataset.state==='complete'`, 'Ghost Fleet three-beat reveal complete', 8_000);
assert.match(await ghostOne.evaluate(`document.querySelector('#ghostRevealStep').textContent`), /THREE ORDERS RESOLVED/);
assert.equal(await ghostOne.evaluate(`document.querySelector('#ghostProgram').classList.contains('reveal-locked')`), false);
assert.equal(await ghostOne.evaluate(`document.documentElement.scrollWidth`), 390);
assert.equal(await ghostTwo.evaluate(`document.documentElement.scrollWidth`), 390);

for (const page of [signalOne, signalTwo, ghostOne, ghostTwo]) {
  assert.deepEqual(page.errors, []);
  page.socket.close();
}

console.log('flagship browser lab passed: Signal Storm two-role co-op and Ghost Fleet simultaneous duel across four mobile browser tabs');
