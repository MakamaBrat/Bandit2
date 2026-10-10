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
  if (c.since < 0.1) return b + 4;                       // muzzle flash right after a shot
  if (c.moving) return b + (c.far ? 2 : 1);              // walking / running always wins over the aim pose
  if (c.aiming) return b + 3;
  return b;
}
// time base for the animation: shot / aim poses count from the last shot, everything else from the cop's own clock
export const copAnimTime = c => (c.since < 0.1 || (c.aiming && !c.moving)) ? c.since : c.t;

// clear line of sight: no solid tile between the two points
export function sees(map, ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
  for (let i = 1; i < n; i++) if (solid(map, ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
  return true;
}

// Advances a cop towards (tx, ty); returns a new bullet (or null). Cops line up on an axis with the target and shoot along it.
// Everything has hysteresis so nothing flickers: the firing axis is held for a while, a chosen step direction is held for
// 0.4s, "aligned" turns on at 5px and off only at 12px, and the walking flag is debounced.
const RUN_SPEED = 90;
export function stepCop(map, c, tx, ty, dt, rnd = Math.random) {
  c.t += dt;
  if (c.dead) { c.deadT += dt; c.moving = false; c.aiming = false; return null; }
  c.cool -= dt; c.since += dt; c.moveHold = Math.max(0, (c.moveHold || 0) - dt); c.mvT = Math.max(0, (c.mvT || 0) - dt); c.axisT = (c.axisT || 0) - dt;
  const dx = tx - c.x, dy = ty - c.y, dist = Math.hypot(dx, dy);
  c.far = c.far ? dist > 100 : dist > 140;
  // firing axis: 'h' shoots along x (needs |dy| small), 'v' along y. Switch only when the other one is clearly closer.
  const hP = Math.abs(dy), vP = Math.abs(dx);
  if (!c.axis) { c.axis = hP <= vP ? 'h' : 'v'; c.axisT = 1.2; }
  else if (c.axisT <= 0) { const o = c.axis === 'h' ? 'v' : 'h', pc = c.axis === 'h' ? hP : vP, po = o === 'h' ? hP : vP; if (po + 24 < pc) { c.axis = o; c.axisT = 1.2; } else c.axisT = 0.3; }
  const perp = c.axis === 'h' ? hP : vP, along = c.axis === 'h' ? Math.abs(dx) : Math.abs(dy);
  c.losT = sees(map, c.x, c.y, tx, ty) ? 0.4 : Math.max(0, (c.losT || 0) - dt);
  const inRange = dist < 190 && c.losT > 0 && along > 8;
  c.aligned = inRange && perp <= (c.aligned ? 12 : 5);
  c.aiming = c.aligned || dist < 40;
  if (c.aligned || dist < 40) {                           // stand, face the target, shoot
    c.dir = c.axis === 'h' ? (dx < 0 ? DIR.LEFT : DIR.RIGHT) : (dy < 0 ? DIR.UP : DIR.DOWN);
    if (dist < 40 && !c.aligned) c.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? DIR.LEFT : DIR.RIGHT) : (dy < 0 ? DIR.UP : DIR.DOWN);
    c.moving = c.moveHold > 0; c.mvT = 0;
    if (c.cool <= 0 && c.aligned && perp <= 6) {
      c.cool = 0.9 + rnd() * 0.6; c.since = 0;
      const vx = c.axis === 'h' ? Math.sign(dx) : 0, vy = c.axis === 'v' ? Math.sign(dy) : 0;
      return { x: c.x + vx * 12, y: c.y + vy * 6, vx: vx * 260, vy: vy * 260, left: 230, owner: 'cop' };
    }
    return null;
  }
  // step direction: approach along the larger offset, or sidestep to line up; held for 0.4s once chosen
  if (!(c.mvT > 0)) {
    let mx = 0, my = 0;
    if (dist > 150 || !inRange) { if (Math.abs(dx) > Math.abs(dy)) mx = Math.sign(dx); else my = Math.sign(dy); }
    else if (c.axis === 'h') my = Math.sign(dy) || 1; else mx = Math.sign(dx) || 1;
    c.mvx = mx; c.mvy = my; c.mvT = 0.4;
  }
  const v = (c.far ? RUN_SPEED : COP_SPEED) * dt;
  const tryMove = (ax, ay) => { if (!(ax || ay) || !canStand(map, c.x + ax * v, c.y + ay * v)) return false; c.x += ax * v; c.y += ay * v; c.dir = ax ? (ax < 0 ? DIR.LEFT : DIR.RIGHT) : (ay < 0 ? DIR.UP : DIR.DOWN); return true; };
  if (tryMove(c.mvx, c.mvy)) { c.moveHold = 0.15; c.stuckT = 0; }
  else {                                                   // blocked by a building: after a moment walk around it (a held detour)
    c.mvT = 0; c.stuckT = (c.stuckT || 0) + dt;
    if (c.stuckT > 0.3) { const dirs = c.mvx ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]], d = dirs[Math.floor(rnd() * 2)]; c.mvx = d[0]; c.mvy = d[1]; c.mvT = 0.7 + rnd() * 0.7; c.stuckT = 0; }
  }
  c.moving = c.moveHold > 0;
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
