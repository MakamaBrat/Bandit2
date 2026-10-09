import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newPlayer, blockedAt } from '../js/player.js';
import { spawnCars, stepCar, carBlocked, nearestCar, exitSpot } from '../js/vehicle.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
for (const tag of ['city1_h', 'city2_s']) {
  const data = JSON.parse(readFileSync(`assets/maps/${tag}.json`));
  const map = { data, w: data.blocksW * data.tilesPerBlockW * 24, h: data.blocksH * data.tilesPerBlockH * 24, tileAt: tileLookup(data) };
  const p = newPlayer(map), cars = spawnCars(map, p, 5);
  ok(cars.length === 5, `${tag}: spawned 5 cars (${cars.map(c => c.type).join(',')})`);
  ok(cars.every(c => !carBlocked(map, c.x, c.y, c.heading)), `${tag}: no car spawns inside a wall`);
  let bad = 0, maxSp = 0, dist = 0;
  for (const c of cars) {
    let inp = {};
    for (let i = 0; i < 6000; i++) {
      if (i % 30 === 0) inp = { up: Math.random() < 0.8, down: Math.random() < 0.1, left: Math.random() < 0.35, right: Math.random() < 0.35 };
      const x0 = c.x, y0 = c.y; stepCar(map, c, inp, 1 / 30);
      if (carBlocked(map, c.x, c.y, c.heading)) bad++; maxSp = Math.max(maxSp, Math.abs(c.speed)); dist += Math.hypot(c.x - x0, c.y - y0);
    }
  }
  ok(bad === 0, `${tag}: cars never ended a step inside a wall (30000 random steps, ${Math.round(dist)} px driven, max speed ${maxSp|0})`);
  ok(cars.every(c => c.anim >= 0 && c.anim < 16), `${tag}: anim index always 0..15`);
  const c0 = cars[0]; c0.speed = 0; const q = { x: c0.x + 20, y: c0.y };
  { const n = nearestCar(cars, q); ok(n && Math.hypot(n.x - q.x, n.y - q.y) <= Math.hypot(c0.x - q.x, c0.y - q.y) + 1e-9, `${tag}: nearestCar finds the closest car within 34px`); }
  const sp = exitSpot(map, c0); ok(sp && !blockedAt(map, sp.x, sp.y), `${tag}: exit spot exists and is walkable`);
}
// straight acceleration sanity
{
  const data = JSON.parse(readFileSync('assets/maps/city1_h.json'));
  const map = { data, w: 6144, h: 3840, tileAt: tileLookup(data) };
  const c = spawnCars(map, newPlayer(map), 1)[0]; c.speed = 0;
  for (let i = 0; i < 30; i++) stepCar(map, c, { up: true }, 1 / 30);
  ok(c.speed > 40 && c.speed <= 150, `acceleration after 1s is ${c.speed.toFixed(0)} (40..150)`);
}
process.exit(fail ? 1 : 0);
