import { createFxRuntime } from '../runtime/fx.js';

const STYLE_ID = 'panic-directors-cut-styles';
const GAME_ID = 'panic-directors-cut';
const TUTORIAL_KEY = 'clawcade:panic-directors-cut:tutorial:v1';

export const PANIC_GESTURES = Object.freeze(['tap', 'hold', 'wait', 'drag']);

export function dragOffset(origin, current) {
  return { x: current.x - origin.x, y: current.y - origin.y };
}

export function timerPresentation(remaining, duration, reducedMotion = false) {
  const safeDuration = Math.max(1, Number(duration) || 1);
  const safeRemaining = Math.max(0, Number(remaining) || 0);
  return {
    scale: reducedMotion ? (safeRemaining > 0 ? 1 : 0) : Math.min(1, safeRemaining / safeDuration),
    label: `${Math.ceil(safeRemaining / 1000)} sec`,
  };
}

export function leviathanPhase(phase) {
  return [
    null,
    { label: 'EYE SEARCH', telegraph: 'The eye sweeps the stage. Do not move.' },
    { label: 'TENTACLE CRUSH', telegraph: 'Tentacles hit the hull. Hold the wheel.' },
    { label: 'HULL BREACH', telegraph: 'The glass cracks. Drag the patch to the breach.' },
  ][phase] || null;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = new URL('./panic-directors-cut.css', import.meta.url).href;
  document.head.append(link);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[pick]] = [copy[pick], copy[index]];
  }
  return copy;
}

function captainSvg(mood = 'ready') {
  const mouths = {
    ready: '<path d="M43 65 Q60 74 77 65"/>',
    win: '<path d="M41 62 Q60 82 79 62"/>',
    lose: '<path d="M43 72 Q60 57 77 72"/>',
    panic: '<ellipse cx="60" cy="69" rx="10" ry="13"/>',
  };
  const eyes = mood === 'panic'
    ? '<circle cx="47" cy="48" r="6"/><circle cx="73" cy="48" r="6"/>'
    : mood === 'win'
      ? '<path d="M40 49 Q47 42 54 49M66 49 Q73 42 80 49"/>'
      : '<circle cx="47" cy="49" r="4"/><circle cx="73" cy="49" r="4"/>';
  return `<svg class="pdc-captain-svg" viewBox="0 0 120 120" role="img" aria-label="Captain Clack is ${mood}">
    <defs><linearGradient id="clackShell" x1="0" x2="1"><stop stop-color="#ff7b62"/><stop offset="1" stop-color="#c92f48"/></linearGradient></defs>
    <path class="pdc-antenna" d="M39 37 Q25 17 16 29M81 37 Q95 17 104 29"/>
    <path class="pdc-claw" d="M29 68 C8 57 6 83 25 84 C10 98 34 105 43 82M91 68 C112 57 114 83 95 84 C110 98 86 105 77 82"/>
    <ellipse cx="60" cy="68" rx="35" ry="39" fill="url(#clackShell)"/>
    <path d="M30 43 Q60 18 90 43 L84 33 Q60 19 36 33Z" class="pdc-cap"/>
    <path d="M50 28 L76 28 L72 39 L50 37Z" class="pdc-cap-badge"/>
    <g class="pdc-face">${eyes}<g class="pdc-mouth">${mouths[mood] || mouths.ready}</g></g>
    <path d="M42 92 Q60 102 78 92" class="pdc-belly"/>
  </svg>`;
}

const tapScenes = [
  { id: 'alarm', command: 'SLAP IT!', prop: '<button class="pdc-prop pdc-alarm" data-correct aria-label="Slap the flashing alarm"><span></span></button>', success: 'Alarm slapped. Ears preserved.', timeout: 'The alarm kept screaming because it was never slapped.' },
  { id: 'clam', command: 'CRACK IT!', prop: '<button class="pdc-prop pdc-clam" data-correct aria-label="Crack the closed clam"><span></span></button>', success: 'Clam cracked clean.', timeout: 'The clam stayed shut because it was not cracked.' },
  { id: 'bubble', command: 'POP IT!', prop: '<button class="pdc-prop pdc-bubble" data-correct aria-label="Pop the giant bubble"></button>', success: 'Bubble popped before it reached the fan.', timeout: 'The bubble reached the fan because it was not popped.' },
  { id: 'fuse', command: 'STAMP IT!', prop: '<button class="pdc-prop pdc-fuse" data-correct aria-label="Stamp out the burning fuse"><span></span></button>', success: 'Fuse stamped out.', timeout: 'The fuse burned down because it was not stamped.' },
];

