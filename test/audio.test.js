import { createAudio, attenuation, engineFreq, engineGain, screechGain, sirenFreq, noteFreq, CHORDS, bpmFor, bassNote, arpNote, BASS_STEPS } from '../js/audio.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
ok(attenuation(0) === 1 && attenuation(480) === 0 && attenuation(900) === 0 && attenuation(120) > attenuation(300), 'sound fades with distance and is silent when far');
ok(engineFreq(0.2) < engineFreq(0.6) && engineFreq(0.6) < engineFreq(1) && engineFreq(1) < 140, `engine pitch follows the revs (${Math.round(engineFreq(0.2))} -> ${Math.round(engineFreq(1))} Hz)`);
ok(engineGain(false, true, 0.8) === 0 && engineGain(true, true, 0.8) > engineGain(true, false, 0.8), 'engine is silent when not driving and a little louder on the throttle');
ok(engineGain(true, true, 1) <= 0.04 && engineGain(true, false, 0.2) >= 0.012, `engine is quiet (max ${engineGain(true, true, 1).toFixed(3)}, was 0.135) but never inaudible at idle`);
ok(screechGain(0.1) === 0 && screechGain(0.6) > 0 && screechGain(1) <= 0.13, 'tyres squeal only when slipping, and not louder than the cap');
ok(sirenFreq(0) !== sirenFreq(0.3) && Math.min(...[0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2].map(t => sirenFreq(t))) > 400, 'siren wails between two pitches');
{ const peaks = f => { let n = 0; for (let i = 1; i < 400; i++) { const a = f((i - 1) / 200), b = f(i / 200), c = f((i + 1) / 200); if (b > a && b >= c) n++; } return n; };
  ok(peaks(t => sirenFreq(t, true)) > 3 * peaks(t => sirenFreq(t, false)), `a close police car switches from the slow wail (${peaks(t => sirenFreq(t))} peaks in 2 s) to a fast yelp (${peaks(t => sirenFreq(t, true))})`); }
// ---- music theory helpers ----
ok(Math.abs(noteFreq(69) - 440) < 1e-9 && Math.abs(noteFreq(81) - 880) < 1e-9, 'A4 = 440 Hz, an octave up doubles it');
ok(CHORDS.length === 4 && CHORDS.every(c => c.length === 3) && CHORDS[0][0] % 12 === 9, 'four triads, starting on A (A minor: Am F C G)');
ok(bpmFor(0) === 90 && bpmFor(1) === 132 && bpmFor(0.5) > 90 && bpmFor(5) === 132, 'music tempo rises with the wanted level (90 -> 132 bpm)');
ok(BASS_STEPS.every(s => s >= 0 && s < 16) && [0, 1, 2, 3].every(b => bassNote(b, 0) % 12 === CHORDS[b][0] % 12) && bassNote(0, 14) - bassNote(0, 0) === 7, 'the bass plays the chord root, with a fifth on the last hit of the bar');
ok(Array.from({ length: 16 }, (_, s) => arpNote(0, s)).every(n => CHORDS[0].map(m => (m + 12) % 12).includes(n % 12)), 'the arpeggio only plays notes of the current chord');
{ const a = createAudio({}); ok(!a.supported && a.update() === undefined && a.shot(0, 1) === undefined && a.boom(1) === undefined && a.toggle() === false, 'without WebAudio every call is a harmless no-op'); }
{ // a fake WebAudio to check wiring: nothing throws and the right sources get created
  const log = []; const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(v) { this.last = v; }, cancelScheduledValues() {} });
  class N { constructor(kind) { this.kind = kind; this.frequency = param(); this.gain = param(); this.Q = param(); this.type = ''; this.buffer = null; this.loop = false; log.push(kind); } connect(n) { return n || this; } start() { log.push(this.kind + '.start'); } stop() {} }
  let masterNode = null, clock = null, acInst = null; const gains = [];
  class AC { constructor() { acInst = this; this.currentTime = 1; this.sampleRate = 8000; this.destination = new N('dest'); this.state = 'suspended'; } createGain() { const g = new N('gain'); gains.push(g); if (!masterNode) masterNode = g; return g; } createOscillator() { return new N('osc'); } createBiquadFilter() { return new N('filter'); } createBufferSource() { return new N('src'); } createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; } resume() { this.state = 'running'; return Promise.resolve(); } }
  const a = createAudio({ AudioContext: AC, setInterval: f => { clock = f; return 1; } });
  ok(a.supported && !a.enabled, 'audio is created locked until the first user gesture'); a.shot(0, 1); ok(log.length === 0, 'nothing plays before the unlock');
  a.unlock(); ok(a.enabled && log.filter(k => k === 'osc').length === 4, 'unlock builds the engine (2 oscillators) and the siren (2)'); ok(typeof clock === 'function', 'and starts the music sequencer timer');
  const n0 = log.length; a.shot(0, 1); a.shot(1, 1); a.shot(2, 1); a.crash(0.8, 1); a.thud(1); a.boom(1); ok(log.length > n0 + 12, `one-shot sounds create sources (${log.length - n0} nodes)`);
  const n1 = log.length; a.shot(0, 0.001); a.crash(1, 0); ok(log.length === n1, 'inaudible sounds (far away) create nothing');
  a.update({ driving: true, throttle: true, rpm: 0.7, slip: 0.7, siren: 1, yelp: true, fire: 1 }); ok(true, 'per-frame update runs');
  // wanted-level jingles
  const j0 = log.length; a.starUp(1); const up1 = log.length - j0, j1 = log.length; a.starUp(3); const up3 = log.length - j1; ok(up1 > 6 && up3 > up1, `the star-up alarm adds a note per star (${up1} -> ${up3} nodes)`);
  const j2 = log.length; a.starDown(); ok(log.length > j2 + 6, 'a different jingle plays when a star is lost'); const j3 = log.length; a.cleared(); ok(log.length > j3 + 8, 'and a third when the wanted level is cleared');
  // music: steps are scheduled ahead of the clock; layers appear with the intensity
  const play = secs => { const before = log.length; for (let s = 0; s < secs * 20; s++) { acInst.currentTime += 0.05; a._tick(); } return log.length - before; };
  const calm = play(8); ok(calm > 40, `the soundtrack plays on its own (${calm} nodes in 8 s)`);
  const srcCalm = (() => { const b = log.length; play(8); return log.slice(b).filter(k => k === 'src').length; })();
  a.setIntensity(1); play(10); const bC = log.length; play(8); const chase = log.slice(bC); ok(chase.filter(k => k === 'src').length > srcCalm && chase.length > calm, `at a high wanted level drums and hats join in (${srcCalm} -> ${chase.filter(k => k === 'src').length} noise hits)`);
  a.setMusic(false); ok(!a.musicOn && gains.some(g => g.gain.last === 0), 'the music switch silences the music bus'); const bM = log.length; play(6); ok(log.length === bM, 'and nothing is scheduled while the music is off'); a.toggleMusic(); ok(a.musicOn, 'it can be switched back on'); ok(play(6) > 20, 'and the music resumes');
  a.toggle(); ok(a.muted && masterNode.gain.last === 0, 'mute sets the master volume to 0'); const bm = log.length; play(4); ok(log.length === bm, 'and the sequencer stays idle while muted'); a.toggle(); ok(!a.muted && masterNode.gain.last > 0, 'unmute restores it');
  const bad = createAudio({ AudioContext: class { constructor() { throw new Error('no audio'); } } }); ok((bad.unlock(), bad.shot(0, 1), true) && !bad.enabled, 'a failing AudioContext never breaks the game');
}
process.exit(fail ? 1 : 0);
