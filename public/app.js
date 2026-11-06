import {
  echoWakeStep,
  expectedSequence,
  generateDeducibleBoard,
  neighbors,
  reefClusters,
  reflectPearl,
  seededRandom,
  shiftReef,
  tideActionMatches,
} from './game-core.js';
import { mountSignalStorm } from './games/signal-storm.js';
import { mountPanic } from './games/panic-directors-cut.js';
import { mountGhostFleet } from './games/ghost-fleet.js';

const tg = window.Telegram?.WebApp;
tg?.ready?.();
tg?.expand?.();
const params = new URLSearchParams(location.search);
const roomId = (params.get('room') || tg?.initDataUnsafe?.start_param || 'dev-divers-gaming').replace(/[^a-z0-9-]/gi, '-');
const $ = (selector, root = document) => root.querySelector(selector);
const menu = $('#menuView');
const view = $('#gameView');
const mount = $('#gameMount');
const back = $('#backButton');
const title = $('#pageTitle');
const toast = $('#toast');
let cleanup = () => {};
let current = '';
let sound = localStorage.getItem('clawcade:sound') !== 'off';
const labKey = 'clawcade:lab-events:v1';
const labSession = sessionStorage.getItem('clawcade:lab-session') || crypto.randomUUID();
sessionStorage.setItem('clawcade:lab-session', labSession);
function track(event, data = {}) {
  let events = [];
  try { events = JSON.parse(localStorage.getItem(labKey) || '[]'); } catch { events = []; }
  events.push({ at: new Date().toISOString(), session: labSession, event, ...data });
  localStorage.setItem(labKey, JSON.stringify(events.slice(-250)));
}
const games = [
  { id: 'claw-four', icon: '🦞', name: 'Claw Four', tag: 'PLAY TOGETHER', desc: 'Drop, block, and steal the win. Two claws enter.', color: 'coral' },
  { id: 'kraken-sequence', icon: '🐙', name: 'Kraken Sequence', tag: 'MEMORY', desc: 'Watch the deep-sea signals. Repeat them or sink.', color: 'violet' },
  { id: 'abyss-sweep', icon: '💣', name: 'Abyss Sweep', tag: 'LOGIC', desc: 'Find the safe route through a mine-filled reef.', color: 'gold' },
  { id: 'shell-shuffle', icon: '🐚', name: 'Shell Shuffle', tag: 'MATCHING', desc: 'Flip sea creatures. Match pairs against the clock.', color: 'sea' },
  { id: 'reef-reflex', icon: '⚡', name: 'Reef Reflex', tag: 'SPEED', desc: 'Wait for the flash. Tap faster than a snapping claw.', color: 'blue' },
  { id: 'abyss-expedition', icon: '🧿', name: 'Abyss Expedition', tag: 'DEDUCTION', desc: 'Clear the reef, then decide whether to risk the dive.', color: 'gold' },
  { id: 'kraken-current', icon: '🌊', name: 'Kraken Current', tag: 'MEMORY TWIST', desc: 'Hold four signals. Some currents run backward.', color: 'violet' },
  { id: 'tide-tell', icon: '🪼', name: 'Tide Tell', tag: 'READ & REACT', desc: 'Read the rule, resist the feint, and choose when to dive.', color: 'sea' },
  { id: 'echo-wake', icon: '👻', name: 'Echo Wake', tag: 'OUTRUN YOUR PAST', desc: 'Collect pearls while your last moves erupt behind you.', color: 'blue' },
  { id: 'pearl-ricochet', icon: '⚪', name: 'Pearl Ricochet', tag: 'TRICK SHOTS', desc: 'Bank one pearl through a living coral course.', color: 'gold' },
  { id: 'shell-shift', icon: '🐚', name: 'Shell Shift', tag: 'BOARD TACTICS', desc: 'Move whole reef lines and engineer chain reactions.', color: 'coral' },
  { id: 'clawcade-panic', icon: '🚨', name: 'Clawcade Panic', tag: 'MICROGAME GAUNTLET', desc: 'Six ridiculous emergencies. Read fast. Act faster.', color: 'violet' },
  { id: 'signal-storm', icon: '⚓', name: 'Signal Storm', tag: '2-PLAYER CO-OP', desc: 'Different screens. Shared submarine. Talk or implode.', color: 'sea' },
  { id: 'panic-directors-cut', icon: '🎭', name: 'Panic: Director’s Cut', tag: 'AUTHORED MICROGAME SHOW', desc: 'Twenty scenes, four lives, three acts, one furious leviathan.', color: 'coral' },
  { id: 'ghost-fleet', icon: '☠️', name: 'Ghost Fleet', tag: 'SECRET PROGRAM DUEL', desc: 'Write three moments. Reveal together. Sink your rival in the fog.', color: 'blue' },
];
const metricVersion = { 'abyss-sweep': 2, 'shell-shuffle': 2, 'abyss-expedition': 1, 'kraken-current': 1, 'tide-tell': 1, 'echo-wake': 1, 'pearl-ricochet': 1, 'shell-shift': 1, 'clawcade-panic': 1, 'panic-directors-cut': 1 };
const key = (id) => `clawcade:best:${id}${metricVersion[id] ? `:v${metricVersion[id]}` : ''}`;
const best = (id) => Number(localStorage.getItem(key(id)) || 0);
function formatScore(id, value) {
  if (id === 'kraken-sequence') return `level ${value}`;
  if (id === 'abyss-sweep') return `${(value / 1000).toFixed(1)}s`;
  if (id === 'shell-shuffle') return `${Math.floor(value / 1_000_000)} moves`;
  if (id === 'reef-reflex') return `${value} ms`;
  if (id === 'kraken-current') return `${value} currents`;
  if (id === 'abyss-expedition') return `depth ${value}`;
  if (id === 'tide-tell') return `${value} reads`;
  if (id === 'echo-wake') return `${value} pearls`;
  if (id === 'pearl-ricochet') return `${value} gates`;
  if (id === 'shell-shift') return `${value} shells`;
  if (id === 'clawcade-panic') return `${value} saves`;
  if (id === 'panic-directors-cut') return `${value} points`;
  return String(value);
}
function formatBest(id, value = best(id)) { return value ? formatScore(id, value) : '' ; }
function record(id, value, lower = false) {
  const old = best(id);
  if (value > 0 && (!old || (lower ? value < old : value > old))) {
    localStorage.setItem(key(id), String(value));
    renderMenu();
    return true;
  }
  return false;
}
function vibrate(kind = 'light') { tg?.HapticFeedback?.impactOccurred?.(kind); }
let audio;
function beep(freq = 440, duration = .08) {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(.05, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
    osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
  } catch { /* audio is optional */ }
}
function note(message) {
  toast.textContent = message; toast.classList.add('visible');
  clearTimeout(note.timer); note.timer = setTimeout(() => toast.classList.remove('visible'), 2400);
}
function renderMenu() {
  $('#gameGrid').innerHTML = games.map((g, i) => `<button class="game-card ${g.color}" data-game="${g.id}" aria-label="Play ${g.name}"><span class="game-card-top"><span class="game-icon" aria-hidden="true">${g.icon}</span><span class="game-number">${String(i + 1).padStart(2, '0')} / ${String(games.length).padStart(2, '0')}</span></span><span class="game-tag">${g.tag}</span><strong>${g.name}</strong><span class="game-desc">${g.desc}</span><span class="game-card-bottom"><span>${best(g.id) ? `🏆 Best: ${formatBest(g.id)}` : 'New adventure'}</span><span class="play-arrow">↗</span></span></button>`).join('');
  $('#recordCount').textContent = `${games.filter((g) => best(g.id)).length} solo records`;
  $('#gameGrid').querySelectorAll('[data-game]').forEach((button) => button.onclick = () => open(button.dataset.game, { write: 'push' }));
}
function open(id, { write = 'replace' } = {}) {
  cleanup(); cleanup = () => {};
  current = id;
  track(id ? 'game_open' : 'menu_open', id ? { game: id } : {});
  menu.classList.toggle('hidden', !!id);
  view.classList.toggle('hidden', !id);
  back.classList.toggle('hidden', !id);
  title.textContent = id ? games.find((g) => g.id === id)?.name || 'Clawcade' : 'Clawcade';
  const url = id ? `${location.pathname}?room=${encodeURIComponent(roomId)}&game=${id}` : `${location.pathname}?room=${encodeURIComponent(roomId)}`;
  if (write === 'push') history.pushState({ clawcadeGame: id }, '', url);
  if (write === 'replace') history.replaceState({ clawcadeGame: id }, '', url);
  if (id) tg?.BackButton?.show?.(); else tg?.BackButton?.hide?.();
  mount.replaceChildren();
  if (id === 'kraken-sequence') cleanup = legacySequence();
  if (id === 'abyss-sweep') cleanup = legacySweep();
  if (id === 'shell-shuffle') cleanup = shellShuffle();
  if (id === 'reef-reflex') cleanup = reefReflex();
  if (id === 'kraken-current') cleanup = krakenCurrent();
  if (id === 'abyss-expedition') cleanup = abyssExpedition();
  if (id === 'tide-tell') cleanup = tideTell();
  if (id === 'echo-wake') cleanup = echoWake();
  if (id === 'pearl-ricochet') cleanup = pearlRicochet();
  if (id === 'shell-shift') cleanup = shellShift();
  if (id === 'clawcade-panic') cleanup = clawcadePanic();
  if (id === 'signal-storm') cleanup = mountSignalStorm({ mount, shell, roomId, note, track, vibrate, beep, goMenu });
  if (id === 'panic-directors-cut') cleanup = mountPanic({ mount, record, track, note, vibrate, beep, menu: goMenu });
  if (id === 'ghost-fleet') cleanup = mountGhostFleet({ mount, shell, roomId, note, track, vibrate, beep });
  if (id === 'claw-four') cleanup = clawFour();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function goMenu() { open('', { write: 'replace' }); }
back.onclick = goMenu;
tg?.BackButton?.onClick?.(goMenu);
window.addEventListener('popstate', () => {
  const id = new URLSearchParams(location.search).get('game');
  open(games.some((game) => game.id === id) ? id : '', { write: 'none' });
});
$('#soundButton').onclick = () => { sound = !sound; localStorage.setItem('clawcade:sound', sound ? 'on' : 'off'); syncSound(); if (sound) beep(); };
$('#copyLabReport').onclick = async () => {
  try { await navigator.clipboard.writeText(localStorage.getItem(labKey) || '[]'); note('Anonymous playtest report copied'); }
  catch { note('Clipboard unavailable in this browser'); }
};
function syncSound() { $('#soundButton').textContent = sound ? '♪' : '♪̸'; $('#soundButton').setAttribute('aria-pressed', String(sound)); }
function shell(icon, label, instructions, body) {
  mount.innerHTML = `<div class="game-intro"><span class="intro-icon">${icon}</span><p class="eyebrow">${label}</p><h2>${games.find((g) => g.id === current)?.name}</h2><p>${instructions}</p></div>${body}<div class="game-footer"><button class="text-button" id="menuButton">← All games</button></div>`;
  mount.querySelectorAll('.game-status').forEach((status) => { status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true'); });
  $('#menuButton').onclick = goMenu;
}
function finish(message, score, id, { lower = false, scoreLabel = formatScore(id, score), detail = '' } = {}) {
  const isBest = record(id, score, lower);
  track('round_end', { game: id, score, personalBest: isBest });
  const bestText = formatBest(id);
  vibrate('heavy'); beep(isBest ? 750 : 250, .18);
  $('#result').innerHTML = `<div class="result-card" tabindex="-1"><span>${isBest ? '🏆 NEW PERSONAL BEST' : 'ROUND OVER'}</span><h3>${message}</h3><p>${scoreLabel}${bestText ? ` · Best ${bestText}` : ''}${detail ? `<br>${detail}` : ''}</p><button class="primary-action" id="again">Play again ↻</button></div>`;
  $('.result-card')?.focus({ preventScroll: true });
}
function legacySequence() {
  const symbols = ['🪸', '🐙', '🐡', '🦀'];
  const cueNames = ['Coral', 'Octopus', 'Puffer', 'Crab'];
  shell('🐙', 'MEMORY / SOLO', 'Watch the lights. Repeat the entire pattern. One wrong tap ends the dive.', `<div class="scorebar"><span>LEVEL <strong id="level">0</strong></span><span>BEST <strong>${best(current)}</strong></span></div><div class="sequence-grid">${symbols.map((symbol, index) => `<button class="sequence-pad pad-${index}" data-pad="${index}" aria-label="${cueNames[index]}" disabled>${symbol}</button>`).join('')}</div><p id="cue" class="sr-only" role="status" aria-live="assertive" aria-atomic="true"></p><p class="game-status" id="status">Ready to dive?</p><button id="tempoMode" class="secondary-action" aria-pressed="false">⚡ Rising tide tempo</button><div id="result"><button id="start" class="primary-action">Start sequence →</button></div>`);
  let pattern = [], index = 0, playing = false, alive = true, relaxed = false;
  const timers = new Set();
  const setPadsEnabled = (enabled) => mount.querySelectorAll('[data-pad]').forEach((pad) => { pad.disabled = !enabled; });
  function later(fn, ms) { const timer = setTimeout(() => { timers.delete(timer); if (alive) fn(); }, ms); timers.add(timer); }
  function flash(padIndex) { const pad = $(`[data-pad="${padIndex}"]`); pad.classList.add('lit'); $('#cue').textContent = cueNames[padIndex]; beep(270 + padIndex * 125, .22); vibrate(); later(() => pad.classList.remove('lit'), relaxed ? 520 : 360); }
  function next() {
    pattern.push(Math.floor(Math.random() * 4)); index = 0; playing = true; setPadsEnabled(false);
    $('#level').textContent = pattern.length;
    const interval = relaxed ? 1050 : pattern.length >= 13 ? 380 : pattern.length >= 9 ? 450 : pattern.length >= 5 ? 550 : 650;
    $('#status').textContent = pattern.length > 1 ? `Level ${pattern.length}. Watch carefully…` : 'Watch carefully…';
    pattern.forEach((padIndex, cueIndex) => later(() => flash(padIndex), 700 + cueIndex * interval));
    later(() => { playing = false; setPadsEnabled(true); $('#status').textContent = 'YOUR TURN · Repeat the pattern!'; }, 700 + pattern.length * interval);
  }
  $('#tempoMode').onclick = () => { if (pattern.length) return note('Tempo locks during a dive'); relaxed = !relaxed; $('#tempoMode').textContent = relaxed ? '🌙 Relaxed tempo' : '⚡ Rising tide tempo'; $('#tempoMode').setAttribute('aria-pressed', String(relaxed)); vibrate(); };
  $('#start').onclick = () => { $('#result').replaceChildren(); next(); };
  mount.querySelectorAll('[data-pad]').forEach((pad) => { pad.onclick = () => {
    if (playing || !pattern.length) return;
    const guess = Number(pad.dataset.pad); flash(guess);
    if (guess !== pattern[index]) {
      playing = true; setPadsEnabled(false); $('#status').textContent = 'The Kraken caught you.';
      finish(`You reached level ${pattern.length - 1}`, pattern.length - 1, current);
      $('#again').onclick = () => { timers.forEach(clearTimeout); timers.clear(); pattern = []; playing = false; $('#result').replaceChildren(); next(); };
    } else if (++index === pattern.length) { playing = true; setPadsEnabled(false); $('#status').textContent = `Level ${pattern.length} clear. Going deeper…`; later(next, 900); }
  }; });
  return () => { alive = false; timers.forEach(clearTimeout); };
}
function legacySweep() {
  shell('💣', 'LOGIC / SOLO', 'Reveal safe tiles. Numbers show adjacent mines. Flag suspects; clear every safe tile to win.', `<div class="scorebar"><span>SAFE <strong id="safe">0 / 21</strong></span><span>FLAGS <strong id="flags">0 / 4</strong></span><span>TIME <strong id="time">0.0s</strong></span></div><div class="input-mode-panel"><strong id="inputMode" aria-live="polite">👆 NEXT TAP: REVEAL</strong><small>Flag is one-shot · long-press also flags</small><div class="mode-actions"><button class="mode-action active" id="revealMode" aria-pressed="true">👆 Reveal</button><button class="mode-action" id="flagMode" aria-pressed="false">🚩 Flag one tile</button></div></div><div class="sweep-grid mode-reveal" id="sweepGrid"></div><p class="game-status" id="status">Your first tap opens a safe pocket.</p><div id="result"></div>`);
  const grid = $('#sweepGrid');
  let suppressClick = -1;
  let mines = new Set(), openTiles = new Set(), flags = new Set(), flagMode = false, over = false, started = 0, timer;
  function setInputMode(mode, message = '') { flagMode = mode === 'flag'; grid.classList.toggle('mode-flag', flagMode); grid.classList.toggle('mode-reveal', !flagMode); $('#inputMode').textContent = flagMode ? '🚩 NEXT TAP: FLAG ONE TILE' : '👆 NEXT TAP: REVEAL'; $('#flagMode').classList.toggle('active', flagMode); $('#revealMode').classList.toggle('active', !flagMode); $('#flagMode').setAttribute('aria-pressed', String(flagMode)); $('#revealMode').setAttribute('aria-pressed', String(!flagMode)); if (message) $('#status').textContent = message; }
  function adjacent(cell) { const row = Math.floor(cell / 5), column = cell % 5; return [-1, 0, 1].flatMap((rowStep) => [-1, 0, 1].map((columnStep) => [row + rowStep, column + columnStep])).filter(([nextRow, nextColumn]) => (nextRow !== row || nextColumn !== column) && nextRow >= 0 && nextRow < 5 && nextColumn >= 0 && nextColumn < 5).map(([nextRow, nextColumn]) => nextRow * 5 + nextColumn); }
  grid.innerHTML = Array.from({ length: 25 }, (_, index) => `<button class="sweep-tile" data-tile="${index}" aria-label="Row ${Math.floor(index / 5) + 1}, column ${index % 5 + 1}, hidden"></button>`).join('');
  const tiles = [...grid.querySelectorAll('[data-tile]')];
  tiles.forEach((tile) => {
    const cell = Number(tile.dataset.tile);
    tile.onclick = () => { if (suppressClick === cell) { suppressClick = -1; return; } tap(cell); };
    tile.oncontextmenu = (event) => { event.preventDefault(); if (flag(cell) && flagMode) setInputMode('reveal', 'Flag placed. Back to Reveal.'); };
    let hold, startX, startY;
    const cancelHold = () => { clearTimeout(hold); hold = null; };
    tile.onpointerdown = (event) => { if (event.pointerType === 'mouse') return; startX = event.clientX; startY = event.clientY; hold = setTimeout(() => { hold = null; suppressClick = cell; if (flag(cell) && flagMode) setInputMode('reveal', 'Flag placed. Back to Reveal.'); setTimeout(() => { if (suppressClick === cell) suppressClick = -1; }, 700); }, 520); };
    tile.onpointermove = (event) => { if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancelHold(); };
    tile.onpointerup = cancelHold; tile.onpointercancel = cancelHold; tile.onpointerleave = cancelHold;
  });
  function draw() {
    tiles.forEach((tile, index) => {
      const count = adjacent(index).filter((cell) => mines.has(cell)).length;
      tile.className = `sweep-tile ${openTiles.has(index) ? 'revealed' : ''} ${mines.has(index) && over ? 'mine' : ''}`;
      tile.setAttribute('aria-label', `Row ${Math.floor(index / 5) + 1}, column ${index % 5 + 1}${flags.has(index) ? ', flagged' : openTiles.has(index) ? `, ${count} adjacent mines` : ', hidden'}`);
      tile.textContent = flags.has(index) ? '🚩' : openTiles.has(index) || (over && mines.has(index)) ? mines.has(index) ? '💣' : count || '·' : '';
    });
    $('#safe').textContent = `${openTiles.size} / 21`; $('#flags').textContent = `${flags.size} / 4`;
  }
  function randomOrder(values) { const copy = [...values]; for (let index = copy.length - 1; index > 0; index -= 1) { const other = Math.floor(Math.random() * (index + 1)); [copy[index], copy[other]] = [copy[other], copy[index]]; } return copy; }
  function flood(start, field, revealed) { const queue = [start]; while (queue.length) { const cell = queue.pop(); if (revealed.has(cell) || field.has(cell)) continue; revealed.add(cell); if (!adjacent(cell).some((near) => field.has(near))) queue.push(...adjacent(cell)); } }
  function isDeducible(first, field) {
    const revealed = new Set(), knownMines = new Set(); flood(first, field, revealed); let changed = true;
    while (changed) { changed = false; for (const cell of [...revealed]) { const near = adjacent(cell), number = near.filter((candidate) => field.has(candidate)).length; const unknown = near.filter((candidate) => !revealed.has(candidate) && !knownMines.has(candidate)); const marked = near.filter((candidate) => knownMines.has(candidate)).length; if (unknown.length && number === marked) { const before = revealed.size; unknown.forEach((candidate) => flood(candidate, field, revealed)); changed ||= revealed.size > before; } else if (unknown.length && number - marked === unknown.length) { unknown.forEach((candidate) => knownMines.add(candidate)); changed = true; } } }
    return revealed.size === 21;
  }
  function plant(first) { const safePocket = new Set([first, ...adjacent(first)]); const options = Array.from({ length: 25 }, (_, index) => index).filter((index) => !safePocket.has(index)); for (let attempt = 0; attempt < 200; attempt += 1) { const candidate = new Set(randomOrder(options).slice(0, 4)); if (isDeducible(first, candidate)) { mines = candidate; return; } } mines = new Set(randomOrder(options).slice(0, 4)); }
  function flag(cell) { if (over || openTiles.has(cell)) return false; if (flags.has(cell)) flags.delete(cell); else if (flags.size < 4) flags.add(cell); else { note('Only four flags available'); return false; } vibrate(); draw(); return true; }
  function reveal(cell) { if (openTiles.has(cell) || flags.has(cell)) return; openTiles.add(cell); if (!adjacent(cell).some((near) => mines.has(near))) adjacent(cell).forEach((near) => { if (!mines.has(near)) reveal(near); }); }
  function tap(cell) {
    if (over) return; if (flagMode) { if (flag(cell)) setInputMode('reveal', 'Flag placed. Back to Reveal.'); return; } if (flags.has(cell)) return note('That tile is flagged. Choose Flag one tile to remove it.');
    if (!mines.size) { plant(cell); started = performance.now(); timer = setInterval(() => { $('#time').textContent = `${((performance.now() - started) / 1000).toFixed(1)}s`; }, 100); }
    if (openTiles.has(cell)) return note('Already revealed. Pick a hidden tile.');
    if (mines.has(cell)) { over = true; clearInterval(timer); $('#status').textContent = 'Boom. The reef bites back.'; draw(); finish('Mine found!', 0, current, { scoreLabel: `${openTiles.size} / 21 safe`, detail: 'Losses do not replace clear-time records' }); $('#again').onclick = restart; return; }
    reveal(cell); vibrate(); beep(430, .05); draw();
    if (openTiles.size === 21) { over = true; clearInterval(timer); const elapsed = Math.round(performance.now() - started); $('#time').textContent = `${(elapsed / 1000).toFixed(1)}s`; $('#status').textContent = 'Reef cleared. Clean work.'; finish('Perfect sweep!', elapsed, current, { lower: true }); $('#again').onclick = restart; }
  }
  function restart() { clearInterval(timer); mines.clear(); openTiles.clear(); flags.clear(); over = false; started = 0; $('#time').textContent = '0.0s'; $('#result').replaceChildren(); setInputMode('reveal', 'Your first tap opens a safe pocket.'); draw(); }
  $('#revealMode').onclick = () => { setInputMode('reveal', 'Reveal selected. Your next tile tap opens it.'); vibrate(); };
  $('#flagMode').onclick = () => { if (over) return; setInputMode('flag', 'Flag armed for one tile. After that, Reveal returns automatically.'); vibrate(); };
  draw(); return () => clearInterval(timer);
}
function shellShuffle() {
  const icons = ['🐙', '🦀', '🐡', '🦈', '🐚', '🪼', '🦭', '🦞'];
  shell('🐚', 'MATCHING / SOLO', 'Flip two cards at a time. Match every creature with the fewest moves.', `<div class="scorebar"><span>PAIRS <strong id="pairs">0 / 8</strong></span><span>MOVES <strong id="moves">0</strong></span><span>STREAK <strong id="streak">0</strong></span><span>TIME <strong id="time">0.0s</strong></span></div><div class="match-grid" id="matchGrid"></div><p class="game-status" id="status">Choose your first shell.</p><div id="result"></div>`);
  const grid = $('#matchGrid'); let cards, selected, matched, moves, started, locked, timer, flipTimer, streak;
  grid.innerHTML = Array.from({ length: 16 }, (_, index) => `<button class="match-card" data-card="${index}" aria-label="Card ${index + 1}, hidden">✦</button>`).join('');
  const cardButtons = [...grid.querySelectorAll('[data-card]')];
  cardButtons.forEach((button) => { button.onclick = () => tap(Number(button.dataset.card)); });
  function draw() { cardButtons.forEach((button, index) => { const visible = matched.has(index) || selected.includes(index); button.className = `match-card ${visible ? 'flipped' : ''}`; button.disabled = locked || matched.has(index) || selected.includes(index); button.setAttribute('aria-label', `Card ${index + 1}${matched.has(index) ? `, matched ${cards[index]}` : selected.includes(index) ? `, ${cards[index]}` : ', hidden'}`); button.textContent = visible ? cards[index] : '✦'; }); }
  function reset() { clearInterval(timer); clearTimeout(flipTimer); cards = [...icons, ...icons].sort(() => Math.random() - .5); selected = []; matched = new Set(); moves = 0; streak = 0; started = 0; locked = false; $('#pairs').textContent = '0 / 8'; $('#moves').textContent = '0'; $('#streak').textContent = '0'; $('#time').textContent = '0.0s'; $('#status').textContent = 'Choose your first shell.'; $('#result').replaceChildren(); draw(); }
  function tap(index) {
    if (locked || matched.has(index) || selected.includes(index)) return;
    if (!started) { started = performance.now(); timer = setInterval(() => { $('#time').textContent = `${((performance.now() - started) / 1000).toFixed(1)}s`; }, 100); }
    selected.push(index); vibrate(); beep(440 + selected.length * 80, .06); draw();
    if (selected.length === 2) {
      moves += 1; $('#moves').textContent = moves;
      if (cards[selected[0]] === cards[selected[1]]) { selected.forEach((card) => matched.add(card)); selected = []; streak += 1; $('#streak').textContent = streak; $('#pairs').textContent = `${matched.size / 2} / 8`; $('#status').textContent = streak >= 3 ? `${streak} matches in a row! 🔥` : 'A match! Keep going.'; beep(560 + Math.min(streak, 5) * 70, .09); vibrate(streak >= 3 ? 'medium' : 'light'); if (matched.size === 16) { clearInterval(timer); const elapsed = Math.round(performance.now() - started); const score = moves * 1_000_000 + elapsed; $('#time').textContent = `${(elapsed / 1000).toFixed(1)}s`; $('#status').textContent = 'Ocean catalog complete.'; finish('All 8 pairs found!', score, current, { lower: true, scoreLabel: `${moves} moves · ${(elapsed / 1000).toFixed(1)}s`, detail: `Best streak ${streak}` }); $('#again').onclick = reset; } draw(); }
      else { locked = true; streak = 0; $('#streak').textContent = '0'; $('#status').textContent = 'Not a match · input locked while the cards are visible.'; draw(); flipTimer = setTimeout(() => { selected = []; locked = false; draw(); $('#status').textContent = 'Choose a new pair.'; }, 850); }
    }
  }
  reset(); return () => { clearInterval(timer); clearTimeout(flipTimer); };
}
function reefReflex() {
  shell('⚡', 'SPEED / SOLO', 'Wait for GO, then tap. Five clean rounds. Early taps add a 150 ms penalty.', `<div class="scorebar"><span>ROUND <strong id="round">0 / 5</strong></span><span>AVERAGE <strong id="average">—</strong></span><span>FALSE STARTS <strong id="falseStarts">0</strong></span><span>BEST <strong>${best(current) || '—'} ms</strong></span></div><button id="reaction" class="reaction-zone idle" aria-label="Start reflex game"><span id="reactionIcon">⚡</span><strong id="reactionText">Tap to start</strong><small id="reactionHint">Five rounds. No cheating.</small></button><p class="game-status" id="status">When the reef flashes green, strike.</p><div id="result"></div>`);
  const zone = $('#reaction'); let state = 'idle', samples = [], falseStarts = 0, armedAt = 0, waitTimer;
  function set(nextState, icon, label, hint) { state = nextState; zone.className = `reaction-zone ${nextState}`; zone.setAttribute('aria-label', `${label}. ${hint}`); $('#reactionIcon').textContent = icon; $('#reactionText').textContent = label; $('#reactionHint').textContent = hint; }
  function arm() { set('waiting', '◌', 'Wait for it…', 'Do not tap yet'); waitTimer = setTimeout(() => { armedAt = performance.now(); set('go', '🦞', 'GO!', 'TAP NOW'); beep(880, .12); vibrate('heavy'); }, 1100 + Math.random() * 2300); }
  function next() { if (samples.length === 5) { const raw = Math.round(samples.reduce((sum, value) => sum + value, 0) / 5), adjusted = raw + falseStarts * 150, fastest = Math.min(...samples); set('done', '🏁', `${adjusted} ms score`, 'Five clean strikes'); finish('Reef conquered!', adjusted, current, { lower: true, detail: `${raw} ms raw · ${fastest} ms fastest · ${falseStarts} false start${falseStarts === 1 ? '' : 's'}` }); $('#again').onclick = reset; return; } $('#round').textContent = `${samples.length + 1} / 5`; arm(); }
  function reset() { clearTimeout(waitTimer); samples = []; falseStarts = 0; $('#round').textContent = '0 / 5'; $('#average').textContent = '—'; $('#falseStarts').textContent = '0'; $('#result').replaceChildren(); set('idle', '⚡', 'Tap to start', 'Five rounds. No cheating.'); }
  zone.onclick = () => {
    if (state === 'idle') return next();
    if (state === 'waiting') { clearTimeout(waitTimer); falseStarts += 1; $('#falseStarts').textContent = falseStarts; vibrate('heavy'); beep(160, .2); set('early', '😬', 'Too soon!', 'Tap to retry this round'); $('#status').textContent = `False start ${falseStarts}. +150 ms penalty.`; return; }
    if (state === 'early') return arm();
    if (state === 'go') { const milliseconds = Math.round(performance.now() - armedAt), prior = samples.length ? Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length) : 0; samples.push(milliseconds); $('#average').textContent = `${Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length)} ms`; const split = prior ? ` · ${Math.abs(milliseconds - prior)} ms ${milliseconds < prior ? 'faster' : 'slower'} than your run` : ' · First split'; $('#status').textContent = `${milliseconds} ms${split}`; vibrate(); set('between', '✓', `${milliseconds} ms`, 'Tap for next round'); return; }
    if (state === 'between') next();
  };
  return () => clearTimeout(waitTimer);
}
function krakenCurrent() {
  const symbols = ['🪸', '🐙', '🐡', '🦀'];
  const cueNames = ['Coral', 'Octopus', 'Puffer', 'Crab'];
  shell('🐙', 'MEMORY / LAB', 'Remember four signals. NORMAL repeats them in order; REVERSE repeats them backward.', `<div class="scorebar"><span>TRIAL <strong id="level">0 / 10</strong></span><span>CURRENT <strong id="mode">NORMAL</strong></span><span>LIVES <strong id="lives">3</strong></span><span>BEST <strong>${best(current) || 0}</strong></span></div><div class="current-banner" id="currentBanner">NORMAL →</div><div class="sequence-grid">${symbols.map((symbol, index) => `<button class="sequence-pad pad-${index}" data-pad="${index}" aria-label="${cueNames[index]}" disabled>${symbol}</button>`).join('')}</div><p id="cue" class="sr-only" role="status" aria-live="assertive" aria-atomic="true"></p><p class="game-status" id="status">Two practice currents come first.</p><div id="result"><button id="start" class="primary-action">Enter the current →</button></div>`);
  const random = seededRandom(`${new Date().toISOString().slice(0, 10)}:${roomId}:kraken`);
  let pattern = [], target = [], index = 0, trial = -2, correct = 0, lives = 3, playing = false, alive = true;
  const timers = new Set();
  const setPadsEnabled = (enabled) => mount.querySelectorAll('[data-pad]').forEach((pad) => { pad.disabled = !enabled; });
  function later(fn, ms) { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); }
  function flash(padIndex) { const pad = $(`[data-pad="${padIndex}"]`); pad.classList.add('lit'); $('#cue').textContent = cueNames[padIndex]; beep(270 + padIndex * 125, .18); vibrate(); later(() => pad.classList.remove('lit'), 320); }
  function next() {
    if (trial >= 10 || lives <= 0) {
      const scored = Math.max(0, correct);
      $('#status').textContent = lives ? 'Current charted.' : 'The current broke your concentration.';
      finish(lives ? 'Ten currents complete!' : 'Dive over', scored, current, { scoreLabel: `${scored} correct current${scored === 1 ? '' : 's'}`, detail: 'Lab question: did Reverse feel learnable?' });
      $('#again').onclick = reset;
      return;
    }
    pattern = Array.from({ length: 4 }, () => Math.floor(random() * 4));
    const mode = trial < 0 ? (trial === -2 ? 'normal' : 'reverse') : random() < .45 ? 'reverse' : 'normal';
    target = expectedSequence(pattern, mode); index = 0; playing = true; setPadsEnabled(false);
    $('#level').textContent = trial < 0 ? `P${trial + 3} / 2` : `${trial + 1} / 10`;
    $('#mode').textContent = mode.toUpperCase();
    $('#currentBanner').textContent = mode === 'reverse' ? '← REVERSE' : 'NORMAL →';
    $('#currentBanner').classList.toggle('reverse', mode === 'reverse');
    $('#status').textContent = `${trial < 0 ? 'Practice. ' : ''}Watch four signals, then go ${mode}.`;
    pattern.forEach((padIndex, cueIndex) => later(() => flash(padIndex), 650 + cueIndex * 520));
    later(() => { playing = false; setPadsEnabled(true); $('#status').textContent = mode === 'reverse' ? 'YOUR TURN · Reverse it: last signal first.' : 'YOUR TURN · Repeat the same order.'; }, 650 + pattern.length * 520);
  }
  $('#start').onclick = () => { $('#result').replaceChildren(); next(); };
  mount.querySelectorAll('[data-pad]').forEach((pad) => pad.onclick = () => {
    if (playing || !pattern.length) return;
    const guess = Number(pad.dataset.pad); flash(guess);
    if (guess !== target[index]) {
      playing = true; setPadsEnabled(false);
      track('kraken_trial', { mode: $('#mode').textContent.toLowerCase(), practice: trial < 0, correct: false, errorAt: index + 1 });
      if (trial >= 0) { lives -= 1; $('#lives').textContent = lives; }
      $('#status').textContent = `Missed signal ${index + 1}. ${trial < 0 ? 'Practice does not cost a life.' : `${lives} lives left.`}`;
      trial += 1; later(next, 1000);
    } else if (++index === target.length) {
      playing = true; setPadsEnabled(false);
      track('kraken_trial', { mode: $('#mode').textContent.toLowerCase(), practice: trial < 0, correct: true });
      if (trial >= 0) correct += 1;
      $('#status').textContent = trial < 0 ? 'Practice clear.' : 'Current clear.';
      trial += 1; later(next, 850);
    }
  });
  function reset() { timers.forEach(clearTimeout); timers.clear(); pattern=[]; target=[]; index=0; trial=-2; correct=0; lives=3; playing=false; $('#lives').textContent='3'; $('#result').replaceChildren(); next(); }
  return () => { alive = false; timers.forEach(clearTimeout); };
}
function abyssExpedition() {
  const depths = [
    { name: 'Shallows', size: 5, mines: 4 },
    { name: 'Blue Drop', size: 6, mines: 7 },
    { name: 'The Trench', size: 7, mines: 10 },
  ];
  shell('💣', 'DEDUCTION / EXPEDITION LAB', 'Clear a solver-verified reef. After each depth, bank the run or risk everything by descending.', `<div class="scorebar"><span>DEPTH <strong id="depth">1 / 3</strong></span><span>SAFE <strong id="safe">0</strong></span><span>FLAGS <strong id="flags">0</strong></span><span>ACTIONS <strong id="actions">0</strong></span></div><div class="depth-card"><span id="depthName">Shallows</span><strong id="contract">Clear the reef</strong><small id="sonarState">One sonar available this expedition</small></div><div class="input-mode-panel"><strong id="inputMode" aria-live="polite">👆 NEXT TAP: REVEAL</strong><small>Flag and sonar are one-shot · long-press also flags</small><div class="mode-actions three"><button class="mode-action active" id="revealMode" aria-pressed="true">👆 Reveal</button><button class="mode-action" id="flagMode" aria-pressed="false">🚩 Flag one</button><button class="mode-action" id="sonarMode" aria-pressed="false">◉ Sonar one</button></div></div><div class="sweep-grid mode-reveal" id="sweepGrid"></div><p class="game-status" id="status">Your first tap opens a safe pocket.</p><div id="result"></div>`);
  const grid = $('#sweepGrid');
  let depthIndex = 0, cleared = 0, runNumber = 0, sonarAvailable = true, assisted = false;
  let mines = new Set(), openTiles = new Set(), flags = new Set(), sonarMarks = new Map();
  let flagMode = false, sonarMode = false, over = false, actions = 0, generation = null;
  let suppressClick = -1;
  let tiles = [];

  function setInputMode(mode, message = '') {
    flagMode = mode === 'flag'; sonarMode = mode === 'sonar';
    grid.classList.toggle('mode-flag', flagMode); grid.classList.toggle('mode-sonar', sonarMode); grid.classList.toggle('mode-reveal', !flagMode && !sonarMode);
    $('#inputMode').textContent = flagMode ? '🚩 NEXT TAP: FLAG ONE TILE' : sonarMode ? '◉ NEXT TAP: SCAN ONE ZONE' : '👆 NEXT TAP: REVEAL';
    for (const [id, active] of [['revealMode', !flagMode && !sonarMode], ['flagMode', flagMode], ['sonarMode', sonarMode]]) { $(`#${id}`).classList.toggle('active', active); $(`#${id}`).setAttribute('aria-pressed', String(active)); }
    if (message) $('#status').textContent = message;
  }

  const config = () => depths[depthIndex];
  const safeTarget = () => config().size * config().size - config().mines;
  function cellNeighbors(cell) { return neighbors(cell, config().size); }
  function countNear(cell) { return cellNeighbors(cell).filter((candidate) => mines.has(candidate)).length; }

  function buildGrid() {
    const { size } = config();
    grid.style.setProperty('--grid-size', size);
    grid.innerHTML = Array.from({ length: size * size }, (_, index) => `<button class="sweep-tile" data-tile="${index}" aria-label="Row ${Math.floor(index / size) + 1}, column ${index % size + 1}, hidden"></button>`).join('');
    tiles = [...grid.querySelectorAll('[data-tile]')];
    tiles.forEach((tile) => {
      const cell = Number(tile.dataset.tile);
      tile.onclick = () => { if (suppressClick === cell) { suppressClick = -1; return; } tap(cell); };
      tile.oncontextmenu = (event) => { event.preventDefault(); if (flag(cell) && flagMode) setInputMode('reveal', 'Flag placed. Back to Reveal.'); };
      let hold, startX, startY;
      const cancelHold = () => { clearTimeout(hold); hold = null; };
      tile.onpointerdown = (event) => { if (event.pointerType === 'mouse') return; startX = event.clientX; startY = event.clientY; hold = setTimeout(() => { hold = null; suppressClick = cell; if (flag(cell) && flagMode) setInputMode('reveal', 'Flag placed. Back to Reveal.'); setTimeout(() => { if (suppressClick === cell) suppressClick = -1; }, 700); }, 520); };
      tile.onpointermove = (event) => { if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancelHold(); };
      tile.onpointerup = cancelHold; tile.onpointercancel = cancelHold; tile.onpointerleave = cancelHold;
    });
  }

  function draw() {
    const { size, mines: mineCount } = config();
    tiles.forEach((tile, cell) => {
      const adjacent = mines.size ? countNear(cell) : 0;
      const revealed = openTiles.has(cell);
      const sonar = sonarMarks.get(cell);
      tile.className = `sweep-tile ${revealed ? 'revealed' : ''} ${mines.has(cell) && over ? 'mine' : ''} ${sonar !== undefined ? 'sonar' : ''}`;
      tile.setAttribute('aria-label', `Row ${Math.floor(cell / size) + 1}, column ${cell % size + 1}${flags.has(cell) ? ', flagged' : revealed ? `, ${adjacent} adjacent mines` : sonar !== undefined ? `, sonar reports ${sonar} mines nearby` : ', hidden'}`);
      tile.textContent = flags.has(cell) ? '🚩' : revealed || (over && mines.has(cell)) ? mines.has(cell) ? '💣' : adjacent || '·' : sonar !== undefined ? String(sonar) : '';
    });
    $('#depth').textContent = `${depthIndex + 1} / ${depths.length}`;
    $('#safe').textContent = `${openTiles.size} / ${safeTarget()}`;
    $('#flags').textContent = `${flags.size} / ${mineCount}`;
    $('#actions').textContent = actions;
  }

  function plant(first) {
    const seed = `${new Date().toISOString().slice(0, 10)}:${roomId}:${runNumber}:${depthIndex}:${first}`;
    generation = generateDeducibleBoard({ size: config().size, mineCount: config().mines, first, seed });
    mines = generation.mines;
    track('abyss_board_generated', { depth: depthIndex + 1, size: config().size, mines: config().mines, attempts: generation.attempt, opening: generation.opening });
  }

  function reveal(start) {
    const queue = [start];
    while (queue.length) {
      const cell = queue.pop();
      if (openTiles.has(cell) || flags.has(cell) || mines.has(cell)) continue;
      openTiles.add(cell);
      if (!countNear(cell)) queue.push(...cellNeighbors(cell));
    }
  }

  function flag(cell) {
    if (over || openTiles.has(cell)) return false;
    if (flags.has(cell)) flags.delete(cell);
    else if (flags.size < config().mines) flags.add(cell);
    else { note(`Only ${config().mines} flags at this depth`); return false; }
    actions += 1; vibrate(); draw(); return true;
  }

  function useSonar(cell) {
    if (!sonarAvailable || !mines.size || openTiles.has(cell)) return;
    const scanned = new Set([cell, ...cellNeighbors(cell)]);
    const count = [...scanned].filter((candidate) => mines.has(candidate)).length;
    sonarAvailable = false; assisted = true; sonarMarks.set(cell, count); actions += 1;
    $('#sonarMode').textContent = '◉ Sonar spent'; $('#sonarMode').disabled = true; $('#sonarMode').setAttribute('aria-pressed', 'false');
    $('#sonarState').textContent = `Assisted expedition · ${count} mine${count === 1 ? '' : 's'} in that zone`;
    setInputMode('reveal', `Sonar reports ${count} mine${count === 1 ? '' : 's'} in the highlighted 3×3 zone. Back to Reveal.`);
    track('abyss_sonar', { depth: depthIndex + 1, count });
    vibrate('medium'); beep(620, .14); draw();
  }

  function tap(cell) {
    if (over) return;
    if (sonarMode) return useSonar(cell);
    if (flagMode) { if (flag(cell)) setInputMode('reveal', 'Flag placed. Back to Reveal.'); return; }
    if (flags.has(cell)) return note('That tile is flagged. Choose Flag one to remove it.');
    if (!mines.size) {
      try { plant(cell); }
      catch { over = true; $('#status').textContent = 'This reef could not be proven fair. Start a new expedition.'; finish('Generation stopped safely', cleared, current, { scoreLabel: `${cleared} depths banked`, detail: 'No unverified board was served' }); $('#again').onclick = resetExpedition; return; }
    }
    actions += 1;
    if (openTiles.has(cell)) return note('Already revealed. Pick a hidden tile.');
    if (mines.has(cell)) return detonate(cell);
    reveal(cell); vibrate(); beep(430, .05); draw(); checkClear();
  }

  function detonate() {
    over = true; draw(); $('#status').textContent = 'The reef bites back. Unbanked depth is lost.';
    track('abyss_detonate', { depth: depthIndex + 1, cleared, actions, assisted });
    finish('Expedition lost', cleared, current, { scoreLabel: `${cleared} depth${cleared === 1 ? '' : 's'} cleared`, detail: assisted ? 'Assisted with sonar' : 'Clean expedition' });
    $('#again').onclick = resetExpedition;
  }

  function checkClear() {
    if (openTiles.size !== safeTarget() || over) return;
    over = true; cleared += 1; draw();
    if (depthIndex === depths.length - 1) {
      $('#status').textContent = 'The trench is mapped. You made it back.';
      finish('Full expedition!', cleared, current, { scoreLabel: 'All 3 depths cleared', detail: `${actions} actions this depth${assisted ? ' · sonar assisted' : ' · clean'}` });
      $('#again').onclick = resetExpedition; return;
    }
    $('#status').textContent = `${config().name} clear. Bank depth ${cleared}, or risk it in ${depths[depthIndex + 1].name}.`;
    $('#result').innerHTML = `<div class="decision-card"><span>COMMITMENT POINT</span><h3>Surface or descend?</h3><p>Surface saves depth ${cleared}. Descend keeps the expedition alive—but one mine loses the run.</p><div class="decision-actions"><button class="secondary-action" id="surface">Surface · bank ${cleared}</button><button class="primary-action" id="descend">Descend to ${depths[depthIndex + 1].name} ↓</button></div></div>`;
    $('#surface').onclick = () => { track('abyss_commitment', { choice: 'surface', cleared }); finish('Depth banked', cleared, current, { scoreLabel: `${cleared} depth${cleared === 1 ? '' : 's'} secured`, detail: assisted ? 'Assisted with sonar' : 'Clean expedition' }); $('#again').onclick = resetExpedition; };
    $('#descend').onclick = () => { track('abyss_commitment', { choice: 'descend', cleared }); depthIndex += 1; startDepth(); };
  }

  function startDepth() {
    mines.clear(); openTiles.clear(); flags.clear(); sonarMarks.clear(); generation = null; actions = 0; over = false;
    $('#depthName').textContent = config().name; $('#contract').textContent = `${config().size}×${config().size} · ${config().mines} mines`;
    $('#status').textContent = 'Your first tap opens a safe pocket.'; $('#result').replaceChildren();
    setInputMode('reveal');
    $('#sonarMode').disabled = !sonarAvailable; $('#sonarMode').textContent = sonarAvailable ? '◉ Sonar one' : '◉ Sonar spent';
    $('#sonarState').textContent = sonarAvailable ? 'One sonar available this expedition' : 'Sonar already spent';
    buildGrid(); draw();
  }

  function resetExpedition() { runNumber += 1; depthIndex = 0; cleared = 0; sonarAvailable = true; assisted = false; startDepth(); }
  $('#revealMode').onclick = () => { setInputMode('reveal', 'Reveal selected. Your next tile tap opens it.'); vibrate(); };
  $('#flagMode').onclick = () => { if (over) return; setInputMode('flag', 'Flag armed for one tile. After that, Reveal returns automatically.'); vibrate(); };
  $('#sonarMode').onclick = () => { if (!sonarAvailable || over) return; if (!mines.size) return note('Reveal one tile before using sonar'); setInputMode('sonar', 'Sonar armed for one 3×3 zone. Tap a hidden center tile.'); vibrate(); };
  startDepth(); return () => {};
}

function tideTell() {
  const creatures = [
    { icon: '🦀', name: 'CRAB' },
    { icon: '🐙', name: 'OCTOPUS' },
    { icon: '🪼', name: 'JELLYFISH' },
  ];
  const rules = [
    ['tap', 'hold', 'wait'],
    ['wait', 'tap', 'hold'],
    ['hold', 'wait', 'tap'],
  ];
  const actionLabels = { tap: 'TAP', hold: 'HOLD', wait: 'DON’T TOUCH' };
  shell('🪼', 'INHIBITION / SOLO LAB', 'Read the rule, then act—or resist. Calm water forgives misses; a Deep Dive doubles points but ends on one bad read.', `<div class="scorebar"><span>WAVE <strong id="wave">1 / 3</strong></span><span>CUE <strong id="cueNumber">0 / 6</strong></span><span>READS <strong id="reads">0</strong></span><span>COMBO <strong id="combo">0</strong></span></div><div class="rule-board" id="ruleBoard"></div><button class="tell-zone idle" id="tellZone" aria-label="Tide Tell cue area"><span id="tellIcon">🪼</span><strong id="tellName">Read the rule</strong><small id="tellHint">Tap Start when ready</small></button><p class="game-status" id="status">Every cue has exactly one correct response.</p><div id="result"><button id="start" class="primary-action">Start Tide Tell →</button></div>`);
  const zone = $('#tellZone');
  const random = seededRandom(`${new Date().toISOString().slice(0, 10)}:${roomId}:tide`);
  let wave = 0, cueIndex = 0, score = 0, combo = 0, active = false, resolved = false, deep = false, currentCreature = 0;
  let cueTimer, holdTimer, deepConfirmTimer, pointerDownAt = 0, deepArmed = false;

  function renderRule() {
    $('#ruleBoard').innerHTML = creatures.map((creature, index) => `<div><span>${creature.icon} ${creature.name}</span><strong>${actionLabels[rules[wave][index]]}</strong></div>`).join('');
    $('#wave').textContent = `${wave + 1} / ${rules.length}`;
  }

  function chooseCurrent() {
    active = false; resolved = true; deepArmed = false; clearTimeout(cueTimer); clearTimeout(holdTimer); clearTimeout(deepConfirmTimer);
    if (wave >= rules.length) return complete('All currents read');
    renderRule();
    $('#result').innerHTML = `<div class="decision-card"><span>CHOOSE THE PRESSURE</span><h3>${wave ? 'The rule changed.' : 'How deep are you going?'}</h3><p>Calm water gives feedback and continues after mistakes. Deep Dive scores double, moves faster, and ends on one bad read.</p><div class="decision-actions"><button class="secondary-action" id="calm">Calm water</button><button class="primary-action" id="deep">Deep Dive · 2×</button></div></div>`;
    $('#calm').onclick = () => startWave(false);
    $('#deep').onclick = () => {
      if (deepArmed) return startWave(true);
      deepArmed = true; $('#deep').textContent = 'Confirm Deep Dive · 2×'; $('#status').textContent = 'Deep Dive ends on one mistake. Tap again to confirm.'; vibrate('medium');
      deepConfirmTimer = setTimeout(() => { deepArmed = false; if ($('#deep')) $('#deep').textContent = 'Deep Dive · 2×'; }, 2600);
    };
    zone.className = 'tell-zone idle'; $('#tellIcon').textContent = '🌊'; $('#tellName').textContent = 'Choose your pressure'; $('#tellHint').textContent = 'The rule is visible above';
  }

  function startWave(isDeep) {
    deep = isDeep; deepArmed = false; clearTimeout(deepConfirmTimer); cueIndex = 0; active = false; resolved = true; $('#cueNumber').textContent = '0 / 6'; $('#result').replaceChildren();
    track('tide_pressure', { wave: wave + 1, choice: deep ? 'deep' : 'calm' });
    $('#status').textContent = `${deep ? 'Deep Dive: one miss ends the run.' : 'Calm water: misses break the combo.'} Rule locked for this wave.`;
    zone.className = 'tell-zone idle'; $('#tellIcon').textContent = '3'; $('#tellName').textContent = deep ? 'DEEP DIVE' : 'CALM WATER'; $('#tellHint').textContent = 'Rule locked · get ready';
    cueTimer = setTimeout(nextCue, 850);
  }

  function nextCue() {
    clearTimeout(cueTimer); clearTimeout(holdTimer);
    if (cueIndex >= 6) { wave += 1; return chooseCurrent(); }
    currentCreature = Math.floor(random() * creatures.length); resolved = false; active = true;
    const creature = creatures[currentCreature];
    zone.className = `tell-zone live action-${rules[wave][currentCreature]}`;
    $('#tellIcon').textContent = creature.icon; $('#tellName').textContent = creature.name;
    $('#tellHint').textContent = deep ? 'Deep current · decide now' : 'Read the rule above';
    $('#cueNumber').textContent = `${cueIndex + 1} / 6`;
    zone.setAttribute('aria-label', `${creature.name}. Consult the current rule.`);
    const windowMs = deep ? 1250 : 1850;
    cueTimer = setTimeout(() => resolve('wait'), windowMs);
  }

  function resolve(action) {
    if (!active || resolved) return;
    resolved = true; active = false; clearTimeout(cueTimer); clearTimeout(holdTimer);
    const expected = rules[wave][currentCreature];
    const correct = tideActionMatches(expected, action);
    track('tide_cue', { wave: wave + 1, pressure: deep ? 'deep' : 'calm', expected, actual: action, correct });
    if (correct) {
      score += deep ? 2 : 1; combo += 1; $('#reads').textContent = score; $('#combo').textContent = combo;
      zone.className = 'tell-zone correct'; $('#tellHint').textContent = `${actionLabels[action]} · correct`; $('#status').textContent = combo >= 4 ? `${combo} clean reads. Stay sharp.` : 'Clean read.';
      beep(620 + Math.min(combo, 6) * 35, .08); vibrate(combo >= 4 ? 'medium' : 'light'); cueIndex += 1; cueTimer = setTimeout(nextCue, 430);
    } else {
      combo = 0; $('#combo').textContent = '0'; zone.className = 'tell-zone wrong'; $('#tellHint').textContent = `Needed ${actionLabels[expected]}`;
      $('#status').textContent = `You chose ${actionLabels[action]}; ${creatures[currentCreature].name} needed ${actionLabels[expected]}.`;
      beep(150, .18); vibrate('heavy');
      if (deep) return cueTimer = setTimeout(() => complete('Deep Dive broken'), 800);
      cueIndex += 1; cueTimer = setTimeout(nextCue, 900);
    }
  }

  function complete(message) {
    active = false; clearTimeout(cueTimer); clearTimeout(holdTimer);
    finish(message, score, current, { scoreLabel: `${score} weighted read${score === 1 ? '' : 's'}`, detail: `Reached wave ${Math.min(wave + 1, 3)} · accuracy is worth more than speed` });
    $('#again').onclick = reset;
  }

  function reset() { wave = 0; cueIndex = 0; score = 0; combo = 0; deep = false; $('#reads').textContent = '0'; $('#combo').textContent = '0'; $('#result').replaceChildren(); chooseCurrent(); }
  zone.onpointerdown = (event) => {
    if (!active || resolved) return;
    event.preventDefault(); pointerDownAt = performance.now();
    holdTimer = setTimeout(() => resolve('hold'), 480);
  };
  zone.onpointerup = (event) => {
    if (!active || resolved) return;
    event.preventDefault(); clearTimeout(holdTimer);
    if (performance.now() - pointerDownAt < 480) resolve('tap');
  };
  zone.onpointercancel = () => clearTimeout(holdTimer);
  $('#start').onclick = chooseCurrent;
  renderRule();
  return () => { active = false; clearTimeout(cueTimer); clearTimeout(holdTimer); clearTimeout(deepConfirmTimer); };
}

function echoWake() {
  const size = 7;
  const rocks = [9, 11, 15, 19, 29, 33, 37, 39];
  const random = seededRandom(`${new Date().toISOString().slice(0, 10)}:${roomId}:echo`);
  shell('👻', 'DELAYED SPATIAL PLANNING / LAB', 'Tap an adjacent tile. Every move leaves a wake that erupts in three turns—collect seven pearls without colliding with your own past.', `<div class="scorebar"><span>PEARLS <strong id="echoScore">0 / 7</strong></span><span>MOVES <strong id="echoMoves">0 / 28</strong></span><span>WAKE <strong>3 turns</strong></span></div><div class="echo-grid" id="echoGrid" role="grid" aria-label="Echo Wake reef"></div><p class="game-status" id="status">Numbered wakes show exactly when they erupt.</p><div id="result"><button class="primary-action" id="start">Enter the wake →</button></div>`);
  const grid = $('#echoGrid');
  grid.innerHTML = Array.from({ length: size * size }, (_, cell) => `<button class="echo-cell" data-cell="${cell}" role="gridcell" aria-label="Reef tile ${cell + 1}"></button>`).join('');
  let state, score, moves, over = true, run = 0;
  function spawnPearl() {
    const blocked = new Set([state.position, ...rocks, ...state.wakes.map((wake) => wake.cell)]);
    const choices = Array.from({ length: size * size }, (_, cell) => cell).filter((cell) => !blocked.has(cell));
    state.pearls = [choices[Math.floor(random() * choices.length)]];
  }
  function draw(erupted = []) {
    const wakeMap = new Map(state.wakes.map((wake) => [wake.cell, wake.turns]));
    grid.querySelectorAll('[data-cell]').forEach((tile) => {
      const cell = Number(tile.dataset.cell);
      const row = Math.floor(cell / size), column = cell % size;
      const wake = wakeMap.get(cell);
      const isRock = rocks.includes(cell), isPearl = state.pearls.includes(cell), isPlayer = cell === state.position;
      const playerRow = Math.floor(state.position / size), playerColumn = state.position % size;
      const isNext = !isRock && Math.abs(playerRow - row) + Math.abs(playerColumn - column) === 1;
      tile.className = `echo-cell ${isRock ? 'rock' : ''} ${isNext ? 'next' : ''} ${wake ? `wake wake-${wake}` : ''} ${erupted.includes(cell) ? 'erupted' : ''}`;
      tile.textContent = isPlayer ? '🦞' : isPearl ? '⚪' : isRock ? '🪨' : wake ? String(wake) : '';
      tile.disabled = over || !isNext;
      tile.setAttribute('aria-label', `Row ${row + 1}, column ${column + 1}${isPlayer ? ', your lobster' : isPearl ? ', pearl' : isRock ? ', rock' : wake ? `, wake erupts in ${wake}` : ', clear'}${isNext ? ', available move' : ''}`);
    });
    $('#echoScore').textContent = `${score} / 7`; $('#echoMoves').textContent = `${moves} / 28`;
  }
  function end(message, detail) {
    over = true; draw(); finish(message, score, current, { scoreLabel: `${score} pearl${score === 1 ? '' : 's'} recovered`, detail }); $('#again').onclick = reset;
  }
  function move(cell) {
    if (over) return;
    const row = Math.floor(state.position / size), column = state.position % size;
    const nextRow = Math.floor(cell / size), nextColumn = cell % size;
    if (Math.abs(row - nextRow) + Math.abs(column - nextColumn) !== 1) return note('Move one adjacent tile');
    const previous = state.position;
    const next = echoWakeStep(state, [nextRow, nextColumn], size, 3);
    if (next.error) return note(next.error === 'rock' ? 'A rock blocks that route' : 'The reef ends there');
    state = next; moves += 1;
    if (state.collected) { score += 1; beep(720, .08); vibrate('medium'); if (score < 7) spawnPearl(); }
    draw(state.erupted);
    track('echo_move', { run, move: moves, from: previous, to: cell, collected: state.collected, hit: state.hit });
    if (state.hit) return end('Caught by your own wake', `Move ${moves} returned to a tile you armed three turns earlier`);
    if (score >= 7) return end('Wake mastered!', `${moves} moves · every eruption was visible`);
    if (moves >= 28) return end('The tide closed', 'You ran out of moves before the seventh pearl');
    $('#status').textContent = state.wakes.some((wake) => wake.turns === 1) ? 'DANGER: a red wake erupts after your next move.' : 'Glowing adjacent tiles are your legal moves.';
  }
  function reset() {
    run += 1; score = 0; moves = 0; over = false;
    state = { position: 24, wakes: [], pearls: [], rocks: [...rocks] };
    spawnPearl(); $('#result').replaceChildren(); $('#status').textContent = 'Collect seven pearls. Your old tile starts a three-turn countdown.'; draw();
  }
  grid.querySelectorAll('[data-cell]').forEach((tile) => tile.onclick = () => move(Number(tile.dataset.cell)));
  $('#start').onclick = reset;
  state = { position: 24, wakes: [], pearls: [3], rocks: [...rocks] }; score = 0; moves = 0; draw();
  return () => { over = true; };
}

function pearlRicochet() {
  shell('⚪', 'DEXTERITY + PLANNING / LAB', 'Drag from the pearl toward your target, then release. Bank through the numbered gates in order before four shots run out.', `<div class="scorebar"><span>GATES <strong id="ricochetScore">0 / 4</strong></span><span>SHOTS <strong id="ricochetShots">4</strong></span><span>COURSE <strong>Daily</strong></span></div><div class="ricochet-wrap"><canvas id="ricochetCanvas" width="640" height="720" aria-label="Pearl Ricochet course"></canvas></div><div class="ricochet-controls" aria-label="Accessible aim controls"><button id="aimLeft" aria-label="Rotate aim left">↶ Aim</button><button id="firePearl">Fire</button><button id="aimRight" aria-label="Rotate aim right">Aim ↷</button></div><p class="game-status" id="status">Drag to aim, or use the three aim controls.</p><div id="result"><button class="primary-action" id="start">Rack the pearl →</button></div>`);
  const canvas = $('#ricochetCanvas'), context = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  const gates = [{ x: 170, y: 530 }, { x: 485, y: 410 }, { x: 200, y: 250 }, { x: 500, y: 110 }];
  let pearl, gate, shots, aiming = false, aim, aimAngle = -Math.PI / 4, moving = false, frame, over = true, ticks = 0;
  function syncControls() { for (const id of ['aimLeft', 'firePearl', 'aimRight']) $(`#${id}`).disabled = moving || over; }
  const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height }; };
  function draw() {
    context.clearRect(0, 0, width, height);
    const gradient = context.createLinearGradient(0, 0, 0, height); gradient.addColorStop(0, '#0b4661'); gradient.addColorStop(1, '#031622'); context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#1d6a75'; context.lineWidth = 10; context.strokeRect(5, 5, width - 10, height - 10);
    gates.forEach((item, index) => { context.beginPath(); context.arc(item.x, item.y, 30, 0, Math.PI * 2); context.fillStyle = index < gate ? '#0f6c5d' : index === gate ? '#ffc94d' : '#173d50'; context.fill(); context.strokeStyle = index === gate ? '#fff1a7' : '#39748a'; context.lineWidth = 5; context.stroke(); context.fillStyle = '#041420'; context.font = 'bold 28px system-ui'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(index + 1), item.x, item.y); });
    const guide = aiming && aim ? aim : { x: pearl.x + Math.cos(aimAngle) * 150, y: pearl.y + Math.sin(aimAngle) * 150 };
    if (!moving) { context.setLineDash([12, 10]); context.strokeStyle = '#eef8f4'; context.lineWidth = 4; context.beginPath(); context.moveTo(pearl.x, pearl.y); context.lineTo(guide.x, guide.y); context.stroke(); context.setLineDash([]); }
    context.beginPath(); context.arc(pearl.x, pearl.y, 18, 0, Math.PI * 2); context.fillStyle = '#fff8dc'; context.shadowColor = '#ffffff'; context.shadowBlur = 18; context.fill(); context.shadowBlur = 0; context.strokeStyle = '#ffc94d'; context.lineWidth = 4; context.stroke();
  }
  function stop(message) {
    moving = false; cancelAnimationFrame(frame); pearl.vx = 0; pearl.vy = 0; draw(); syncControls();
    if (gate >= gates.length) { over = true; finish('Course cleared!', gate, current, { scoreLabel: 'All four gates', detail: `${4 - shots} shot${4 - shots === 1 ? '' : 's'} used` }); $('#again').onclick = reset; return; }
    if (!shots) { over = true; finish('Pearl spent', gate, current, { scoreLabel: `${gate} gate${gate === 1 ? '' : 's'} cleared`, detail: `Needed gate ${gate + 1} next` }); $('#again').onclick = reset; return; }
    $('#status').textContent = message || `Gate ${gate + 1} is still open. ${shots} shot${shots === 1 ? '' : 's'} left.`;
  }
  function animate() {
    if (!moving) return;
    pearl = reflectPearl(pearl, width, height, 18); ticks += 1;
    pearl.vx *= .996; pearl.vy *= .996;
    const target = gates[gate];
    if (target && Math.hypot(pearl.x - target.x, pearl.y - target.y) < 42) { gate += 1; beep(560 + gate * 70, .08); vibrate('medium'); $('#ricochetScore').textContent = `${gate} / 4`; }
    draw();
    if (ticks > 560 || Math.hypot(pearl.vx, pearl.vy) < .35) return stop();
    frame = requestAnimationFrame(animate);
  }
  function launch(dx, dy) {
    if (moving || over) return;
    const distance = Math.hypot(dx, dy);
    if (distance < 30) return draw();
    aimAngle = Math.atan2(dy, dx); const speed = Math.min(10, Math.max(4.5, distance / 22)); pearl.vx = dx / distance * speed; pearl.vy = dy / distance * speed;
    shots -= 1; ticks = 0; moving = true; syncControls(); $('#ricochetShots').textContent = shots; $('#status').textContent = `SHOT IN MOTION · aiming locked · gate ${gate + 1} next`; track('ricochet_shot', { gate: gate + 1, shotsLeft: shots, speed: Number(speed.toFixed(2)) }); animate();
  }
  function release(event) { if (!aiming || moving || over) return; aim = point(event); aiming = false; launch(aim.x - pearl.x, aim.y - pearl.y); }
  canvas.onpointerdown = (event) => { if (moving || over) return; const cursor = point(event); if (Math.hypot(cursor.x - pearl.x, cursor.y - pearl.y) > 55) return note('Start your drag on the pearl'); aiming = true; aim = cursor; canvas.setPointerCapture?.(event.pointerId); draw(); };
  canvas.onpointermove = (event) => { if (!aiming) return; aim = point(event); draw(); };
  canvas.onpointerup = release; canvas.onpointercancel = () => { aiming = false; draw(); };
  $('#aimLeft').onclick = () => { if (!moving && !over) { aimAngle -= Math.PI / 18; draw(); } }; $('#aimRight').onclick = () => { if (!moving && !over) { aimAngle += Math.PI / 18; draw(); } }; $('#firePearl').onclick = () => launch(Math.cos(aimAngle) * 150, Math.sin(aimAngle) * 150);
  function reset() { cancelAnimationFrame(frame); pearl = { x: 85, y: 650, vx: 0, vy: 0 }; gate = 0; shots = 4; aimAngle = Math.atan2(gates[0].y - pearl.y, gates[0].x - pearl.x); over = false; moving = false; aiming = false; aim = null; $('#ricochetScore').textContent = '0 / 4'; $('#ricochetShots').textContent = '4'; $('#result').replaceChildren(); $('#status').textContent = 'AIMING · drag from the pearl, or use Aim + Fire. Gate 1 is gold.'; draw(); syncControls(); }
  pearl = { x: 85, y: 650, vx: 0, vy: 0 }; gate = 0; shots = 4; draw(); syncControls(); $('#start').onclick = reset;
  return () => { over = true; cancelAnimationFrame(frame); };
}

