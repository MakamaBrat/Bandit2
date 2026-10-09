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
const q = { dir: DIR.RIGHT, moving: true, running: true }; ok(animIndex(q) === 62, 'anim index run-right = 62');
process.exit(fail ? 1 : 0);
