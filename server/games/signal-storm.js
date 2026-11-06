import { randomBytes } from "node:crypto";

const rooms = new Map();
const choices = {
  navigator: ["LEFT", "CENTER", "RIGHT", "DARK", "RISE", "SURFACE"],
  engineer: ["SHIELDS", "ENGINE", "SONAR", "COOLANT", "BALLAST"],
};

const crises = [
  {
    id: "coral-gate",
    title: "CORAL GATE",
    threat: "A razor-coral wall fills the forward glass.",
    route: "LEFT",
    system: "SHIELDS",
    navigatorClue: "Only SHIELDS can take the coral impact. Tell your Engineer.",
    engineerClue: "The pressure map marks the LEFT channel stable. Tell your Navigator.",
    success: "Shields bloom as Mildred slips through the left channel.",
  },
  {
    id: "thermal-vent",
    title: "THERMAL VENT",
    threat: "A volcanic plume rolls under the keel.",
    route: "CENTER",
    system: "COOLANT",
    navigatorClue: "The engine casing is glowing. Call for COOLANT.",
    engineerClue: "The heat map shows a narrow CENTER seam. Call the route.",
    success: "Coolant floods the pipes and the center seam holds.",
  },
  {
    id: "leviathan",
    title: "LEVIATHAN CONTACT",
    threat: "Something enormous opens one eye in the black water.",
    route: "DARK",
    system: "SONAR",
    navigatorClue: "One quiet SONAR pulse can map the creature. Tell your Engineer.",
    engineerClue: "The creature hunts light. Tell your Navigator to go DARK.",
    success: "One sonar pulse draws the beast away from the darkened sub.",
  },
  {
    id: "crush-depth",
    title: "CRUSH DEPTH",
    threat: "The trench clamps down. Hull ribs begin to sing.",
    route: "RISE",
    system: "ENGINE",
    navigatorClue: "Only full ENGINE power can beat the down-current. Call it.",
    engineerClue: "The depth gauge is red. Tell your Navigator to RISE.",
    success: "The engine catches and Mildred claws upward through the current.",
  },
  {
    id: "surface-run",
    title: "FINAL SURFACE RUN",
    threat: "The trench collapses behind you. This is the last move.",
    route: "SURFACE",
    system: "BALLAST",
    navigatorClue: "Blow the BALLAST or the sub stays buried. Tell your Engineer.",
    engineerClue: "The escape line is straight up. Tell your Navigator to SURFACE.",
    success: "Ballast erupts. Mildred punches through the sunrise.",
  },
];

const routeNames = { LEFT: "port channel", CENTER: "center seam", RIGHT: "starboard channel", DARK: "blackout trench", RISE: "rising current", SURFACE: "surface line" };
const systemNames = { SHIELDS: "impact shields", ENGINE: "main engine", SONAR: "sonar pulse", COOLANT: "coolant loop", BALLAST: "ballast tanks" };

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function routeReading(answer) {
  const labels = [["port", "LEFT"], ["center", "CENTER"], ["starboard", "RIGHT"]];
  const values = Object.fromEntries(labels.map(([, key]) => [key, key === answer ? pick([1, 2]) : pick([6, 7, 8, 9])]));
  return `Pressure trace: port ${values.LEFT}, center ${values.CENTER}, starboard ${values.RIGHT}. The quietest reading is the stable water.`;
}

