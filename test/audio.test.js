import { createAudio, attenuation, engineFreq, engineGain, screechGain, sirenFreq } from '../js/audio.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
ok(attenuation(0) === 1 && attenuation(480) === 0 && attenuation(900) === 0 && attenuation(120) > attenuation(300), 'sound fades with distance and is silent when far');
ok(engineFreq(0) < engineFreq(75) && engineFreq(75) < engineFreq(150), `engine pitch rises with speed (${Math.round(engineFreq(0))} -> ${Math.round(engineFreq(150))} Hz)`);
ok(engineGain(false, true, 100) === 0 && engineGain(true, true, 100) > engineGain(true, false, 100), 'engine is silent when not driving and louder on the throttle');
ok(screechGain(0.1) === 0 && screechGain(0.6) > 0 && screechGain(1) <= 0.2, 'tyres squeal only when slipping, and not louder than the cap');
ok(sirenFreq(0) !== sirenFreq(0.3) && Math.min(...[0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2].map(sirenFreq)) > 450, 'siren wails between two pitches');
{ const a = createAudio({}); ok(!a.supported && a.update() === undefined && a.shot(0, 1) === undefined && a.boom(1) === undefined && a.toggle() === false, 'without WebAudio every call is a harmless no-op'); }
{ // a fake WebAudio to check wiring: nothing throws and the right sources get created
  const log = []; const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(v) { this.last = v; }, cancelScheduledValues() {} });
  class N { constructor(kind) { this.kind = kind; this.frequency = param(); this.gain = param(); this.Q = param(); this.type = ''; this.buffer = null; this.loop = false; log.push(kind); } connect(n) { return n || this; } start() { log.push(this.kind + '.start'); } stop() {} }
  let masterNode = null;
  class AC { constructor() { this.currentTime = 1; this.sampleRate = 8000; this.destination = new N('dest'); this.state = 'suspended'; } createGain() { const g = new N('gain'); if (!masterNode) masterNode = g; return g; } createOscillator() { return new N('osc'); } createBiquadFilter() { return new N('filter'); } createBufferSource() { return new N('src'); } createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; } resume() { this.state = 'running'; return Promise.resolve(); } }
  const a = createAudio({ AudioContext: AC });
  ok(a.supported && !a.enabled, 'audio is created locked until the first user gesture'); a.shot(0, 1); ok(log.length === 0, 'nothing plays before the unlock');
  a.unlock(); ok(a.enabled && log.filter(k => k === 'osc').length === 3, 'unlock builds the engine (2 oscillators) and the siren (1)');
  const n0 = log.length; a.shot(0, 1); a.shot(1, 1); a.shot(2, 1); a.crash(0.8, 1); a.thud(1); a.boom(1); ok(log.length > n0 + 12, `one-shot sounds create sources (${log.length - n0} nodes)`);
  const n1 = log.length; a.shot(0, 0.001); a.crash(1, 0); ok(log.length === n1, 'inaudible sounds (far away) create nothing');
  a.update({ driving: true, throttle: true, speed: 120, slip: 0.7, siren: 1, fire: 1 }); ok(true, 'per-frame update runs');
  a.toggle(); ok(a.muted && masterNode.gain.last === 0, 'mute sets the master volume to 0'); a.toggle(); ok(!a.muted && masterNode.gain.last > 0, 'and unmute restores it');
  const bad = createAudio({ AudioContext: class { constructor() { throw new Error('no audio'); } } }); ok((bad.unlock(), bad.shot(0, 1), true) && !bad.enabled, 'a failing AudioContext never breaks the game');
}
process.exit(fail ? 1 : 0);