function shellShift() {
  const size = 5, icons = ['🐚', '🪸', '⭐', '🦀'];
  const random = seededRandom(`${new Date().toISOString().slice(0, 10)}:${roomId}:shell-shift`);
  shell('🐚', 'DISCRETE BOARD TACTICS / LAB', 'Select a row or column, then shift the whole current. Groups of three or more clear; the visible forecast refills the reef.', `<div class="scorebar"><span>SHELLS <strong id="shiftScore">0</strong></span><span>MOVES <strong id="shiftMoves">12</strong></span><span>CHAIN <strong id="shiftChain">—</strong></span></div><div class="forecast-card">NEXT CURRENT <strong id="forecast"></strong></div><div class="shift-grid" id="shiftGrid" role="grid" aria-label="Shell Shift reef"></div><div class="shift-controls"><button class="secondary-action" id="rowMode" aria-pressed="true">Shift row</button><button class="secondary-action" id="columnMode" aria-pressed="false">Shift column</button><button aria-label="Shift selected line backward" id="shiftBack">← / ↑</button><button aria-label="Shift selected line forward" id="shiftForward">→ / ↓</button></div><p class="game-status" id="status">Choose a line, then move the current.</p><div id="result"><button class="primary-action" id="start">Wake the reef →</button></div>`);
  const grid = $('#shiftGrid');
  grid.innerHTML = Array.from({ length: size * size }, (_, cell) => `<button class="shift-cell" data-cell="${cell}" role="gridcell"></button>`).join('');
  let board = [], forecast = [], axis = 'row', selected = null, moves = 12, score = 0, over = true;
  const nextIcon = () => Math.floor(random() * icons.length);
  function draw(highlight = []) {
    const selectedCells = new Set(selected == null ? [] : Array.from({ length: size }, (_, offset) => axis === 'row' ? selected * size + offset : offset * size + selected));
    grid.querySelectorAll('[data-cell]').forEach((tile) => { const cell = Number(tile.dataset.cell); tile.textContent = icons[board[cell]]; tile.className = `shift-cell ${selectedCells.has(cell) ? 'selected' : ''} ${highlight.includes(cell) ? 'clearing' : ''}`; tile.disabled = over; tile.setAttribute('aria-label', `Row ${Math.floor(cell / size) + 1}, column ${cell % size + 1}, ${icons[board[cell]]}${selectedCells.has(cell) ? ', selected line' : ''}`); });
    $('#forecast').textContent = forecast.map((value) => icons[value]).join(' '); $('#shiftScore').textContent = score; $('#shiftMoves').textContent = moves;
    $('#shiftBack').disabled = over || selected == null; $('#shiftForward').disabled = over || selected == null;
    $('#shiftBack').textContent = axis === 'row' ? '← Shift row' : '↑ Shift column'; $('#shiftForward').textContent = axis === 'row' ? 'Shift row →' : 'Shift column ↓';
  }
  function settle() {
    let chain = 0, total = 0, clusters;
    while ((clusters = reefClusters(board, size)).length && chain < 4) {
      chain += 1; const cleared = [...new Set(clusters.flat())]; total += cleared.length * chain;
      cleared.forEach((cell) => { board[cell] = null; });
      for (let column = 0; column < size; column += 1) {
        const kept = Array.from({ length: size }, (_, row) => board[row * size + column]).filter((value) => value != null);
        while (kept.length < size) { kept.unshift(forecast.shift()); forecast.push(nextIcon()); }
        kept.forEach((value, row) => { board[row * size + column] = value; });
      }
    }
    score += total; $('#shiftChain').textContent = chain ? `${chain}×` : '—';
    if (chain) { beep(520 + chain * 90, .1); vibrate(chain > 1 ? 'heavy' : 'medium'); $('#status').textContent = `${total} shells cleared${chain > 1 ? ` in a ${chain}× chain` : ''}.`; }
    else $('#status').textContent = 'No cluster. Use the forecast to set up the next current.';
  }
  function shift(amount) {
    if (over || selected == null) return note(`Choose a ${axis} first`); board = shiftReef(board, size, axis, selected, amount); moves -= 1; settle(); draw(); track('shell_shift', { axis, selected, amount, moves, score });
    if (!moves) { over = true; draw(); finish('Tide exhausted', score, current, { scoreLabel: `${score} shell points`, detail: 'Whole-line planning beats lucky swaps' }); $('#again').onclick = reset; }
  }
  function setAxis(next) { axis = next; selected = null; $('#rowMode').setAttribute('aria-pressed', String(axis === 'row')); $('#columnMode').setAttribute('aria-pressed', String(axis === 'column')); $('#rowMode').classList.toggle('active', axis === 'row'); $('#columnMode').classList.toggle('active', axis === 'column'); $('#status').textContent = `ROW/COLUMN: ${axis.toUpperCase()} · choose one on the board.`; draw(); }
  grid.querySelectorAll('[data-cell]').forEach((tile) => tile.onclick = () => { const cell = Number(tile.dataset.cell); selected = axis === 'row' ? Math.floor(cell / size) : cell % size; $('#status').textContent = `${axis === 'row' ? 'Row' : 'Column'} ${selected + 1} selected. Choose a direction below.`; draw(); });
  $('#rowMode').onclick = () => setAxis('row'); $('#columnMode').onclick = () => setAxis('column'); $('#shiftBack').onclick = () => shift(-1); $('#shiftForward').onclick = () => shift(1);
  function reset() { board = Array.from({ length: size * size }, nextIcon); forecast = Array.from({ length: 10 }, nextIcon); axis = 'row'; selected = null; moves = 12; score = 0; over = false; $('#result').replaceChildren(); setAxis('row'); }
  board = Array.from({ length: size * size }, nextIcon); forecast = Array.from({ length: 10 }, nextIcon); draw(); $('#start').onclick = reset;
  return () => { over = true; };
}

