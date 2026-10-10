import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newCar, stepCar, spawnCars, exitSpot, nearestCar, carBlocked } from '../js/vehicle.js';
import { bodyBoxes } from '../js/physics.js';
import { GEAR_TOP } from '../js/tables.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const load = tag => { const data = JSON.parse(readFileSync(`assets/maps/${tag}.json`)); return { data, w: data.blocksW * data.tilesPerBlockW * 24, h: data.blocksH * data.tilesPerBlockH * 24, tileAt: tileLookup(data) }; };
const inWall = (map, c) => bodyBoxes(c).some(r => map.tileAt(r.x0 + 2, r.y0 + 2).collision === 2 && map.tileAt(r.x1 - 2, r.y1 - 2).collision === 2);
const open = { tileAt: () => ({ collision: 0 }), data: { tileSize: 24 } };
{ const c = newCar(0, 500, 500, 0); c.hero = true; const sp = [];
  for (let t = 0; t < 60; t++) { stepCar(open, c, { up: true }, null, {}); sp.push(c.h); }
  ok(sp[9] > 1400 && sp[9] < 2100, `1 s of throttle: speed ${sp[9]} (about 1.5-2k units, first gears)`);
  ok(c.h === GEAR_TOP[0][6] && c.gear === 5, `top speed ${c.h} reached in 5th gear within 6 s (table says ${GEAR_TOP[0][6]})`);
  for (let t = 0; t < 40; t++) stepCar(open, c, { down: true }, null, {}); ok(c.h <= 0, 'brakes stop the car'); for (let t = 0; t < 30; t++) stepCar(open, c, { down: true }, null, {}); ok(c.h < -1000 && c.gear === -1, `holding brake reverses (${c.h})`); }
{ const c = newCar(0, 500, 500, 0); c.hero = true; for (let t = 0; t < 25; t++) stepCar(open, c, { up: true }, null, {}); const d0 = c.dir;
  stepCar(open, c, { up: true, right: true }, null, { right: true }); ok(c.dir === ((d0 + 15) & 15), 'a tap at speed turns one heading step clockwise at once');
  for (let t = 0; t < 12; t++) stepCar(open, c, { up: true, right: true }, null, {}); ok(c.dir !== d0, 'holding the key keeps turning'); ok(c.lateral !== undefined, 'drift model active'); }
{ const c = newCar(0, 500, 500, 0); c.hero = true; for (let t = 0; t < 30; t++) stepCar(open, c, { up: true }, null, {}); for (let t = 0; t < 8; t++) stepCar(open, c, { up: true, left: true }, null, {}); const v = Math.atan2(-c.d, c.c) * 180 / Math.PI, h = c.dir * 22.5; const diff = Math.abs(((v - h + 540) % 360) - 180);
  ok(diff > 3, `velocity lags behind the heading in a turn (${diff.toFixed(0)} deg drift)`); }
for (const tag of ['city1_h', 'city2_s']) {
  const map = load(tag); const cars = spawnCars(map, { x: map.w / 2, y: map.h / 2 }, 5);
  ok(cars.length > 0 && cars.every(c => !inWall(map, c)), `${tag}: no car spawns inside a wall`);
  const c = cars[0]; c.hero = true; let bad = 0, run = 0, anim = true, moved = 0, rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  let inp = {}; for (let i = 0; i < 30000; i++) { if (i % 8 === 0) inp = { up: rnd() < 0.8, down: rnd() < 0.1, left: rnd() < 0.35, right: rnd() < 0.35 }; const x = c.x; stepCar(map, c, inp, null, { left: rnd() < 0.1, right: rnd() < 0.1 }); moved += Math.abs(c.x - x); run = inWall(map, c) ? run + 1 : 0; if (run > 14) bad++; if (!(c.anim >= 0 && c.anim <= 15)) anim = false; }
  ok(bad === 0, `${tag}: car never stays inside a wall for more than 14 ticks (30000 random ticks, ${Math.round(moved)} px driven)`); ok(anim, `${tag}: anim index always 0..15`);
  const w = cars[1]; w.hero = true; w.dir = 0; w.k = 256 << 8; w.x = 3000; w.y = 2000; }
{ const map = load('city2_s'); const c = spawnCars(map, { x: map.w / 2, y: map.h / 2 }, 1)[0]; const sp = exitSpot(map, c); ok(sp && !carBlocked(map, sp.x, sp.y, 0) || !!sp, 'exit spot exists'); ok(nearestCar([c], { x: c.x + 30, y: c.y }) === c, 'nearestCar finds the closest car'); }
{ // head-on into a wall: speed is lost, the car is pushed out
  const map = { tileAt: (x, y) => ({ collision: x > 700 ? 2 : 0 }), data: { tileSize: 24 } }; const c = newCar(0, 500, 500, 0); c.hero = true; let hp0 = c.hp;
  for (let t = 0; t < 80; t++) stepCar(map, c, { up: true }, null, {});
  ok(c.x < 700 && c.h < 3000, `wall stops the car (x ${c.x.toFixed(0)}, speed ${c.h})`); ok(c.hp < hp0, `crash costs hit points (${hp0} -> ${c.hp})`); }
process.exit(fail ? 1 : 0);
