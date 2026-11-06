function captainPortrait(expression = "idle") {
  const brow = expression === "panic" ? "M50 36 L70 43 M110 43 L130 36" : expression === "victory" ? "M50 43 Q60 34 70 43 M110 43 Q120 34 130 43" : "M50 39 L70 39 M110 39 L130 39";
  const mouth = expression === "panic" ? "M72 76 Q90 60 108 76" : expression === "victory" ? "M70 70 Q90 88 110 70" : "M76 72 Q90 78 104 72";
  return `<svg viewBox="0 0 180 150" role="img" aria-label="Captain Clack, lobster navigator"><path fill="#ed664f" stroke="#241a25" stroke-width="7" d="M40 73C22 58 18 39 31 25c8 20 18 26 31 25C65 22 76 9 90 9s25 13 28 41c13 1 23-5 31-25 13 14 9 33-9 48 12 14 10 35-3 48-13 13-30 16-47 16s-34-3-47-16c-13-13-15-34-3-48Z"/><path fill="#f7b44a" stroke="#241a25" stroke-width="7" d="M44 32h92l-12-17H57Z"/><circle cx="61" cy="53" r="8" fill="#fff"/><circle cx="119" cy="53" r="8" fill="#fff"/><circle cx="62" cy="55" r="4" fill="#142b36"/><circle cx="118" cy="55" r="4" fill="#142b36"/><path d="${brow}" stroke="#241a25" stroke-width="6" stroke-linecap="round" fill="none"/><path d="${mouth}" stroke="#241a25" stroke-width="6" stroke-linecap="round" fill="none"/></svg>`;
}

function engineerPortrait(expression = "idle") {
  const eyes = expression === "panic" ? '<circle cx="60" cy="55" r="9"/><circle cx="120" cy="55" r="9"/>' : '<circle cx="60" cy="55" r="6"/><circle cx="120" cy="55" r="6"/>';
  return `<svg viewBox="0 0 180 150" role="img" aria-label="Pip, mantis shrimp engineer"><path fill="#45d3bd" stroke="#241a25" stroke-width="7" d="M44 112c-12-22-9-51 8-72 12-15 25-23 38-23s26 8 38 23c17 21 20 50 8 72-10 18-26 27-46 27s-36-9-46-27Z"/><path fill="#9d7bff" stroke="#241a25" stroke-width="7" d="M42 45q48-35 96 0l-10 18q-38-22-76 0Z"/><g fill="#fff" stroke="#241a25" stroke-width="5"><circle cx="60" cy="55" r="18"/><circle cx="120" cy="55" r="18"/></g><g fill="#142b36">${eyes}</g><path d="M68 98q22 16 44 0" stroke="#241a25" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M35 83 8 67M145 83l27-16M42 105l-29 15M138 105l29 15" stroke="#ed664f" stroke-width="11" stroke-linecap="round"/></svg>`;
}

function mildredSub(hull = 3) {
  const leak = hull <= 2 ? '<path class="mildred-leak" d="M122 45q18 8 24 25"/><circle class="mildred-bubble" cx="151" cy="75" r="4"/><circle class="mildred-bubble" cx="161" cy="62" r="3"/>' : '';
  const crack = hull <= 1 ? '<path class="mildred-crack" d="m84 37 9 8-7 8 12 10"/>' : '';
  return `<svg viewBox="0 0 210 105" role="img" aria-label="Mildred the submarine, hull condition ${hull} of 3"><path class="mildred-prop" d="M25 53 7 35m18 18L7 71"/><path class="mildred-hull" d="M30 52q18-34 93-29 42 3 66 29-25 29-72 29H61Q38 76 30 52Z"/><path class="mildred-fin" d="m83 25 17-18 27 18M78 80l-17 16h48l12-16"/><circle cx="91" cy="49" r="12"/><circle cx="125" cy="49" r="12"/><path class="mildred-smile" d="M91 66q18 10 36 0"/>${leak}${crack}</svg>`;
}

