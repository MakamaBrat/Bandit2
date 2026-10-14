// Synthesised sound and music (WebAudio, no sample files): engine, tyre squeal, crashes, shots, siren, fire crackle, explosions,
// wanted-level jingles and an original generative soundtrack. Everything is generated, nothing is loaded.
// Safe where there is no audio (tests, old browsers): all calls become no-ops.
export const attenuation = (dist, maxd = 480) => { const k = Math.max(0, 1 - dist / maxd); return k * k; };
// Engine: pitch follows the revs (0..1) of the gearbox, so it climbs inside a gear and drops at every shift. Kept low and soft on purpose.
export const engineFreq = rpm => 38 + Math.max(0, Math.min(1.05, rpm)) * 92;                       // Hz
export const engineGain = (driving, throttle, rpm) => driving ? 0.012 + 0.016 * Math.max(0, Math.min(1, rpm)) + (throttle ? 0.007 : 0) : 0;
export const screechGain = slip => slip > 0.3 ? Math.min(0.13, (slip - 0.3) * 0.2) : 0;
// Siren: slow wail normally, fast yelp when a police car is close
export const sirenFreq = (t, yelp = false) => yelp ? 880 + 330 * Math.sin(t * Math.PI * 2 * 3.1) : 720 + 280 * Math.sin(t * Math.PI * 2 * 0.62);
// ---- music helpers (A minor, Am - F - C - G) ----
export const noteFreq = m => 440 * Math.pow(2, (m - 69) / 12);
export const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
export const bpmFor = i => 90 + 42 * Math.max(0, Math.min(1, i));                                  // calm 90 bpm, full chase 132
export const BASS_STEPS = [0, 3, 6, 8, 11, 14];
export const bassNote = (bar, step) => CHORDS[((bar % 4) + 4) % 4][0] - 24 + (step === 14 ? 7 : 0);
export const arpNote = (bar, step) => CHORDS[((bar % 4) + 4) % 4][[0, 1, 2, 1][step % 4]] + 12;
export const MUSIC_VOL = 0.2;

const NOOP = { supported: false, enabled: false, muted: false, musicOn: false, unlock() {}, update() {}, shot() {}, crash() {}, thud() {}, boom() {}, starUp() {}, starDown() {}, cleared() {}, setIntensity() {}, setMusic() {}, toggleMusic() { return false; }, setMuted() {}, toggle() { return false; } };