const holdScenes = [
  { id: 'hatch', command: 'HOLD IT!', prop: '<button class="pdc-prop pdc-wheel" data-hold aria-label="Hold the airlock wheel"><span></span></button>', success: 'Airlock held until the seal caught.', early: 'You released the wheel before the airlock sealed.', timeout: 'The airlock blew because the wheel was never held.' },
  { id: 'puffer', command: 'INFLATE!', prop: '<button class="pdc-prop pdc-puffer" data-hold aria-label="Hold to inflate the emergency puffer"><span></span></button>', success: 'Emergency puffer fully inflated.', early: 'You let go before the puffer inflated.', timeout: 'The puffer stayed flat because it was never held.' },
  { id: 'lever', command: 'BRACE!', prop: '<button class="pdc-prop pdc-lever" data-hold aria-label="Hold the ballast lever"><span></span></button>', success: 'Ballast braced through the impact.', early: 'You released the ballast lever during the impact.', timeout: 'The ballast lever was not braced.' },
  { id: 'hose', command: 'PINCH IT!', prop: '<button class="pdc-prop pdc-hose" data-hold aria-label="Hold the ruptured hose closed"><span></span></button>', success: 'Hose pinched until pressure dropped.', early: 'You released the hose while it was still pressurized.', timeout: 'The hose flooded the deck because it was not pinched.' },
];

const waitScenes = [
  { id: 'mine', command: 'FREEZE!', prop: '<button class="pdc-prop pdc-mine" data-wrong aria-label="Drifting sea mine; do not touch"><span></span></button>', success: 'The mine drifted past untouched.', wrong: 'You touched the mine during FREEZE.' },
  { id: 'kraken', command: 'PLAY DEAD!', prop: '<button class="pdc-prop pdc-eye" data-wrong aria-label="Kraken eye; do not touch"><span></span></button>', success: 'The kraken lost interest.', wrong: 'You moved while the kraken was watching.' },
  { id: 'laser', command: 'DON’T CROSS!', prop: '<button class="pdc-prop pdc-laser" data-wrong aria-label="Security beam; do not touch"><span></span></button>', success: 'The security beam cycled off.', wrong: 'You crossed the live security beam.' },
  { id: 'eel', command: 'STAY STILL!', prop: '<button class="pdc-prop pdc-eel" data-wrong aria-label="Electric eel; do not touch"><span></span></button>', success: 'The electric eel swam by.', wrong: 'You startled the electric eel.' },
];

const targetScenes = [
  { id: 'porthole', command: 'FIND CLACK!', prop: `<div class="pdc-targets" aria-label="Choose a porthole"><button aria-label="Empty porthole"></button><button data-correct aria-label="Captain Clack porthole"><span class="pdc-mini-clack">${captainSvg('panic')}</span></button><button aria-label="Empty porthole"></button><button aria-label="Empty porthole"></button></div>`, success: 'Captain located.', wrong: 'That porthole was empty.' },
  { id: 'valve', command: 'TURN BLUE!', prop: '<div class="pdc-targets pdc-valves" aria-label="Choose a valve"><button aria-label="Red triangle valve"><span>▲</span><strong>RED</strong></button><button aria-label="Gold circle valve"><span>●</span><strong>GOLD</strong></button><button aria-label="Green square valve"><span>■</span><strong>GREEN</strong></button><button data-correct aria-label="Blue diamond valve"><span>◆</span><strong>BLUE</strong></button></div>', success: 'Blue diamond valve turned.', wrong: 'Wrong valve. Match the BLUE label and diamond.' },
  { id: 'intruder', command: 'CATCH THE FAKE!', prop: '<div class="pdc-targets pdc-barnacles" aria-label="Find the fake barnacle"><button aria-label="Barnacle"></button><button aria-label="Barnacle"></button><button aria-label="Barnacle"></button><button data-correct aria-label="Fake mechanical barnacle"></button></div>', success: 'Mechanical barnacle caught.', wrong: 'That was an innocent barnacle.' },
  { id: 'signal', command: 'HIT THE PULSE!', prop: '<div class="pdc-targets pdc-signals" aria-label="Choose the pulsing beacon"><button aria-label="Dark beacon"></button><button aria-label="Dark beacon"></button><button data-correct aria-label="Pulsing beacon"></button><button aria-label="Dark beacon"></button></div>', success: 'Signal pulse caught.', wrong: 'That beacon was dark.' },
];