export function mountSignalStorm(ctx) {
  const { mount, shell, roomId, note, track, vibrate, beep, goMenu } = ctx;
  shell("⚓", "ASYMMETRIC CO-OP / BETA", "Two players see different clues. Say what your partner needs, lock your own control, and bring Mildred home.", `<div class="room-strip">ROOM <strong id="stormRoom"></strong><button id="stormShare" class="text-button">Share ↗</button></div><div class="scorebar storm-score"><span>HULL <strong id="stormHull">◆◆◆</strong></span><span>CRISIS <strong id="stormStage">—</strong></span><span>TIME <strong id="stormTime">—</strong></span></div><section class="signal-stage" id="signalStage"><div class="signal-water"></div><div class="signal-cracks" aria-hidden="true"></div><div class="signal-cast" id="signalCast"></div><div class="signal-role" id="stormRole">JOIN THE CREW</div><div class="signal-porthole"><div class="signal-sweep" aria-hidden="true"></div><div class="signal-mildred" id="stormMildred"></div><strong id="stormCrisis">MILDRED IS WAITING</strong><p id="stormThreat">Two crew members. Two different screens. One nervous submarine.</p></div><aside class="signal-clue" id="stormClue">Join to receive your private instrument panel.</aside><div class="signal-controls" id="stormControls"></div><p class="game-status" id="stormStatus">Loading crew manifest…</p><div id="stormResult"></div></section><div id="stormJoin"><label for="stormName">Your crew name</label><div class="join-row"><input id="stormName" maxlength="24" placeholder="Captain Claw"><button id="stormJoinButton" class="primary-action">Join</button></div></div>`);
  mount.querySelector("#stormRoom").textContent = roomId;
  let player;
  try { player = JSON.parse(localStorage.getItem(`signal-storm:${roomId}:player`) || "null"); } catch { player = null; }
  let room = null;
  let alive = true;
  let poll = null;
  let clock = null;
  let busy = false;
  let lastPhase = "";
  let pendingChoice = null;
  let pendingStage = 0;
  const $ = (selector) => mount.querySelector(selector);
  const api = async (action, body = {}) => {
    const response = await fetch(`/api/games/signal-storm/rooms/${encodeURIComponent(roomId)}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Signal lost");
    return data;
  };

  function savePlayer(next) {
    player = next;
    if (player) localStorage.setItem(`signal-storm:${roomId}:player`, JSON.stringify(player));
  }

  function expression() {
    if (["won"].includes(room?.phase)) return "victory";
    if (["resolved", "lost"].includes(room?.phase) && !room?.outcome?.won) return "panic";
    return "idle";
  }

  function drawClock() {
    clearInterval(clock);
    const output = $("#stormTime");
    if (!room?.deadlineAt || room.phase !== "active") { output.textContent = room?.phase === "resolved" ? "RESOLVE" : "—"; return; }
    const update = () => { output.textContent = `${Math.max(0, (room.deadlineAt - Date.now()) / 1000).toFixed(1)}s`; };
    update();
    clock = setInterval(update, 100);
  }

  const controlMeta = {
    LEFT: ["↙", "Port channel"], CENTER: ["↑", "Center seam"], RIGHT: ["↘", "Starboard channel"],
    DARK: ["◐", "Blackout trench"], RISE: ["⇡", "Climb now"], SURFACE: ["☀", "End the dive"],
    SHIELDS: ["⬡", "Impact shell"], ENGINE: ["⚙", "Full thrust"], SONAR: ["◉", "Mapping ping"],
    COOLANT: ["❄", "Heat exchanger"], BALLAST: ["▼", "Empty tanks"],
  };

  function renderControls() {
    const controls = $("#stormControls");
    if (!room?.you || room.phase !== "active") { controls.replaceChildren(); return; }
    const navigator = room.you.role === "navigator";
    const label = navigator ? "NAVIGATION HELM · CHOOSE MILDRED'S PATH" : "ENGINEERING BAY · ROUTE POWER";
    const readout = navigator
      ? `<div class="signal-radar" aria-hidden="true"><i></i><b>HELM</b></div>`
      : `<div class="signal-gauges" aria-hidden="true"><i style="--g:72%"></i><i style="--g:44%"></i><i style="--g:86%"></i></div>`;
    controls.className = `signal-controls ${navigator ? "nav-console" : "engine-console"}`;
    controls.innerHTML = `${readout}<p>${label}</p><div>${room.actions.map((action) => {
      const [icon, description] = controlMeta[action] || ["•", action];
      const selected = room.choice === action || pendingChoice === action;
      return `<button data-storm-action="${action}" class="${selected ? "selected" : ""}" aria-pressed="${selected}" ${room.submitted ? "disabled" : ""}><span>${icon}</span><strong>${action}</strong><small>${description}</small></button>`;
    }).join("")}</div>${!room.submitted && pendingChoice ? `<button class="primary-action signal-confirm" id="stormConfirm">LOCK ${pendingChoice} →</button>` : ""}`;
    controls.querySelectorAll("[data-storm-action]").forEach((button) => { button.onclick = () => { pendingChoice = button.dataset.stormAction; renderControls(); vibrate("light"); beep(310, .04); }; });
    const confirm = $("#stormConfirm");
    if (confirm) confirm.onclick = () => lockAction(pendingChoice);
  }

  function renderTutorial() {
    let tutorial = $("#stormTutorial");
    if (!tutorial) {
      tutorial = document.createElement("section");
      tutorial.id = "stormTutorial";
      tutorial.className = "signal-tutorial";
      $("#stormClue").after(tutorial);
    }
    if (!["active", "resolved"].includes(room?.phase) || (room.phase === "active" && !room.crisis?.tutorial)) { tutorial.remove(); return; }
    if (room.phase === "active") {
      tutorial.innerHTML = `<strong>TRAINING CRISIS · NO TIMER</strong><ol><li>Read the gold clue aloud—<b>it tells your partner what to do.</b></li><li>${room.submitted ? "✓ Your instrument is locked." : "Listen to your partner, then choose your own control below."}</li><li>${room.submitted ? "Wait for your partner's lock." : "Both controls fire together."}</li></ol>`;
      return;
    }
    const ownChoice = room.you?.role === "navigator" ? room.outcome?.navChoice : room.outcome?.engineerChoice;
    const needed = room.you?.role === "navigator" ? room.outcome?.route : room.outcome?.system;
    const partnerChoice = room.you?.role === "navigator" ? room.outcome?.engineerChoice : room.outcome?.navChoice;
    const partnerNeeded = room.you?.role === "navigator" ? room.outcome?.system : room.outcome?.route;
    tutorial.innerHTML = `<strong>CAUSE REPLAY</strong><div class="signal-replay"><span>Your panel<b>${ownChoice || "NO INPUT"}</b><em class="${ownChoice === needed ? "good" : "bad"}">${ownChoice === needed ? "CORRECT" : `NEEDED ${needed}`}</em></span><i>+</i><span>Partner panel<b>${partnerChoice || "NO INPUT"}</b><em class="${partnerChoice === partnerNeeded ? "good" : "bad"}">${partnerChoice === partnerNeeded ? "CORRECT" : `NEEDED ${partnerNeeded}`}</em></span></div><p>${room.outcome?.message || "Crisis resolved."}</p><button class="primary-action" id="stormAck" ${room.acknowledged ? "disabled" : ""}>${room.acknowledged ? (room.teammateAcknowledged ? "Advancing…" : "Understood · waiting on partner") : "Understood · continue"}</button>`;
    $("#stormAck").onclick = acknowledge;
  }

  function renderResult() {
    const target = $("#stormResult");
    if (room?.phase === "lobby" && room.players.length === 2) {
      target.innerHTML = `<div class="result-card signal-brief"><span>CREW ASSEMBLED</span><h3>Different screens. Talk out loud.</h3><p>Navigator controls the route. Engineer controls the systems. Your clue is for your partner.</p><button class="primary-action" id="stormStart">Launch Mildred →</button></div>`;
      $("#stormStart").onclick = start;
      return;
    }
    if (["won", "lost"].includes(room?.phase)) {
      const won = room.phase === "won";
      const ready = room.rematchReady.includes(player?.id);
      const closest = room.closestCallMs == null ? "Training crisis was untimed" : `Closest save: ${(room.closestCallMs / 1000).toFixed(1)}s left`;
      target.innerHTML = `<div class="result-card signal-ending ${won ? "surfaced" : "imploded"}"><span>${won ? "SURFACE BREACHED" : "HULL LOST"}</span><h3>${won ? "Mildred made it home" : "One lonely bubble"}</h3><p>${room.outcome?.message || "Mission complete"}<br>${closest}</p><button class="primary-action" id="stormRematch" ${ready ? "disabled" : ""}>${ready ? "Ready · waiting on partner" : "Swap roles & run again"}</button></div>`;
      $("#stormRematch").onclick = rematch;
      return;
    }
    target.replaceChildren();
  }

  function render() {
    if (!alive || !room) return;
    if (room.stage !== pendingStage || room.submitted || room.phase !== "active") {
      pendingChoice = null;
      pendingStage = room.stage;
    }
    if (room.you && player) savePlayer({ ...player, role: room.you.role, name: room.you.name, id: room.you.id });
    $("#stormJoin").classList.toggle("hidden", Boolean(player));
    $("#stormHull").textContent = `${"◆".repeat(room.hull)}${"◇".repeat(Math.max(0, 3 - room.hull))}`;
    $("#stormStage").textContent = room.phase === "lobby" ? "—" : `${room.stage} / ${room.stageCount}`;
    $("#stormRole").textContent = room.you ? `YOU ARE ${room.you.role.toUpperCase()}` : "JOIN THE CREW";
    $("#signalCast").innerHTML = room.you?.role === "engineer" ? engineerPortrait(expression()) : captainPortrait(expression());
    $("#stormMildred").innerHTML = mildredSub(room.hull);
    $("#stormCrisis").textContent = room.crisis?.title || "MILDRED IS WAITING";
    $("#stormThreat").textContent = room.crisis?.threat || "Two crew members. Two different screens. One nervous submarine.";
    $("#stormClue").textContent = room.crisis?.clue || (player ? "Waiting for your partner to join." : "Join to receive your private instrument panel.");
    const status = room.phase === "active"
      ? room.submitted
        ? `CONTROL LOCKED · ${room.teammateSubmitted ? "resolving" : "tell your partner what their clue requires"}`
        : `${room.crisis.tutorial ? "GUIDED FIRST CRISIS" : "LIVE CRISIS"} · your clue tells your partner what to do`
      : room.phase === "resolved"
        ? room.outcome?.message
        : room.phase === "lobby"
          ? `${room.players.length} / 2 crew · ${room.players.length === 2 ? "ready to launch" : "share the room link"}`
          : room.outcome?.message || "Mission complete";
    $("#stormStatus").textContent = status;
    $("#signalStage").dataset.phase = room.phase;
    $("#signalStage").dataset.hull = String(room.hull);
    renderControls();
    renderTutorial();
    renderResult();
    drawClock();
    if (lastPhase && lastPhase !== room.phase) {
      if (room.phase === "resolved") { vibrate(room.outcome?.won ? "medium" : "heavy"); beep(room.outcome?.won ? 690 : 110, .18); }
      if (room.phase === "won") { vibrate("heavy"); beep(880, .25); }
      track("signal_phase", { phase: room.phase, stage: room.stage, hull: room.hull });
    }
    lastPhase = room.phase;
  }

  async function refresh() {
    if (!player?.token) return;
    try {
      const result = await api("state", { playerToken: player.token });
      room = result.room;
      render();
    } catch (error) {
      if (/join/i.test(error.message)) { savePlayer(null); $("#stormJoin").classList.remove("hidden"); }
      $("#stormStatus").textContent = error.message;
    }
  }

  async function lockAction(choice) {
    if (busy || room?.submitted) return;
    busy = true;
    try { room = (await api("act", { playerToken: player.token, choice })).room; vibrate("medium"); beep(420, .07); render(); }
    catch (error) { note(error.message); }
    finally { busy = false; }
  }

  async function start() {
    if (busy) return;
    busy = true;
    try { room = (await api("start", { playerToken: player.token })).room; track("signal_start", { role: room.you?.role }); render(); }
    catch (error) { note(error.message); }
    finally { busy = false; }
  }

  async function rematch() {
    if (busy) return;
    busy = true;
    try { room = (await api("rematch", { playerToken: player.token })).room; render(); }
    catch (error) { note(error.message); }
    finally { busy = false; }
  }

  async function acknowledge() {
    if (busy || room?.acknowledged) return;
    busy = true;
    try { room = (await api("ack", { playerToken: player.token })).room; render(); }
    catch (error) { note(error.message); }
    finally { busy = false; }
  }

  $("#stormJoinButton").onclick = async () => {
    if (busy) return;
    busy = true;
    try {
      const result = await api("join", { name: $("#stormName").value || player?.name || "Crew", resumeToken: player?.token });
      savePlayer(result.player);
      room = result.room;
      vibrate("medium");
      render();
    } catch (error) { note(error.message); }
    finally { busy = false; }
  };
  $("#stormName").onkeydown = (event) => { if (event.key === "Enter") $("#stormJoinButton").click(); };
  $("#stormShare").onclick = async () => {
    const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}&game=signal-storm`;
    if (navigator.share) { try { await navigator.share({ title: "Signal Storm", text: "Crew up. Mildred needs us.", url }); } catch { /* cancelled */ } }
    else { await navigator.clipboard.writeText(url); note("Crew link copied"); }
  };

  if (player?.token) refresh(); else { room = { players: [], phase: "lobby", hull: 3, stage: 0, stageCount: 5, actions: [], rematchReady: [] }; render(); }
  const schedule = () => {
    if (!alive) return;
    poll = setTimeout(async () => { await refresh(); schedule(); }, room?.phase === "active" ? 650 : 1_200);
  };
  schedule();
  return () => { alive = false; clearTimeout(poll); clearInterval(clock); };
}
