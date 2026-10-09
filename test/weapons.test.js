import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newPlayer, DIR } from '../js/player.js';
import { newPed, stepPed, pedAnim, topUpPeds, spawnPeds } from '../js/ped.js';
import { newCar } from '../js/vehicle.js';
import { WEAPONS, arm, nextWeapon, stepArm, fire, armAnim, stepBullets, scare } from '../js/weapons.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const data = JSON.parse(readFileSync('assets/maps/city1_h.json'));
const map = { data, w: data.blocksW * data.tilesPerBlockW * 24, h: data.blocksH * data.tilesPerBlockH * 24, tileAt: tileLookup(data) };
// find a free horizontal corridor to the right of the hero for a clean shot
function place() { const h = arm(newPlayer(map)); h.dir = DIR.RIGHT; return h; }
{ const h = place(), bs = fire(h); ok(bs.length === 1 && h.cool > 0, 'pistol fires one bullet and goes on cooldown'); ok(fire(h).length === 0, 'cannot fire during cooldown');
  stepArm(h, 1); ok(fire(h).length === 1, 'can fire again after cooldown'); }
{ const h = place(); nextWeapon(h); ok(fire(h).length === 5, 'shotgun fires 5 pellets'); nextWeapon(h); ok(WEAPONS[h.weapon].name === 'Автомат', 'third weapon is the assault rifle'); }
{ const h = place(); h.since = 0; ok(armAnim(h) === DIR.RIGHT + 3 + 1, `pistol fire pose = ${armAnim(h)}`); h.since = 0.3; ok(armAnim(h) === DIR.RIGHT + 3, 'pistol hold pose after the shot'); h.since = 2; ok(armAnim(h) === null, 'pose ends after 0.7s'); h.since = 0.3; h.moving = true; ok(armAnim(h) === null, 'moving uses normal walk anim'); }
{ // bullet kills a pedestrian standing in the line of fire
  const h = place(); h.x = 3000; h.y = 2000; const q = newPed(3050, 2000, 1); q.down = 0; const bs = fire(h);
  let hits = []; for (let i = 0; i < 30 && !hits.length; i++) hits = stepBullets(map, bs, [q], [], 1 / 30);
  ok(hits.length === 1 && q.dead, 'bullet kills the pedestrian in front'); ok(bs.length === 0, 'bullet is removed after the hit'); ok(pedAnim(q) % 30 === 27, `dead man uses lying anim (${pedAnim(q)})`);
  const before = { x: q.x, y: q.y }; for (let i = 0; i < 60; i++) stepPed(map, q, 1 / 30); ok(q.x === before.x && q.y === before.y, 'dead pedestrian does not move'); }
{ const h = place(); h.x = 3000; h.y = 2000; const q = newPed(3050, 2030, 1); q.down = 0; const bs = fire(h); let hits = []; for (let i = 0; i < 30; i++) hits.push(...stepBullets(map, bs, [q], [], 1 / 30)); ok(hits.length === 0 && !q.dead, 'bullet misses a pedestrian off the line'); }
{ const h = place(); h.x = 3000; h.y = 2000; const c = newCar('k_00', 3040, 2000, 0); const bs = fire(h); for (let i = 0; i < 30; i++) stepBullets(map, bs, [], [c], 1 / 30); ok(bs.length === 0, 'bullet stops on a car'); }
{ const h = place(); const bs = [{ x: h.x, y: h.y, vx: 300, vy: 0, left: 5000 }]; for (let i = 0; i < 300; i++) stepBullets(map, bs, [], [], 1 / 30); ok(bs.length === 0, 'bullet never flies forever (range/walls)'); }
{ const qs = [newPed(3100, 2000, 1), newPed(3500, 2000, 1)]; qs.forEach(q => q.down = 0); scare(qs, 3000, 2000, 170);
  ok(qs[0].flee > 0 && qs[0].vx === 1, 'nearby pedestrian runs away from the shot'); ok(!(qs[1].flee > 0), 'distant pedestrian is not scared'); ok(pedAnim(qs[0]) % 30 === 2 || pedAnim(qs[0]) >= 208, 'fleeing pedestrian uses run anim'); }
{ const peds = spawnPeds(map, newPlayer(map), 14); peds.slice(0, 5).forEach(q => { q.dead = true; q.deadT = 20; }); for (let i = 0; i < 30; i++) topUpPeds(map, newPlayer(map), peds, 14); ok(peds.filter(q => q.dead).length === 0, 'old bodies are removed'); ok(peds.length >= 12, `population refilled to ${peds.length}`); }
process.exit(fail ? 1 : 0);