function buildMission() {
  const thermalRoute = pick(["LEFT", "CENTER", "RIGHT"]);
  const thermalSystem = pick(["COOLANT", "SHIELDS"]);
  const creatureRoute = pick(["DARK", "LEFT", "RIGHT"]);
  const creatureSystem = pick(["SONAR", "ENGINE"]);
  const depthRoute = pick(["RISE", "CENTER"]);
  const depthSystem = pick(["ENGINE", "BALLAST"]);
  const finalRoute = pick(["SURFACE", "RISE"]);
  const finalSystem = pick(["BALLAST", "ENGINE"]);
  return [
    crises[0],
    {
      id: "thermal-vent", title: thermalSystem === "COOLANT" ? "THERMAL VENT" : "OBSIDIAN SHOWER",
      threat: thermalSystem === "COOLANT" ? "The engine casing glows as volcanic water folds around Mildred." : "A wall of volcanic glass tumbles through the current.",
      route: thermalRoute, system: thermalSystem,
      navigatorClue: thermalSystem === "COOLANT" ? "The temperature needle is buried in red; tell Engineering to route power to the heat exchanger." : "The glass will rake the hull; tell Engineering to harden the outer shell.",
      engineerClue: routeReading(thermalRoute),
      success: `${systemNames[thermalSystem]} hold while Mildred threads the ${routeNames[thermalRoute]}.`,
    },
    {
      id: "leviathan", title: creatureSystem === "SONAR" ? "LEVIATHAN CONTACT" : "HUNGER CURRENT",
      threat: creatureSystem === "SONAR" ? "Something enormous opens one eye in the black water." : "A blind hunter follows the vibration of Mildred's propeller.",
      route: creatureRoute, system: creatureSystem,
      navigatorClue: creatureSystem === "SONAR" ? "The thing tracks echoes poorly; ask for one mapping ping." : "Silence will not outrun it; ask for maximum thrust.",
      engineerClue: creatureRoute === "DARK" ? "Its pupil contracts whenever the lamps flare. Choose the route that kills every light." : `Its wake blocks ${creatureRoute === "LEFT" ? "starboard" : "port"}; send Mildred through the opposite side.`,
      success: `${systemNames[creatureSystem]} buys enough time to escape through the ${routeNames[creatureRoute]}.`,
    },
    {
      id: "crush-depth", title: "CRUSH DEPTH", threat: "The trench clamps down. Hull ribs begin to sing.",
      route: depthRoute, system: depthSystem,
      navigatorClue: depthSystem === "ENGINE" ? "The down-current is stronger than the trim jets; demand full propulsion." : "The bow is too heavy to climb; empty the weight tanks.",
      engineerClue: depthRoute === "RISE" ? "Depth is increasing eight meters per second. Take the route that gains altitude now." : "The walls shear inward on both sides; the only open water is dead ahead.",
      success: `${systemNames[depthSystem]} catches and Mildred claws into the ${routeNames[depthRoute]}.`,
    },
    {
      id: "surface-run", title: "FINAL SURFACE RUN", threat: "The trench collapses behind you. This is the last move.",
      route: finalRoute, system: finalSystem,
      navigatorClue: finalSystem === "BALLAST" ? "Mildred is carrying too much water to climb; order the tanks emptied." : "The collapse is overtaking the ascent; order every propeller online.",
      engineerClue: finalRoute === "SURFACE" ? "Daylight is directly above. Take the route that ends the dive." : "A rising thermal column can lift the sub without exposing it yet.",
      success: `${systemNames[finalSystem]} roar as Mildred commits to the ${routeNames[finalRoute]}.`,
    },
  ];
}

function token() {
  return randomBytes(16).toString("hex");
}

function cleanName(value) {
  return String(value || "")
    .replace(/[^\w .'-]/g, "")
    .trim()
    .slice(0, 24);
}

function nowIso() {
  return new Date().toISOString();
}

function createRoom(id) {
  return {
    id,
    game: "signal-storm",
    phase: "lobby",
    players: [],
    hull: 3,
    stage: 0,
    submissions: {},
    deadlineAt: null,
    nextAt: null,
    rematchReady: [],
    outcome: null,
    closestCallMs: null,
    history: [],
    mission: null,
    acknowledgements: [],
    updatedAt: nowIso(),
  };
}

function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, createRoom(id));
  return rooms.get(id);
}

function beginStage(room) {
  room.phase = "active";
  room.submissions = {};
  room.outcome = null;
  room.nextAt = null;
  room.acknowledgements = [];
  room.deadlineAt = room.stage === 0 ? null : Date.now() + Math.max(12_000, 20_000 - room.stage * 1_250);
  room.updatedAt = nowIso();
}

function finish(room, phase, message) {
  room.phase = phase;
  room.deadlineAt = null;
  room.nextAt = null;
  room.outcome = { won: phase === "won", message };
  room.updatedAt = nowIso();
}

function resolveStage(room, timedOut = false) {
  const crisis = (room.mission || crises)[room.stage];
  const navigator = room.players.find((player) => player.role === "navigator");
  const engineer = room.players.find((player) => player.role === "engineer");
  const navChoice = room.submissions[navigator?.id];
  const engineerChoice = room.submissions[engineer?.id];
  const won = !timedOut && navChoice === crisis.route && engineerChoice === crisis.system;
  const remaining = room.deadlineAt ? Math.max(0, room.deadlineAt - Date.now()) : null;
  if (won && remaining != null) room.closestCallMs = room.closestCallMs == null ? remaining : Math.min(room.closestCallMs, remaining);
  if (!won) room.hull -= 1;
  const why = timedOut
    ? `Time ran out. Navigator needed ${crisis.route}; Engineer needed ${crisis.system}.`
    : won
      ? crisis.success
      : `Navigator chose ${navChoice || "nothing"}; Engineer chose ${engineerChoice || "nothing"}. Needed ${crisis.route} + ${crisis.system}.`;
  room.outcome = {
    won,
    message: why,
    route: crisis.route,
    system: crisis.system,
    navChoice: navChoice || null,
    engineerChoice: engineerChoice || null,
    timedOut,
  };
  room.history.push({ at: nowIso(), type: won ? "save" : "hit", stage: room.stage, text: why });
  room.phase = "resolved";
  room.deadlineAt = null;
  room.nextAt = null;
  room.updatedAt = nowIso();
}

function advanceClock(room) {
  if (room.phase === "active" && room.deadlineAt && Date.now() >= room.deadlineAt) resolveStage(room, true);
  if (room.phase !== "resolved" || room.acknowledgements.length < 2) return;
  if (room.hull <= 0) return finish(room, "lost", "Mildred imploded before reaching the surface.");
  if (room.stage >= (room.mission || crises).length - 1) return finish(room, "won", "Mildred broke the surface with both crew aboard.");
  room.stage += 1;
  beginStage(room);
}

