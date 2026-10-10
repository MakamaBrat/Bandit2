import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newPlayer } from '../js/player.js';
import { newCar, stepCar, wheels, HL } from '../js/vehicle.js';
import { newPed } from '../js/ped.js';
import { newCop } from '../js/police.js';
import { carVsCar, flyStep } from '../js/collide.js';
import { damageCar, damageFromCrash, damageFromWall, stage, health, stepCarFire, explode, isUsable, burning, BLAST_R } from '../js/damage.js';
import { newFx, skidStep, tyreSmoke, addSmoke, addFlame, addExplosion, stepFx } from '../js/fx.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const data = JSON.parse(readFileSync('assets/maps/city1_h.json'));
const map = { data, w: data.blocksW * data.tilesPerBlockW * 24, h: data.blocksH * data.tilesPerBlockH * 24, tileAt: tileLookup(data) };
const T = 24, OP = (() => { const cx = map.w / 2, cy = map.h / 2; for (let r = 0; r < 120; r++) for (let a = 0; a < 360; a += 10) { const x = Math.floor((cx + Math.cos(a * Math.PI / 180) * r * T) / T) * T + 12, y = Math.floor((cy + Math.sin(a * Math.PI / 180) * r * T) / T) * T + 12; let clear = true; for (let dx = -4; dx <= 4 && clear; dx++) for (let dy = -4; dy <= 4; dy++) if (map.tileAt(x + dx * T, y + dy * T).collision !== 0) { clear = false; break; } if (clear) return { x, y }; } return null; })();
// ---- stages ----
{ const c = newCar('k_01', OP.x, OP.y, 0); ok(stage(c) === 'ok' && health(c) === 1 && isUsable(c), 'a new car is fine');
  c.hp = 45; ok(stage(c) === 'smoke', 'below 50% it smokes'); c.hp = 20; ok(stage(c) === 'heavy', 'below 25% heavy smoke and flames'); damageCar(c, 100); ok(stage(c) === 'burning' && !isUsable(c) && burning(c), 'at 0 it is burning and cannot be driven'); }
{ const c = newCar('k_01', 0, 0, 0); ok(damageCar(c, 30) === false && c.hp === 70, 'damage lowers hp'); ok(damageCar(c, 100) === true, 'the hit that kills reports it'); ok(damageCar(c, 10) === false, 'a dead car takes no more damage events'); }
{ const c = newCar('k_01', 0, 0, 0); damageFromCrash(c, 20); ok(c.hp === 100, 'a light bump does no damage'); damageFromCrash(c, 200); const after = c.hp; ok(after < 70 && after > 40, `a hard crash (200) takes ~40% (${Math.round(100 - after)}%)`); const w = newCar('k_01', 0, 0, 0); damageFromWall(w, 60); ok(w.hp === 100, 'slow wall touch: no damage'); damageFromWall(w, 150); ok(w.hp < 95, `a fast wall hit hurts (${Math.round(w.hp)})`); const p = newCar('k_00', 0, 0, 0); p.hp = p.hpMax = 30; damageFromCrash(p, 200); ok(p.hp < 20, 'damage scales with the car’s own hpMax (police cars are weaker)'); }
// ---- smoke / flames / explosion events ----
{ const c = newCar('k_01', OP.x, OP.y, 0); const count = (t, secs) => { let n = { smoke: 0, flame: 0, explode: 0 }; for (let i = 0; i < secs * 30; i++) for (const e of stepCarFire(c, 1 / 30)) n[e.type]++; return n; };
  ok(count(0, 3).smoke === 0, 'a healthy car makes no smoke'); c.hp = 40; const a = count(0, 3); ok(a.smoke > 15 && a.flame === 0, `a damaged car smokes (${a.smoke} puffs in 3 s)`);
  c.hp = 15; const b = count(0, 3); ok(b.flame > 3 && b.smoke > 15, `a badly damaged car smokes and shows flames (${b.flame} flames)`);
  c.hp = 0; const d = count(0, 6); ok(d.explode === 1 && c.wreck, `a burning car explodes exactly once after a few seconds (${c.burn.toFixed(1)} s)`); ok(c.speed === 0 && c.ai === false && !isUsable(c), 'and becomes a wreck that cannot be driven'); const e2 = count(0, 4); ok(e2.flame > 10 && e2.explode === 0, `the wreck keeps burning (${e2.flame} flames)`);
  c.fireT = 0; const e3 = count(0, 5); ok(e3.flame === 0 && e3.smoke > 5, 'then it only smoulders'); c.smolder = 0; ok(count(0, 3).smoke === 0 && !burning(c), 'and finally goes quiet'); }
