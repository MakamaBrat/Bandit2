import { readFileSync } from 'node:fs';
import { tileLookup } from '../js/engine.js';
import { newPlayer, step, blockedAt, DIR, animIndex } from '../js/player.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
for (const tag of ['city1_h', 'city2_s']) {
  const data = JSON.parse(readFileSync(`assets/maps/${tag}.json`));
  const map = { data, w: data.blocksW * data.tilesPerBlockW * 24, h: data.blocksH * data.tilesPerBlockH * 24, tileAt: tileLookup(data) };
  const p = newPlayer(map);
  ok(!blockedAt(map, p.x, p.y), `${tag}: spawn not blocked (${p.x|0},${p.y|0}, collision ${map.tileAt(p.x, p.y).collision})`);
  let bad = 0, moved = 0; const keys = ['left', 'right', 'up', 'down'];
  for (let i = 0; i < 20000; i++) {
    if (i % 40 === 0) { var inp = {}; for (const k of keys) if (Math.random() < 0.4) inp[k] = true; inp.run = Math.random() < 0.5; }
    const x0 = p.x, y0 = p.y; step(map, p, inp, 1 / 30);
    if (blockedAt(map, p.x, p.y)) bad++; if (p.x !== x0 || p.y !== y0) moved++;
  }
  ok(bad === 0, `${tag}: never entered a solid tile in 20000 random steps (moved ${moved})`);
  ok(p.x >= 0 && p.y >= 0 && p.x < map.w && p.y < map.h, `${tag}: stayed inside the map`);
}
const q = { dir: DIR.RIGHT, moving: true, running: true }; ok(animIndex(q) === DIR.RIGHT + 2, 'anim index run-right = right group + 2');
{ // facing: in i_00 the group that is NOT mirrored for walking faces right (its aim poses point right); the mirrored one faces left
  const an = JSON.parse(readFileSync('assets/sprites/i_00/sprite.json')).animations, flip = a => an[a][0].flip & 1;
  ok(flip(DIR.RIGHT + 1) === 0 && flip(DIR.LEFT + 1) === 1, 'walking right uses the unmirrored group, walking left the mirrored one');
  ok(flip(DIR.RIGHT + 3) === 1 && flip(DIR.LEFT + 3) === 0, 'aim poses are stored the other way round (right group = mirrored aim pose)'); }
process.exit(fail ? 1 : 0);
