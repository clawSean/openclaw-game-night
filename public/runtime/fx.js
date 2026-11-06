const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));

/** Create a disposable, capped visual-effects layer for one game mount. */
export function createFxRuntime({ root, maxParticles = 24 } = {}) {
  const host = root || (typeof document !== 'undefined' ? document.body : null);
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const layer = host?.ownerDocument?.createElement('div') || null;
  const particles = new Set();
  const timers = new Set();
  let reducedMotion = Boolean(media?.matches);
  let disposed = false;

  if (layer) {
    layer.className = 'claw-fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    host.append(layer);
  }

  function later(callback, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function originPoint(origin) {
    if (origin?.getBoundingClientRect) {
      const rect = origin.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return { x: Number(origin?.x) || innerWidth / 2, y: Number(origin?.y) || innerHeight / 2 };
  }

  function removeParticle(particle) {
    particles.delete(particle);
    particle.remove();
  }

  function particlesBurst({ origin, type = 'bubble', count = 8, colors = [], duration = 850, spread = 90 } = {}) {
    if (!layer || disposed || reducedMotion) return [];
    const available = Math.max(0, clamp(maxParticles, 0, 100) - particles.size);
    const amount = Math.min(available, clamp(count, 0, 30));
    const point = originPoint(origin);
    const created = [];
    for (let index = 0; index < amount; index += 1) {
      const particle = layer.ownerDocument.createElement('i');
      const angle = Math.random() * Math.PI * 2;
      const distance = spread * (0.35 + Math.random() * 0.65);
      particle.className = `claw-particle claw-particle--${type}`;
      particle.style.setProperty('--fx-x', `${point.x}px`);
      particle.style.setProperty('--fx-y', `${point.y}px`);
      particle.style.setProperty('--fx-dx', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--fx-dy', `${Math.sin(angle) * distance - spread * 0.35}px`);
      particle.style.setProperty('--fx-size', `${6 + Math.random() * 10}px`);
      particle.style.setProperty('--fx-duration', `${clamp(duration * (0.8 + Math.random() * 0.4), 150, 2500)}ms`);
      if (colors.length) particle.style.setProperty('--fx-color', colors[index % colors.length]);
      layer.append(particle);
      particles.add(particle);
      created.push(particle);
      particle.addEventListener('animationend', () => removeParticle(particle), { once: true });
      later(() => { if (particles.has(particle)) removeParticle(particle); }, clamp(duration * 1.5, 300, 4000));
    }
    return created;
  }

  function impact(kind = 'medium', target = host) {
    if (!target || disposed) return;
    const safeKind = ['light', 'medium', 'heavy', 'success', 'error'].includes(kind) ? kind : 'medium';
    const className = reducedMotion ? 'claw-impact--static' : `claw-impact--${safeKind}`;
    target.classList.remove('claw-impact--light', 'claw-impact--medium', 'claw-impact--heavy', 'claw-impact--success', 'claw-impact--error', 'claw-impact--static');
    void target.offsetWidth;
    target.classList.add(className);
    later(() => target.classList.remove(className), reducedMotion ? 140 : 480);
  }

  function clear() {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const particle of particles) particle.remove();
    particles.clear();
    host?.classList?.remove('claw-impact--light', 'claw-impact--medium', 'claw-impact--heavy', 'claw-impact--success', 'claw-impact--error', 'claw-impact--static');
  }

  function handleMotion(event) {
    reducedMotion = Boolean(event.matches);
    if (reducedMotion) {
      for (const particle of particles) particle.remove();
      particles.clear();
    }
  }
  media?.addEventListener?.('change', handleMotion);

  function cleanup() {
    if (disposed) return;
    disposed = true;
    clear();
    media?.removeEventListener?.('change', handleMotion);
    layer?.remove();
  }

  return {
    particles: particlesBurst,
    impact,
    clear,
    cleanup,
    get particleCount() { return particles.size; },
    get reducedMotion() { return reducedMotion; },
  };
}
