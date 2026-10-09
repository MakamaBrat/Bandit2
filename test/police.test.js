import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newPlayer, blockedAt, DIR } from '../js/player.js';
import { stepBullets } from '../js/weapons.js';
import { newCop, stepCop, copAnim, newWanted, addHeat, stars, stepWanted, manageCops, hurtHero, reviveHero, sees, COPS_FOR } from '../js/police.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
for (const tag of ['city1_h', 'city2_s']) {
  const data = JSON.parse(readFileSync(`assets/maps/${tag}.json`));
  const map = { data, w: data.blocksW * data.tilesPerBlockW * 24, h: data.blocksH * data.tilesPerBlockH * 24, tileAt: tileLookup(data) };
  const hero = newPlayer(map), w = newWanted();
  ok(stars(w) === 0, `${tag}: no stars at start`);
  addHeat(w, 30); ok(stars(w) === 1, '30 heat = 1 star'); addHeat(w, 40); ok(stars(w) === 3 || stars(w) === 2, `70 heat = ${stars(w)} stars`); addHeat(w, 999); ok(stars(w) === 3 && w.heat === 100, 'max 3 stars');
  const cops = []; manageCops(map, w, cops, hero.x, hero.y);
  ok(cops.length === COPS_FOR[3], `${tag}: 3 stars -> ${cops.length} cops`);
  ok(cops.every(c => !blockedAt(map, c.x, c.y) && Math.hypot(c.x - hero.x, c.y - hero.y) > 200), 'cops spawn on free ground, away from the hero');
  // chase simulation: cops reach the hero, shoot, and bullets hurt the hero
  const bullets = []; let hits = 0, bad = 0, minD = 1e9; hero.hp = 100;
  for (let i = 0; i < 30 * 90 && !hero.dead; i++) {
    for (const c of cops) { const b = stepCop(map, c, hero.x, hero.y, 1 / 30); if (b) bullets.push(b); if (blockedAt(map, c.x, c.y)) bad++; minD = Math.min(minD, Math.hypot(c.x - hero.x, c.y - hero.y)); }
    stepBullets(map, bullets, [], [], 1 / 30, { cops, hero, onHit: k => { if (k === 'hero') { hits++; hurtHero(hero, 8); } } });
  }
  ok(bad === 0, `${tag}: cops never walk into walls`); ok(minD < 200, `${tag}: cops close in (closest ${Math.round(minD)}px)`); ok(hits > 0, `${tag}: cop bullets hit the hero (${hits} hits, hp ${hero.hp})`);
  if (hero.dead) { reviveHero(hero, 100, 100); ok(hero.hp === 100 && !hero.dead, 'hero can be revived'); }
}
{ // line of sight + shooting a cop
  const data = JSON.parse(readFileSync('assets/maps/city1_h.json'));
  const map = { data, w: 6144, h: 3840, tileAt: tileLookup(data) };
  const c = newCop(3000, 2000); const bs = [];
  for (let k = 0; k < 3; k++) bs.push({ x: 2970, y: 2000, vx: 300, vy: 0, left: 200, owner: 'hero' });
  const seen = []; for (let i = 0; i < 40; i++) stepBullets(map, bs, [], [], 1 / 30, { cops: [c], onHit: (kk, t) => seen.push(kk) });
  ok(c.dead && seen.length === 3, `3 pistol hits kill a cop (hp now ${c.hp})`); ok(copAnim(c) % 11 === 10 || [174, 185, 196, 207].includes(copAnim(c)), `dead cop uses lying anim (${copAnim(c)})`);
  const w = newWanted(); addHeat(w, 50); const far = []; for (let i = 0; i < 100; i++) stepWanted(w, far, 0, 0, 1); ok(stars(w) === 0, 'heat fades when no cop is near'); }
{ const p = { x: 1, y: 1 }; hurtHero(p, 60); ok(p.hp === 40 && !p.dead, 'hero hurt'); ok(hurtHero(p, 60) === true && p.dead && p.hp === 0, 'hero dies at 0 hp'); }
process.exit(fail ? 1 : 0);
