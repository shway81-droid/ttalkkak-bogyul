// 효과음(정답·시간 끝). Web Audio 로 짧은 소리를 낸다. 실패해도 조용히 넘어간다.

export function createSfx() {
  let ctx = null;

  function audio() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, start, dur, type = 'sine', gain = 0.18) {
    const ac = audio();
    if (!ac) return;
    try {
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime + start;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(ac.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch {
      /* 소리가 안 나도 수업은 계속된다 */
    }
  }

  const sfx = {
    muted: false,
    correct() {
      if (sfx.muted) return;
      tone(660, 0, 0.18, 'triangle');
      tone(990, 0.12, 0.28, 'triangle');
    },
    timeUp() {
      if (sfx.muted) return;
      tone(520, 0, 0.35, 'sine', 0.15);
      tone(390, 0.32, 0.5, 'sine', 0.15);
    },
    toggle() {
      sfx.muted = !sfx.muted;
      return sfx.muted;
    },
  };
  return sfx;
}
