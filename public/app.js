import {
  expectedSequence,
  generateDeducibleBoard,
  neighbors,
  seededRandom,
  tideActionMatches,
} from './game-core.js';

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
  { id: 'claw-four', icon: '🦞', name: 'Claw Four', tag: 'PLAY TOGETHER', desc: 'A best-of-three duel with another human.', color: 'coral' },
  { id: 'abyss-sweep', icon: '💣', name: 'Abyss Expedition', tag: 'DEDUCTION', desc: 'Clear the reef, then decide whether to risk the dive.', color: 'gold' },
  { id: 'kraken-sequence', icon: '🐙', name: 'Kraken Current', tag: 'MEMORY', desc: 'Hold four signals. Some currents run backward.', color: 'violet' },
  { id: 'tide-tell', icon: '🪼', name: 'Tide Tell', tag: 'READ & REACT', desc: 'Read the rule, resist the feint, and choose when to dive.', color: 'sea' },
];
const metricVersion = { 'abyss-sweep': 3, 'kraken-sequence': 2, 'tide-tell': 1 };
const key = (id) => `clawcade:best:${id}${metricVersion[id] ? `:v${metricVersion[id]}` : ''}`;
const best = (id) => Number(localStorage.getItem(key(id)) || 0);
function formatScore(id, value) {
  if (id === 'kraken-sequence') return `${value} currents`;
  if (id === 'abyss-sweep') return `depth ${value}`;
  if (id === 'tide-tell') return `${value} reads`;
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
  if (id === 'kraken-sequence') cleanup = sequence();
  if (id === 'abyss-sweep') cleanup = sweep();
  if (id === 'tide-tell') cleanup = tideTell();
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
function sequence() {
  const symbols = ['🪸', '🐙', '🐡', '🦀'];
  const cueNames = ['Coral', 'Octopus', 'Puffer', 'Crab'];
  shell('🐙', 'MEMORY / LAB', 'Remember four signals. NORMAL repeats them in order; REVERSE repeats them backward.', `<div class="scorebar"><span>TRIAL <strong id="level">0 / 10</strong></span><span>CURRENT <strong id="mode">NORMAL</strong></span><span>LIVES <strong id="lives">3</strong></span><span>BEST <strong>${best(current) || 0}</strong></span></div><div class="current-banner" id="currentBanner">NORMAL →</div><div class="sequence-grid">${symbols.map((symbol, index) => `<button class="sequence-pad pad-${index}" data-pad="${index}" aria-label="${cueNames[index]}">${symbol}</button>`).join('')}</div><p id="cue" class="sr-only" role="status" aria-live="assertive" aria-atomic="true"></p><p class="game-status" id="status">Two practice currents come first.</p><div id="result"><button id="start" class="primary-action">Enter the current →</button></div>`);
  const random = seededRandom(`${new Date().toISOString().slice(0, 10)}:${roomId}:kraken`);
  let pattern = [], target = [], index = 0, trial = -2, correct = 0, lives = 3, playing = false, alive = true;
  const timers = new Set();
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
    target = expectedSequence(pattern, mode); index = 0; playing = true;
    $('#level').textContent = trial < 0 ? `P${trial + 3} / 2` : `${trial + 1} / 10`;
    $('#mode').textContent = mode.toUpperCase();
    $('#currentBanner').textContent = mode === 'reverse' ? '← REVERSE' : 'NORMAL →';
    $('#currentBanner').classList.toggle('reverse', mode === 'reverse');
    $('#status').textContent = `${trial < 0 ? 'Practice. ' : ''}Watch four signals, then go ${mode}.`;
    pattern.forEach((padIndex, cueIndex) => later(() => flash(padIndex), 650 + cueIndex * 520));
    later(() => { playing = false; $('#status').textContent = mode === 'reverse' ? 'Your turn—last signal first.' : 'Your turn—same order.'; }, 650 + pattern.length * 520);
  }
  $('#start').onclick = () => { $('#result').replaceChildren(); next(); };
  mount.querySelectorAll('[data-pad]').forEach((pad) => pad.onclick = () => {
    if (playing || !pattern.length) return;
    const guess = Number(pad.dataset.pad); flash(guess);
    if (guess !== target[index]) {
      playing = true;
      track('kraken_trial', { mode: $('#mode').textContent.toLowerCase(), practice: trial < 0, correct: false, errorAt: index + 1 });
      if (trial >= 0) { lives -= 1; $('#lives').textContent = lives; }
      $('#status').textContent = `Missed signal ${index + 1}. ${trial < 0 ? 'Practice does not cost a life.' : `${lives} lives left.`}`;
      trial += 1; later(next, 1000);
    } else if (++index === target.length) {
      playing = true;
      track('kraken_trial', { mode: $('#mode').textContent.toLowerCase(), practice: trial < 0, correct: true });
      if (trial >= 0) correct += 1;
      $('#status').textContent = trial < 0 ? 'Practice clear.' : 'Current clear.';
      trial += 1; later(next, 850);
    }
  });
  function reset() { timers.forEach(clearTimeout); timers.clear(); pattern=[]; target=[]; index=0; trial=-2; correct=0; lives=3; playing=false; $('#lives').textContent='3'; $('#result').replaceChildren(); next(); }
  return () => { alive = false; timers.forEach(clearTimeout); };
}
function sweep() {
  const depths = [
    { name: 'Shallows', size: 5, mines: 4 },
    { name: 'Blue Drop', size: 6, mines: 7 },
    { name: 'The Trench', size: 7, mines: 10 },
  ];
  shell('💣', 'DEDUCTION / EXPEDITION LAB', 'Clear a solver-verified reef. After each depth, bank the run or risk everything by descending.', `<div class="scorebar"><span>DEPTH <strong id="depth">1 / 3</strong></span><span>SAFE <strong id="safe">0</strong></span><span>FLAGS <strong id="flags">0</strong></span><span>ACTIONS <strong id="actions">0</strong></span></div><div class="depth-card"><span id="depthName">Shallows</span><strong id="contract">Clear the reef</strong><small id="sonarState">One sonar available this expedition</small></div><div class="sweep-grid" id="sweepGrid"></div><p class="game-status" id="status">Your first tap opens a safe pocket.</p><div class="game-actions"><button class="secondary-action" id="flagMode" aria-pressed="false">🚩 Flag mode: off</button><button class="secondary-action" id="sonarMode" aria-pressed="false">◉ Use sonar</button></div><div id="result"></div>`);
  const grid = $('#sweepGrid');
  let depthIndex = 0, cleared = 0, runNumber = 0, sonarAvailable = true, assisted = false;
  let mines = new Set(), openTiles = new Set(), flags = new Set(), sonarMarks = new Map();
  let flagMode = false, sonarMode = false, over = false, actions = 0, generation = null;
  let suppressClick = -1;
  let tiles = [];

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
      tile.oncontextmenu = (event) => { event.preventDefault(); flag(cell); };
      let hold, startX, startY;
      const cancelHold = () => { clearTimeout(hold); hold = null; };
      tile.onpointerdown = (event) => { if (event.pointerType === 'mouse') return; startX = event.clientX; startY = event.clientY; hold = setTimeout(() => { hold = null; suppressClick = cell; flag(cell); setTimeout(() => { if (suppressClick === cell) suppressClick = -1; }, 700); }, 520); };
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
    if (over || openTiles.has(cell)) return;
    if (flags.has(cell)) flags.delete(cell);
    else if (flags.size < config().mines) flags.add(cell);
    else return note(`Only ${config().mines} flags at this depth`);
    actions += 1; vibrate(); draw();
  }

  function useSonar(cell) {
    if (!sonarAvailable || !mines.size || openTiles.has(cell)) return;
    const scanned = new Set([cell, ...cellNeighbors(cell)]);
    const count = [...scanned].filter((candidate) => mines.has(candidate)).length;
    sonarAvailable = false; assisted = true; sonarMode = false; sonarMarks.set(cell, count); actions += 1;
    $('#sonarMode').textContent = '◉ Sonar spent'; $('#sonarMode').disabled = true; $('#sonarMode').setAttribute('aria-pressed', 'false');
    $('#sonarState').textContent = `Assisted expedition · ${count} mine${count === 1 ? '' : 's'} in that zone`;
    $('#status').textContent = `Sonar reports ${count} mine${count === 1 ? '' : 's'} in the highlighted 3×3 zone.`;
    track('abyss_sonar', { depth: depthIndex + 1, count });
    vibrate('medium'); beep(620, .14); draw();
  }

  function tap(cell) {
    if (over) return;
    if (sonarMode) return useSonar(cell);
    if (flagMode) return flag(cell);
    if (flags.has(cell)) return;
    if (!mines.size) {
      try { plant(cell); }
      catch { over = true; $('#status').textContent = 'This reef could not be proven fair. Start a new expedition.'; finish('Generation stopped safely', cleared, current, { scoreLabel: `${cleared} depths banked`, detail: 'No unverified board was served' }); $('#again').onclick = resetExpedition; return; }
    }
    actions += 1;
    if (openTiles.has(cell)) {
      const near = cellNeighbors(cell);
      if (countNear(cell) && near.filter((candidate) => flags.has(candidate)).length === countNear(cell)) {
        const chordTargets = near.filter((candidate) => !flags.has(candidate));
        if (chordTargets.some((candidate) => mines.has(candidate))) return detonate();
        chordTargets.forEach(reveal);
        draw(); checkClear();
      }
      return;
    }
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
    mines.clear(); openTiles.clear(); flags.clear(); sonarMarks.clear(); generation = null; actions = 0; over = false; flagMode = false; sonarMode = false;
    $('#depthName').textContent = config().name; $('#contract').textContent = `${config().size}×${config().size} · ${config().mines} mines`;
    $('#status').textContent = 'Your first tap opens a safe pocket.'; $('#result').replaceChildren();
    $('#flagMode').textContent = '🚩 Flag mode: off'; $('#flagMode').setAttribute('aria-pressed', 'false');
    $('#sonarMode').disabled = !sonarAvailable; $('#sonarMode').textContent = sonarAvailable ? '◉ Use sonar' : '◉ Sonar spent';
    $('#sonarState').textContent = sonarAvailable ? 'One sonar available this expedition' : 'Sonar already spent';
    buildGrid(); draw();
  }

  function resetExpedition() { runNumber += 1; depthIndex = 0; cleared = 0; sonarAvailable = true; assisted = false; startDepth(); }
  $('#flagMode').onclick = () => { if (over) return; flagMode = !flagMode; sonarMode = false; $('#flagMode').textContent = `🚩 Flag mode: ${flagMode ? 'on' : 'off'}`; $('#flagMode').setAttribute('aria-pressed', String(flagMode)); $('#sonarMode').setAttribute('aria-pressed', 'false'); vibrate(); };
  $('#sonarMode').onclick = () => { if (!sonarAvailable || over) return; if (!mines.size) return note('Open the reef before using sonar'); sonarMode = !sonarMode; flagMode = false; $('#sonarMode').setAttribute('aria-pressed', String(sonarMode)); $('#flagMode').setAttribute('aria-pressed', 'false'); $('#status').textContent = sonarMode ? 'Choose the center of a 3×3 sonar zone.' : 'Sonar cancelled.'; };
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
  let cueTimer, holdTimer, pointerDownAt = 0;

  function renderRule() {
    $('#ruleBoard').innerHTML = creatures.map((creature, index) => `<div><span>${creature.icon} ${creature.name}</span><strong>${actionLabels[rules[wave][index]]}</strong></div>`).join('');
    $('#wave').textContent = `${wave + 1} / ${rules.length}`;
  }

  function chooseCurrent() {
    active = false; resolved = true; clearTimeout(cueTimer); clearTimeout(holdTimer);
    if (wave >= rules.length) return complete('All currents read');
    renderRule();
    $('#result').innerHTML = `<div class="decision-card"><span>CHOOSE THE PRESSURE</span><h3>${wave ? 'The rule changed.' : 'How deep are you going?'}</h3><p>Calm water gives feedback and continues after mistakes. Deep Dive scores double, moves faster, and ends on one bad read.</p><div class="decision-actions"><button class="secondary-action" id="calm">Calm water</button><button class="primary-action" id="deep">Deep Dive · 2×</button></div></div>`;
    $('#calm').onclick = () => startWave(false);
    $('#deep').onclick = () => startWave(true);
    zone.className = 'tell-zone idle'; $('#tellIcon').textContent = '🌊'; $('#tellName').textContent = 'Choose your pressure'; $('#tellHint').textContent = 'The rule is visible above';
  }

  function startWave(isDeep) {
    deep = isDeep; cueIndex = 0; active = false; resolved = true; $('#cueNumber').textContent = '0 / 6'; $('#result').replaceChildren();
    track('tide_pressure', { wave: wave + 1, choice: deep ? 'deep' : 'calm' });
    $('#status').textContent = `${deep ? 'Deep Dive: one miss ends the run.' : 'Calm water: misses break the combo.'} Rule locked for this wave.`;
    nextCue();
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
  return () => { active = false; clearTimeout(cueTimer); clearTimeout(holdTimer); };
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
    $('#turn').textContent=['finished','set-finished'].includes(room.status)?'Finished':room.currentPlayer?.name||'Waiting';
    const lastMove=[...(room.history||[])].reverse().find(event=>event.type==='move')?.text;
    const readyCount=room.rematchReady?.length||0;
    $('#status').textContent=room.status==='set-finished'?`${room.setWinner?.name} wins the set ${room.players.map(item=>item.wins||0).join('–')}!`:room.status==='finished'?room.winner?.id==='draw'?'Draw. Both players must ready up.':`${room.winner?.name} wins the round. ${readyCount}/2 ready.`:room.status==='lobby'?'Waiting for a second player. Share the room link.':myTurn()?`Your move. Pick a column.${lastMove?` ${lastMove}.`:''}`:`Waiting on ${room.currentPlayer?.name}.${lastMove?` ${lastMove}.`:''}`;
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