function clawcadePanic() {
  const scenes = [
    { command: 'CRACK THE CLAM!', hint: 'Tap the closed shell', html: '<button data-win="tap" class="panic-prop giant">🦪</button><span class="panic-prop decoy">🐚</span>' },
    { command: 'HOLD THE AIRLOCK!', hint: 'Press and hold until it seals', html: '<button data-win="hold" class="panic-prop giant">🛞</button><span class="panic-spray">💦 💦</span>' },
    { command: 'DON’T WAKE THE KRAKEN!', hint: 'Hands off. Let it sleep.', html: '<button data-lose="touch" class="panic-prop giant sleeping">🐙<small>z z z</small></button>' },
    { command: 'FIND THE IMPOSTER!', hint: 'One crab faces the wrong way', html: '<div class="panic-choices"><button>🦀</button><button>🦀</button><button data-win="tap">🦞</button><button>🦀</button></div>' },
    { command: 'POP THE BIG ONE!', hint: 'Size matters', html: '<div class="panic-choices bubbles"><button>◯</button><button data-win="tap">◉</button><button>○</button><button>∘</button></div>' },
    { command: 'CUT THE RED WIRE!', hint: 'Not coral. Not orange. Red.', html: '<div class="panic-wires"><button>🟠</button><button data-win="tap">🔴</button><button>🟣</button></div>' },
  ];
  shell('🚨', 'AUTHORED MICROGAME GAUNTLET / LAB', 'Six original emergencies. Read the command, then tap, hold, or deliberately do nothing before the siren closes.', `<div class="scorebar"><span>SAVED <strong id="panicScore">0</strong></span><span>SCENE <strong id="panicScene">0 / 6</strong></span><span>TIME <strong id="panicTime">—</strong></span></div><div class="panic-stage" id="panicStage"><div class="panic-command" id="panicCommand">READY?</div><p id="panicHint">Commands are short. The joke is visual. Failure is immediate.</p><div id="panicProps" class="panic-props">🚨</div></div><p class="game-status" id="status">No scene should need an explanation after the command.</p><div id="result"><button class="primary-action" id="start">Start the panic →</button></div>`);
  let index = 0, score = 0, active = false, timer, ticker, deadline, holdTimer, alive = true;
  function resolve(won, why) {
    if (!active) return; active = false; clearTimeout(timer); clearTimeout(holdTimer); clearInterval(ticker);
    track('panic_scene', { scene: index + 1, won, why });
    if (won) { score += 1; beep(690, .08); vibrate('medium'); $('#status').textContent = `${scenes[index].command.replace('!', '')} — saved.`; }
    else { beep(145, .15); vibrate('heavy'); $('#status').textContent = why; }
    $('#panicScore').textContent = score; $('#panicStage').classList.toggle('failed', !won); index += 1; setTimeout(next, 520);
  }
  function next() {
    if (!alive) return;
    if (index >= scenes.length) { finish(score === scenes.length ? 'Perfect panic!' : 'Shift survived', score, current, { scoreLabel: `${score} of ${scenes.length} emergencies saved`, detail: score === scenes.length ? 'Every command read cleanly' : 'Replay is one tap away' }); $('#again').onclick = reset; return; }
    const scene = scenes[index]; active = true; $('#panicStage').classList.remove('failed'); $('#panicCommand').textContent = scene.command; $('#panicHint').textContent = scene.hint; $('#panicProps').innerHTML = scene.html; $('#panicScene').textContent = `${index + 1} / ${scenes.length}`;
    deadline = performance.now() + (scene.command.includes('KRAKEN') ? 1800 : 3000); clearInterval(ticker); ticker = setInterval(() => { $('#panicTime').textContent = `${Math.max(0, (deadline - performance.now()) / 1000).toFixed(1)}s`; }, 80);
    $('#panicProps').querySelectorAll('button').forEach((button) => {
      button.onclick = () => { if (button.dataset.win === 'tap') resolve(true, 'Clean action'); else if (button.dataset.lose) resolve(false, 'You woke the kraken. The command said do nothing.'); else resolve(false, 'Wrong target—the command and scene disagreed.'); };
      if (button.dataset.win === 'hold') {
        button.onclick = null; button.onpointerdown = (event) => { event.preventDefault(); holdTimer = setTimeout(() => resolve(true, 'Airlock sealed'), 700); }; button.onpointerup = () => { clearTimeout(holdTimer); if (active) resolve(false, 'Released before the airlock sealed.'); }; button.onpointercancel = () => clearTimeout(holdTimer);
      }
    });
    timer = setTimeout(() => resolve(scene.command.includes('KRAKEN'), scene.command.includes('KRAKEN') ? 'Perfect restraint' : 'Time ran out before the command was completed.'), deadline - performance.now());
  }
  function reset() { clearTimeout(timer); clearTimeout(holdTimer); clearInterval(ticker); index = 0; score = 0; active = false; $('#panicScore').textContent = '0'; $('#result').replaceChildren(); $('#status').textContent = 'Read the command—not the loudest object.'; next(); }
  $('#start').onclick = reset;
  return () => { alive = false; active = false; clearTimeout(timer); clearTimeout(holdTimer); clearInterval(ticker); };
}

