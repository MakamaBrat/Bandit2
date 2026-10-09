import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newPlayer, step, animIndex } from '../js/player.js';
import { newPed, stepPed, pedAnim } from '../js/ped.js';
import { newCar, fwd } from '../js/vehicle.js';
import { carHits, carVsCar } from '../js/collide.js';
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
process.exit(fail ? 1 : 0);
