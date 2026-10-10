import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newPlayer, step, animIndex, blockedAt } from '../js/player.js';
import { newPed, stepPed, pedAnim } from '../js/ped.js';
import { newCar, fwd, stepCar } from '../js/vehicle.js';
import { carHits, carVsCar, keepOutOfCars, obbOverlap, flyStep } from '../js/collide.js';
import { newFx, addSparks, addPuff, stepFx, shake } from '../js/fx.js';
import { HL, HW, nearestCar, carDist, carBlocked } from '../js/vehicle.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const data = JSON.parse(readFileSync('assets/maps/city1_h.json'));
const map = { data, w: data.blocksW * data.tilesPerBlockW * 24, h: data.blocksH * data.tilesPerBlockH * 24, tileAt: tileLookup(data) };

const openSpot = () => { const T = 24, cx = map.w / 2, cy = map.h / 2; for (let r = 0; r < 120; r++) for (let a = 0; a < 360; a += 10) { const x = Math.floor((cx + Math.cos(a * Math.PI / 180) * r * T) / T) * T + 12, y = Math.floor((cy + Math.sin(a * Math.PI / 180) * r * T) / T) * T + 12;
  let clear = true; for (let dx = -4; dx <= 4 && clear; dx++) for (let dy = -4; dy <= 4; dy++) if (map.tileAt(x + dx * T, y + dy * T).collision !== 0) { clear = false; break; } if (clear) return { x, y }; } return null; };
const OP = openSpot();
const mk = (speed, kind = 'man') => { const c = newCar('k_00', 3000, 2000, 0); c.speed = speed; const [fx] = fwd(0); const q = newPed(c.x + fx * 12, c.y, 1, Math.random, kind); q.down = 0; return { c, q }; };
{ const { c, q } = mk(100); const h = carHits(map, c, [q], null);
  ok(h.length === 1 && q.down > 0, 'fast car knocks the pedestrian down'); ok(c.speed < 100, 'car loses speed on impact'); ok(pedAnim(q) % 1 === 0 && pedAnim(q) >= 0, `down anim index ${pedAnim(q)}`); }
{ const { c, q } = mk(100, 'woman'); carHits(map, c, [q], null); ok([212, 217, 222, 227].includes(pedAnim(q)), `woman lying anim is one of 212/217/222/227 (got ${pedAnim(q)})`); }
{ const { c, q } = mk(10); ok(carHits(map, c, [q], null).length === 0, 'slow car does not hurt anyone'); }
{ const { c, q } = mk(100); carHits(map, c, [q], null); const n = carHits(map, c, [q], null); ok(n.length === 0, 'an already-downed pedestrian is not hit twice'); for (let i = 0; i < 200; i++) stepPed(map, q, 1 / 30); ok(q.down <= 0, 'pedestrian gets up after a few seconds'); }
{ const hero = newPlayer(map); const c = newCar('k_00', hero.x - 12, hero.y, 0); c.speed = 90; carHits(map, c, [], hero);
  ok(hero.down > 0, 'hero on foot is knocked down'); const x = hero.x; step(map, hero, { right: true }, 0.1); ok(hero.x === x, 'knocked-down hero cannot move'); ok(animIndex(hero) % 30 === 27, 'hero uses lying animation');
  for (let i = 0; i < 60; i++) step(map, hero, {}, 1 / 30); ok(hero.down <= 0, 'hero gets up'); }
{ const a = newCar('k_00', 3000, 2000, 0), b = newCar('k_01', 3000 + 2 * HL - 8, 2000, 180); a.speed = 80; b.speed = 80; const r = carVsCar(map, a, b);
  ok(r && r.impact > 100, `head-on: contact detected, closing speed ${r && Math.round(r.impact)}`); ok(a.speed < 80 && b.speed < 80 && a.speed < 0 && b.speed < 0, `head-on collision bounces both back (${Math.round(a.speed)}, ${Math.round(b.speed)})`); ok(!obbOverlap(a, b), 'and they no longer overlap'); }

{ // the collider is as big as the car art (about 72 x 33 px)
  ok(HL >= 28 && HW >= 11, `car collider ${2 * HL} x ${2 * HW} px matches the ~72 x 33 art`);
  const c = newCar('k_00', 3000, 2000, 0); c.speed = 100; const q = newPed(3000 + 27, 2000, 1); q.down = 0;
  ok(carHits(map, c, [q], null).length === 1, 'a pedestrian touching the nose of the car (27px from centre) is hit');
  const far = newPed(3000 + 45, 2000, 1); far.down = 0; ok(carHits(map, c, [far], null).length === 0, 'a pedestrian 45px ahead is not hit yet'); }
{ // hero on foot cannot walk through a standing car and slides along it
  const car = newCar('k_00', 3000, 2000, 0), h = newPlayer(map); h.x = 3000 - 55; h.y = 2000;
  for (let i = 0; i < 120; i++) { const px = h.x, py = h.y; step(map, h, { right: true }, 1 / 30); keepOutOfCars([car], h, px, py); }
  ok(h.x < car.x - HL + 1, `hero stops at the car's rear (x ${Math.round(h.x)} < ${car.x - HL})`);
  h.x = 3000 - 20; h.y = 2000 - 40;  for (let i = 0; i < 60; i++) { const px = h.x, py = h.y; step(map, h, { down: true }, 1 / 30); keepOutOfCars([car], h, px, py); }
  ok(h.y < car.y - HW + 1, 'hero walking down onto the roof line stops at the side of the car');
  const inside = newPlayer(map); inside.x = 3000; inside.y = 2000; for (let i = 0; i < 30; i++) { const px = inside.x, py = inside.y; step(map, inside, { up: true }, 1 / 30); keepOutOfCars([car], inside, px, py); }
  ok(inside.y < 2000, 'a hero that ends up inside a car body can still walk out'); }
{ // getting in works from the edge of the body, not only from the centre
  const car = newCar('k_00', 3000, 2000, 0), h = { x: 3000 + HL + 8, y: 2000 };
  ok(nearestCar([car], h) === car && carDist(car, h.x, h.y) < 10, 'hero standing at the nose can enter the car'); h.x = 3000 + HL + 40; ok(nearestCar([car], h) === null, 'hero 40px from the nose cannot'); }
{ // driving into a wall: the whole body stays out of solid tiles
  let bad = 0; const c = newCar('k_00', 3000, 2000, 0); c.speed = 0;
  for (let i = 0; i < 4000; i++) { stepCar(map, c, { up: true, left: (i >> 6) % 3 === 0, right: (i >> 6) % 3 === 1 }, 1 / 30); if (carBlocked(map, c.x, c.y, c.heading)) bad++; }
  ok(bad === 0, 'car body never overlaps a solid tile'); }

