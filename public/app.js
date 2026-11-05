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
const key = (id) => `clawcade:best:${id}`;
const best = (id) => Number(localStorage.getItem(key(id)) || 0);
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
  $('#gameGrid').innerHTML = games.map((g, i) => `<button class="game-card ${g.color}" data-game="${g.id}" aria-label="Play ${g.name}"><span class="game-card-top"><span class="game-icon" aria-hidden="true">${g.icon}</span><span class="game-number">0${i + 1} / 05</span></span><span class="game-tag">${g.tag}</span><strong>${g.name}</strong><span class="game-desc">${g.desc}</span><span class="game-card-bottom"><span>${best(g.id) ? `🏆 Best: ${best(g.id)}${g.id === 'reef-reflex' ? ' ms' : ''}` : 'New adventure'}</span><span class="play-arrow">↗</span></span></button>`).join('');
  $('#recordCount').textContent = `${games.filter((g) => best(g.id)).length} records`;
  $('#gameGrid').querySelectorAll('[data-game]').forEach((button) => button.onclick = () => open(button.dataset.game));
}
function open(id) {
  cleanup(); cleanup = () => {};
  current = id;
  menu.classList.toggle('hidden', !!id);
  view.classList.toggle('hidden', !id);
  back.classList.toggle('hidden', !id);
  title.textContent = id ? games.find((g) => g.id === id)?.name || 'Clawcade' : 'Clawcade';
  history.replaceState(null, '', id ? `${location.pathname}?room=${encodeURIComponent(roomId)}&game=${id}` : `${location.pathname}?room=${encodeURIComponent(roomId)}`);
  mount.replaceChildren();
  if (id === 'kraken-sequence') cleanup = sequence();
  if (id === 'abyss-sweep') cleanup = sweep();
  if (id === 'shell-shuffle') cleanup = shuffle();
  if (id === 'reef-reflex') cleanup = reflex();
  if (id === 'claw-four') cleanup = clawFour();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
back.onclick = () => open('');
$('#soundButton').onclick = () => { sound = !sound; localStorage.setItem('clawcade:sound', sound ? 'on' : 'off'); syncSound(); if (sound) beep(); };
function syncSound() { $('#soundButton').textContent = sound ? '♪' : '♪̸'; $('#soundButton').setAttribute('aria-pressed', String(sound)); }
function shell(icon, label, instructions, body) {
  mount.innerHTML = `<div class="game-intro"><span class="intro-icon">${icon}</span><p class="eyebrow">${label}</p><h2>${games.find((g) => g.id === current)?.name}</h2><p>${instructions}</p></div>${body}<div class="game-footer"><button class="text-button" id="menuButton">← All games</button></div>`;
  $('#menuButton').onclick = () => open('');
}
function finish(message, score, id, lower = false) {
  const isBest = record(id, score, lower);
  vibrate('heavy'); beep(isBest ? 750 : 250, .18);
  $('#result').innerHTML = `<div class="result-card"><span>${isBest ? '🏆 NEW PERSONAL BEST' : 'ROUND OVER'}</span><h3>${message}</h3><p>${score}${id === 'reef-reflex' ? ' ms' : ''} · Best ${best(id)}${id === 'reef-reflex' ? ' ms' : ''}</p><button class="primary-action" id="again">Play again ↻</button></div>`;
}
function sequence() {
  const symbols = ['🪸', '🐙', '🐡', '🦀'];
  shell('🐙', 'MEMORY / SOLO', 'Watch the lights. Repeat the entire pattern. One wrong tap ends the dive.', `<div class="scorebar"><span>LEVEL <strong id="level">0</strong></span><span>BEST <strong>${best(current)}</strong></span></div><div class="sequence-grid">${symbols.map((s, i) => `<button class="sequence-pad pad-${i}" data-pad="${i}" aria-label="Signal ${i + 1}: ${s}">${s}</button>`).join('')}</div><p class="game-status" id="status">Ready to dive?</p><div id="result"><button id="start" class="primary-action">Start sequence →</button></div>`);
  let pattern = [], index = 0, playing = false, alive = true;
  const timers = new Set();
  function later(fn, ms) { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); }
  function flash(i) { const pad = $(`[data-pad="${i}"]`); pad.classList.add('lit'); beep(270 + i * 125, .22); vibrate(); later(() => pad.classList.remove('lit'), 360); }
  function next() {
    pattern.push(Math.floor(Math.random() * 4)); index = 0; playing = true;
    $('#level').textContent = pattern.length;
    $('#status').textContent = 'Watch carefully…';
    pattern.forEach((p, i) => later(() => flash(p), 700 + i * 650));
    later(() => { playing = false; $('#status').textContent = 'Your turn. Repeat the pattern!'; }, 700 + pattern.length * 650);
  }
  $('#start').onclick = () => { $('#result').replaceChildren(); next(); };
  mount.querySelectorAll('[data-pad]').forEach((pad) => pad.onclick = () => {
    if (playing || !pattern.length) return;
    const guess = Number(pad.dataset.pad); flash(guess);
    if (guess !== pattern[index]) {
      playing = true; $('#status').textContent = 'The Kraken caught you.';
      finish(`You reached level ${pattern.length}`, pattern.length - 1, current);
      $('#again').onclick = () => { timers.forEach(clearTimeout); timers.clear(); pattern = []; playing = false; $('#result').replaceChildren(); next(); };
    } else if (++index === pattern.length) { playing = true; $('#status').textContent = 'Perfect. Going deeper…'; later(next, 900); }
  });
  return () => { alive = false; timers.forEach(clearTimeout); };
}
function sweep() {
  shell('💣', 'LOGIC / SOLO', 'Reveal safe tiles. Numbers show adjacent mines. Flag suspects; clear every safe tile to win.', `<div class="scorebar"><span>SAFE <strong id="safe">0 / 21</strong></span><span>FLAGS <strong id="flags">0 / 4</strong></span></div><div class="sweep-grid" id="sweepGrid"></div><p class="game-status" id="status">First tap is always safe.</p><button class="secondary-action" id="flagMode" aria-pressed="false">🚩 Flag mode: off</button><div id="result"></div>`);
  const grid = $('#sweepGrid');
  let suppressClick = -1;
  let mines = new Set(), openTiles = new Set(), flags = new Set(), flagMode = false, over = false;
  function neighbors(n) { const r = Math.floor(n / 5), c = n % 5; return [-1,0,1].flatMap((dr) => [-1,0,1].map((dc) => [r+dr,c+dc])).filter(([rr,cc]) => (rr!==r||cc!==c) && rr>=0 && rr<5 && cc>=0 && cc<5).map(([rr,cc]) => rr*5+cc); }
  function draw() {
    grid.innerHTML = Array.from({length:25}, (_,i) => `<button class="sweep-tile ${openTiles.has(i) ? 'revealed' : ''} ${mines.has(i)&&over ? 'mine' : ''}" data-tile="${i}" aria-label="Row ${Math.floor(i/5)+1}, column ${i%5+1}${flags.has(i) ? ', flagged' : openTiles.has(i) ? `, ${neighbors(i).filter(n => mines.has(n)).length} adjacent mines` : ', hidden'}">${flags.has(i) ? '🚩' : openTiles.has(i) || (over && mines.has(i)) ? mines.has(i) ? '💣' : neighbors(i).filter(n => mines.has(n)).length || '·' : ''}</button>`).join('');
    $('#safe').textContent = `${openTiles.size} / 21`; $('#flags').textContent = `${flags.size} / 4`;
    grid.querySelectorAll('[data-tile]').forEach((tile) => {
      tile.onclick = () => { const n = Number(tile.dataset.tile); if (suppressClick === n) { suppressClick = -1; return; } tap(n); };
      tile.oncontextmenu = (event) => { event.preventDefault(); flag(Number(tile.dataset.tile)); };
      let hold; tile.ontouchstart = () => { hold = setTimeout(() => { hold = null; suppressClick = Number(tile.dataset.tile); flag(suppressClick); setTimeout(() => { if (suppressClick === Number(tile.dataset.tile)) suppressClick = -1; }, 700); }, 520); }; tile.ontouchend = () => clearTimeout(hold);
    });
  }
  function plant(first) { const options = Array.from({length:25},(_,i)=>i).filter(i=>i!==first).sort(()=>Math.random()-.5); mines = new Set(options.slice(0,4)); }
  function flag(n) { if (over || openTiles.has(n)) return; if (flags.has(n)) flags.delete(n); else if (flags.size < 4) flags.add(n); else return note('Only four flags available'); vibrate(); draw(); }
  function reveal(n) { if (openTiles.has(n) || flags.has(n)) return; openTiles.add(n); if (!neighbors(n).some(x=>mines.has(x))) neighbors(n).forEach(x=>{ if (!mines.has(x)) reveal(x); }); }
  function tap(n) {
    if (over) return;
    if (flagMode) return flag(n);
    if (flags.has(n) || openTiles.has(n)) return;
    if (!mines.size) plant(n);
    if (mines.has(n)) { over = true; $('#status').textContent = 'Boom. The reef bites back.'; draw(); finish('Mine found!', openTiles.size, current); $('#again').onclick = restart; return; }
    reveal(n); vibrate(); beep(430,.05); draw();
    if (openTiles.size === 21) { over = true; $('#status').textContent = 'Reef cleared. Clean work.'; finish('Perfect sweep!', 21, current); $('#again').onclick = restart; }
  }
  function restart() { mines.clear(); openTiles.clear(); flags.clear(); over=false; $('#result').replaceChildren(); $('#status').textContent='First tap is always safe.'; draw(); }
  $('#flagMode').onclick = () => { flagMode=!flagMode; $('#flagMode').textContent=`🚩 Flag mode: ${flagMode ? 'on' : 'off'}`; $('#flagMode').setAttribute('aria-pressed', String(flagMode)); vibrate(); };
  draw(); return () => {};
}
function shuffle() {
  const icons = ['🐙','🦀','🐡','🦈','🐚','🪼','🦭','🦞'];
  shell('🐚','MATCHING / SOLO','Flip two cards at a time. Match every creature with the fewest moves.',`<div class="scorebar"><span>PAIRS <strong id="pairs">0 / 8</strong></span><span>MOVES <strong id="moves">0</strong></span><span>TIME <strong id="time">0s</strong></span></div><div class="match-grid" id="matchGrid"></div><p class="game-status" id="status">Choose your first shell.</p><div id="result"></div>`);
  const grid = $('#matchGrid'); let cards, selected, matched, moves, started, locked, timer, flipTimer;
  function draw() { grid.innerHTML = cards.map((icon,i)=>`<button class="match-card ${matched.has(i)||selected.includes(i)?'flipped':''}" data-card="${i}" aria-label="Card ${i+1}${matched.has(i)?`, matched ${icon}`:selected.includes(i)?`, ${icon}`:', hidden'}">${matched.has(i)||selected.includes(i)?icon:'✦'}</button>`).join(''); grid.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>tap(Number(b.dataset.card))); }
  function reset() { clearInterval(timer); clearTimeout(flipTimer); cards=[...icons,...icons].sort(()=>Math.random()-.5); selected=[]; matched=new Set(); moves=0; started=0; locked=false; $('#pairs').textContent='0 / 8'; $('#moves').textContent='0'; $('#time').textContent='0s'; $('#status').textContent='Choose your first shell.'; $('#result').replaceChildren(); draw(); }
  function tap(i) {
    if (locked||matched.has(i)||selected.includes(i)) return;
    if (!started) { started=Date.now(); timer=setInterval(()=>$('#time').textContent=`${Math.floor((Date.now()-started)/1000)}s`,250); }
    selected.push(i); vibrate(); beep(440+selected.length*80,.06); draw();
    if (selected.length===2) {
      moves++; $('#moves').textContent=moves;
      if (cards[selected[0]]===cards[selected[1]]) { selected.forEach(n=>matched.add(n)); selected=[]; $('#pairs').textContent=`${matched.size/2} / 8`; $('#status').textContent='A match! Keep going.'; if(matched.size===16) {clearInterval(timer); $('#status').textContent='Ocean catalog complete.'; finish('All 8 pairs found!',Math.max(1,100-moves*3),current); $('#again').onclick=reset;} draw(); }
      else { locked=true; $('#status').textContent='Not quite. Watch them turn.'; flipTimer=setTimeout(()=>{selected=[]; locked=false; draw();},850); }
    }
  }
  reset(); return ()=>{clearInterval(timer);clearTimeout(flipTimer);};
}
function reflex() {
  shell('⚡','SPEED / SOLO','Wait for GO, then tap. Five clean rounds. Early taps count as false starts.',`<div class="scorebar"><span>ROUND <strong id="round">0 / 5</strong></span><span>AVERAGE <strong id="average">—</strong></span><span>BEST <strong>${best(current) || '—'} ms</strong></span></div><button id="reaction" class="reaction-zone idle" aria-label="Start reflex game"><span id="reactionIcon">⚡</span><strong id="reactionText">Tap to start</strong><small id="reactionHint">Five rounds. No cheating.</small></button><p class="game-status" id="status">When the reef flashes green, strike.</p><div id="result"></div>`);
  const zone=$('#reaction'); let state='idle', samples=[], armedAt=0, waitTimer;
  function set(s,icon,label,hint){state=s;zone.className=`reaction-zone ${s}`;$('#reactionIcon').textContent=icon;$('#reactionText').textContent=label;$('#reactionHint').textContent=hint;}
  function arm(){ set('waiting','◌','Wait for it…','Do not tap yet'); waitTimer=setTimeout(()=>{armedAt=performance.now();set('go','🦞','GO!','TAP NOW');beep(880,.12);vibrate('heavy');},1100+Math.random()*2300); }
  function next(){ if(samples.length===5){const average=Math.round(samples.reduce((a,b)=>a+b,0)/5);set('done','🏁',`${average} ms average`,'Five clean strikes');finish('Reef conquered!',average,current,true);$('#again').onclick=reset;return;}$('#round').textContent=`${samples.length+1} / 5`;arm(); }
  function reset(){clearTimeout(waitTimer);samples=[];$('#round').textContent='0 / 5';$('#average').textContent='—';$('#result').replaceChildren();set('idle','⚡','Tap to start','Five rounds. No cheating.');}
  zone.onclick=()=>{
    if(state==='idle') return next();
    if(state==='waiting'){clearTimeout(waitTimer);vibrate('heavy');beep(160,.2);set('early','😬','Too soon!','Tap to retry this round');$('#status').textContent='False start. Same round, try again.';return;}
    if(state==='early') return arm();
    if(state==='go'){const ms=Math.round(performance.now()-armedAt);samples.push(ms);$('#average').textContent=`${Math.round(samples.reduce((a,b)=>a+b,0)/samples.length)} ms`;$('#status').textContent=`${ms} ms. ${ms<250?'Claws of lightning.':'Keep the rhythm.'}`;vibrate();set('between','✓',`${ms} ms`,'Tap for next round');return;}
    if(state==='between') next();
  };
  return ()=>clearTimeout(waitTimer);
}
function clawFour(){
  shell('🦞','MULTIPLAYER / ROOM','Two players. Drop a token into a column; connect four to win.',`<div class="room-strip">ROOM <strong id="roomName"></strong><button id="shareRoom" class="text-button">Share ↗</button></div><div class="scorebar"><span>TURN <strong id="turn">Waiting</strong></span><span id="players">0 / 2 players</span></div><div class="claw-board" id="clawBoard"></div><div class="claw-columns" id="clawColumns"></div><p class="game-status" id="status">Loading room…</p><div id="joinPanel"><label for="playerName">Your display name</label><div class="join-row"><input id="playerName" maxlength="24" placeholder="Captain Claw"><button id="join" class="primary-action">Join</button></div></div><div class="game-footer"><button id="resetRoom" class="text-button">Reset shared room</button></div>`);
  $('#roomName').textContent=roomId;
  let player; try{player=JSON.parse(localStorage.getItem(`claw-four:${roomId}:player`)||'null');}catch{player=null;}
  let room, busy=false, alive=true;
  const api=async(action,body)=>{const response=await fetch(`/api/rooms/${roomId}/${action}`,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});const json=await response.json();if(!response.ok)throw new Error(json.error||'Request failed');return json;};
  const myTurn=()=>player&&room?.status==='active'&&room.currentPlayer?.id===player.id;
  function render(){if(!room||!alive)return;$('#players').textContent=`${room.players.length} / 2 players`;$('#turn').textContent=room.status==='finished'?'Finished':room.currentPlayer?.name||'Waiting';$('#status').textContent=room.status==='finished'?room.winner?.id==='draw'?'Draw!':`${room.winner?.name} wins! 🏆`:room.status==='lobby'?'Waiting for a second player. Share the room link.':myTurn()?'Your move. Pick a column.':`Waiting on ${room.currentPlayer?.name}.`;$('#joinPanel').classList.toggle('hidden',!!player);$('#clawBoard').innerHTML=room.board.flat().map(mark=>`<span class="claw-cell ${mark==='R'?'red':mark==='Y'?'gold':''}">${mark==='R'?'🦞':mark==='Y'?'🐚':'·'}</span>`).join('');$('#clawColumns').innerHTML=Array.from({length:7},(_,i)=>`<button data-column="${i}" ${!myTurn()||room.board[0][i]?'disabled':''} aria-label="Drop in column ${i+1}">${i+1}</button>`).join('');$('#clawColumns').querySelectorAll('button').forEach(button=>button.onclick=async()=>{if(busy)return;busy=true;try{room=(await api('move',{playerId:player.id,column:Number(button.dataset.column)})).room;vibrate('medium');beep(350,.1);render();}catch(error){note(error.message);}finally{busy=false;}});}
  async function refresh(){try{room=(await api('state')).room;render();}catch(error){$('#status').textContent=error.message;}}
  $('#join').onclick=async()=>{try{const result=await api('join',{name:$('#playerName').value||'Player'});player=result.player;room=result.room;localStorage.setItem(`claw-four:${roomId}:player`,JSON.stringify(player));vibrate('medium');render();}catch(error){note(error.message);}};
  $('#playerName').onkeydown=e=>{if(e.key==='Enter')$('#join').click();};
  $('#resetRoom').onclick=async()=>{if(!confirm('Reset this shared room for everyone?'))return;try{room=(await api('reset',{})).room;player=null;localStorage.removeItem(`claw-four:${roomId}:player`);render();}catch(error){note(error.message);}};
  $('#shareRoom').onclick=async()=>{const url=`${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}&game=claw-four`;if(navigator.share){try{await navigator.share({title:'Claw Four',url});}catch{}}else{await navigator.clipboard.writeText(url);note('Room link copied');}};
  refresh();const interval=setInterval(refresh,2500);return()=>{alive=false;clearInterval(interval);};
}
syncSound();renderMenu();open(games.some(g=>g.id===params.get('game'))?params.get('game'):'');
