import { COMMANDS } from './ghost-fleet-core.js';
import { admiralBrine } from '../runtime/characters.js';

const commandLabels = {
  PORT: ['↶', 'Turn port'],
  STARBOARD: ['↷', 'Turn starboard'],
  SAIL: ['↑', 'Sail one'],
  BROADSIDE: ['✹', 'Fire broadside'],
  SONAR: ['◉', 'Paint rival; next broadside reaches farther'],
  ANCHOR: ['⚓', 'Hold position'],
};

export function mountGhostFleet(ctx) {
  const { mount, shell, roomId, note, track, vibrate, beep } = ctx;
  shell('☠', 'SIMULTANEOUS STRATEGY / 2 PLAYERS', 'Secretly write three orders. Both fleets execute together. Predict the rival, steal three relics, or sink them first.', `<div class="room-strip">ROOM <strong id="ghostRoom"></strong><button id="ghostShare" class="text-button">Share ↗</button></div><div class="ghost-header"><div id="ghostPortrait" class="ghost-portrait"></div><div><p id="ghostRole">JOIN THE FLEET</p><strong id="ghostMatch">Haunted chart sealed</strong></div></div><div class="scorebar"><span>ROUND <strong id="ghostRound">—</strong></span><span>HULL <strong id="ghostHull">—</strong></span><span>RELICS <strong id="ghostRelics">—</strong></span><span>RIVAL <strong id="ghostRival">—</strong></span></div><div class="ghost-chart-wrap"><canvas id="ghostChart" width="700" height="700" aria-label="Ghost Fleet haunted chart"></canvas><div id="ghostImpact" class="ghost-impact" aria-hidden="true"></div></div><div class="ghost-legend"><span>▲ reef</span><span>● relic</span><span>▶ ship bow</span><span>✹ broadside fires sideways</span></div><p id="ghostBoardSummary" class="sr-only" aria-live="polite"></p><div class="ghost-program" id="ghostProgram"><p>YOUR THREE ORDERS</p><div class="ghost-slots" id="ghostSlots"></div><div class="ghost-cards" id="ghostCards"></div><button class="primary-action" id="ghostLock" disabled>Lock program</button></div><p class="game-status" id="ghostStatus">Loading the haunted chart…</p><ol class="ghost-log" id="ghostLog" aria-label="Last simultaneous resolution"></ol><div id="ghostResult"></div><div id="ghostJoin"><label for="ghostName">Captain name</label><div class="join-row"><input id="ghostName" maxlength="24" placeholder="Admiral Brine"><button id="ghostJoinButton" class="primary-action">Join</button></div></div>`);
  const $ = (selector) => mount.querySelector(selector);
  $('.scorebar').insertAdjacentHTML('afterend', `<div id="ghostReveal" class="ghost-reveal" data-state="idle" aria-live="polite"><span id="ghostRevealStep">PROGRAM SEALED</span><div><strong id="ghostRedOrder">RED · ?</strong><b>VS</b><strong id="ghostGoldOrder">GOLD · ?</strong></div></div>`);
  $('#ghostRoom').textContent = roomId;
  const canvas = $('#ghostChart');
  const context = canvas.getContext('2d');
  let player;
  try { player = JSON.parse(localStorage.getItem(`ghost-fleet:${roomId}:player`) || 'null'); } catch { player = null; }
  let room = null;
  let queue = [];
  let alive = true;
  let busy = false;
  let poll = null;
  let revealTimers = [];
  let animatedKey = '';
  let renderedRound = 0;
  let playbackFleet = null;
  let revealFrame = null;
  let revealFrameHandle = null;
  let revealing = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const api = async (action, body = {}) => {
    const response = await fetch(`/api/games/ghost-fleet/rooms/${encodeURIComponent(roomId)}/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'The fog swallowed the signal'); error.status = response.status; throw error; }
    return data;
  };
  const savePlayer = (next) => { player = next; if (next) localStorage.setItem(`ghost-fleet:${roomId}:player`, JSON.stringify(next)); else localStorage.removeItem(`ghost-fleet:${roomId}:player`); };
  const me = () => room?.fleet?.players.find((item) => item.id === room.you?.role);
  const rival = () => room?.fleet?.players.find((item) => item.id !== room.you?.role);

  function drawChart(fleet = playbackFleet || room?.fleet, effects = revealFrame?.events || []) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#294b5a'); gradient.addColorStop(1, '#071926');
    context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#b7e6d12b'; context.lineWidth = 2;
    const size = fleet?.size || 7, cell = canvas.width / size;
    for (let line = 0; line <= size; line += 1) { context.beginPath(); context.moveTo(line * cell, 0); context.lineTo(line * cell, canvas.height); context.stroke(); context.beginPath(); context.moveTo(0, line * cell); context.lineTo(canvas.width, line * cell); context.stroke(); }
    if (!fleet) { context.fillStyle = '#b7e6d1'; context.font = '700 28px system-ui'; context.textAlign = 'center'; context.fillText('TWO CAPTAINS REQUIRED', 350, 350); return; }
    const center = (key) => { const [row, col] = key.split(',').map(Number); return { x: (col + .5) * cell, y: (row + .5) * cell }; };
    for (const reef of fleet.reefs) { const p = center(reef); context.fillStyle = '#15282d'; context.strokeStyle = '#687a6c'; context.lineWidth = 5; context.beginPath(); context.moveTo(p.x - 30, p.y + 28); context.lineTo(p.x - 12, p.y - 30); context.lineTo(p.x + 10, p.y - 8); context.lineTo(p.x + 30, p.y + 28); context.closePath(); context.fill(); context.stroke(); }
    for (const relic of fleet.treasures) { const p = center(relic); context.fillStyle = '#ffe27a'; context.shadowColor = '#ffe27a'; context.shadowBlur = 18; context.beginPath(); context.arc(p.x, p.y, 11, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0; }
    const facingAngle = { N: -Math.PI / 2, E: 0, S: Math.PI / 2, W: Math.PI };
    for (const ship of fleet.players) {
      const x = (ship.position.col + .5) * cell, y = (ship.position.row + .5) * cell;
      context.save(); context.translate(x, y); context.rotate(ship.displayAngle ?? facingAngle[ship.facing]);
      context.fillStyle = ship.id === room.you.role ? '#78ffe0' : '#ff7c8c'; context.strokeStyle = '#06131c'; context.lineWidth = 6; context.shadowColor = context.fillStyle; context.shadowBlur = 16;
      context.beginPath(); context.moveTo(35, 0); context.lineTo(-25, -23); context.lineTo(-13, 0); context.lineTo(-25, 23); context.closePath(); context.fill(); context.stroke();
      context.restore();
      context.fillStyle = '#eafff8'; context.font = '700 18px system-ui'; context.textAlign = 'center'; context.fillText(ship.id === room.you.role ? 'YOU' : 'RIVAL', x, y + 48);
    }
    const activeCommands = revealFrame?.commands || {};
    for (const ship of fleet.players) {
      if (activeCommands[ship.id] !== 'SONAR') continue;
      const x = (ship.position.col + .5) * cell, y = (ship.position.row + .5) * cell;
      context.strokeStyle = ship.id === room.you.role ? '#78ffe0' : '#ff7c8c'; context.lineWidth = 8;
      context.beginPath(); context.arc(x, y, cell * (.35 + (revealFrame.progress || 1) * .55), 0, Math.PI * 2); context.stroke();
    }
    for (const event of effects) {
      if (!event.type.startsWith('broadside')) continue;
      const shooter = fleet.players.find((ship) => ship.id === event.actors[0]);
      if (!shooter) continue;
      const startX = (shooter.position.col + .5) * cell, startY = (shooter.position.row + .5) * cell;
      context.strokeStyle = event.type === 'broadside-hit' ? '#fff1a1' : '#d9bd7888'; context.lineWidth = 12; context.lineCap = 'round';
      for (const target of event.ray || []) { const end = center(target); context.beginPath(); context.moveTo(startX, startY); context.lineTo(end.x, end.y); context.stroke(); }
    }
  }

  function angleFor(facing) { return { N: -Math.PI / 2, E: 0, S: Math.PI / 2, W: Math.PI }[facing]; }
  function tweenSnapshot(previous, next, progress) {
    const prior = new Map(previous.players.map((ship) => [ship.id, ship]));
    return {
      ...room.fleet,
      treasures: progress < .78 ? [...previous.treasures] : [...next.treasures],
      players: next.players.map((ship) => {
        const before = prior.get(ship.id) || ship;
        const startAngle = angleFor(before.facing), endAngle = angleFor(ship.facing);
        const delta = ((endAngle - startAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        return {
          ...ship,
          position: {
            row: before.position.row + (ship.position.row - before.position.row) * progress,
            col: before.position.col + (ship.position.col - before.position.col) * progress,
          },
          displayAngle: startAngle + delta * progress,
        };
      }),
    };
  }

  function setReveal(frame, state = 'playing') {
    $('#ghostReveal').dataset.state = state;
    if (!frame) {
      $('#ghostRevealStep').textContent = state === 'complete' ? 'THREE ORDERS RESOLVED' : 'PROGRAM SEALED';
      $('#ghostRedOrder').textContent = 'RED · ?'; $('#ghostGoldOrder').textContent = 'GOLD · ?';
      return;
    }
    $('#ghostRevealStep').textContent = `ORDER ${frame.beat} / 3`;
    $('#ghostRedOrder').textContent = `RED · ${commandLabels[frame.commands.red]?.[0] || ''} ${frame.commands.red}`;
    $('#ghostGoldOrder').textContent = `GOLD · ${commandLabels[frame.commands.gold]?.[0] || ''} ${frame.commands.gold}`;
  }

  function renderProgram() {
    const mine = me();
    if (room?.fleet?.round !== renderedRound) {
      renderedRound = room?.fleet?.round || 0;
      if (!mine?.queue) queue = [];
    }
    if (mine?.queue) queue = [...mine.queue];
    $('#ghostProgram').classList.toggle('reveal-locked', revealing);
    $('#ghostSlots').innerHTML = Array.from({ length: 3 }, (_, index) => `<button data-slot="${index}" ${mine?.queue || revealing ? 'disabled' : ''}><span>${index + 1}</span>${queue[index] ? `${commandLabels[queue[index]][0]} ${queue[index]}` : 'EMPTY'}</button>`).join('');
    $('#ghostSlots').querySelectorAll('[data-slot]').forEach((button) => { button.onclick = () => { if (!mine?.queue) { queue.splice(Number(button.dataset.slot), 1); renderProgram(); } }; });
    $('#ghostCards').innerHTML = COMMANDS.map((command) => `<button data-command="${command}" ${mine?.queue || queue.length >= 3 || revealing ? 'disabled' : ''}><span>${commandLabels[command][0]}</span><strong>${command}</strong><small>${commandLabels[command][1]}</small></button>`).join('');
    $('#ghostCards').querySelectorAll('[data-command]').forEach((button) => { button.onclick = () => { if (queue.length < 3 && !mine?.queue) { queue.push(button.dataset.command); renderProgram(); vibrate('light'); beep(330 + queue.length * 70, .05); } }; });
    $('#ghostLock').disabled = queue.length !== 3 || Boolean(mine?.queue) || room?.phase !== 'planning' || revealing;
    $('#ghostLock').textContent = revealing ? 'Orders executing…' : mine?.queue ? 'Program locked · waiting' : 'Lock program';
  }

  function logText(event) {
    if (event.type === 'beat') return `ORDER ${event.beat}: ${event.effect}`;
    if (event.type === 'move') return `${event.actors.join(' & ')} sailed`;
    if (event.type === 'turn') return `${event.actors[0]} turned ${event.effect}`;
    if (event.type === 'broadside-hit') return `${event.actors[0]} broadside hit ${event.target}`;
    if (event.type === 'broadside-miss') return `${event.actors[0]} fired into empty fog`;
    if (event.type === 'collision' || event.type === 'grounding' || event.type === 'anchor-block') return event.cause;
    if (event.type === 'treasure') return `${event.actors[0]} recovered a relic`;
    if (event.type === 'sonar') return event.effect;
    if (event.type === 'game-over') return event.effect;
    return event.effect || event.cause || event.type;
  }

  function animateResolution() {
    const resolution = room?.fleet?.resolution;
    if (!resolution?.beats?.length) return false;
    const key = `${room.match}:${resolution.round}`;
    if (key === animatedKey) return false;
    animatedKey = key;
    revealTimers.forEach(clearTimeout); revealTimers = [];
    cancelAnimationFrame(revealFrameHandle);
    $('#ghostLog').replaceChildren();
    const appendBeatLog = (beat) => {
      for (const event of beat.events.filter((entry) => entry.type !== 'beat')) {
        const item = document.createElement('li'); item.textContent = logText(event); item.dataset.type = event.type; $('#ghostLog').append(item);
      }
    };
    if (reducedMotion) {
      for (const beat of resolution.beats) {
        const heading = document.createElement('li'); heading.textContent = `ORDER ${beat.beat}: ${beat.commands.red} vs ${beat.commands.gold}`; heading.dataset.type = 'beat'; $('#ghostLog').append(heading);
        appendBeatLog(beat);
      }
      playbackFleet = null; revealFrame = null; revealing = false; setReveal(null, 'complete'); drawChart(room.fleet);
      $('#ghostStatus').textContent = `All ${resolution.beats.length} orders resolved. Review the causal log below.`;
      return true;
    }
    revealing = true;
    playbackFleet = { ...room.fleet, ...resolution.start };
    revealFrame = null;
    setReveal(null, 'playing');
    drawChart(playbackFleet, []);
    const beatDuration = 760;
    const beatSpacing = 1_100;
    resolution.beats.forEach((beat, index) => {
      const previous = index === 0 ? resolution.start : resolution.beats[index - 1];
      const timer = setTimeout(() => {
        if (!alive) return;
        revealFrame = { ...beat, progress: 0 };
        setReveal(beat);
        const heading = document.createElement('li'); heading.textContent = `ORDER ${beat.beat}: ${beat.commands.red} vs ${beat.commands.gold}`; heading.dataset.type = 'beat'; $('#ghostLog').append(heading);
        $('#ghostStatus').textContent = `Executing order ${beat.beat}: ${beat.commands.red} vs ${beat.commands.gold}`;
        const started = performance.now();
        const frame = (now) => {
          if (!alive || !revealing) return;
          const progress = Math.min(1, (now - started) / beatDuration);
          revealFrame = { ...beat, progress };
          playbackFleet = tweenSnapshot(previous, beat, progress);
          drawChart(playbackFleet, progress > .35 ? beat.events : []);
          if (progress < 1) revealFrameHandle = requestAnimationFrame(frame);
          else {
            appendBeatLog(beat);
            const impact = beat.events.some((event) => ['broadside-hit', 'collision', 'grounding', 'anchor-block'].includes(event.type));
            if (impact) { $('#ghostImpact').classList.add('show'); setTimeout(() => $('#ghostImpact').classList.remove('show'), 240); vibrate('heavy'); beep(120, .12); }
            else { vibrate('light'); beep(340 + beat.beat * 55, .07); }
          }
        };
        revealFrameHandle = requestAnimationFrame(frame);
      }, index * beatSpacing);
      revealTimers.push(timer);
    });
    const finishTimer = setTimeout(() => {
      if (!alive) return;
      revealing = false; playbackFleet = null; revealFrame = null; setReveal(null, 'complete'); drawChart(room.fleet); renderProgram();
      $('#ghostStatus').textContent = room.phase === 'finished'
        ? `All ${resolution.beats.length} orders resolved. The duel is over.`
        : `All ${resolution.beats.length} orders resolved. Write the next program.`;
    }, resolution.beats.length * beatSpacing + 120);
    revealTimers.push(finishTimer);
    return true;
  }

  function renderResult() {
    const target = $('#ghostResult');
    if (room?.phase === 'lobby' && room.players.length === 2) {
      target.innerHTML = `<div class="result-card ghost-brief"><span>DUEL READY</span><h3>You don’t take turns.</h3><p>You write the next three moments. Both programs reveal together.</p><button class="primary-action" id="ghostStart">Unseal the chart →</button></div>`;
      $('#ghostStart').onclick = start;
      return;
    }
    if (room?.phase === 'finished') {
      const won = room.fleet.winner === room.you.role, draw = room.fleet.winner === 'draw', ready = room.rematchReady.includes(player?.id);
      target.innerHTML = `<div class="result-card ghost-ending"><span>${draw ? 'DEAD CALM' : won ? 'RIVAL SUNK' : 'YOUR LIGHTS WENT OUT'}</span><h3>${draw ? 'The fog keeps both captains' : won ? 'Admiral Brine salutes' : 'The Widow Current takes the chart'}</h3><p>${room.fleet.winReason.replaceAll('-', ' ')} · ${me().treasure} relics · ${me().hull} hull</p><button class="primary-action" id="ghostRematch" ${ready ? 'disabled' : ''}>${ready ? 'Ready · waiting on rival' : 'Demand a rematch'}</button></div>`;
      $('#ghostRematch').onclick = rematch;
      return;
    }
    target.replaceChildren();
  }

  function render() {
    if (!room || !alive) return;
    $('#ghostJoin').classList.toggle('hidden', Boolean(player));
    $('#ghostRole').textContent = room.you ? `YOU COMMAND THE ${room.you.role.toUpperCase()} FLEET` : 'JOIN THE FLEET';
    $('#ghostMatch').textContent = room.phase === 'lobby' ? `${room.players.length} / 2 captains` : `Match ${room.match} · simultaneous orders`;
    $('#ghostPortrait').innerHTML = admiralBrine(room.phase === 'finished' ? room.fleet.winner === room.you?.role ? 'victory' : 'panic' : 'idle');
    $('#ghostPortrait').dataset.fleet = room.you?.role || 'none';
    $('#ghostRound').textContent = room.fleet?.round || '—';
    $('#ghostHull').textContent = me() ? `${me().hull} / 4` : '—';
    $('#ghostRelics').textContent = me() ? `${me().treasure} / 3` : '—';
    $('#ghostRival').textContent = rival() ? `${rival().hull} hull` : '—';
    $('#ghostBoardSummary').textContent = room.fleet
      ? `You are at row ${me().position.row + 1}, column ${me().position.col + 1}, facing ${me().facing}, with ${me().hull} hull and ${me().treasure} relics. Rival is at row ${rival().position.row + 1}, column ${rival().position.col + 1}, facing ${rival().facing}, with ${rival().hull} hull. ${room.fleet.reefs.length} reef cells and ${room.fleet.treasures.length} relics remain.`
      : 'The haunted chart is waiting for two captains.';
    const mine = me();
    if (!revealing) $('#ghostStatus').textContent = room.phase === 'lobby' ? (room.players.length === 2 ? 'Both captains present. Start the duel.' : 'Share the room link with your rival.') : room.phase === 'finished' ? 'Final command intersection recorded below.' : mine?.queue ? `${rival()?.locked ? 'Both programs locked. Resolving…' : 'Your program is locked. The rival is still writing.'}` : 'Write exactly three orders, then lock them.';
    const startedReveal = animateResolution();
    if (!startedReveal) drawChart();
    renderProgram(); renderResult();
  }

  async function refresh() {
    if (!player?.token) return;
    try { room = (await api('state', { playerToken: player.token })).room; render(); }
    catch (error) {
      if (error.status === 403) {
        savePlayer(null); queue = []; animatedKey = ''; revealing = false; playbackFleet = null; revealFrame = null;
        revealTimers.forEach(clearTimeout); revealTimers = []; cancelAnimationFrame(revealFrameHandle);
        room = { phase: 'lobby', players: [], match: 1, fleet: null, rematchReady: [] };
        setReveal(null, 'idle');
        render(); note('Your old captain token expired. Rejoin this fleet.');
      } else $('#ghostStatus').textContent = error.message;
    }
  }
  async function start() { if (busy) return; busy = true; try { room = (await api('start', { playerToken: player.token })).room; queue = []; render(); } catch (error) { note(error.message); } finally { busy = false; } }
  async function rematch() { if (busy) return; busy = true; try { room = (await api('rematch', { playerToken: player.token })).room; queue = []; render(); } catch (error) { note(error.message); } finally { busy = false; } }
  $('#ghostLock').onclick = async () => { if (busy || queue.length !== 3) return; busy = true; try { room = (await api('lock', { playerToken: player.token, queue })).room; track('ghost_program_locked', { round: room.fleet.round, commands: [...queue] }); vibrate('medium'); beep(180, .12); render(); } catch (error) { note(error.message); } finally { busy = false; } };
  $('#ghostJoinButton').onclick = async () => { if (busy) return; busy = true; try { const result = await api('join', { name: $('#ghostName').value || player?.name || 'Captain', resumeToken: player?.token }); savePlayer(result.player); room = result.room; render(); } catch (error) { note(error.message); } finally { busy = false; } };
  $('#ghostName').onkeydown = (event) => { if (event.key === 'Enter') $('#ghostJoinButton').click(); };
  $('#ghostShare').onclick = async () => { const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}&game=ghost-fleet`; if (navigator.share) { try { await navigator.share({ title: 'Ghost Fleet', text: 'Write three moments. Sink me.', url }); } catch { /* cancelled */ } } else { await navigator.clipboard.writeText(url); note('Duel link copied'); } };
  if (player?.token) refresh(); else { room = { phase: 'lobby', players: [], match: 1, fleet: null, rematchReady: [] }; render(); }
  const schedule = () => { if (!alive) return; poll = setTimeout(async () => { await refresh(); schedule(); }, room?.phase === 'planning' ? 700 : 1_300); }; schedule();
  return () => { alive = false; clearTimeout(poll); revealTimers.forEach(clearTimeout); cancelAnimationFrame(revealFrameHandle); };
}
