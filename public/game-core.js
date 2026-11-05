export function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return () => {
    state |= 0;
    state = state + 0x6d2b79f5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function shuffled(values, random = Math.random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

export function neighbors(cell, size) {
  const row = Math.floor(cell / size);
  const column = cell % size;
  const result = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (
        (rowOffset || columnOffset) &&
        nextRow >= 0 && nextRow < size &&
        nextColumn >= 0 && nextColumn < size
      ) result.push(nextRow * size + nextColumn);
    }
  }
  return result;
}

function flood(start, size, mines, revealed) {
  const queue = [start];
  while (queue.length) {
    const cell = queue.pop();
    if (revealed.has(cell) || mines.has(cell)) continue;
    revealed.add(cell);
    if (!neighbors(cell, size).some((near) => mines.has(near))) {
      queue.push(...neighbors(cell, size));
    }
  }
}

export function solveBoard({ size, mines, first }) {
  const revealed = new Set();
  const knownMines = new Set();
  flood(first, size, mines, revealed);
  const opening = revealed.size;
  let changed = true;
  while (changed) {
    changed = false;
    for (const cell of [...revealed]) {
      const near = neighbors(cell, size);
      const number = near.filter((candidate) => mines.has(candidate)).length;
      const unknown = near.filter((candidate) => !revealed.has(candidate) && !knownMines.has(candidate));
      const marked = near.filter((candidate) => knownMines.has(candidate)).length;
      if (unknown.length && number === marked) {
        const before = revealed.size;
        unknown.forEach((candidate) => flood(candidate, size, mines, revealed));
        if (revealed.size > before) changed = true;
      } else if (unknown.length && number - marked === unknown.length) {
        const before = knownMines.size;
        unknown.forEach((candidate) => knownMines.add(candidate));
        if (knownMines.size > before) changed = true;
      }
    }
  }
  return { revealed, knownMines, opening, solved: revealed.size === size * size - mines.size };
}

export function generateDeducibleBoard({ size, mineCount, first, seed, maxAttempts = 5000, safePocket = 'cross', maxOpeningRatio = .7 }) {
  const random = seededRandom(seed);
  const firstRow = Math.floor(first / size);
  const firstColumn = first % size;
  const protectedCells = safePocket === 'full'
    ? neighbors(first, size)
    : neighbors(first, size).filter((cell) => Math.floor(cell / size) === firstRow || cell % size === firstColumn);
  const safeCells = new Set([first, ...protectedCells]);
  const candidates = Array.from({ length: size * size }, (_, index) => index)
    .filter((index) => !safeCells.has(index));
  if (candidates.length < mineCount) throw new Error('safe pocket leaves no room for mines');
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const mines = new Set(shuffled(candidates, random).slice(0, mineCount));
    const solution = solveBoard({ size, mines, first });
    const safeCount = size * size - mineCount;
    if (solution.solved && solution.opening <= Math.floor(safeCount * maxOpeningRatio)) {
      return { mines, attempt, opening: solution.opening };
    }
  }
  throw new Error(`no deducible board after ${maxAttempts} attempts`);
}

export function expectedSequence(sequence, mode) {
  return mode === 'reverse' ? [...sequence].reverse() : [...sequence];
}

export function tideActionMatches(expected, actual) {
  return expected === actual;
}

export function echoWakeStep({ position, wakes = [], pearls = [], rocks = [] }, next, size = 7, delay = 3) {
  const [row, column] = next;
  if (row < 0 || column < 0 || row >= size || column >= size) return { error: 'edge' };
  const key = row * size + column;
  if (rocks.includes(key)) return { error: 'rock' };
  const advanced = wakes
    .map((wake) => ({ ...wake, turns: wake.turns - 1 }))
    .filter((wake) => wake.turns >= 0);
  const erupted = advanced.filter((wake) => wake.turns === 0).map((wake) => wake.cell);
  const collected = pearls.includes(key);
  return {
    position: key,
    wakes: [...advanced.filter((wake) => wake.turns > 0), { cell: position, turns: delay }],
    pearls: pearls.filter((cell) => cell !== key),
    rocks: [...rocks],
    collected,
    erupted,
    hit: erupted.includes(key),
  };
}

export function shiftReef(board, size, axis, index, amount) {
  const next = [...board];
  const line = Array.from({ length: size }, (_, offset) => axis === 'row'
    ? board[index * size + offset]
    : board[offset * size + index]);
  const normalized = ((amount % size) + size) % size;
  const shifted = line.map((_, offset) => line[(offset - normalized + size) % size]);
  shifted.forEach((value, offset) => {
    next[axis === 'row' ? index * size + offset : offset * size + index] = value;
  });
  return next;
}

export function reefClusters(board, size, minimum = 3) {
  const visited = new Set();
  const clusters = [];
  for (let cell = 0; cell < board.length; cell += 1) {
    if (visited.has(cell) || board[cell] == null) continue;
    const group = [];
    const queue = [cell];
    visited.add(cell);
    while (queue.length) {
      const current = queue.pop();
      group.push(current);
      const row = Math.floor(current / size);
      const column = current % size;
      for (const [rowStep, columnStep] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nextRow = row + rowStep;
        const nextColumn = column + columnStep;
        const candidate = nextRow * size + nextColumn;
        if (nextRow < 0 || nextColumn < 0 || nextRow >= size || nextColumn >= size || visited.has(candidate)) continue;
        if (board[candidate] === board[current]) { visited.add(candidate); queue.push(candidate); }
      }
    }
    if (group.length >= minimum) clusters.push(group);
  }
  return clusters;
}

export function reflectPearl({ x, y, vx, vy }, width, height, radius = 12) {
  let nextX = x + vx;
  let nextY = y + vy;
  let nextVx = vx;
  let nextVy = vy;
  if (nextX <= radius || nextX >= width - radius) {
    nextX = Math.max(radius, Math.min(width - radius, nextX));
    nextVx *= -1;
  }
  if (nextY <= radius || nextY >= height - radius) {
    nextY = Math.max(radius, Math.min(height - radius, nextY));
    nextVy *= -1;
  }
  return { x: nextX, y: nextY, vx: nextVx, vy: nextVy };
}

export function winningCells(board, row, column, mark) {
  const height = board.length;
  const width = board[0]?.length || 0;
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [rowStep, columnStep] of directions) {
    const cells = [[row, column]];
    for (const sign of [-1, 1]) {
      let nextRow = row + rowStep * sign;
      let nextColumn = column + columnStep * sign;
      const side = [];
      while (
        nextRow >= 0 && nextRow < height &&
        nextColumn >= 0 && nextColumn < width &&
        board[nextRow][nextColumn] === mark
      ) {
        side.push([nextRow, nextColumn]);
        nextRow += rowStep * sign;
        nextColumn += columnStep * sign;
      }
      if (sign < 0) cells.unshift(...side.reverse()); else cells.push(...side);
    }
    if (cells.length >= 4) return cells;
  }
  return [];
}
