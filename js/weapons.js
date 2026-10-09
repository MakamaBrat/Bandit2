// Weapons and bullets (pure logic). i_00 hero pose layout inside each 30-anim direction group:
// weapon k (0 pistol, 1 shotgun, 2 assault rifle): hold = 3 + 2k, fire = hold + 1 (aiming straight in the facing direction).
import { DIR } from './player.js';
export const WEAPONS = [
  { name: 'Пистолет', cd: 0.30, speed: 300, range: 220, pellets: 1, spread: 0 },
  { name: 'Дробовик', cd: 0.80, speed: 280, range: 140, pellets: 5, spread: 0.25 },
  { name: 'Автомат', cd: 0.09, speed: 340, range: 260, pellets: 1, spread: 0.04 },
];
const V = { [DIR.LEFT]: [-1, 0], [DIR.UP]: [0, -1], [DIR.RIGHT]: [1, 0], [DIR.DOWN]: [0, 1] };
export const arm = p => { p.weapon = 0; p.cool = 0; p.since = 99; return p; };
export const nextWeapon = p => { p.weapon = (p.weapon + 1) % WEAPONS.length; p.since = 0.5; return p; };
export const stepArm = (p, dt) => { p.cool = Math.max(0, p.cool - dt); p.since += dt; };

export function fire(p, rnd = Math.random) {
  const w = WEAPONS[p.weapon];
  if (!w || p.cool > 0 || p.down > 0) return [];
  p.cool = w.cd; p.since = 0;
  const [vx, vy] = V[p.dir], a0 = Math.atan2(vy, vx), out = [];
  for (let i = 0; i < w.pellets; i++) {
    const a = a0 + (rnd() * 2 - 1) * w.spread;
    out.push({ x: p.x + vx * 12, y: p.y + vy * 6, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, left: w.range, owner: 'hero' });
  }
  return out;
}
export const armAnim = p => (p.weapon < 0 || p.weapon == null || p.moving || p.down > 0 || p.since > 0.7) ? null : p.dir + 3 + 2 * p.weapon + (p.since < 0.1 ? 1 : 0);

const inCar = (c, x, y) => { const h = c.heading * Math.PI / 180, dx = x - c.x, dy = y - c.y, f = dx * Math.cos(h) - dy * Math.sin(h), s = dx * Math.sin(h) + dy * Math.cos(h); return Math.abs(f) < 15 && Math.abs(s) < 7; };

// Moves bullets (array is filtered in place), returns the pedestrians that were shot.
// ctx (optional): { cops, hero, driving, onHit(kind, target) } - hero bullets hurt cops, cop bullets hurt the hero (or the car the hero drives).
export function stepBullets(map, bullets, peds, cars, dt, ctx = {}) {
  const hits = [];
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i], sp = Math.hypot(b.vx, b.vy), n = Math.max(1, Math.ceil(sp * dt / 4)), sx = b.vx * dt / n, sy = b.vy * dt / n;
    let dead = false;
    for (let k = 0; k < n && !dead; k++) {
      b.x += sx; b.y += sy; b.left -= Math.hypot(sx, sy);
      if (b.left <= 0 || map.tileAt(b.x, b.y).collision === 2) { dead = true; break; }
      if (b.owner !== 'cop') for (const q of peds) if (!q.dead && Math.abs(q.x - b.x) < 6 && Math.abs(q.y - b.y) < 8) { q.dead = true; q.deadT = 0; q.down = 30; hits.push(q); dead = true; break; }
      if (!dead && b.owner === 'hero' && ctx.cops) for (const k of ctx.cops) if (!k.dead && Math.abs(k.x - b.x) < 6 && Math.abs(k.y - b.y) < 8) { k.hp -= 1; if (k.hp <= 0) { k.dead = true; k.deadT = 0; } ctx.onHit && ctx.onHit('cop', k); dead = true; break; }
      if (!dead && b.owner === 'cop' && ctx.hero && !ctx.driving && !ctx.hero.dead && Math.abs(ctx.hero.x - b.x) < 7 && Math.abs(ctx.hero.y - b.y) < 8) { ctx.onHit && ctx.onHit('hero', b); dead = true; }
      if (!dead) for (const c of cars) if (inCar(c, b.x, b.y)) { if (b.owner === 'cop' && c === ctx.driving) ctx.onHit && ctx.onHit('hero', b); dead = true; break; }
    }
    if (dead) bullets.splice(i, 1);
  }
  return hits;
}

// Frightens pedestrians near (x, y): they run away from it for a few seconds.
export function scare(peds, x, y, r = 170) {
  for (const q of peds) {
    if (q.dead || q.down > 0) continue;
    const dx = q.x - x, dy = q.y - y; if (Math.hypot(dx, dy) > r) continue;
    q.flee = 4; q.wait = 0;
    if (Math.abs(dx) > Math.abs(dy)) { q.vx = Math.sign(dx) || 1; q.vy = 0; q.dir = q.vx < 0 ? DIR.LEFT : DIR.RIGHT; }
    else { q.vy = Math.sign(dy) || 1; q.vx = 0; q.dir = q.vy < 0 ? DIR.UP : DIR.DOWN; }
  }
}
