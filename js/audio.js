// Synthesised sound (WebAudio, no sample files): engine, tyre squeal, crashes, shots, siren, fire crackle, explosions.
// Everything is generated, nothing is loaded. Safe where there is no audio (tests, old browsers): all calls become no-ops.
export const attenuation = (dist, maxd = 480) => { const k = Math.max(0, 1 - dist / maxd); return k * k; };
export const engineFreq = speed => 48 + Math.min(1.1, Math.abs(speed) / 150) * 130;           // Hz, from car speed (px/s)
export const engineGain = (driving, throttle, speed) => driving ? 0.05 + 0.05 * Math.min(1, Math.abs(speed) / 150) + (throttle ? 0.035 : 0) : 0;
export const screechGain = slip => slip > 0.3 ? Math.min(0.2, (slip - 0.3) * 0.28) : 0;
export const sirenFreq = t => 720 + 260 * Math.sin(t * Math.PI * 2 * 0.8);

const NOOP = { supported: false, enabled: false, muted: false, unlock() {}, update() {}, shot() {}, crash() {}, thud() {}, boom() {}, setMuted() {}, toggle() { return false; } };

export function createAudio(env = globalThis, muted = false) {
  const AC = env.AudioContext || env.webkitAudioContext;
  if (!AC) return { ...NOOP };
  let ctx = null, master = null, noise = null, eng = null, tyre = null, siren = null, fire = null;
  const a = { supported: true, enabled: false, muted };
  const safe = f => (...args) => { try { return f(...args); } catch (e) { return undefined; } };

  const makeNoise = () => { const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; };
  const noiseSrc = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; return s; };
  function envGain(g, t0, vol, attack, decay) { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay); }
  function burst(vol, { type = 'lowpass', f0 = 2000, f1 = 300, q = 0.7, attack = 0.004, decay = 0.2 } = {}) {
    const t = ctx.currentTime, s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
    envGain(g, t, vol, attack, decay); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + attack + decay + 0.05);
  }
  function thump(vol, f0, f1, decay) {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + decay); envGain(g, t, vol, 0.004, decay);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + decay + 0.05);
  }
  function build() {
    ctx = new AC(); master = ctx.createGain(); master.gain.value = a.muted ? 0 : 0.7; master.connect(ctx.destination); noise = makeNoise();
    // engine: two detuned oscillators through a low-pass
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(), o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    g.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 500; o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = 60; o2.frequency.value = 30;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master); o1.start(); o2.start(); eng = { g, lp, o1, o2 };
    // tyre squeal: band-passed noise
    const tg = ctx.createGain(), bp = ctx.createBiquadFilter(), ts = noiseSrc(); tg.gain.value = 0; bp.type = 'bandpass'; bp.Q.value = 7; bp.frequency.value = 2400;
    ts.connect(bp); bp.connect(tg); tg.connect(master); ts.start(); tyre = { g: tg, bp };
    // siren
    const sg = ctx.createGain(), so = ctx.createOscillator(); sg.gain.value = 0; so.type = 'triangle'; so.frequency.value = 800; so.connect(sg); sg.connect(master); so.start(); siren = { g: sg, o: so };
    // fire crackle: high-passed noise whose level is shaken every frame
    const fg = ctx.createGain(), hp = ctx.createBiquadFilter(), fs = noiseSrc(); fg.gain.value = 0; hp.type = 'highpass'; hp.frequency.value = 1400; fs.connect(hp); hp.connect(fg); fg.connect(master); fs.start(); fire = { g: fg };
    a.enabled = true;
  }
  a.unlock = safe(() => { if (!ctx) build(); if (ctx.state === 'suspended') ctx.resume(); });
  a.setMuted = safe(m => { a.muted = !!m; if (master) master.gain.setTargetAtTime(a.muted ? 0 : 0.7, ctx.currentTime, 0.03); });
  a.toggle = () => { a.setMuted(!a.muted); return a.muted; };
  // per frame: { driving, throttle, speed, slip (0..1, loudest nearby), siren (0..1), fire (0..1) }
  a.update = safe(s => {
    if (!a.enabled) return; const t = ctx.currentTime, k = 0.06;
    eng.o1.frequency.setTargetAtTime(engineFreq(s.speed), t, k); eng.o2.frequency.setTargetAtTime(engineFreq(s.speed) * 0.5, t, k);
    eng.lp.frequency.setTargetAtTime(300 + Math.abs(s.speed) * 7, t, k); eng.g.gain.setTargetAtTime(engineGain(s.driving, s.throttle, s.speed), t, 0.08);
    tyre.g.gain.setTargetAtTime(screechGain(s.slip || 0), t, 0.05); tyre.bp.frequency.setTargetAtTime(2200 + Math.random() * 500 + Math.abs(s.speed) * 3, t, 0.05);
    siren.g.gain.setTargetAtTime(0.045 * (s.siren || 0), t, 0.1); siren.o.frequency.setTargetAtTime(sirenFreq(t), t, 0.05);
    fire.g.gain.setTargetAtTime(0.11 * (s.fire || 0) * (0.35 + Math.random() * 0.9), t, 0.03);
  });
  // one-shots: vol 0..1 (already attenuated by distance)
  a.shot = safe((kind, vol = 1) => {
    if (!a.enabled || vol < 0.01) return;
    if (kind === 1) { burst(0.55 * vol, { f0: 3200, f1: 150, decay: 0.32, q: 0.6 }); thump(0.5 * vol, 120, 40, 0.18); }          // shotgun
    else if (kind === 2) { burst(0.32 * vol, { type: 'bandpass', f0: 2600, f1: 900, q: 0.9, decay: 0.07 }); thump(0.22 * vol, 150, 70, 0.07); }   // rifle
    else { burst(0.4 * vol, { type: 'bandpass', f0: 2200, f1: 700, q: 0.8, decay: 0.12 }); thump(0.28 * vol, 170, 60, 0.1); }                    // pistol
  });
  a.crash = safe((impact, vol = 1) => { if (!a.enabled || vol < 0.01) return; const k = Math.min(1, impact) * vol; burst(0.6 * k, { f0: 3000, f1: 250, decay: 0.38, q: 0.5 }); thump(0.5 * k, 110, 38, 0.25); if (impact > 0.4) burst(0.18 * k, { type: 'highpass', f0: 3500, f1: 3000, decay: 0.5 }); });
  a.thud = safe((vol = 1) => { if (!a.enabled || vol < 0.01) return; thump(0.55 * vol, 130, 45, 0.16); burst(0.2 * vol, { f0: 900, f1: 200, decay: 0.08 }); });
  a.boom = safe((vol = 1) => { if (!a.enabled || vol < 0.01) return; burst(0.9 * vol, { f0: 1400, f1: 50, decay: 1.4, q: 0.4 }); thump(0.9 * vol, 75, 26, 1.1); burst(0.25 * vol, { type: 'highpass', f0: 2500, f1: 1800, decay: 0.6 }); });
  return a;
}