{ // the situation from the screenshot: a long car lying across the road and another one pushed into its side at an angle
  const blue = newCar('k_02', OP.x, OP.y, 180); blue.speed = 0;
  ok(!!obbOverlap(blue, newCar('k_03', OP.x + 20, OP.y - 25, 40)), 'a car whose nose sits inside the side of another is detected (the old circle test missed this)');
  const p2 = newCar('k_03', OP.x + 20, OP.y - 25, 220); p2.speed = 90; let hits = 0;   // nose pointing down-left, into the side of the blue car
  for (let i = 0; i < 40; i++) { stepCar(map, p2, {}, 1 / 30); if (carVsCar(map, blue, p2)) hits++; }
  ok(!obbOverlap(blue, p2), `after the crash the cars do not overlap (${hits} contact frames)`); ok(Math.abs(blue.spin || 0) > 0 || Math.abs(p2.spin || 0) > 0 || blue.kx || blue.ky, 'the hit set the struck car sliding / spinning'); }
{ // random pairs: any overlap is resolved within a few steps and nothing ends up in a wall
  let bad = 0, wall = 0; const rnd = (a, b) => a + Math.random() * (b - a);
  for (let n = 0; n < 400; n++) { const a = newCar('k_00', OP.x, OP.y, rnd(0, 360)), b = newCar('k_01', OP.x + rnd(-45, 45), OP.y + rnd(-45, 45), rnd(0, 360)); a.speed = rnd(-40, 120); b.speed = rnd(-40, 120);
    for (let i = 0; i < 6 && obbOverlap(a, b); i++) carVsCar(map, a, b); if (obbOverlap(a, b)) bad++; if (carBlocked(map, a.x, a.y, a.heading) || carBlocked(map, b.x, b.y, b.heading)) wall++; }
  ok(bad === 0, 'overlapping cars are always separated (400 random pairs)'); ok(wall === 0, 'separation never pushes a car into a wall'); }
{ // sparks and shake
  const fx = newFx(); addSparks(fx, 100, 100, 1); ok(fx.sparks.length >= 10, `a crash makes sparks (${fx.sparks.length})`); addPuff(fx, 100, 100, 5); shake(fx, 6); ok(fx.shake === 6, 'shake set');
  for (let i = 0; i < 60; i++) stepFx(fx, 1 / 30); ok(fx.sparks.length === 0 && fx.puffs.length === 0 && fx.shake === 0, 'sparks, puffs and shake fade out');
  const big = newFx(); for (let i = 0; i < 100; i++) addSparks(big, 0, 0, 1.5); ok(big.sparks.length <= 400, 'spark count is capped'); }
{ // a struck pedestrian flies in an arc, bounces and slides to rest, never into a wall
  const c = newCar('k_00', OP.x - 20, OP.y, 0); c.speed = 110; const q = newPed(OP.x - 20 + HL - 4, OP.y, 1); q.down = 0; carHits(map, c, [q], null);
  ok(!!q.fly && q.fly.vz > 100, `hit pedestrian is launched (up ${Math.round(q.fly.vz)} px/s)`); const x0 = q.x; let maxZ = 0, steps = 0, wallHit = 0;
  while (q.fly && steps < 600) { flyStep(map, q, 1 / 60); maxZ = Math.max(maxZ, q.fly ? q.fly.z : 0); if (blockedAt(map, q.x, q.y)) wallHit++; steps++; }
  ok(maxZ > 12, `goes up in an arc (peak ${Math.round(maxZ)} px)`); ok(q.x - x0 > 40, `and flies away from the car (${Math.round(q.x - x0)} px)`); ok(!q.fly, `comes to rest after ${(steps / 60).toFixed(1)}s`); ok(wallHit === 0, 'never ends up inside a wall');
  const slow = newCar('k_00', OP.x - 20, OP.y, 0); slow.speed = 40; const q2 = newPed(OP.x - 20 + HL - 4, OP.y, 1); q2.down = 0; carHits(map, slow, [q2], null); const far = () => { let s = 0; const x1 = q2.x; while (q2.fly && s++ < 600) flyStep(map, q2, 1 / 60); return q2.x - x1; };
  ok(far() < q.x - x0, 'a faster car launches pedestrians farther'); }
process.exit(fail ? 1 : 0);
