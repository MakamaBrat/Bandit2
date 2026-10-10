import { readFileSync } from 'node:fs';
import { DIR } from '../js/player.js';
import { lyingPose, facingOf, LYING_ANIMS } from '../js/lying.js';
import { newFx, addBlood, addStain, addPool, smear, stepBlood } from '../js/fx.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const an = JSON.parse(readFileSync('assets/sprites/i_00/sprite.json')).animations;
ok(LYING_ANIMS.every(a => an[a] && an[a].length > 0), `every lying animation exists (${LYING_ANIMS.join(', ')})`);
const STAND = new Set([0, 1, 2, 30, 31, 32, 60, 61, 62, 90, 91, 92, 117, 118, 119, 164, 165, 166, 175, 176, 177, 186, 187, 188, 197, 198, 199, 206, 207, 208, 213, 218, 223, 211, 216, 221, 226]);
ok(LYING_ANIMS.every(a => !STAND.has(a)), 'none of them is a standing / walking / stumbling frame (the old +27 for the "down" group was one)');
for (const kind of ['man', 'woman', 'cop']) for (const [name, v] of [['right', { x: 1, y: 0 }], ['left', { x: -1, y: 0 }], ['down', { x: 0, y: 1 }], ['up', { x: 0, y: -1 }]]) { const p = lyingPose(kind, v); ok(LYING_ANIMS.includes(p.anim) && (p.xor === 0 || p.xor === 1 || p.xor === 2), `${kind} thrown ${name}: anim ${p.anim}${p.xor ? ' xor ' + p.xor : ''}`); }
ok(lyingPose('man', { x: 5, y: 0 }).anim === 87 && lyingPose('man', { x: -5, y: 0 }).anim === 27, 'a man thrown right lies head right (87), thrown left head left (27)');
ok(lyingPose('man', { x: 0, y: 5 }).xor === 0 && lyingPose('man', { x: 0, y: -5 }).xor === 2, 'vertical throws: head down as is, head up = mirrored top to bottom');
ok(lyingPose('cop', { x: 5, y: 0 }).xor === 1 && lyingPose('cop', { x: -5, y: 0 }).xor === 0, 'a cop thrown right is the mirrored frame');
ok(lyingPose('woman', { x: 4, y: 1 }).anim === 222 && lyingPose('woman', { x: -4, y: 1 }).anim === 212, 'women: right 222, left 212');
ok(lyingPose('man', null, 'left').anim === 27 && lyingPose('man', null, 'up').xor === 2 && lyingPose('man', { x: 0, y: 0 }, 'right').anim === 87, 'without a throw direction the body lies the way it faced');
ok(facingOf(DIR, DIR.LEFT) === 'left' && facingOf(DIR, DIR.RIGHT) === 'right' && facingOf(DIR, DIR.UP) === 'up' && facingOf(DIR, DIR.DOWN) === 'down', 'facing names map to the direction constants');
// ---- blood ----
{ const fx = newFx(); addBlood(fx, 100, 100, 1, 1, 0); ok(fx.drops.length >= 10 && fx.stains.length === 1, `a hit sprays drops (${fx.drops.length}) and leaves a stain`);
  const towards = fx.drops.filter(d => d.vx > 0).length / fx.drops.length; ok(towards > 0.7, `most of the spray goes the way of the blow (${Math.round(towards * 100)}%)`);
  for (let i = 0; i < 60; i++) stepBlood(fx, 1 / 30); ok(fx.drops.length === 0 && fx.stains.length > 1, `drops land and leave stains (${fx.stains.length} stains)`); }
{ const fx = newFx(); fx.blood = false; addBlood(fx, 0, 0, 1); addPool(fx, 0, 0); ok(!fx.drops.length && !fx.stains.length, 'blood switched off: nothing is created'); }
{ const fx = newFx(); const o = {}; smear(fx, o, 0, 0); smear(fx, o, 3, 0); ok(fx.stains.length === 0, 'a short slide leaves no smear yet'); smear(fx, o, 9, 0); smear(fx, o, 18, 0); ok(fx.stains.length >= 2, `a long slide leaves a trail of smears (${fx.stains.length})`); }
{ const fx = newFx(); const s = addPool(fx, 10, 10); const r0 = s.r; for (let i = 0; i < 100; i++) stepBlood(fx, 1 / 30); ok(s.r > r0 + 4 && s.r <= s.max, `a pool grows under a body (${r0} -> ${s.r.toFixed(1)})`); }
{ const fx = newFx(); for (let i = 0; i < 500; i++) addStain(fx, i, 0, 2); ok(fx.stains.length <= 220, 'stains are capped'); for (let i = 0; i < 2000; i++) stepBlood(fx, 1 / 30); ok(fx.stains.length === 0, 'and fade away after a minute'); }
process.exit(fail ? 1 : 0);
