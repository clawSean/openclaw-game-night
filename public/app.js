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
const games = [
  { id: 'claw-four', icon: '🦞', name: 'Claw Four', tag: 'PLAY TOGETHER', desc: 'Drop, block, and steal the win. Two claws enter.', color: 'coral' },
  { id: 'kraken-sequence', icon: '🐙', name: 'Kraken Sequence', tag: 'MEMORY', desc: 'Watch the deep-sea signals. Repeat them or sink.', color: 'violet' },
  { id: 'abyss-sweep', icon: '💣', name: 'Abyss Sweep', tag: 'LOGIC', desc: 'Find the safe route through a mine-filled reef.', color: 'gold' },
  { id: 'shell-shuffle', icon: '🐚', name: 'Shell Shuffle', tag: 'MATCHING', desc: 'Flip sea creatures. Match pairs against the clock.', color: 'sea' },
  { id: 'reef-reflex', icon: '⚡', name: 'Reef Reflex', tag: 'SPEED', desc: 'Wait for the flash. Tap faster than a snapping claw.', color: 'blue' },
];
const metricVersion = { 'abyss-sweep': 2, 'shell-shuffle': 2 };
const key = (id) => `clawcade:best:${id}${metricVersion[id] ? `:v${metricVersion[id]}` : ''}`;
const best = (id) => Number(localStorage.getItem(key(id)) || 0);
function formatScore(id, value) {
  if (id === 'kraken-sequence') return `level ${value}`;
  if (id === 'abyss-sweep') return `${(value / 1000).toFixed(1)}s`;
  if (id === 'shell-shuffle') return `${Math.floor(value / 1_000_000)} moves`;
  if (id === 'reef-reflex') return `${value} ms`;
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
  $('#gameGrid').innerHTML = games.map((g, i) => `<button class="game-card ${g.color}" data-game="${g.id}" aria-label="Play ${g.name}"><span class="game-card-top"><span class="game-icon" aria-hidden="true">${g.icon}</span><span class="game-number">0${i + 1} / 05</span></span><span class="game-tag">${g.tag}</span><strong>${g.name}</strong><span class="game-desc">${g.desc}</span><span class="game-card-bottom"><span>${best(g.id) ? `🏆 Best: ${formatBest(g.id)}` : 'New adventure'}</span><span class="play-arrow">↗</span></span></button>`).join('');
  $('#recordCount').textContent = `${games.filter((g) => best(g.id)).length} solo records`;
  $('#gameGrid').querySelectorAll('[data-game]').forEach((button) => button.onclick = () => open(button.dataset.game, { write: 'push' }));
}
function open(id, { write = 'replace' } = {}) {
  cleanup(); cleanup = () => {};
  current = id;
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
  if (id === 'shell-shuffle') cleanup = shuffle();
  if (id === 'reef-reflex') cleanup = reflex();
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
function syncSound() { $('#soundButton').textContent = sound ? '♪' : '♪̸'; $('#soundButton').setAttribute('aria-pressed', String(sound)); }
function shell(icon, label, instructions, body) {
  mount.innerHTML = `<div class="game-intro"><span class="intro-icon">${icon}</span><p class="eyebrow">${label}</p><h2>${games.find((g) => g.id === current)?.name}</h2><p>${instructions}</p></div>${body}<div class="game-footer"><button class="text-button" id="menuButton">← All games</button></div>`;
  mount.querySelectorAll('.game-status').forEach((status) => { status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true'); });
  $('#menuButton').onclick = goMenu;
}
function finish(message, score, id, { lower = false, scoreLabel = formatScore(id, score), detail = '' } = {}) {
  const isBest = record(id, score, lower);
  const bestText = formatBest(id);
  vibrate('heavy'); beep(isBest ? 750 : 250, .18);
  $('#result').innerHTML = `<div class="result-card" tabindex="-1"><span>${isBest ? '🏆 NEW PERSONAL BEST' : 'ROUND OVER'}</span><h3>${message}</h3><p>${scoreLabel}${bestText ? ` · Best ${bestText}` : ''}${detail ? `<br>${detail}` : ''}</p><button class="primary-action" id="again">Play again ↻</button></div>`;
  $('.result-card')?.focus({ preventScroll: true });
}
function sequence() {
  const symbols = ['🪸', '🐙', '🐡', '🦀'];
  const cueNames = ['Coral', 'Octopus', 'Puffer', 'Crab'];
  shell('🐙', 'MEMORY / SOLO', 'Watch the lights. Repeat the entire pattern. One wrong tap ends the dive.', `<div class="scorebar"><span>LEVEL <strong id="level">0</strong></span><span>BEST <strong>${best(current)}</strong></span></div><div class="sequence-grid">${symbols.map((s, i) => `<button class="sequence-pad pad-${i}" data-pad="${i}" aria-label="${cueNames[i]}">${s}</button>`).join('')}</div><p id="cue" class="sr-only" role="status" aria-live="assertive" aria-atomic="true"></p><p class="game-status" id="status">Ready to dive?</p><button id="tempoMode" class="secondary-action" aria-pressed="false">⚡ Rising tide tempo</button><div id="result"><button id="start" class="primary-action">Start sequence →</button></div>`);
  let pattern = [], index = 0, playing = false, alive = true, relaxed = false;
  const timers = new Set();
  function later(fn, ms) { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); }
  function flash(i) { const pad = $(`[data-pad="${i}"]`); pad.classList.add('lit'); $('#cue').textContent = cueNames[i]; beep(270 + i * 125, .22); vibrate(); later(() => pad.classList.remove('lit'), relaxed ? 520 : 360); }
  function next() {
    pattern.push(Math.floor(Math.random() * 4)); index = 0; playing = true;
    $('#level').textContent = pattern.length;
    const interval = relaxed ? 1050 : pattern.length >= 13 ? 380 : pattern.length >= 9 ? 450 : pattern.length >= 5 ? 550 : 650;
    $('#status').textContent = pattern.length > 1 ? `Level ${pattern.length}. Watch carefully…` : 'Watch carefully…';
    pattern.forEach((p, i) => later(() => flash(p), 700 + i * interval));
    later(() => { playing = false; $('#status').textContent = 'Your turn. Repeat the pattern!'; }, 700 + pattern.length * interval);
  }
  $('#tempoMode').onclick = () => { if (pattern.length) return note('Tempo locks during a dive'); relaxed = !relaxed; $('#tempoMode').textContent = relaxed ? '🌙 Relaxed tempo' : '⚡ Rising tide tempo'; $('#tempoMode').setAttribute('aria-pressed', String(relaxed)); vibrate(); };
  $('#start').onclick = () => { $('#result').replaceChildren(); next(); };
  mount.querySelectorAll('[data-pad]').forEach((pad) => pad.onclick = () => {
    if (playing || !pattern.length) return;
    const guess = Number(pad.dataset.pad); flash(guess);
    if (guess !== pattern[index]) {
      playing = true; $('#status').textContent = 'The Kraken caught you.';
      finish(`You reached level ${pattern.length - 1}`, pattern.length - 1, current);
      $('#again').onclick = () => { timers.forEach(clearTimeout); timers.clear(); pattern = []; playing = false; $('#result').replaceChildren(); next(); };
    } else if (++index === pattern.length) { playing = true; $('#status').textContent = `Level ${pattern.length} clear. Going deeper…`; later(next, 900); }
  });
  return () => { alive = false; timers.forEach(clearTimeout); };
}
function sweep() {
  shell('💣', 'LOGIC / SOLO', 'Reveal safe tiles. Numbers show adjacent mines. Flag suspects; clear every safe tile to win.', `<div class="scorebar"><span>SAFE <strong id="safe">0 / 21</strong></span><span>FLAGS <strong id="flags">0 / 4</strong></span><span>TIME <strong id="time">0.0s</strong></span></div><div class="sweep-grid" id="sweepGrid"></div><p class="game-status" id="status">Your first tap opens a safe pocket.</p><button class="secondary-action" id="flagMode" aria-pressed="false">🚩 Flag mode: off</button><div id="result"></div>`);
  const grid = $('#sweepGrid');
  let suppressClick = -1;
  let mines = new Set(), openTiles = new Set(), flags = new Set(), flagMode = false, over = false, started = 0, timer;
  function neighbors(n) { const r = Math.floor(n / 5), c = n % 5; return [-1,0,1].flatMap((dr) => [-1,0,1].map((dc) => [r+dr,c+dc])).filter(([rr,cc]) => (rr!==r||cc!==c) && rr>=0 && rr<5 && cc>=0 && cc<5).map(([rr,cc]) => rr*5+cc); }
  grid.innerHTML = Array.from({length:25}, (_,i) => `<button class="sweep-tile" data-tile="${i}" aria-label="Row ${Math.floor(i/5)+1}, column ${i%5+1}, hidden"></button>`).join('');
  const tiles = [...grid.querySelectorAll('[data-tile]')];
  tiles.forEach((tile) => {
    const n = Number(tile.dataset.tile);
    tile.onclick = () => { if (suppressClick === n) { suppressClick = -1; return; } tap(n); };
    tile.oncontextmenu = (event) => { event.preventDefault(); flag(n); };
    let hold, startX, startY;
    const cancelHold = () => { clearTimeout(hold); hold = null; };
    tile.onpointerdown = (event) => { if (event.pointerType === 'mouse') return; startX = event.clientX; startY = event.clientY; hold = setTimeout(() => { hold = null; suppressClick = n; flag(n); setTimeout(() => { if (suppressClick === n) suppressClick = -1; }, 700); }, 520); };
    tile.onpointermove = (event) => { if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancelHold(); };
    tile.onpointerup = cancelHold;
    tile.onpointercancel = cancelHold;
    tile.onpointerleave = cancelHold;
  });
  function draw() {
    tiles.forEach((tile, i) => {
      const count = neighbors(i).filter(n => mines.has(n)).length;
      tile.className = `sweep-tile ${openTiles.has(i) ? 'revealed' : ''} ${mines.has(i)&&over ? 'mine' : ''}`;
      tile.setAttribute('aria-label', `Row ${Math.floor(i/5)+1}, column ${i%5+1}${flags.has(i) ? ', flagged' : openTiles.has(i) ? `, ${count} adjacent mines` : ', hidden'}`);
      tile.textContent = flags.has(i) ? '🚩' : openTiles.has(i) || (over && mines.has(i)) ? mines.has(i) ? '💣' : count || '·' : '';
    });
    $('#safe').textContent = `${openTiles.size} / 21`; $('#flags').textContent = `${flags.size} / 4`;
  }
  function shuffled(values) {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  function flood(start, field, revealed) {
    const queue = [start];
    while (queue.length) {
      const cell = queue.pop();
      if (revealed.has(cell) || field.has(cell)) continue;
      revealed.add(cell);
      if (!neighbors(cell).some((near) => field.has(near))) queue.push(...neighbors(cell));
    }
  }
  function isDeducible(first, field) {
    const revealed = new Set(), knownMines = new Set();
    flood(first, field, revealed);
    let changed = true;
    while (changed) {
      changed = false;
      for (const cell of [...revealed]) {
        const near = neighbors(cell), number = near.filter((n) => field.has(n)).length;
        const unknown = near.filter((n) => !revealed.has(n) && !knownMines.has(n));
        const marked = near.filter((n) => knownMines.has(n)).length;
        if (unknown.length && number === marked) {
          const before = revealed.size;
          unknown.forEach((n) => flood(n, field, revealed));
          changed ||= revealed.size > before;
        } else if (unknown.length && number - marked === unknown.length) {
          unknown.forEach((n) => knownMines.add(n));
          changed = true;
        }
      }
    }
    return revealed.size === 21;
  }
  function plant(first) {
    const safePocket = new Set([first, ...neighbors(first)]);
    const options = Array.from({length:25},(_,i)=>i).filter(i=>!safePocket.has(i));
    for (let attempt = 0; attempt < 200; attempt++) {
      const candidate = new Set(shuffled(options).slice(0,4));
      if (isDeducible(first, candidate)) { mines = candidate; return; }
    }
    mines = new Set(shuffled(options).slice(0,4));
  }
  function flag(n) { if (over || openTiles.has(n)) return; if (flags.has(n)) flags.delete(n); else if (flags.size < 4) flags.add(n); else return note('Only four flags available'); vibrate(); draw(); }
  function reveal(n) { if (openTiles.has(n) || flags.has(n)) return; openTiles.add(n); if (!neighbors(n).some(x=>mines.has(x))) neighbors(n).forEach(x=>{ if (!mines.has(x)) reveal(x); }); }
  function tap(n) {
    if (over) return;
    if (flagMode) return flag(n);
    if (flags.has(n)) return;
    if (!mines.size) { plant(n); started = performance.now(); timer = setInterval(() => $('#time').textContent = `${((performance.now() - started) / 1000).toFixed(1)}s`, 100); }
    if (openTiles.has(n)) {
      const near = neighbors(n), count = near.filter(x => mines.has(x)).length;
      if (count && near.filter(x => flags.has(x)).length === count) near.filter(x => !flags.has(x)).forEach(tap);
      return;
    }
    if (mines.has(n)) { over = true; clearInterval(timer); $('#status').textContent = 'Boom. The reef bites back.'; draw(); finish('Mine found!', 0, current, { scoreLabel: `${openTiles.size} / 21 safe`, detail: 'Losses do not replace clear-time records' }); $('#again').onclick = restart; return; }
    reveal(n); vibrate(); beep(430,.05); draw();
    if (openTiles.size === 21) { over = true; clearInterval(timer); const elapsed = Math.round(performance.now() - started); $('#time').textContent = `${(elapsed / 1000).toFixed(1)}s`; $('#status').textContent = 'Reef cleared. Clean work.'; finish('Perfect sweep!', elapsed, current, { lower: true }); $('#again').onclick = restart; }
  }
  function restart() { clearInterval(timer); mines.clear(); openTiles.clear(); flags.clear(); over=false; started=0; $('#time').textContent='0.0s'; $('#result').replaceChildren(); $('#status').textContent='Your first tap opens a safe pocket.'; draw(); }
  $('#flagMode').onclick = () => { flagMode=!flagMode; $('#flagMode').textContent=`🚩 Flag mode: ${flagMode ? 'on' : 'off'}`; $('#flagMode').setAttribute('aria-pressed', String(flagMode)); vibrate(); };
  draw(); return () => clearInterval(timer);
}
function shuffle() {
  const icons = ['🐙','🦀','🐡','🦈','🐚','🪼','🦭','🦞'];
  shell('🐚','MATCHING / SOLO','Flip two cards at a time. Match every creature with the fewest moves.',`<div class="scorebar"><span>PAIRS <strong id="pairs">0 / 8</strong></span><span>MOVES <strong id="moves">0</strong></span><span>STREAK <strong id="streak">0</strong></span><span>TIME <strong id="time">0.0s</strong></span></div><div class="match-grid" id="matchGrid"></div><p class="game-status" id="status">Choose your first shell.</p><div id="result"></div>`);
  const grid = $('#matchGrid'); let cards, selected, matched, moves, started, locked, timer, flipTimer, streak;
  grid.innerHTML = Array.from({length:16},(_,i)=>`<button class="match-card" data-card="${i}" aria-label="Card ${i+1}, hidden">✦</button>`).join('');
  const cardButtons = [...grid.querySelectorAll('[data-card]')];
  cardButtons.forEach((button) => button.onclick = () => tap(Number(button.dataset.card)));
  function draw() { cardButtons.forEach((button,i)=>{ const visible=matched.has(i)||selected.includes(i); button.className=`match-card ${visible?'flipped':''}`; button.setAttribute('aria-label',`Card ${i+1}${matched.has(i)?`, matched ${cards[i]}`:selected.includes(i)?`, ${cards[i]}`:', hidden'}`); button.textContent=visible?cards[i]:'✦'; }); }
  function reset() { clearInterval(timer); clearTimeout(flipTimer); cards=[...icons,...icons].sort(()=>Math.random()-.5); selected=[]; matched=new Set(); moves=0; streak=0; started=0; locked=false; $('#pairs').textContent='0 / 8'; $('#moves').textContent='0'; $('#streak').textContent='0'; $('#time').textContent='0.0s'; $('#status').textContent='Choose your first shell.'; $('#result').replaceChildren(); draw(); }
  function tap(i) {
    if (locked||matched.has(i)||selected.includes(i)) return;
    if (!started) { started=performance.now(); timer=setInterval(()=>$('#time').textContent=`${((performance.now()-started)/1000).toFixed(1)}s`,100); }
    selected.push(i); vibrate(); beep(440+selected.length*80,.06); draw();
    if (selected.length===2) {
      moves++; $('#moves').textContent=moves;
      if (cards[selected[0]]===cards[selected[1]]) { selected.forEach(n=>matched.add(n)); selected=[]; streak++; $('#streak').textContent=streak; $('#pairs').textContent=`${matched.size/2} / 8`; $('#status').textContent=streak >= 3 ? `${streak} matches in a row! 🔥` : 'A match! Keep going.'; beep(560 + Math.min(streak, 5) * 70, .09); vibrate(streak >= 3 ? 'medium' : 'light'); if(matched.size===16) {clearInterval(timer); const elapsed=Math.round(performance.now()-started); const score=moves*1_000_000+elapsed; $('#time').textContent=`${(elapsed/1000).toFixed(1)}s`; $('#status').textContent='Ocean catalog complete.'; finish('All 8 pairs found!',score,current,{lower:true,scoreLabel:`${moves} moves · ${(elapsed/1000).toFixed(1)}s`,detail:`Best streak ${streak}`}); $('#again').onclick=reset;} draw(); }
      else { locked=true; streak=0; $('#streak').textContent='0'; $('#status').textContent='Not quite. Watch them turn.'; flipTimer=setTimeout(()=>{selected=[]; locked=false; draw();},850); }
    }
  }
  reset(); return ()=>{clearInterval(timer);clearTimeout(flipTimer);};
}
function reflex() {
  shell('⚡','SPEED / SOLO','Wait for GO, then tap. Five clean rounds. Early taps add a 150 ms penalty.',`<div class="scorebar"><span>ROUND <strong id="round">0 / 5</strong></span><span>AVERAGE <strong id="average">—</strong></span><span>FALSE STARTS <strong id="falseStarts">0</strong></span><span>BEST <strong>${best(current) || '—'} ms</strong></span></div><button id="reaction" class="reaction-zone idle" aria-label="Start reflex game"><span id="reactionIcon">⚡</span><strong id="reactionText">Tap to start</strong><small id="reactionHint">Five rounds. No cheating.</small></button><p class="game-status" id="status">When the reef flashes green, strike.</p><div id="result"></div>`);
  const zone=$('#reaction'); let state='idle', samples=[], falseStarts=0, armedAt=0, waitTimer;
  function set(s,icon,label,hint){state=s;zone.className=`reaction-zone ${s}`;zone.setAttribute('aria-label',`${label}. ${hint}`);$('#reactionIcon').textContent=icon;$('#reactionText').textContent=label;$('#reactionHint').textContent=hint;}
  function arm(){ set('waiting','◌','Wait for it…','Do not tap yet'); waitTimer=setTimeout(()=>{armedAt=performance.now();set('go','🦞','GO!','TAP NOW');beep(880,.12);vibrate('heavy');},1100+Math.random()*2300); }
  function next(){ if(samples.length===5){const raw=Math.round(samples.reduce((a,b)=>a+b,0)/5), adjusted=raw+falseStarts*150, fastest=Math.min(...samples);set('done','🏁',`${adjusted} ms score`,'Five clean strikes');finish('Reef conquered!',adjusted,current,{lower:true,detail:`${raw} ms raw · ${fastest} ms fastest · ${falseStarts} false start${falseStarts===1?'':'s'}`});$('#again').onclick=reset;return;}$('#round').textContent=`${samples.length+1} / 5`;arm(); }
  function reset(){clearTimeout(waitTimer);samples=[];falseStarts=0;$('#round').textContent='0 / 5';$('#average').textContent='—';$('#falseStarts').textContent='0';$('#result').replaceChildren();set('idle','⚡','Tap to start','Five rounds. No cheating.');}
  zone.onclick=()=>{
    if(state==='idle') return next();
    if(state==='waiting'){clearTimeout(waitTimer);falseStarts++;$('#falseStarts').textContent=falseStarts;vibrate('heavy');beep(160,.2);set('early','😬','Too soon!','Tap to retry this round');$('#status').textContent=`False start ${falseStarts}. +150 ms penalty.`;return;}
    if(state==='early') return arm();
    if(state==='go'){const ms=Math.round(performance.now()-armedAt), prior=samples.length?Math.round(samples.reduce((a,b)=>a+b,0)/samples.length):0;samples.push(ms);$('#average').textContent=`${Math.round(samples.reduce((a,b)=>a+b,0)/samples.length)} ms`;const split=prior?` · ${Math.abs(ms-prior)} ms ${ms<prior?'faster':'slower'} than your run`:` · First split`;$('#status').textContent=`${ms} ms${split}`;vibrate();set('between','✓',`${ms} ms`,'Tap for next round');return;}
    if(state==='between') next();
  };
  return ()=>clearTimeout(waitTimer);
}
function clawFour(){
  shell('🦞','MULTIPLAYER / ROOM','Two players. Drop a token into a column; connect four to win.',`<div class="room-strip">ROOM <strong id="roomName"></strong><button id="shareRoom" class="text-button">Share ↗</button></div><div class="scorebar"><span>ROUND <strong id="round">1</strong></span><span>TURN <strong id="turn">Waiting</strong></span><span id="players">0 / 2 players</span></div><div class="claw-board" id="clawBoard" role="grid" aria-label="Claw Four board"></div><div class="claw-columns" id="clawColumns" aria-label="Choose a column"></div><p class="game-status" id="status">Loading room…</p><div id="clawResult"></div><div id="joinPanel"><label for="playerName">Your display name</label><div class="join-row"><input id="playerName" maxlength="24" placeholder="Captain Claw"><button id="join" class="primary-action">Join</button></div></div><div class="game-footer"><button id="resetRoom" class="text-button">Leave & reset room</button></div>`);
  $('#roomName').textContent=roomId;
  let player; try{player=JSON.parse(localStorage.getItem(`claw-four:${roomId}:player`)||'null');}catch{player=null;}
  let room, busy=false, alive=true, lastFingerprint='';
  const api=async(action,body)=>{const response=await fetch(`/api/rooms/${roomId}/${action}`,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});const json=await response.json();if(!response.ok)throw new Error(json.error||'Request failed');return json;};
  const myTurn=()=>player&&room?.status==='active'&&room.currentPlayer?.id===player.id;
  $('#clawBoard').innerHTML=Array.from({length:42},(_,i)=>`<span class="claw-cell" role="gridcell" aria-label="Row ${Math.floor(i/7)+1}, column ${i%7+1}, empty">·</span>`).join('');
  $('#clawColumns').innerHTML=Array.from({length:7},(_,i)=>`<button data-column="${i}" aria-label="Drop in column ${i+1}">${i+1}</button>`).join('');
  const cells=[...$('#clawBoard').children], columns=[...$('#clawColumns').querySelectorAll('button')];
  columns.forEach(button=>button.onclick=async()=>{if(busy||!myTurn())return;busy=true;try{room=(await api('move',{playerId:player.id,column:Number(button.dataset.column)})).room;lastFingerprint='';vibrate('medium');beep(350,.1);render();}catch(error){note(error.message);}finally{busy=false;}});
  function render(){
    if(!room||!alive)return;
    const fingerprint=`${room.updatedAt}:${player?.id||''}`;
    if(fingerprint===lastFingerprint)return;
    lastFingerprint=fingerprint;
    $('#players').textContent=`${room.players.length} / 2 players`;
    $('#round').textContent=room.round||1;
    $('#turn').textContent=room.status==='finished'?'Finished':room.currentPlayer?.name||'Waiting';
    const lastMove=[...(room.history||[])].reverse().find(event=>event.type==='move')?.text;
    $('#status').textContent=room.status==='finished'?room.winner?.id==='draw'?'Draw!':`${room.winner?.name} wins! 🏆`:room.status==='lobby'?'Waiting for a second player. Share the room link.':myTurn()?`Your move. Pick a column.${lastMove?` ${lastMove}.`:''}`:`Waiting on ${room.currentPlayer?.name}.${lastMove?` ${lastMove}.`:''}`;
    $('#joinPanel').classList.toggle('hidden',!!player);
    room.board.flat().forEach((mark,i)=>{cells[i].className=`claw-cell ${mark==='R'?'red':mark==='Y'?'gold':''}`;cells[i].textContent=mark==='R'?'🦞':mark==='Y'?'🐚':'·';cells[i].setAttribute('aria-label',`Row ${Math.floor(i/7)+1}, column ${i%7+1}, ${mark==='R'?'lobster':mark==='Y'?'shell':'empty'}`);});
    columns.forEach((button,i)=>button.disabled=!myTurn()||Boolean(room.board[0][i]));
    if(room.status==='finished'&&player){$('#clawResult').innerHTML=`<div class="result-card"><span>ROUND ${room.round||1} OVER</span><h3>${room.winner?.id==='draw'?'Nobody sinks':'Victory at sea'}</h3><p>${room.winner?.id==='draw'?'The reef held.':`${room.winner?.name} takes the round.`}</p><button class="primary-action" id="rematch">Rematch ↻</button></div>`;$('#rematch').onclick=async()=>{if(busy)return;busy=true;try{room=(await api('rematch',{playerId:player.id})).room;lastFingerprint='';vibrate('heavy');render();}catch(error){note(error.message);}finally{busy=false;}};}else{$('#clawResult').replaceChildren();}
  }
  async function refresh(){try{room=(await api('state')).room;render();}catch(error){$('#status').textContent=error.message;}}
  $('#join').onclick=async()=>{try{const result=await api('join',{name:$('#playerName').value||'Player'});player=result.player;room=result.room;lastFingerprint='';localStorage.setItem(`claw-four:${roomId}:player`,JSON.stringify(player));vibrate('medium');render();}catch(error){note(error.message);}};
  $('#playerName').onkeydown=e=>{if(e.key==='Enter')$('#join').click();};
  $('#resetRoom').onclick=async()=>{if(!confirm('Leave and reset this shared room for everyone?'))return;try{room=(await api('reset',{})).room;player=null;lastFingerprint='';localStorage.removeItem(`claw-four:${roomId}:player`);render();}catch(error){note(error.message);}};
  $('#shareRoom').onclick=async()=>{const url=`${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}&game=claw-four`;if(navigator.share){try{await navigator.share({title:'Claw Four',url});}catch{}}else{await navigator.clipboard.writeText(url);note('Room link copied');}};
  refresh();let poll;const schedule=()=>{if(!alive)return;poll=setTimeout(async()=>{await refresh();schedule();},room?.status==='active'?1000:2500);};schedule();return()=>{alive=false;clearTimeout(poll);};
}
syncSound();renderMenu();open(games.some(g=>g.id===params.get('game'))?params.get('game'):'');