export function createAudio(env = globalThis, muted = false, musicOn = true) {
  const AC = env.AudioContext || env.webkitAudioContext;
  if (!AC) return { ...NOOP };
  let ctx = null, master = null, noise = null, eng = null, tyre = null, siren = null, fire = null, mus = null;
  const a = { supported: true, enabled: false, muted, musicOn, intensity: 0, intensityTarget: 0 };
  const safe = f => (...args) => { try { return f(...args); } catch (e) { return undefined; } };
  const makeNoise = () => { const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; };
  const noiseSrc = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; return s; };
  function envGain(g, t0, vol, attack, decay) { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay); }
  function burst(vol, { type = 'lowpass', f0 = 2000, f1 = 300, q = 0.7, attack = 0.004, decay = 0.2, to = master, at } = {}) {
    const t = at ?? ctx.currentTime, s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
    envGain(g, t, vol, attack, decay); s.connect(f); f.connect(g); g.connect(to); s.start(t, Math.random()); s.stop(t + attack + decay + 0.05);
  }
  function thump(vol, f0, f1, decay, { to = master, at } = {}) {
    const t = at ?? ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + decay); envGain(g, t, vol, 0.004, decay);
    o.connect(g); g.connect(to); o.start(t); o.stop(t + decay + 0.05);
  }
  // a pitched note: oscillator -> low-pass -> envelope
  function note(freq, t, dur, vol, type = 'triangle', cutoff = 2000, to = master, attack = 0.01) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.setValueAtTime(vol, t + Math.max(attack, dur - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    o.connect(f); f.connect(g); g.connect(to); o.start(t); o.stop(t + dur + 0.08);
  }
  // ---- music: a 16-step sequencer scheduled ahead of time; layers come in with the wanted level ----
  function playStep(step, bar, t, sd) {
    const I = a.intensity, bus = mus.bus, chord = CHORDS[bar % 4];
    if (step === 0) for (const m of chord) note(noteFreq(m), t, sd * 16, 0.05, 'triangle', 900, bus, 0.25);                     // pad
    if (BASS_STEPS.includes(step)) note(noteFreq(bassNote(bar, step)), t, sd * 2.6, 0.13, 'sawtooth', 340 + 260 * I, bus, 0.012);  // bass groove
    if (step === 0 || step === 8 || (I > 0.5 && (step === 6 || step === 14))) thump((0.13 + 0.2 * Math.min(1, I * 2)), 135, 42, 0.13, { to: bus, at: t });   // kick
    if (I > 0.35 && (step === 4 || step === 12)) burst(0.09, { type: 'highpass', f0: 1800, f1: 1500, decay: 0.12, to: bus, at: t });                  // snare
    if (I > 0.18 && (step % 2 === 0 || I > 0.6)) burst(step % 4 === 2 ? 0.045 : 0.025, { type: 'highpass', f0: 7000, f1: 6500, decay: 0.035, to: bus, at: t });  // hats
    if (I > 0.45 || (I > 0.2 && step % 2 === 0)) note(noteFreq(arpNote(bar, step)), t, sd * 0.9, I > 0.45 ? 0.05 : 0.03, I > 0.45 ? 'square' : 'triangle', 1700, bus, 0.006);   // arpeggio
  }
  function scheduleMusic() {
    if (!mus) return;
    a.intensity += (a.intensityTarget - a.intensity) * 0.04;
    if (!a.musicOn || a.muted) { mus.next = ctx.currentTime + 0.1; return; }                                              // keep the clock moving while off
    let guard = 0;
    while (mus.next < ctx.currentTime + 0.18 && guard++ < 8) {
      const sd = 60 / bpmFor(a.intensity) / 4; playStep(mus.step, mus.bar, mus.next, sd); mus.next += sd;
      if (++mus.step === 16) { mus.step = 0; mus.bar++; }
    }
  }
  function build() {
    ctx = new AC(); master = ctx.createGain(); master.gain.value = a.muted ? 0 : 0.7; master.connect(ctx.destination); noise = makeNoise();
    // engine: soft triangle + a sub sine through a low-pass (no harsh sawtooth)
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(), o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    g.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 260; o1.type = 'triangle'; o2.type = 'sine'; o1.frequency.value = 50; o2.frequency.value = 25;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master); o1.start(); o2.start(); eng = { g, lp, o1, o2 };
    // tyre squeal: band-passed noise
    const tg = ctx.createGain(), bp = ctx.createBiquadFilter(), ts = noiseSrc(); tg.gain.value = 0; bp.type = 'bandpass'; bp.Q.value = 7; bp.frequency.value = 2400;
    ts.connect(bp); bp.connect(tg); tg.connect(master); ts.start(); tyre = { g: tg, bp };
    // siren: triangle + a quieter square, both band-limited
    const sg = ctx.createGain(), sl = ctx.createBiquadFilter(), so = ctx.createOscillator(), so2 = ctx.createOscillator(), sq = ctx.createGain();
    sg.gain.value = 0; sl.type = 'lowpass'; sl.frequency.value = 2600; so.type = 'triangle'; so2.type = 'square'; sq.gain.value = 0.35; so.frequency.value = 800; so2.frequency.value = 800;
    so.connect(sl); so2.connect(sq); sq.connect(sl); sl.connect(sg); sg.connect(master); so.start(); so2.start(); siren = { g: sg, o: so, o2: so2 };
    // fire crackle
    const fg = ctx.createGain(), hp = ctx.createBiquadFilter(), fs = noiseSrc(); fg.gain.value = 0; hp.type = 'highpass'; hp.frequency.value = 1400; fs.connect(hp); hp.connect(fg); fg.connect(master); fire = { g: fg };
    fs.start();
    // music bus
    const bus = ctx.createGain(); bus.gain.value = MUSIC_VOL; bus.connect(master); mus = { bus, next: ctx.currentTime + 0.15, step: 0, bar: 0 };
    mus.timer = (env.setInterval || globalThis.setInterval)(safe(scheduleMusic), 45); a._tick = safe(scheduleMusic);
    a.enabled = true;
  }
  a.unlock = safe(() => { if (!ctx) build(); if (ctx.state === 'suspended') ctx.resume(); });
  a.setMuted = safe(m => { a.muted = !!m; if (master) master.gain.setTargetAtTime(a.muted ? 0 : 0.7, ctx.currentTime, 0.03); });
  a.toggle = () => { a.setMuted(!a.muted); return a.muted; };
  a.setMusic = safe(on => { a.musicOn = !!on; if (mus) mus.bus.gain.setTargetAtTime(a.musicOn ? MUSIC_VOL : 0, ctx.currentTime, 0.2); });
  a.toggleMusic = () => { a.setMusic(!a.musicOn); return a.musicOn; };
  a.setIntensity = x => { a.intensityTarget = Math.max(0, Math.min(1, x)); };
  // per frame: { driving, throttle, rpm (0..1), slip, siren (0..1), yelp, fire }
  a.update = safe(s => {
    if (!a.enabled) return; const t = ctx.currentTime, k = 0.05, f = engineFreq(s.rpm);
    eng.o1.frequency.setTargetAtTime(f, t, k); eng.o2.frequency.setTargetAtTime(f * 0.5, t, k); eng.lp.frequency.setTargetAtTime(240 + (s.rpm || 0) * 520, t, k);
    eng.g.gain.setTargetAtTime(engineGain(s.driving, s.throttle, s.rpm), t, 0.1);
    tyre.g.gain.setTargetAtTime(screechGain(s.slip || 0), t, 0.05); tyre.bp.frequency.setTargetAtTime(2200 + Math.random() * 500, t, 0.05);
    const sf = sirenFreq(t, s.yelp); siren.g.gain.setTargetAtTime(0.06 * (s.siren || 0), t, 0.1); siren.o.frequency.setTargetAtTime(sf, t, 0.03); siren.o2.frequency.setTargetAtTime(sf, t, 0.03);
    fire.g.gain.setTargetAtTime(0.1 * (s.fire || 0) * (0.35 + Math.random() * 0.9), t, 0.03);
  });
  // one-shots: vol 0..1 (already attenuated by distance)
  a.shot = safe((kind, vol = 1) => {
    if (!a.enabled || vol < 0.01) return;
    if (kind === 1) { burst(0.55 * vol, { f0: 3200, f1: 150, decay: 0.32, q: 0.6 }); thump(0.5 * vol, 120, 40, 0.18); }
    else if (kind === 2) { burst(0.32 * vol, { type: 'bandpass', f0: 2600, f1: 900, q: 0.9, decay: 0.07 }); thump(0.22 * vol, 150, 70, 0.07); }
    else { burst(0.4 * vol, { type: 'bandpass', f0: 2200, f1: 700, q: 0.8, decay: 0.12 }); thump(0.28 * vol, 170, 60, 0.1); }
  });
  a.crash = safe((impact, vol = 1) => { if (!a.enabled || vol < 0.01) return; const k = Math.min(1, impact) * vol; burst(0.6 * k, { f0: 3000, f1: 250, decay: 0.38, q: 0.5 }); thump(0.5 * k, 110, 38, 0.25); if (impact > 0.4) burst(0.18 * k, { type: 'highpass', f0: 3500, f1: 3000, decay: 0.5 }); });
  a.thud = safe((vol = 1) => { if (!a.enabled || vol < 0.01) return; thump(0.55 * vol, 130, 45, 0.16); burst(0.2 * vol, { f0: 900, f1: 200, decay: 0.08 }); });
  a.boom = safe((vol = 1) => { if (!a.enabled || vol < 0.01) return; burst(0.9 * vol, { f0: 1400, f1: 50, decay: 1.4, q: 0.4 }); thump(0.9 * vol, 75, 26, 1.1); burst(0.25 * vol, { type: 'highpass', f0: 2500, f1: 1800, decay: 0.6 }); });
  // wanted level jingles
  a.starUp = safe((n = 1) => {                                              // a rising alarm, one more note per star, ending on a short siren whoop
    if (!a.enabled) return; const t = ctx.currentTime, f = [659, 784, 988, 1319].slice(0, 2 + Math.min(3, Math.max(1, n)));
    f.forEach((hz, i) => note(hz, t + i * 0.085, 0.11, 0.075, 'square', 2600)); thump(0.25, 95, 45, 0.18);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(600, t + f.length * 0.085); o.frequency.exponentialRampToValueAtTime(1100, t + f.length * 0.085 + 0.28); envGain(g, t + f.length * 0.085, 0.07, 0.03, 0.26); o.connect(g); g.connect(master); o.start(t); o.stop(t + 1);
  });
  a.starDown = safe(() => { if (!a.enabled) return; const t = ctx.currentTime; [988, 784, 659].forEach((hz, i) => note(hz, t + i * 0.1, 0.13, 0.06, 'triangle', 2200)); });
  a.cleared = safe(() => { if (!a.enabled) return; const t = ctx.currentTime; [523, 659, 784, 1047].forEach((hz, i) => note(hz, t + i * 0.11, 0.2, 0.07, 'triangle', 3000)); });
  return a;
}
