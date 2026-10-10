// Police and wanted level (pure logic). i_00 police anims, 11 per direction: +0 idle, +1 walk, +2 run, +3 aim, +4 shoot, +9 hit, +10 lying.
import { DIR, blockedAt } from './player.js';
const BASE = { [DIR.RIGHT]: 164, [DIR.UP]: 175, [DIR.LEFT]: 186, [DIR.DOWN]: 197 };
export const COP_SPEED = 62, COP_HP = 3, COP_DMG = 8;
const solid = (map, x, y) => map.tileAt(x, y).collision === 2;
const canStand = (map, x, y) => !blockedAt(map, x, y);

export const newCop = (x, y) => ({ x, y, dir: DIR.DOWN, hp: COP_HP, dead: false, deadT: 0, cool: 1 + Math.random(), since: 99, moving: false, t: Math.random() * 5, far: false });
export function copAnim(c) {
  const b = BASE[c.dir];
  if (c.dead || c.down > 0) return b + 10;               // lying (knocked down by a car or dead)
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

// Cop on foot: runs at the target while it is far, slows down when close, stops at ~73 px and shoots straight at the target in any direction.
// Everything has hysteresis (stand-and-shoot starts at 73 px and ends at 92 px, run/walk switch at 98/75 px, facing changes only when the other
// axis clearly dominates, the walking flag is debounced, detours are held) so he never flickers. Returns a new bullet or null.
export const STOP_DIST = 73, LEAVE_DIST = 92, RUN_SPEED = 85, WALK_SPEED = 40;
export function stepCop(map, c, tx, ty, dt, rnd = Math.random) {
  c.t += dt;
  if (c.dead) { c.deadT += dt; c.moving = false; c.aiming = false; return null; }
  if (c.down > 0) { c.down -= dt; c.moving = false; c.aiming = false; c.since += dt; c.cool = Math.max(c.cool, 0.6); return null; }   // knocked down: gets up after a moment
  c.cool -= dt; c.since += dt; c.moveHold = Math.max(0, (c.moveHold || 0) - dt);
  const dx = tx - c.x, dy = ty - c.y, dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist;
  c.losT = sees(map, c.x, c.y, tx, ty) ? 0.4 : Math.max(0, (c.losT || 0) - dt);
  c.stand = c.stand ? (dist <= LEAVE_DIST && c.losT > 0) : (dist <= STOP_DIST && c.losT > 0);
  c.far = c.far ? dist > 75 : dist > 98;
  const face = () => {                                  // dominant axis wins only when it clearly dominates
    const ax = Math.abs(dx), ay = Math.abs(dy), horiz = c.dir === DIR.LEFT || c.dir === DIR.RIGHT;
    const toH = horiz ? !(ay > ax * 1.35) : ax > ay * 1.35;
    c.dir = toH ? (dx < 0 ? DIR.LEFT : DIR.RIGHT) : (dy < 0 ? DIR.UP : DIR.DOWN);
  };
  if (c.stand) {
    face(); c.aiming = true; c.moving = c.moveHold > 0;
    if (c.cool <= 0) {
      c.cool = 0.9 + rnd() * 0.6; c.since = 0;
      const a = Math.atan2(dy, dx) + (rnd() - 0.5) * 0.16;
      return { x: c.x + ux * 8, y: c.y + uy * 8, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, left: 230, owner: 'cop' };
    }
    return null;
  }
  c.aiming = false;
  const v = (c.far ? RUN_SPEED : WALK_SPEED) * dt;
  const tryMove = (mx, my) => { if (!(mx || my) || !canStand(map, c.x + mx * v, c.y + my * v)) return false; c.x += mx * v; c.y += my * v; return true; };
  let moved = false;
  if (c.detour > 0) { c.detour -= dt; moved = tryMove(c.dx, c.dy); if (!moved) c.detour = 0; }
  if (!moved) moved = tryMove(ux, uy) || tryMove(Math.sign(ux), 0) || tryMove(0, Math.sign(uy));
  if (moved) { c.moveHold = 0.15; c.stuckT = 0; face(); }
  else {                                                   // blocked by a building: after a moment walk around it (a held detour)
    c.stuckT = (c.stuckT || 0) + dt;
    if (c.stuckT > 0.3) { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rnd() * 4)]; c.dx = d[0]; c.dy = d[1]; c.detour = 0.7 + rnd() * 0.7; c.stuckT = 0; }
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
