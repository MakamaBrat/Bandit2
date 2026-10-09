// Police and wanted level (pure logic). i_00 police anims, 11 per direction: +0 idle, +1 walk, +2 run, +3 aim, +4 shoot, +9 hit, +10 lying.
import { DIR, blockedAt } from './player.js';
const BASE = { [DIR.RIGHT]: 164, [DIR.UP]: 175, [DIR.LEFT]: 186, [DIR.DOWN]: 197 };
export const COP_SPEED = 62, COP_HP = 3, COP_DMG = 8;
const solid = (map, x, y) => map.tileAt(x, y).collision === 2;
const canStand = (map, x, y) => !blockedAt(map, x, y);

export const newCop = (x, y) => ({ x, y, dir: DIR.DOWN, hp: COP_HP, dead: false, deadT: 0, cool: 1 + Math.random(), since: 99, moving: false, t: Math.random() * 5, far: false });
export function copAnim(c) {
  const b = BASE[c.dir];
  if (c.dead) return b + 10;
  if (c.since < 0.1) return b + 4;
  if (c.since < 0.6) return b + 3;
  return b + (c.moving ? (c.far ? 2 : 1) : 0);
}

// clear line of sight: no solid tile between the two points
export function sees(map, ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
  for (let i = 1; i < n; i++) if (solid(map, ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
  return true;
}

// Advances a cop towards (tx, ty); returns a new bullet (or null). Cops line up on an axis with the target and shoot along it.
export function stepCop(map, c, tx, ty, dt, rnd = Math.random) {
  c.t += dt;
  if (c.dead) { c.deadT += dt; c.moving = false; return null; }
  c.cool -= dt; c.since += dt;
  const dx = tx - c.x, dy = ty - c.y, dist = Math.hypot(dx, dy), TOL = 4;
  const horiz = Math.abs(dy) <= TOL && Math.abs(dx) > 8, vert = Math.abs(dx) <= TOL && Math.abs(dy) > 8;
  const aligned = (horiz || vert) && dist < 190 && sees(map, c.x, c.y, tx, ty);
  c.moving = false; c.far = dist > 120;
  if (aligned) {
    c.dir = horiz ? (dx < 0 ? DIR.LEFT : DIR.RIGHT) : (dy < 0 ? DIR.UP : DIR.DOWN);
    if (c.cool <= 0) {
      c.cool = 0.9 + rnd() * 0.6; c.since = 0;
      const vx = horiz ? Math.sign(dx) : 0, vy = vert ? Math.sign(dy) : 0;
      return { x: c.x + vx * 12, y: c.y + vy * 6, vx: vx * 260, vy: vy * 260, left: 230, owner: 'cop' };
    }
    return null;
  }
  // move: approach if far, otherwise shift sideways to line up with the target
  let mx = 0, my = 0;
  if (dist > 150) { if (Math.abs(dx) > Math.abs(dy)) mx = Math.sign(dx); else my = Math.sign(dy); }
  else if (Math.abs(dx) < Math.abs(dy)) mx = Math.sign(dx) || 1; else my = Math.sign(dy) || 1;
  const v = COP_SPEED * dt;
  const tryMove = (ax, ay) => { if (!(ax || ay)) return false; if (canStand(map, c.x + ax * v, c.y + ay * v)) { c.x += ax * v; c.y += ay * v; c.dir = ax ? (ax < 0 ? DIR.LEFT : DIR.RIGHT) : (ay < 0 ? DIR.UP : DIR.DOWN); return true; } return false; };
  // detour: blocked by a building for a while -> walk in a random direction for a moment to get around it
  if (c.detour > 0) { c.detour -= dt; if (tryMove(c.dx, c.dy)) { c.moving = true; return null; } c.detour = 0; }
  c.moving = tryMove(mx, my) || tryMove(my ? Math.sign(dx) || 1 : 0, mx ? Math.sign(dy) || 1 : 0);
  c.stuckT = c.moving ? 0 : (c.stuckT || 0) + dt;
  if (c.stuckT > 0.25) { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rnd() * 4)]; c.dx = d[0]; c.dy = d[1]; c.detour = 0.6 + rnd() * 0.8; c.stuckT = 0; }
  return null;
}

// ---- wanted level ----
export const newWanted = () => ({ heat: 0 });
export const addHeat = (w, n) => { w.heat = Math.min(100, w.heat + n); };
export const stars = w => w.heat <= 0 ? 0 : Math.min(3, Math.ceil(w.heat / 34));
export const COPS_FOR = [0, 2, 4, 6];
export function stepWanted(w, cops, tx, ty, dt) {
  if (w.heat <= 0) return;
  const near = cops.some(c => !c.dead && Math.hypot(c.x - tx, c.y - ty) < 200);
  w.heat = Math.max(0, w.heat - (near ? 0.4 : 3) * dt);
}

// keeps the number of living cops at COPS_FOR[stars], spawning outside the view; removes bodies and cops when the heat is gone
export function manageCops(map, w, cops, tx, ty, rnd = Math.random) {
  for (let i = cops.length - 1; i >= 0; i--) {
    const c = cops[i], far = Math.hypot(c.x - tx, c.y - ty) > 520;
    if ((c.dead && c.deadT > 10) || (stars(w) === 0 && (far || c.dead))) cops.splice(i, 1);
  }
  const want = COPS_FOR[stars(w)];
  for (let tries = 0; tries < 20 && cops.filter(c => !c.dead).length < want; tries++) {
    const a = rnd() * Math.PI * 2, r = 230 + rnd() * 150, x = tx + Math.cos(a) * r, y = ty + Math.sin(a) * r;
    if (canStand(map, x, y) && !cops.some(o => Math.hypot(o.x - x, o.y - y) < 30)) cops.push(newCop(x, y));
  }
  return cops;
}

// ---- hero health ----
export const HERO_HP = 100;
export function hurtHero(p, n) { if (p.hp == null) p.hp = HERO_HP; if (p.dead) return false; p.hp -= n; if (p.hp <= 0) { p.hp = 0; p.dead = true; p.deadT = 0; p.down = 99; return true; } return false; }
export function reviveHero(p, x, y) { p.hp = HERO_HP; p.dead = false; p.deadT = 0; p.down = 0; p.x = x; p.y = y; }
