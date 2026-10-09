// Pedestrians: wander on sidewalks. Pure logic (no DOM). Reuses hero sprite i_00 with palette variants.
import { DIR, ANIM, blockedAt } from './player.js';
export const PED_SPEED = 28, FLEE_SPEED = 85;
const DIRS = [[-1, 0, DIR.LEFT], [0, -1, DIR.UP], [1, 0, DIR.RIGHT], [0, 1, DIR.DOWN]];
export const onWalk = (map, x, y) => map.tileAt(x, y).collision === 1;
const canStand = (map, x, y) => !blockedAt(map, x, y) && onWalk(map, x, y);

export function newPed(x, y, pal, rnd = Math.random, kind = 'man') {
  const d = DIRS[Math.floor(rnd() * 4)];
  return { x, y, kind, down: 0, dir: d[2], vx: d[0], vy: d[1], pal, moving: true, wait: 0, turn: 1 + rnd() * 3, t: rnd() * 5 };
}

export function stepPed(map, p, dt, rnd = Math.random) {
  p.t += dt;
  if (p.dead) { p.deadT = (p.deadT || 0) + dt; p.moving = false; return p; }
  if (p.down > 0) { p.down -= dt; p.moving = false; return p; }   // knocked over, gets up later
  if (p.wait > 0) { p.wait -= dt; p.moving = false; return p; }
  p.moving = true;
  const spd = p.flee > 0 ? FLEE_SPEED : PED_SPEED; if (p.flee > 0) p.flee -= dt;
  const nx = p.x + p.vx * spd * dt, ny = p.y + p.vy * spd * dt;
  p.turn -= dt;
  if (!canStand(map, nx, ny)) {                       // hit a wall / kerb: pick another free direction (or wait)
    const opts = DIRS.filter(d => canStand(map, p.x + d[0] * 6, p.y + d[1] * 6));
    if (!opts.length) { p.wait = 1; return p; }
    const d = opts[Math.floor(rnd() * opts.length)];
    p.vx = d[0]; p.vy = d[1]; p.dir = d[2]; p.turn = 1 + rnd() * 3;
    if (rnd() < 0.3) p.wait = 0.5 + rnd() * 2;
    return p;
  }
  p.x = nx; p.y = ny;
  if (p.turn <= 0) {                                  // occasionally stop or change direction
    p.turn = 1 + rnd() * 4;
    if (rnd() < 0.35) p.wait = 0.5 + rnd() * 2.5;
    else { const d = DIRS[Math.floor(rnd() * 4)]; if (canStand(map, p.x + d[0] * 6, p.y + d[1] * 6)) { p.vx = d[0]; p.vy = d[1]; p.dir = d[2]; } }
  }
  return p;
}
// i_00 holds men (groups of 30 per direction, lying = +27) and women (208.., groups of 5: idle, walk, run, run, lying)
const WOMAN = { [DIR.LEFT]: 208, [DIR.UP]: 213, [DIR.RIGHT]: 218, [DIR.DOWN]: 223 };
export const pedAnim = p => p.kind === 'woman'
  ? WOMAN[p.dir] + (p.down > 0 || p.dead ? 4 : p.moving ? (p.flee > 0 ? ANIM.RUN : ANIM.WALK) : ANIM.IDLE)
  : p.dir + (p.down > 0 || p.dead ? 27 : p.moving ? (p.flee > 0 ? ANIM.RUN : ANIM.WALK) : ANIM.IDLE);

export function spawnPeds(map, around, n = 14, rnd = Math.random) {
  const T = map.data.tileSize, out = [], R = 22;
  for (let tries = 0; tries < 4000 && out.length < n; tries++) {
    const x = around.x + (rnd() * 2 - 1) * R * T, y = around.y + (rnd() * 2 - 1) * R * T;
    if (!canStand(map, x, y) || Math.hypot(x - around.x, y - around.y) < 60) continue;
    if (out.some(o => Math.hypot(o.x - x, o.y - y) < 24)) continue;
    { const woman = out.length % 3 === 2; out.push(newPed(x, y, woman ? 0 : 1 + out.length % 3, rnd, woman ? 'woman' : 'man')); }
  }
  return out;
}

// Removes bodies that lay long enough and spawns new pedestrians out of sight so the streets stay populated.
export function topUpPeds(map, around, peds, n = 14, rnd = Math.random, minR = 220, maxR = 520) {
  for (let i = peds.length - 1; i >= 0; i--) if ((peds[i].dead && peds[i].deadT > 12) || (!peds[i].dead && Math.hypot(peds[i].x - around.x, peds[i].y - around.y) > maxR + 300)) peds.splice(i, 1);
  for (let tries = 0; tries < 20 && peds.length < n; tries++) {
    const a = rnd() * Math.PI * 2, r = minR + rnd() * (maxR - minR), x = around.x + Math.cos(a) * r, y = around.y + Math.sin(a) * r;
    if (!canStand(map, x, y) || peds.some(o => Math.hypot(o.x - x, o.y - y) < 24)) continue;
    const woman = rnd() < 0.34; peds.push(newPed(x, y, woman ? 0 : 1 + Math.floor(rnd() * 3), rnd, woman ? 'woman' : 'man'));
  }
  return peds;
}