function publicState(room, player) {
  advanceClock(room);
  const mission = room.mission || crises;
  const crisis = mission[Math.min(room.stage, mission.length - 1)];
  const teammate = room.players.find((item) => item.id !== player?.id);
  return {
    id: room.id,
    game: room.game,
    phase: room.phase,
    players: room.players.map(({ token: privateToken, ...safe }) => safe),
    you: player ? { id: player.id, name: player.name, role: player.role } : null,
    teammate: teammate ? { id: teammate.id, name: teammate.name, role: teammate.role } : null,
    hull: room.hull,
    stage: room.stage + 1,
    stageCount: mission.length,
    deadlineAt: room.deadlineAt,
    crisis: room.phase === "lobby" ? null : {
      id: crisis.id,
      title: crisis.title,
      threat: crisis.threat,
      clue: player?.role === "navigator" ? crisis.navigatorClue : crisis.engineerClue,
      tutorial: room.stage === 0,
    },
    actions: player?.role ? choices[player.role] : [],
    submitted: Boolean(player && room.submissions[player.id]),
    choice: player ? room.submissions[player.id] || null : null,
    teammateSubmitted: Boolean(teammate && room.submissions[teammate.id]),
    outcome: room.outcome,
    closestCallMs: room.closestCallMs,
    rematchReady: room.rematchReady,
    acknowledged: Boolean(player && room.acknowledgements.includes(player.id)),
    teammateAcknowledged: Boolean(teammate && room.acknowledgements.includes(teammate.id)),
    recent: room.history.slice(-5),
    updatedAt: room.updatedAt,
  };
}

function findPlayer(room, body) {
  return room.players.find((player) => player.token === body.playerToken || player.token === body.resumeToken);
}

export async function handleSignalStorm({ req, json, readJson, roomId, action }) {
  const room = getRoom(roomId);
  const body = req.method === "POST" ? await readJson(req) : {};
  let player = findPlayer(room, body);

  if (req.method === "POST" && action === "join") {
    const name = cleanName(body.name) || `Crew ${room.players.length + 1}`;
    if (!player) {
      if (room.players.length >= 2) return json(409, { error: "Signal Storm crew is full" });
      player = { id: token().slice(0, 12), token: token(), name, role: room.players.length ? "engineer" : "navigator" };
      room.players.push(player);
      room.history.push({ at: nowIso(), type: "join", text: `${name} joined as ${player.role}` });
      room.updatedAt = nowIso();
    }
    return json(200, { player: { id: player.id, token: player.token, name: player.name, role: player.role }, room: publicState(room, player) });
  }

  if (!player) return json(403, { error: "Join the crew first" });

  if (req.method === "POST" && action === "state") return json(200, { room: publicState(room, player) });

  if (req.method === "POST" && action === "start") {
    if (room.players.length !== 2) return json(409, { error: "Two crew members are required" });
    if (room.phase !== "lobby") return json(409, { error: "Mission already underway" });
    room.hull = 3;
    room.stage = 0;
    room.rematchReady = [];
    room.closestCallMs = null;
    room.history = room.history.filter((event) => event.type === "join").slice(-2);
    room.mission = buildMission();
    beginStage(room);
    return json(200, { room: publicState(room, player) });
  }

  if (req.method === "POST" && action === "act") {
    advanceClock(room);
    if (room.phase !== "active") return json(409, { error: "No active crisis" });
    if (room.submissions[player.id]) return json(409, { error: "Choice already locked" });
    const choice = String(body.choice || "").toUpperCase();
    if (!choices[player.role].includes(choice)) return json(400, { error: "Invalid control" });
    room.submissions[player.id] = choice;
    room.history.push({ at: nowIso(), type: "lock", text: `${player.name} locked a ${player.role} action` });
    room.updatedAt = nowIso();
    if (Object.keys(room.submissions).length === 2) resolveStage(room, false);
    return json(200, { room: publicState(room, player) });
  }

  if (req.method === "POST" && action === "ack") {
    if (room.phase !== "resolved") return json(409, { error: "No crisis replay to acknowledge" });
    if (!room.acknowledgements.includes(player.id)) room.acknowledgements.push(player.id);
    room.updatedAt = nowIso();
    advanceClock(room);
    return json(200, { room: publicState(room, player) });
  }

  if (req.method === "POST" && action === "rematch") {
    if (!["won", "lost"].includes(room.phase)) return json(409, { error: "Finish the mission first" });
    if (!room.rematchReady.includes(player.id)) room.rematchReady.push(player.id);
    if (room.rematchReady.length === 2) {
      room.players.reverse();
      room.players.forEach((item, index) => { item.role = index ? "engineer" : "navigator"; });
      room.phase = "lobby";
      room.rematchReady = [];
      room.outcome = null;
      room.updatedAt = nowIso();
    }
    return json(200, { room: publicState(room, player) });
  }

  return json(404, { error: "Unknown Signal Storm route" });
}

export function resetSignalStormForTests() {
  rooms.clear();
}