function clawFour(){
  shell('🦞','MULTIPLAYER / BEST OF THREE','Two players. First to two rounds wins the set. The next round begins only when both players are ready.',`<div class="room-strip">ROOM <strong id="roomName"></strong><button id="shareRoom" class="text-button">Share ↗</button></div><div class="scorebar"><span>ROUND <strong id="round">1</strong></span><span>SET <strong id="setScore">0 — 0</strong></span><span>TURN <strong id="turn">Waiting</strong></span><span id="players">0 / 2 players</span></div><div class="claw-board" id="clawBoard" role="grid" aria-label="Claw Four board"></div><div class="claw-columns" id="clawColumns" aria-label="Choose a column"></div><p class="game-status" id="status">Loading room…</p><div id="clawResult"></div><div id="joinPanel"><label for="playerName">Your display name</label><div class="join-row"><input id="playerName" maxlength="24" placeholder="Captain Claw"><button id="join" class="primary-action">Join</button></div></div><div class="game-footer"><button id="resetRoom" class="text-button">Leave & reset room</button></div>`);
  $('#roomName').textContent=roomId;
  let player; try{player=JSON.parse(localStorage.getItem(`claw-four:${roomId}:player`)||'null');}catch{player=null;}
  let room, busy=false, alive=true, lastFingerprint='';
  const api=async(action,body)=>{const response=await fetch(`/api/rooms/${roomId}/${action}`,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});const json=await response.json();if(!response.ok)throw new Error(json.error||'Request failed');return json;};
  const myTurn=()=>player&&room?.status==='active'&&room.currentPlayer?.id===player.id;
  $('#clawBoard').innerHTML=Array.from({length:42},(_,i)=>`<span class="claw-cell" role="gridcell" aria-label="Row ${Math.floor(i/7)+1}, column ${i%7+1}, empty">·</span>`).join('');
  $('#clawColumns').innerHTML=Array.from({length:7},(_,i)=>`<button data-column="${i}" aria-label="Drop in column ${i+1}">${i+1}</button>`).join('');
  const cells=[...$('#clawBoard').children], columns=[...$('#clawColumns').querySelectorAll('button')];
  columns.forEach(button=>button.onclick=async()=>{if(busy||!myTurn())return;busy=true;try{room=(await api('move',{playerToken:player.token,column:Number(button.dataset.column)})).room;track('claw_move_ack',{round:room.round,column:Number(button.dataset.column)});lastFingerprint='';vibrate('medium');beep(350,.1);render();}catch(error){note(error.message);}finally{busy=false;}});
  function render(){
    if(!room||!alive)return;
    const fingerprint=`${room.updatedAt}:${player?.id||''}`;
    if(fingerprint===lastFingerprint)return;
    lastFingerprint=fingerprint;
    $('#players').textContent=`${room.players.length} / 2 players`;
    $('#round').textContent=room.round||1;
    $('#setScore').textContent=room.players.length?room.players.map(item=>item.wins||0).join(' — '):'0 — 0';
    $('#turn').textContent=['finished','set-finished'].includes(room.status)?'Finished':room.currentPlayer?.id===player?.id?'YOU':room.currentPlayer?.name||'Waiting';
    const lastMove=[...(room.history||[])].reverse().find(event=>event.type==='move')?.text;
    const readyCount=room.rematchReady?.length||0;
    const myPiece=room.players.findIndex(item=>item.id===player?.id)===0?'🦞':room.players.findIndex(item=>item.id===player?.id)===1?'🐚':'';
    $('#status').textContent=room.status==='set-finished'?`${room.setWinner?.name} wins the set ${room.players.map(item=>item.wins||0).join('–')}!`:room.status==='finished'?room.winner?.id==='draw'?'Draw. Both players must ready up.':`${room.winner?.name} wins the round. ${readyCount}/2 ready.`:room.status==='lobby'?'Waiting for a second player. Share the room link.':myTurn()?`YOUR MOVE ${myPiece} · tap a numbered column once.${lastMove?` ${lastMove}.`:''}`:`WAIT · ${room.currentPlayer?.name} is choosing.${lastMove?` ${lastMove}.`:''}`;
    $('#joinPanel').classList.toggle('hidden',!!player);
    const winning=new Set((room.winningCells||[]).map(([row,column])=>row*7+column));
    room.board.flat().forEach((mark,i)=>{cells[i].className=`claw-cell ${mark==='R'?'red':mark==='Y'?'gold':''} ${winning.has(i)?'winner':''}`;cells[i].textContent=mark==='R'?'🦞':mark==='Y'?'🐚':'·';cells[i].setAttribute('aria-label',`Row ${Math.floor(i/7)+1}, column ${i%7+1}, ${mark==='R'?'lobster':mark==='Y'?'shell':'empty'}${winning.has(i)?', winning line':''}`);});
    columns.forEach((button,i)=>button.disabled=!myTurn()||Boolean(room.board[0][i]));
    if(['finished','set-finished'].includes(room.status)&&player){const ready=room.rematchReady?.includes(player.id);$('#clawResult').innerHTML=`<div class="result-card"><span>${room.status==='set-finished'?'SET COMPLETE':`ROUND ${room.round||1} OVER`}</span><h3>${room.winner?.id==='draw'?'Nobody sinks':room.status==='set-finished'?`${room.setWinner?.name} owns the reef`:'Victory at sea'}</h3><p>${room.winner?.id==='draw'?'The reef held.':`${room.winner?.name} takes the round.`} ${room.rematchReady?.length||0}/2 ready.</p><button class="primary-action" id="rematch" ${ready?'disabled':''}>${ready?'Ready · waiting on rival':room.status==='set-finished'?'Ready for a new set':'Ready for next round'}</button></div>`;$('#rematch').onclick=async()=>{if(busy||ready)return;busy=true;try{room=(await api('rematch',{playerToken:player.token})).room;track('claw_ready',{round:room.round,setFinished:room.status==='set-finished'});lastFingerprint='';vibrate('heavy');render();}catch(error){note(error.message);}finally{busy=false;}};}else{$('#clawResult').replaceChildren();}
  }
  async function refresh(){try{room=(await api('state')).room;if(player&&(!player.token||!room.players.some(item=>item.id===player.id))){const resumed=await api('join',{name:player.name||'Player',resumeToken:player.token});player=resumed.player;room=resumed.room;localStorage.setItem(`claw-four:${roomId}:player`,JSON.stringify(player));}render();}catch(error){player=null;localStorage.removeItem(`claw-four:${roomId}:player`);$('#status').textContent=error.message;render();}}
  $('#join').onclick=async()=>{try{const result=await api('join',{name:$('#playerName').value||player?.name||'Player',resumeToken:player?.token});player=result.player;room=result.room;lastFingerprint='';localStorage.setItem(`claw-four:${roomId}:player`,JSON.stringify(player));vibrate('medium');render();}catch(error){player=null;localStorage.removeItem(`claw-four:${roomId}:player`);note(error.message);render();}};
  $('#playerName').onkeydown=e=>{if(e.key==='Enter')$('#join').click();};
  $('#resetRoom').onclick=async()=>{if(!player)return note('Join the room first');if(!confirm('Leave and reset this shared room for everyone?'))return;try{room=(await api('reset',{playerToken:player.token})).room;player=null;lastFingerprint='';localStorage.removeItem(`claw-four:${roomId}:player`);render();}catch(error){note(error.message);}};
  $('#shareRoom').onclick=async()=>{const url=`${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}&game=claw-four`;if(navigator.share){try{await navigator.share({title:'Claw Four',url});}catch{}}else{await navigator.clipboard.writeText(url);note('Room link copied');}};
  refresh();let poll;const schedule=()=>{if(!alive)return;poll=setTimeout(async()=>{await refresh();schedule();},room?.status==='active'?1000:2500);};schedule();return()=>{alive=false;clearTimeout(poll);};
}
syncSound();renderMenu();open(games.some(g=>g.id===params.get('game'))?params.get('game'):'');
