let audioContext: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext ??= new Ctor();
  return audioContext;
}

export function playBoutiqueChime(kind: 'tap' | 'success' = 'tap') {
  try {
    const ctx = context();
    if (!ctx) return;
    const now = ctx.currentTime;
    const frequencies = kind === 'success' ? [440, 659.25, 880] : [523.25, 659.25];
    frequencies.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * 0.055);
      gain.gain.linearRampToValueAtTime(0.028, now + index * 0.055 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.055 + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + index * 0.055);
      oscillator.stop(now + index * 0.055 + 0.2);
    });
  } catch {
    // Delight must never be a checkout dependency.
  }
}