const dragScenes = [
  { id: 'patch', command: 'PATCH IT!', source: 'patch', target: 'leak', sourceLabel: 'Hull patch', targetLabel: 'Hull leak', success: 'Patch seated over the leak.', wrong: 'The patch was dropped away from the hull leak.' },
  { id: 'rope', command: 'TIE IT!', source: 'rope', target: 'cleat', sourceLabel: 'Loose rope', targetLabel: 'Deck cleat', success: 'Rope secured to the cleat.', wrong: 'The rope missed the deck cleat.' },
  { id: 'pearl', command: 'SOCKET IT!', source: 'pearl', target: 'socket', sourceLabel: 'Power pearl', targetLabel: 'Empty power socket', success: 'Pearl locked into the power socket.', wrong: 'The pearl missed the power socket.' },
  { id: 'cargo', command: 'STOW IT!', source: 'cargo', target: 'crate', sourceLabel: 'Loose cargo', targetLabel: 'Open cargo crate', success: 'Cargo stowed before the roll.', wrong: 'The cargo was dropped outside the crate.' },
];

const pools = { tap: tapScenes, hold: holdScenes, wait: waitScenes, target: targetScenes, drag: dragScenes };

const bossPhases = [
  { ...waitScenes[1], id: 'boss-hide', command: 'HIDE!', boss: true },
  { ...holdScenes[0], id: 'boss-hold', command: 'HOLD FAST!', boss: true },
  { ...dragScenes[0], id: 'boss-patch', command: 'SEAL THE BREACH!', boss: true },
];

function regularRun() {
  const typeOrder = shuffle(['tap', 'hold', 'wait', 'target', 'drag']);
  const queues = Object.fromEntries(Object.entries(pools).map(([type, scenes]) => [type, shuffle(scenes)]));
  const acts = [];
  for (let act = 0; act < 3; act += 1) {
    const types = shuffle([...typeOrder]).slice(0, 4);
    acts.push(types.map((type) => {
      const scene = queues[type].shift() || shuffle(pools[type])[0];
      return { ...scene, type, act: act + 1 };
    }));
  }
  return acts.flat();
}

