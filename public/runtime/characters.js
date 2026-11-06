export const characterStates = Object.freeze(['idle', 'panic', 'victory']);
export const characterNames = Object.freeze(['captain-clack', 'pip', 'mildred', 'admiral-brine']);

const safeState = (state) => characterStates.includes(state) ? state : 'idle';
const svgOpen = (name, state, label, viewBox = '0 0 320 320') => `<svg class="claw-character claw-character--${name} claw-character--${state}" data-character="${name}" data-state="${state}" viewBox="${viewBox}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">`;

export function captainClack(state = 'idle') {
  const pose = safeState(state);
  const eyes = pose === 'panic'
    ? '<circle cx="128" cy="137" r="8" fill="#fff"/><circle cx="128" cy="139" r="3" fill="#07131b"/><circle cx="192" cy="137" r="8" fill="#fff"/><circle cx="192" cy="139" r="3" fill="#07131b"/>'
    : '<path d="M117 137q11-8 22 0" fill="none" stroke="#07131b" stroke-width="7" stroke-linecap="round"/><path d="M181 137q11-8 22 0" fill="none" stroke="#07131b" stroke-width="7" stroke-linecap="round"/>';
  const mouth = pose === 'victory' ? 'M140 174q20 20 40 0' : pose === 'panic' ? 'M148 177q12-11 24 0' : 'M145 176q15 7 30 0';
  const clawLift = pose === 'victory' ? -24 : pose === 'panic' ? 10 : 0;
  return `${svgOpen('captain-clack', pose, `Captain Clack, ${pose}`)}
    <ellipse class="claw-character__shadow" cx="160" cy="288" rx="92" ry="16"/>
    <g class="claw-character__body">
      <path d="M92 ${210 + clawLift}C51 ${194 + clawLift} 34 ${217 + clawLift} 47 ${245 + clawLift}c9 19 38 17 58-7" fill="#db3f3d" stroke="#3b1520" stroke-width="8" stroke-linejoin="round"/>
      <path d="M228 ${210 + clawLift}c41-16 58 7 45 35-9 19-38 17-58-7" fill="#db3f3d" stroke="#3b1520" stroke-width="8" stroke-linejoin="round"/>
      <path d="M102 173c0-53 23-80 58-80s58 27 58 80v80c-13 25-103 25-116 0z" fill="#d84a45" stroke="#3b1520" stroke-width="8"/>
      <path d="M118 204h84v54c-20 13-64 13-84 0z" fill="#173a4a" stroke="#07131b" stroke-width="7"/>
      <path d="M155 88v-18M117 102c-8-31 2-55 43-55s51 24 43 55" fill="#143748" stroke="#07131b" stroke-width="8" stroke-linecap="round"/>
      <path d="M111 90h98l-13 24h-72z" fill="#f2c84c" stroke="#3b2b11" stroke-width="7" stroke-linejoin="round"/>
      <circle cx="160" cy="88" r="10" fill="#f4e6a0"/>
      ${eyes}
      <path d="${mouth}" fill="none" stroke="#46171e" stroke-width="7" stroke-linecap="round"/>
      <path d="M126 157q17-13 34 0q17-13 34 0q-10 11-34 6q-24 5-34-6" fill="#23181a"/>
      <path d="M109 253h102" stroke="#f2c84c" stroke-width="8"/>
    </g>
  </svg>`;
}

export function pip(state = 'idle') {
  const pose = safeState(state);
  const eyeScale = pose === 'panic' ? 1.25 : 1;
  const tool = pose === 'victory'
    ? '<path d="M218 91l31-30 11 11-30 31" fill="#f2c84c" stroke="#27333a" stroke-width="7"/><circle cx="255" cy="66" r="13" fill="#49d7c0" stroke="#27333a" stroke-width="7"/>'
    : '<path d="M218 91l31-30" stroke="#d7e4e7" stroke-width="9" stroke-linecap="round"/><path d="M244 57l18 18M251 50l18 18" stroke="#d7e4e7" stroke-width="7" stroke-linecap="round"/>';
  return `${svgOpen('pip', pose, `Pip the engineer, ${pose}`)}
    <ellipse class="claw-character__shadow" cx="157" cy="281" rx="76" ry="14"/>
    <g class="claw-character__body">
      <path d="M103 170c-41-14-55 34-22 49M217 170c41-14 55 34 22 49M111 201c-44 4-46 47-9 47M209 201c44 4 46 47 9 47" fill="none" stroke="#de7653" stroke-width="18" stroke-linecap="round"/>
      <ellipse cx="160" cy="179" rx="62" ry="87" fill="#ef8e61" stroke="#4a2224" stroke-width="8"/>
      <path d="M113 139q47-39 94 0" fill="#263f4c" stroke="#13242d" stroke-width="8"/>
      <path d="M106 142h108" stroke="#f2c84c" stroke-width="9"/>
      <g transform="translate(0 ${pose === 'panic' ? -4 : 0}) scale(${eyeScale}) translate(${eyeScale === 1 ? 0 : -32} ${eyeScale === 1 ? 0 : -24})">
        <circle cx="132" cy="158" r="20" fill="#aeefff" stroke="#263f4c" stroke-width="7"/><circle cx="188" cy="158" r="20" fill="#aeefff" stroke="#263f4c" stroke-width="7"/>
        <circle cx="136" cy="160" r="7" fill="#07131b"/><circle cx="184" cy="160" r="7" fill="#07131b"/>
      </g>
      <path d="M145 196q15 ${pose === 'panic' ? -11 : 9} 30 0" fill="none" stroke="#4a2224" stroke-width="7" stroke-linecap="round"/>
      <path d="M115 235h90v34c-19 13-71 13-90 0z" fill="#21495b" stroke="#13242d" stroke-width="7"/>
      <path d="M160 235v43M132 246h56" stroke="#f2c84c" stroke-width="6"/>
      ${tool}
    </g>
  </svg>`;
}