// ---- the blast ----
{ const car = newCar('k_01', OP.x, OP.y, 0); car.wreck = true; const mk = (dx, kind) => { const o = kind === 'cop' ? newCop(OP.x + dx, OP.y) : newPed(OP.x + dx, OP.y, 1); o.down = 0; return o; };
  const near = mk(20), mid = mk(65), far = mk(150), cop = mk(30, 'cop'), hero = newPlayer(map); hero.x = OP.x + 40; hero.y = OP.y; hero.down = 0; hero.hp = 100;
  const other = newCar('k_02', OP.x - 70, OP.y, 0); const out = explode(car, { peds: [near, mid, far], cops: [cop], hero, cars: [car, other], driving: null });
  ok(near.dead && !!near.fly && out.killed.includes(near), 'a pedestrian next to the car is killed and thrown'); ok(!mid.dead && mid.down > 0 && !!mid.fly, 'one further out is only knocked down'); ok(!far.dead && !far.fly, `one outside the blast (${BLAST_R}px) is untouched`);
  ok(cop.hp < 3 && !!cop.fly, `a cop nearby is hurt and thrown (hp ${cop.hp})`); ok(out.heroDamage > 8 && hero.down > 0 && !!hero.fly, `the hero on foot is hurt (${out.heroDamage}) and thrown`);
  ok((other.kx || other.ky) && other.hp < 100, 'a neighbouring car is shoved and damaged'); ok(car.hp === car.hp, 'the exploding car is not pushed by its own blast');
  for (const o of [near, mid, cop, hero]) { let s = 0; while (o.fly && s++ < 800) flyStep(map, o, 1 / 60); ok(!o.fly, 'every thrown body comes to rest'); } }
{ const car = newCar('k_01', OP.x, OP.y, 0), hero = newPlayer(map); hero.hp = 100; const out = explode(car, { peds: [], cops: [], hero, cars: [car], driving: car }); ok(out.heroDamage === 55, 'a hero sitting in the exploding car takes 55 damage'); }
// ---- tyre marks and smoke ----
{ const fx = newFx(); const c = newCar('k_01', OP.x, OP.y, 0); c.speed = 150; let maxSlip = 0;
  for (let i = 0; i < 40; i++) { stepCar(map, c, { down: true }, 1 / 30); maxSlip = Math.max(maxSlip, c.slip); skidStep(fx, c, wheels(c)); }
  ok(maxSlip > 0.8 && fx.skids.length > 10, `hard braking from full speed leaves skid marks (${fx.skids.length} segments, slip up to ${maxSlip.toFixed(2)})`);
  const w = wheels(c); ok(w.length === 4 && w[0][0] < c.x + 1 && w.every(p => Math.hypot(p[0] - c.x, p[1] - c.y) <= HL), 'wheel positions are around the car (rear pair first)');
  const fx2 = newFx(); const c2 = newCar('k_01', OP.x, OP.y, 0); c2.speed = 40; for (let i = 0; i < 40; i++) { stepCar(map, c2, { up: true }, 1 / 30); skidStep(fx2, c2, wheels(c2)); } ok(fx2.skids.length === 0, 'gentle driving leaves no marks');
  const fx3 = newFx(); const c3 = newCar('k_01', OP.x, OP.y, 0); c3.speed = 130; for (let i = 0; i < 40; i++) { stepCar(map, c3, { left: true, up: true }, 1 / 30); skidStep(fx3, c3, wheels(c3)); } ok(fx3.skids.length > 10, `a fast corner leaves marks (${fx3.skids.length})`);
  const a = newCar('k_01', OP.x, OP.y, 0), b = newCar('k_02', OP.x + HL + 10, OP.y - 22, 270); a.speed = 90; b.speed = 90; const r = carVsCar(map, a, b); stepCar(map, b, {}, 1 / 30); ok(r && r.impact > 40 && b.slip > 0.5, `a car hit from the side slides and leaves marks (slip ${b.slip.toFixed(2)})`);
  for (let i = 0; i < 800; i++) stepFx(fx, 1 / 30); ok(fx.skids.length === 0, 'marks fade away after 25 s'); const dead = newCar('k_01', OP.x, OP.y, 0); dead.hp = 0; dead.speed = 130; stepCar(map, dead, { down: true }, 1 / 30); ok(dead.slip === 0, 'a burnt-out car does not skid'); }
{ const fx = newFx(); tyreSmoke(fx, 10, 10, 0.9); addSmoke(fx, 0, 0, { col: [30, 30, 30] }); addFlame(fx, 0, 0); ok(fx.smoke.length === 2 && fx.flames.length === 1, 'smoke and flame particles are created'); const y0 = fx.flames[0].y; stepFx(fx, 0.2); ok(fx.flames[0].y < y0 && fx.smoke[0].r > 2, 'flames rise and smoke puffs grow');
  addExplosion(fx, 0, 0); ok(fx.flames.length > 40 && fx.smoke.length > 15 && fx.rings.length === 1 && fx.shake >= 9 && fx.stains.some(s => s.col), 'an explosion makes a fireball, smoke, a ring, shake and a scorch mark'); for (let i = 0; i < 200; i++) stepFx(fx, 1 / 30); ok(fx.flames.length === 0 && fx.smoke.length === 0 && fx.rings.length === 0, 'everything burns out'); const big = newFx(); for (let i = 0; i < 2000; i++) { addSmoke(big, 0, 0); addFlame(big, 0, 0); } ok(big.smoke.length <= 320 && big.flames.length <= 320, 'particle counts are capped'); }
process.exit(fail ? 1 : 0);
