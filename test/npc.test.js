import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newPlayer, blockedAt } from '../js/player.js';
import { spawnPeds, stepPed, onWalk } from '../js/ped.js';
import { spawnTraffic, stepTraffic } from '../js/traffic.js';
import { carBlocked } from '../js/vehicle.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
for (const tag of ['city1_h', 'city2_s']) {
  const data = JSON.parse(readFileSync(`assets/maps/${tag}.json`));
  const map = { data, w: data.blocksW * data.tilesPerBlockW * 24, h: data.blocksH * data.tilesPerBlockH * 24, tileAt: tileLookup(data) };
  const hero = newPlayer(map);
  const peds = spawnPeds(map, hero, 14), cars = spawnTraffic(map, hero, 8);
  ok(peds.length >= 10, `${tag}: spawned ${peds.length} pedestrians`);
  ok(cars.length >= 5, `${tag}: spawned ${cars.length} traffic cars`);
  let bad = 0, moved = 0;
  for (const p of peds) for (let i = 0; i < 6000; i++) { const x = p.x, y = p.y; stepPed(map, p, 1 / 30); if (blockedAt(map, p.x, p.y) || !onWalk(map, p.x, p.y)) bad++; moved += Math.hypot(p.x - x, p.y - y); }
  ok(bad === 0, `${tag}: pedestrians always on free sidewalk (${Math.round(moved)} px walked)`);
  let carBad = 0, dist = 0, offRoad = 0;
  for (let i = 0; i < 6000; i++) for (const c of cars) {
    const x = c.x, y = c.y; stepTraffic(map, c, [...cars, hero, ...peds], 1 / 30);
    if (carBlocked(map, c.x, c.y, c.heading)) carBad++; if (map.tileAt(c.x, c.y).collision === 1) offRoad++; dist += Math.hypot(c.x - x, c.y - y);
  }
  ok(carBad === 0, `${tag}: traffic never inside a wall (${Math.round(dist)} px driven)`);
  ok(dist / cars.length > 1500, `${tag}: traffic keeps moving (avg ${Math.round(dist / cars.length)} px per car)`);
  console.log(`  info: ${offRoad} car-steps on sidewalk of ${6000 * cars.length}`);
}
process.exit(fail ? 1 : 0);