export function mountPanic(ctx) {
  ensureStyles();
  const {
    mount,
    record = () => false,
    track = () => {},
    note = () => {},
    vibrate = () => {},
    beep = () => {},
    menu = () => {},
  } = ctx || {};
  if (!(mount instanceof Element)) throw new TypeError('mountPanic requires ctx.mount Element');

  mount.innerHTML = `<section class="pdc" aria-labelledby="pdc-title">
    <header class="pdc-header">
      <div id="pdc-captain" class="pdc-captain">${captainSvg('ready')}</div>
      <div><p class="pdc-kicker">AUTHORED MICROGAME SHOW</p><h2 id="pdc-title">Panic: Director's Cut</h2><p>One command. One action. Four lives. Captain Clack is absolutely qualified.</p></div>
    </header>
    <div class="pdc-hud" aria-label="Run status"><span>ACT <strong id="pdc-act">1 / 3</strong></span><span>SCENE <strong id="pdc-scene">0 / 15</strong></span><span>LIVES <strong id="pdc-lives">●●●●</strong></span><span>SPEED <strong id="pdc-speed">1×</strong></span><span>SCORE <strong id="pdc-score">0</strong></span><span>STREAK <strong id="pdc-streak">0</strong></span></div>
    <div class="pdc-stage" id="pdc-stage" aria-labelledby="pdc-command">
      <div class="pdc-curtain pdc-curtain-left"></div><div class="pdc-curtain pdc-curtain-right"></div>
      <div class="pdc-leviathan" id="pdc-leviathan" role="img" aria-label="Leviathan outside the glass">
        <i class="pdc-leviathan-tentacle pdc-leviathan-tentacle-left"></i><i class="pdc-leviathan-tentacle pdc-leviathan-tentacle-right"></i><i class="pdc-leviathan-eye"></i><i class="pdc-leviathan-crack"></i>
      </div>
      <div class="pdc-boss-track" id="pdc-boss-track" aria-label="Leviathan finale progress"><span>1 EYE</span><span>2 HOLD</span><span>3 SEAL</span></div>
      <div class="pdc-command" id="pdc-command">PLACES!</div>
      <div class="pdc-timer" aria-hidden="true"><span id="pdc-timer-fill"></span></div>
      <strong class="pdc-time-text" id="pdc-time-text" aria-live="off">Ready</strong>
      <div class="pdc-scene" id="pdc-props"></div>
    </div>
    <p class="pdc-status" id="pdc-status" role="status" aria-live="assertive" aria-atomic="true">Captain Clack needs a stagehand.</p>
    <div class="pdc-actions" id="pdc-actions"><button class="pdc-primary" id="pdc-start">Start the show</button></div>
    <button class="pdc-menu" id="pdc-menu">← All games</button>
  </section>`;

  const $ = (selector) => mount.querySelector(selector);
  const stage = $('#pdc-stage');
  const props = $('#pdc-props');
  const fx = createFxRuntime({ root: stage, maxParticles: 24 });
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let alive = true;
  let active = false;
  let run = [];
  let index = 0;
  let lives = 4;
  let score = 0;
  let streak = 0;
  let bossPhase = 0;
  let timeoutId = 0;
  let holdId = 0;
  let rafId = 0;
  let deadline = 0;
  let duration = 0;
  let dragCleanup = () => {};
  let currentScene = null;
  let pausedByVisibility = false;
  let lastFailure = '';
  let lastTimerSecond = -1;

  function clearTimers() {
    clearTimeout(timeoutId);
    clearTimeout(holdId);
    cancelAnimationFrame(rafId);
    dragCleanup();
    dragCleanup = () => {};
  }

  function setCaptain(mood, line) {
    $('#pdc-captain').innerHTML = captainSvg(mood);
    if (line) note(line);
  }

  function updateHud(act = Math.min(3, Math.floor(index / 4) + 1)) {
    $('#pdc-act').textContent = bossPhase ? 'FINALE' : `${act} / 3`;
    $('#pdc-scene').textContent = bossPhase ? `${bossPhase} / ${bossPhases.length}` : `${Math.min(index + 1, run.length)} / ${run.length + 3}`;
    $('#pdc-lives').textContent = `${'●'.repeat(lives)}${'○'.repeat(4 - lives)}`;
    $('#pdc-speed').textContent = bossPhase ? 'BOSS' : `${act}×`;
    $('#pdc-score').textContent = String(score);
    $('#pdc-streak').textContent = streak ? `${streak}×` : '0';
  }

  function animateTimer() {
    if (!active) return;
    const remaining = Math.max(0, deadline - performance.now());
    const presentation = timerPresentation(remaining, duration, motionQuery.matches);
    $('#pdc-timer-fill').style.transform = `scaleX(${presentation.scale})`;
    const second = Math.ceil(remaining / 1000);
    if (second !== lastTimerSecond) {
      lastTimerSecond = second;
      $('#pdc-time-text').textContent = presentation.label;
    }
    if (remaining > 0) rafId = requestAnimationFrame(animateTimer);
  }

  function deadlineFor(scene) {
    if (scene.boss) return 2200;
    const act = scene.act || 1;
    return [0, 3500, 2700, 2100][act];
  }

  function result(won, reason, scene) {
    if (!active || !alive) return;
    active = false;
    clearTimers();
    track('panic_director_scene', { scene: scene.id, type: scene.type, act: scene.act || 4, boss: Boolean(scene.boss), won, reason });
    stage.classList.toggle('pdc-failed', !won);
    stage.classList.toggle('pdc-won', won);
    if (won) {
      score += scene.boss ? 3 : 1;
      streak += 1;
      vibrate(streak >= 3 ? 'heavy' : 'medium');
      beep(560 + Math.min(240, streak * 35), .09);
      setCaptain('win');
      $('#pdc-status').textContent = scene.success;
    } else {
      lives -= 1;
      streak = 0;
      lastFailure = reason;
      vibrate('heavy');
      beep(145, .16);
      setCaptain(lives ? 'panic' : 'lose');
      $('#pdc-status').textContent = reason;
    }
    updateHud(scene.act);
    if (!lives) {
      timeoutId = setTimeout(finishRun, 850);
      return;
    }
    timeoutId = setTimeout(() => {
      if (scene.boss) {
        if (won) bossPhase += 1;
        showBoss();
      } else {
        index += 1;
        showRegular();
      }
    }, 720);
  }

  function bindTapScene(scene) {
    props.innerHTML = scene.prop;
    props.querySelectorAll('button').forEach((button) => {
      button.onclick = () => result(button.hasAttribute('data-correct'), button.hasAttribute('data-correct') ? scene.success : (scene.wrong || 'That was not the commanded target.'), scene);
    });
  }

  function bindHoldScene(scene) {
    props.innerHTML = scene.prop;
    const button = props.querySelector('[data-hold]');
    let held = false;
    const needed = scene.boss ? 900 : 700;
    const begin = (event) => {
      event.preventDefault();
      if (!active) return;
      held = true;
      button.classList.add('pdc-holding');
      holdId = setTimeout(() => result(true, scene.success, scene), needed);
    };
    const end = () => {
      if (!active || !held) return;
      held = false;
      clearTimeout(holdId);
      result(false, scene.early, scene);
    };
    button.onpointerdown = begin;
    button.onpointerup = end;
    button.onpointercancel = end;
    button.onkeydown = (event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) begin(event); };
    button.onkeyup = (event) => { if (event.key === ' ' || event.key === 'Enter') end(); };
  }

  function bindWaitScene(scene) {
    props.innerHTML = scene.prop;
    props.querySelectorAll('button').forEach((button) => { button.onclick = () => result(false, scene.wrong, scene); });
  }

  function bindDragScene(scene) {
    props.innerHTML = `<div class="pdc-drag-field">
      <button class="pdc-drag-source pdc-${scene.source}" aria-label="${scene.sourceLabel}" aria-describedby="pdc-drag-help"><span></span></button>
      <button class="pdc-drag-target pdc-${scene.target}" aria-label="${scene.targetLabel}" aria-describedby="pdc-drag-help"><span></span></button>
      <span class="pdc-drag-help" id="pdc-drag-help">Drag the movable object to its matching destination. Keyboard: select the object, then select the destination.</span>
    </div>`;
    const source = props.querySelector('.pdc-drag-source');
    const target = props.querySelector('.pdc-drag-target');
    let dragging = false;
    let armed = false;
    let dragOrigin = null;
    const resetSource = () => { source.style.removeProperty('transform'); source.classList.remove('pdc-dragging'); dragOrigin = null; };
    const complete = () => result(true, scene.success, scene);
    source.onclick = () => {
      if (!active) return;
      armed = true;
      source.classList.add('pdc-armed');
      $('#pdc-status').textContent = `${scene.sourceLabel} selected.`;
    };
    target.onclick = () => {
      if (armed) complete();
      else result(false, `The ${scene.targetLabel.toLowerCase()} was selected before the ${scene.sourceLabel.toLowerCase()}.`, scene);
    };
    source.onpointerdown = (event) => {
      if (!active) return;
      event.preventDefault();
      dragging = true;
      dragOrigin = { x: event.clientX, y: event.clientY };
      source.setPointerCapture?.(event.pointerId);
      source.classList.add('pdc-dragging');
    };
    source.onpointermove = (event) => {
      if (!dragging || !dragOrigin) return;
      const offset = dragOffset(dragOrigin, { x: event.clientX, y: event.clientY });
      source.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    };
    source.onpointerup = (event) => {
      if (!dragging) return;
      dragging = false;
      const box = target.getBoundingClientRect();
      const hit = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (hit) complete(); else { resetSource(); result(false, scene.wrong, scene); }
    };
    source.onpointercancel = () => { dragging = false; resetSource(); };
    dragCleanup = resetSource;
  }

  function renderBossTrack(phase = 0) {
    stage.dataset.bossPhase = phase ? String(phase) : '';
    $('#pdc-boss-track').querySelectorAll('span').forEach((step, index) => {
      step.classList.toggle('complete', index + 1 < phase);
      step.classList.toggle('active', index + 1 === phase);
    });
    const telegraph = leviathanPhase(phase);
    $('#pdc-leviathan').setAttribute('aria-label', telegraph ? `Leviathan: ${telegraph.label}. ${telegraph.telegraph}` : 'Leviathan outside the glass');
  }

  function mountScene(scene) {
    clearTimers();
    currentScene = scene;
    active = true;
    stage.classList.remove('pdc-failed', 'pdc-won', 'pdc-boss', 'pdc-paused', 'pdc-tutorial');
    if (scene.boss) stage.classList.add('pdc-boss');
    renderBossTrack(scene.boss ? bossPhase : 0);
    $('#pdc-command').textContent = scene.command;
    const bossCue = scene.boss ? leviathanPhase(bossPhase) : null;
    $('#pdc-status').textContent = bossCue ? `${bossCue.label} · ${bossCue.telegraph}` : `Act ${scene.act}. Read the command.`;
    setCaptain(scene.boss ? 'panic' : 'ready');
    updateHud(scene.act);
    if (scene.type === 'tap' || scene.type === 'target') bindTapScene(scene);
    if (scene.type === 'hold') bindHoldScene(scene);
    if (scene.type === 'wait') bindWaitScene(scene);
    if (scene.type === 'drag') bindDragScene(scene);
    duration = deadlineFor(scene);
    deadline = performance.now() + duration;
    lastTimerSecond = -1;
    $('#pdc-timer-fill').style.transform = 'scaleX(1)';
    rafId = requestAnimationFrame(animateTimer);
    timeoutId = setTimeout(() => {
      if (scene.type === 'wait') result(true, scene.success, scene);
      else result(false, scene.timeout || `Time ran out before “${scene.command}” was completed.`, scene);
    }, duration);
  }

  function actCard(act, callback) {
    active = false;
    currentScene = null;
    clearTimers();
    stage.classList.remove('pdc-failed', 'pdc-won', 'pdc-boss');
    if (act === 4) stage.classList.add('pdc-boss');
    renderBossTrack(act === 4 ? 1 : 0);
    $('#pdc-command').textContent = act === 4 ? 'FINAL ACT' : `ACT ${act}`;
    props.innerHTML = act === 4
      ? '<div class="pdc-act-card"><strong>LEVIATHAN AT THE GLASS</strong><span>Three readable attacks. No hints. No mercy.</span></div>'
      : `<div class="pdc-act-card"><strong>${['', 'THE CALM SHIFT', 'ALL HANDS', 'RED ALERT'][act]}</strong><span>${act === 1 ? 'Learn the stage.' : act === 2 ? 'Less time. Stranger props.' : 'The show stops waiting.'}</span></div>`;
    $('#pdc-status').textContent = act === 4 ? 'Captain Clack has seen worse. Allegedly.' : `Act ${act} begins.`;
    setCaptain(act === 4 ? 'panic' : 'ready');
    timeoutId = setTimeout(callback, act === 4 ? 1500 : 1000);
  }

  function showRegular() {
    if (!alive) return;
    if (index >= run.length) {
      bossPhase = 1;
      actCard(4, showBoss);
      return;
    }
    const scene = run[index];
    if (index % 4 === 0) actCard(scene.act, () => mountScene(scene));
    else mountScene(scene);
  }

  function showBoss() {
    if (!alive) return;
    if (bossPhase > bossPhases.length) {
      finishRun(true);
      return;
    }
    const base = bossPhases[bossPhase - 1];
    mountScene({ ...base, type: base.type || (base.source ? 'drag' : base.id.includes('hold') ? 'hold' : 'wait'), act: 4 });
  }

  function finishRun(cleared = false) {
    active = false;
    currentScene = null;
    clearTimers();
    const completed = index + Math.max(0, bossPhase - 1);
    const finalScore = score * 100 + lives * 25 + (cleared ? 250 : 0);
    const isBest = record(GAME_ID, finalScore);
    track('panic_director_end', { score: finalScore, scenes: completed, lives, cleared, personalBest: Boolean(isBest) });
    stage.classList.remove('pdc-failed', 'pdc-boss');
    stage.classList.add(cleared ? 'pdc-won' : 'pdc-failed');
    $('#pdc-command').textContent = cleared ? 'CURTAIN CALL!' : 'SHOW OVER';
    props.innerHTML = `<div class="pdc-finale"><strong>${cleared ? 'Captain Clack survives opening night.' : 'Captain Clack demands a rewrite.'}</strong><span>${score} scenes saved · ${lives} lives left · ${finalScore} points${isBest ? ' · NEW BEST' : ''}</span>${!cleared && lastFailure ? `<em>Final miss: ${lastFailure}</em>` : ''}</div>`;
    $('#pdc-status').textContent = cleared ? 'You read every boss telegraph and saved the show.' : `Final miss: ${lastFailure || 'The show ran out of lives.'} Replay is one tap away.`;
    setCaptain(cleared ? 'win' : 'lose');
    $('#pdc-actions').innerHTML = '<button class="pdc-primary" id="pdc-replay">Replay instantly</button>';
    $('#pdc-replay').onclick = startRun;
    vibrate(cleared ? 'heavy' : 'medium');
    beep(cleared ? 820 : 190, .2);
    if (cleared) fx.particles({ origin: props.querySelector('.pdc-finale'), type: 'spark', count: 24, spread: 150, duration: 1200, colors: ['#ffd65a', '#47d9ff', '#ff4e63', '#55efb3'] });
  }

  function finishTutorial() {
    localStorage.setItem(TUTORIAL_KEY, 'complete');
    stage.classList.remove('pdc-tutorial');
    $('#pdc-actions').replaceChildren();
    startRun();
  }

  function showTutorial(step = 0) {
    clearTimers();
    active = false;
    currentScene = null;
    stage.classList.remove('pdc-failed', 'pdc-won', 'pdc-boss');
    stage.classList.add('pdc-tutorial');
    renderBossTrack(0);
    $('#pdc-timer-fill').style.transform = 'scaleX(1)';
    $('#pdc-time-text').textContent = `Lesson ${step + 1} / ${PANIC_GESTURES.length}`;
    const lessons = [
      ['TAP', 'Tap the lit prop once.', '<button class="pdc-prop pdc-alarm" id="pdc-tutorial-tap" aria-label="Tap the practice alarm"></button>'],
      ['HOLD', 'Press and keep holding until it locks.', '<button class="pdc-prop pdc-wheel" id="pdc-tutorial-hold" aria-label="Hold the practice wheel"></button>'],
      ['WAIT', 'Some commands mean do nothing. Let the danger pass.', '<button class="pdc-prop pdc-mine" id="pdc-tutorial-wait" aria-label="Practice mine; do not touch"></button>'],
      ['DRAG', 'Drag the patch to the leak. Tap-then-tap also works.', '<div class="pdc-drag-field"><button class="pdc-drag-source pdc-patch" id="pdc-tutorial-source" aria-label="Practice patch"></button><button class="pdc-drag-target pdc-leak" id="pdc-tutorial-target" aria-label="Practice leak"></button></div>'],
    ];
    const [command, help, markup] = lessons[step];
    $('#pdc-command').textContent = `PRACTICE ${command}`;
    $('#pdc-status').textContent = help;
    props.innerHTML = markup;
    setCaptain('ready');
    $('#pdc-actions').innerHTML = '<button class="pdc-menu" id="pdc-skip-tutorial">Skip tutorial & play</button>';
    $('#pdc-skip-tutorial').onclick = finishTutorial;
    const advance = () => {
      $('#pdc-status').textContent = `${command} understood.`;
      vibrate('light');
      beep(610 + step * 45, .06);
      timeoutId = setTimeout(() => step + 1 < lessons.length ? showTutorial(step + 1) : finishTutorial(), 350);
    };
    if (step === 0) $('#pdc-tutorial-tap').onclick = advance;
    if (step === 1) {
      const button = $('#pdc-tutorial-hold');
      let completed = false;
      const begin = (event) => {
        event.preventDefault();
        button.classList.add('pdc-holding');
        holdId = setTimeout(() => { completed = true; advance(); }, 650);
      };
      const end = () => {
        if (completed) return;
        clearTimeout(holdId);
        button.classList.remove('pdc-holding');
        $('#pdc-status').textContent = 'Keep holding until the wheel locks.';
      };
      button.onpointerdown = begin; button.onpointerup = end; button.onpointercancel = end;
      button.onkeydown = (event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) begin(event); };
      button.onkeyup = (event) => { if (event.key === ' ' || event.key === 'Enter') end(); };
    }
    if (step === 2) {
      const button = $('#pdc-tutorial-wait');
      const pass = () => { if (alive) advance(); };
      timeoutId = setTimeout(pass, 1200);
      button.onclick = () => {
        clearTimeout(timeoutId);
        $('#pdc-status').textContent = 'That was movement. For WAIT, touch nothing.';
        timeoutId = setTimeout(pass, 1200);
      };
    }
    if (step === 3) {
      const source = $('#pdc-tutorial-source');
      const target = $('#pdc-tutorial-target');
      let origin = null;
      let armed = false;
      source.onclick = () => { armed = true; source.classList.add('pdc-armed'); $('#pdc-status').textContent = 'Patch selected. Now choose the leak.'; };
      target.onclick = () => { if (armed) advance(); else $('#pdc-status').textContent = 'Select the patch first.'; };
      source.onpointerdown = (event) => { event.preventDefault(); origin = { x: event.clientX, y: event.clientY }; source.setPointerCapture?.(event.pointerId); source.classList.add('pdc-dragging'); };
      source.onpointermove = (event) => { if (!origin) return; const offset = dragOffset(origin, { x: event.clientX, y: event.clientY }); source.style.transform = `translate(${offset.x}px, ${offset.y}px)`; };
      source.onpointerup = (event) => { if (!origin) return; const box = target.getBoundingClientRect(); const hit = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom; origin = null; if (hit) advance(); else { source.style.removeProperty('transform'); source.classList.remove('pdc-dragging'); } };
      dragCleanup = () => { origin = null; source.style.removeProperty('transform'); source.classList.remove('pdc-dragging'); };
    }
  }

  function startRun() {
    clearTimers();
    run = regularRun();
    index = 0;
    lives = 4;
    score = 0;
    streak = 0;
    bossPhase = 0;
    lastFailure = '';
    currentScene = null;
    $('#pdc-actions').replaceChildren();
    track('panic_director_start', { sceneCount: run.length, authoredPool: Object.values(pools).flat().length });
    showRegular();
  }

  function handleVisibility() {
    if (document.hidden && active && currentScene) {
      pausedByVisibility = true;
      active = false;
      clearTimers();
      stage.classList.add('pdc-paused');
      $('#pdc-time-text').textContent = 'PAUSED';
      $('#pdc-status').textContent = 'Run paused while Clawcade was hidden. This scene will restart fairly.';
      track('panic_director_pause', { scene: currentScene.id });
      return;
    }
    if (!document.hidden && pausedByVisibility && currentScene) {
      pausedByVisibility = false;
      const scene = currentScene;
      mountScene(scene);
      $('#pdc-status').textContent = `${scene.boss ? leviathanPhase(bossPhase)?.telegraph : 'Scene restarted'} · full time restored.`;
      track('panic_director_resume', { scene: scene.id });
    }
  }

  $('#pdc-start').onclick = () => localStorage.getItem(TUTORIAL_KEY) === 'complete' ? startRun() : showTutorial();
  $('#pdc-menu').onclick = menu;
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    alive = false;
    active = false;
    clearTimers();
    fx.cleanup();
    document.removeEventListener('visibilitychange', handleVisibility);
    mount.replaceChildren();
  };
}

export default mountPanic;
