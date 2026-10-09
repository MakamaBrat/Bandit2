import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newPlayer, step, animIndex } from '../js/player.js';
import { newPed, stepPed, pedAnim } from '../js/ped.js';
import { newCar, fwd, stepCar } from '../js/vehicle.js';
import { carHits, carVsCar, keepOutOfCars } from '../js/collide.js';
import { HL, HW, nearestCar, carDist, carBlocked } from '../js/vehicle.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const data = JSON.parse(readFileSync('assets/maps/city1_h.json'));
const map = { data, w: data.blocksW * data.tilesPerBlockW * 24, h: data.blocksH * data.tilesPerBlockH * 24, tileAt: tileLookup(data) };
const mk = (speed, kind = 'man') => { const c = newCar('k_00', 3000, 2000, 0); c.speed = speed; const [fx] = fwd(0); const q = newPed(c.x + fx * 12, c.y, 1, Math.random, kind); q.down = 0; return { c, q }; };
{ const { c, q } = mk(100); const h = carHits(map, c, [q], null);
  ok(h.length === 1 && q.down > 0, 'fast car knocks the pedestrian down'); ok(c.speed < 100, 'car loses speed on impact'); ok(pedAnim(q) % 1 === 0 && pedAnim(q) >= 0, `down anim index ${pedAnim(q)}`); }
{ const { c, q } = mk(100, 'woman'); carHits(map, c, [q], null); ok([212, 217, 222, 227].includes(pedAnim(q)), `woman lying anim is one of 212/217/222/227 (got ${pedAnim(q)})`); }
{ const { c, q } = mk(10); ok(carHits(map, c, [q], null).length === 0, 'slow car does not hurt anyone'); }
{ const { c, q } = mk(100); carHits(map, c, [q], null); const n = carHits(map, c, [q], null); ok(n.length === 0, 'an already-downed pedestrian is not hit twice'); for (let i = 0; i < 200; i++) stepPed(map, q, 1 / 30); ok(q.down <= 0, 'pedestrian gets up after a few seconds'); }
{ const hero = newPlayer(map); const c = newCar('k_00', hero.x - 12, hero.y, 0); c.speed = 90; carHits(map, c, [], hero);
  ok(hero.down > 0, 'hero on foot is knocked down'); const x = hero.x; step(map, hero, { right: true }, 0.1); ok(hero.x === x, 'knocked-down hero cannot move'); ok(animIndex(hero) % 30 === 27, 'hero uses lying animation');
  for (let i = 0; i < 60; i++) step(map, hero, {}, 1 / 30); ok(hero.down <= 0, 'hero gets up'); }
{ const a = newCar('k_00', 3000, 2000, 0), b = newCar('k_01', 3010, 2000, 180); a.speed = 80; b.speed = 80; carVsCar(map, a, b);
  ok(Math.hypot(a.x - b.x, a.y - b.y) > 10, 'overlapping cars are pushed apart'); ok(a.speed < 80 && b.speed < 80, 'head-on collision reduces speeds'); }

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
process.exit(fail ? 1 : 0);