export function mildred(state = 'idle') {
  const pose = safeState(state);
  const windowColor = pose === 'panic' ? '#ff6b61' : pose === 'victory' ? '#ffe76b' : '#72e9d5';
  const cracks = pose === 'panic' ? '<path d="M114 143l15 13-11 14 19 18M209 133l-14 17 12 12-17 19" fill="none" stroke="#dcefff" stroke-width="5"/>' : '';
  return `${svgOpen('mildred', pose, `Mildred the submarine, ${pose}`, '0 0 420 280')}
    <ellipse class="claw-character__shadow" cx="210" cy="241" rx="145" ry="17"/>
    <g class="claw-character__body">
      <path d="M51 143c14-64 83-95 186-88 72 5 116 40 126 88-10 48-54 83-126 88-103 7-172-24-186-88z" fill="#bc7c3e" stroke="#362416" stroke-width="9"/>
      <path d="M87 102c42-42 153-56 223-11-50-17-167-8-223 11z" fill="#e1a952" opacity=".65"/>
      <path d="M356 118l46-42v134l-46-42" fill="#9c6336" stroke="#362416" stroke-width="9" stroke-linejoin="round"/>
      <path d="M183 58V29h64v28" fill="#9c6336" stroke="#362416" stroke-width="9"/>
      <path d="M211 29V9h55" fill="none" stroke="#362416" stroke-width="9" stroke-linecap="round"/>
      <circle cx="132" cy="143" r="35" fill="${windowColor}" stroke="#362416" stroke-width="9"/>
      <circle cx="226" cy="143" r="35" fill="${windowColor}" stroke="#362416" stroke-width="9"/>
      <circle cx="119" cy="133" r="9" fill="#efffff" opacity=".75"/><circle cx="213" cy="133" r="9" fill="#efffff" opacity=".75"/>
      <path d="M153 199q35 ${pose === 'panic' ? -18 : pose === 'victory' ? 21 : 7} 70 0" fill="none" stroke="#51351e" stroke-width="9" stroke-linecap="round"/>
      <path d="M65 143H24M43 124v38" stroke="#362416" stroke-width="9" stroke-linecap="round"/>
      ${cracks}
      ${pose === 'victory' ? '<path d="M275 69l9-20 9 20 22 4-17 15 4 22-18-11-19 11 5-22-17-15z" fill="#ffe76b"/>' : ''}
    </g>
  </svg>`;
}

export function admiralBrine(state = 'idle') {
  const pose = safeState(state);
  const eye = pose === 'panic' ? '#ff756d' : '#a8ffe9';
  return `${svgOpen('admiral-brine', pose, `Admiral Brine, ${pose}`)}
    <ellipse class="claw-character__shadow" cx="160" cy="289" rx="78" ry="13"/>
    <g class="claw-character__specter">
      <path d="M87 268c16-28 8-71 13-116 5-55 29-86 60-86s55 31 60 86c5 45-3 88 13 116-20-10-29 17-48 0-18 20-33-9-50 3-15-20-31 8-48-3z" fill="#55d8bc" fill-opacity=".38" stroke="#b6ffed" stroke-width="7"/>
      <path d="M111 112c6-39 92-39 98 0" fill="#182d45" stroke="#091723" stroke-width="8"/>
      <path d="M102 105h116l-16 27h-84z" fill="#263f63" stroke="#091723" stroke-width="8"/>
      <path d="M148 94l12-20 12 20" fill="#f0c75b"/>
      <circle cx="130" cy="151" r="8" fill="${eye}"/><circle cx="190" cy="151" r="8" fill="${eye}"/>
      <path d="M122 140l18 5M198 140l-18 5" stroke="#d5fff3" stroke-width="7" stroke-linecap="round"/>
      <path d="M116 180q22-22 44 0q22-22 44 0q-15 9-44 4-29 5-44-4" fill="#d8fff4"/>
      <path d="M139 204q21 ${pose === 'panic' ? -12 : pose === 'victory' ? 18 : 4} 42 0" fill="none" stroke="#d5fff3" stroke-width="7" stroke-linecap="round"/>
      <path d="M108 226l-33-22M212 226l33-22" stroke="#b6ffed" stroke-width="13" stroke-linecap="round"/>
      ${pose === 'victory' ? '<path d="M230 91l15-30 15 30 31 5-23 22 6 31-29-15-28 15 5-31-23-22z" fill="#f0c75b" opacity=".9"/>' : ''}
    </g>
  </svg>`;
}

export function characterSvg(name, state = 'idle') {
  const factories = {
    'captain-clack': captainClack,
    pip,
    mildred,
    'admiral-brine': admiralBrine,
  };
  return (factories[name] || captainClack)(state);
}
