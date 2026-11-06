const AudioContextCtor = () => globalThis.AudioContext || globalThis.webkitAudioContext;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));

/**
 * Dependency-free procedural audio for Clawcade cabinets.
 * The AudioContext is created lazily and must be unlocked from a user gesture.
 */
export function createAudioRuntime({ enabled = true, onEnabledChange = () => {}, contextFactory } = {}) {
  let active = Boolean(enabled);
  let context = null;
  let master = null;
  let unlocked = false;
  let disposed = false;

  function ensureContext() {
    if (disposed) return null;
    if (!context) {
      const Factory = contextFactory || AudioContextCtor();
      if (!Factory) return null;
      context = typeof Factory === 'function' ? new Factory() : Factory;
      master = context.createGain();
      master.gain.value = active ? 1 : 0;
      master.connect(context.destination);
    }
    return context;
  }

  async function unlock() {
    const audioContext = ensureContext();
    if (!audioContext) return false;
    try {
      if (audioContext.state === 'suspended') await audioContext.resume();
      unlocked = audioContext.state === 'running';
      return unlocked;
    } catch {
      return false;
    }
  }

  function setEnabled(nextEnabled) {
    active = Boolean(nextEnabled);
    if (master && context) {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(active ? 1 : 0, now + 0.025);
    }
    onEnabledChange(active);
    return active;
  }

  function toggleEnabled() {
    return setEnabled(!active);
  }

  function tone({
    wave = 'sine',
    startHz = 440,
    endHz = startHz,
    duration = 0.1,
    gain = 0.045,
    attack = 0.006,
    when = 0,
  } = {}) {
    if (!active || !unlocked) return null;
    const audioContext = ensureContext();
    if (!audioContext || audioContext.state !== 'running') return null;
    const start = audioContext.currentTime + Math.max(0, Number(when) || 0);
    const length = clamp(duration, 0.015, 4);
    const peakAt = start + Math.min(clamp(attack, 0.001, 0.2), length * 0.45);
    const stopAt = start + length;
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    oscillator.type = ['sine', 'square', 'sawtooth', 'triangle'].includes(wave) ? wave : 'sine';
    oscillator.frequency.setValueAtTime(clamp(startHz, 20, 18000), start);
    oscillator.frequency.exponentialRampToValueAtTime(clamp(endHz, 20, 18000), stopAt);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(clamp(gain, 0.0001, 0.35), peakAt);
    envelope.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    oscillator.connect(envelope).connect(master);
    oscillator.start(start);
    oscillator.stop(stopAt + 0.02);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      envelope.disconnect();
    }, { once: true });
    return { oscillator, envelope, stopAt };
  }

  function noise({
    duration = 0.12,
    cutoff = 1200,
    filterType = 'lowpass',
    gain = 0.035,
    when = 0,
  } = {}) {
    if (!active || !unlocked) return null;
    const audioContext = ensureContext();
    if (!audioContext || audioContext.state !== 'running') return null;
    const length = clamp(duration, 0.015, 4);
    const start = audioContext.currentTime + Math.max(0, Number(when) || 0);
    const frameCount = Math.max(1, Math.ceil(audioContext.sampleRate * length));
    const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const envelope = audioContext.createGain();
    source.buffer = buffer;
    filter.type = ['lowpass', 'highpass', 'bandpass'].includes(filterType) ? filterType : 'lowpass';
    filter.frequency.value = clamp(cutoff, 40, 18000);
    envelope.gain.setValueAtTime(clamp(gain, 0.0001, 0.35), start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter).connect(envelope).connect(master);
    source.start(start);
    source.stop(start + length + 0.02);
    source.addEventListener('ended', () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    }, { once: true });
    return { source, envelope, stopAt: start + length };
  }

  /**
   * Schedule a short phrase. Entries may be frequencies or tone option objects.
   */
  function sequence(notes, { gap = 0.035, defaultDuration = 0.09, gain = 0.04, wave = 'sine' } = {}) {
    if (!Array.isArray(notes)) return [];
    let cursor = 0;
    return notes.map((note) => {
      const options = typeof note === 'number' ? { startHz: note } : { ...note };
      const duration = clamp(options.duration ?? defaultDuration, 0.015, 4);
      const handle = tone({ wave, gain, ...options, duration, when: cursor + (Number(options.when) || 0) });
      cursor += duration + Math.max(0, Number(gap) || 0);
      return handle;
    }).filter(Boolean);
  }

  async function handleVisibility() {
    if (!context || disposed || typeof document === 'undefined') return;
    try {
      if (document.hidden && context.state === 'running') await context.suspend();
      else if (!document.hidden && active && unlocked && context.state === 'suspended') await context.resume();
    } catch { /* Audio suspension is best-effort. */ }
  }

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibility);

  async function dispose() {
    disposed = true;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility);
    if (context && context.state !== 'closed') {
      try { await context.close(); } catch { /* Optional audio should never block teardown. */ }
    }
    context = null;
    master = null;
    unlocked = false;
  }

  return {
    unlock,
    setEnabled,
    toggleEnabled,
    tone,
    noise,
    sequence,
    dispose,
    get enabled() { return active; },
    get isUnlocked() { return unlocked; },
    get state() { return context?.state || 'uninitialized'; },
  };
}
