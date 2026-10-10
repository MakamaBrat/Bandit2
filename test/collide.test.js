import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newPlayer, step, animIndex } from '../js/player.js';
import { newPed, stepPed, pedAnim } from '../js/ped.js';
import { newCar, stepCar } from '../js/vehicle.js';
import { makeWorld, keepOutOfCars } from '../js/collide.js';
import { setSpeed, bodyBoxes } from '../js/physics.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const open = { tileAt: () => ({ collision: 0 }), data: { tileSize: 24 } };
const data = JSON.parse(readFileSync('assets/maps/city1_h.json')); const city = { data, w: 8 * 32 * 24, h: 5 * 32 * 24, tileAt: tileLookup(data) };
const game = (cars, peds, extra = {}) => makeWorld({ cars, peds, ...extra });
const scene = (h, kind = 'man') => { const c = newCar(0, 3000, 2000, 0); setSpeed(c, h); const q = newPed(3030, 2000, 1, Math.random, kind); q.down = 0; return { c, q }; };
{ const { c, q } = scene(3000); let hit = 0; const w = game([c], [q], { onPedHit: () => hit++ }); for (let i = 0; i < 4 && !q.flying; i++) stepCar(open, c, null, w);
  ok(q.flying && q.dead, 'fast car kills and throws the pedestrian'); ok(hit === 1, 'hit reported once'); ok(Math.abs(c.c) < 3000 * 2.56, `car velocity cut by the impact (${c.c})`);
  const x0 = q.x; for (let i = 0; i < 40; i++) stepPed(open, q, 0.1); ok(q.x > x0 + 10, `body flies ${Math.round(q.x - x0)} px`); ok(!q.flying && q.dead && q.down > 0, 'body stays on the ground'); ok(pedAnim(q) % 1 === 0, `lying anim ${pedAnim(q)}`); }
{ const { c, q } = scene(900); const w = game([c], [q]); for (let i = 0; i < 4 && !q.flying; i++) stepCar(open, c, null, w);
  ok(q.flying && !q.dead && q.hp === 25, `slow hit: 10 damage, survives (hp ${q.hp})`); for (let i = 0; i < 60; i++) stepPed(open, q, 0.1); ok(!q.flying && q.down <= 0 && !q.dead, 'pedestrian gets up after about a second'); }
{ const { c, q } = scene(3000, 'woman'); const w = game([c], [q]); for (let i = 0; i < 4; i++) stepCar(open, c, null, w); ok([212, 217, 222, 227].includes(pedAnim(q)), `woman lying anim (${pedAnim(q)})`); }
{ const { c, q } = scene(0); const w = game([c], [q]); c.c = 0; stepCar(open, c, null, w); ok(!q.flying, 'a parked car does not hurt anyone'); }
{ const hero = newPlayer(city); const c = newCar(0, hero.x - 36, hero.y + 5, 0); setSpeed(c, 3000); let hurt = 0; const w = game([c], [Object.assign(hero, { hero: true })], { hurtHero: n => hurt += n });
  for (let i = 0; i < 6 && !(hero.down > 0); i++) { stepCar(open, c, null, w); }
  ok(hero.down > 0 && hurt === 10, 'hero on foot is knocked down and hurt'); const x = hero.x; step(city, hero, { right: true }, 0.1); ok(hero.x === x, 'knocked-down hero cannot move'); ok(animIndex(hero) % 30 === 27, 'hero uses lying animation'); for (let i = 0; i < 40; i++) step(city, hero, {}, 0.05); ok(hero.down <= 0, 'hero gets up'); }
{ const a = newCar(0, 500, 500, 0), b = newCar(1, 580, 500, 180); a.hero = true; setSpeed(a, 2500); setSpeed(b, 2500); let crash = 0; const w = game([a, b], [], { onCrash: () => crash++ });
  for (let i = 0; i < 12; i++) { stepCar(open, a, {}, w); stepCar(open, b, null, w); }
  ok(crash > 0, 'head-on cars collide'); const ov = bodyBoxes(a).some(r => bodyBoxes(b).some(s => r.x0 + 4 < s.x1 && r.x1 - 4 > s.x0 && r.y0 + 4 < s.y1 && r.y1 - 4 > s.y0)); ok(!ov, 'cars are separated afterwards'); ok(Math.abs(a.h) < 2500 && Math.abs(b.h) < 2500, `both lose speed (${a.h}, ${b.h})`); ok(a.hp < 40 && b.hp < 40, `both take damage (${a.hp}, ${b.hp})`); }
{ const a = newCar(0, 500, 500, 0), b = newCar(1, 620, 500, 0); b.parked = true; a.hero = true; setSpeed(a, 3000); const w = game([a, b], []); for (let i = 0; i < 10; i++) { stepCar(open, a, { up: true }, w); stepCar(open, b, null, w); } ok(b.x > 620, `rear-ending shoves the other car (${b.x.toFixed(0)})`); }
{ const c = newCar(0, 3000, 2000, 0), p = { x: 3000, y: 2000 }; keepOutOfCars([c], p, 3000, 2060); ok(p.y === 2060, 'hero cannot stand inside a car'); const q = { x: 3000, y: 2040 }; keepOutOfCars([c], q, 3000, 2060); ok(q.y === 2040, 'hero outside stays'); }
process.exit(fail ? 1 : 0);
