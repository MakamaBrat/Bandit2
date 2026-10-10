import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newPlayer } from '../js/player.js';
import { carBlocked, HL } from '../js/vehicle.js';
import { carHits } from '../js/collide.js';
import { stepBullets } from '../js/weapons.js';
import { managePoliceCars, stepTraffic, policeCarsFor, spawnTraffic, CIVIL_SPRITES, POLICE_HP } from '../js/traffic.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
ok(policeCarsFor(0) === 0 && policeCarsFor(1) === 0 && policeCarsFor(2) === 1 && policeCarsFor(3) === 2, 'police cars: 0/0/1/2 for 0..3 stars');
for (const tag of ['city1_h', 'city2_s']) {
  const data = JSON.parse(readFileSync(`assets/maps/${tag}.json`));
  const map = { data, w: data.blocksW * data.tilesPerBlockW * 24, h: data.blocksH * data.tilesPerBlockH * 24, tileAt: tileLookup(data) };
  const hero = newPlayer(map);
  ok(spawnTraffic(map, hero, 8).every(c => CIVIL_SPRITES.includes(c.type) && !c.police), `${tag}: civilian traffic never uses the police car body`);
  const cars = []; managePoliceCars(map, 3, hero, cars);
  ok(cars.filter(c => c.police).length === 2, `${tag}: 3 stars spawn 2 police cars`);
  ok(cars.every(c => !carBlocked(map, c.x, c.y, c.heading) && Math.hypot(c.x - hero.x, c.y - hero.y) > 200), 'they appear on free road, away from the hero');
  // chase: the hero stands still; police cars should arrive and stay close
  let bad = 0, minD = 1e9, dEnd = 0;
  for (let i = 0; i < 30 * 90; i++) { managePoliceCars(map, 3, hero, cars); for (const c of cars) { stepTraffic(map, c, cars, 1 / 30); if (carBlocked(map, c.x, c.y, c.heading)) bad++; minD = Math.min(minD, Math.hypot(c.x - hero.x, c.y - hero.y)); } }
  dEnd = Math.min(...cars.filter(c => c.police).map(c => Math.hypot(c.x - hero.x, c.y - hero.y)));
  ok(bad === 0, `${tag}: police cars never overlap walls`); ok(minD < 120, `${tag}: a police car reaches the hero (closest ${Math.round(minD)}px, at the end ${Math.round(dEnd)}px)`);
  // heat gone: far cars are removed, near ones stay until they leave
  const far = [{ police: true, ai: true, x: hero.x + 3000, y: hero.y, heading: 0, speed: 0 }]; managePoliceCars(map, 0, hero, far); ok(far.length === 0, 'with no stars a far police car is removed');
  // a disabled police car stops being police
  const dead = [{ police: true, ai: false, x: 0, y: 0 }]; managePoliceCars(map, 3, hero, dead); ok(dead[0].police === false, 'a wrecked police car is no longer counted');
}
{ const data = JSON.parse(readFileSync('assets/maps/city1_h.json')); const map = { data, w: 6144, h: 3840, tileAt: tileLookup(data) };
  const pc = managePoliceCars(map, 3, newPlayer(map), [])[0]; pc.x = 3000; pc.y = 2000; pc.heading = 0; pc.hp = POLICE_HP;
  const hits = []; const bs = []; for (let k = 0; k < POLICE_HP; k++) bs.push({ x: 2960, y: 2000, vx: 300, vy: 0, left: 200, owner: 'hero' });
  for (let i = 0; i < 80; i++) stepBullets(map, bs, [], [pc], 1 / 30, { onHit: (kind, t) => hits.push(kind) });
  ok(hits.length === POLICE_HP && pc.hp <= 0, `shots wear down a police car (${hits.length} hits, hp ${pc.hp})`);
  const h = newPlayer(map); pc.speed = 100; h.x = pc.x + HL - 2; h.y = pc.y; h.down = 0; ok(carHits(map, pc, [], h).includes(h), 'a police car at speed knocks the hero down'); }
process.exit(fail ? 1 : 0);
