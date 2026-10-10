// Car damage, smoke, fire, explosion and wrecks (pure logic). hp / hpMax decide the stage:
//   > 50%: fine | 25..50%: light grey smoke | 0..25%: heavy black smoke and flames | 0: burning, explodes after a few seconds -> a burning wreck.
import { fwd, HL } from './vehicle.js';
import { launchBody } from './collide.js';
export const health = c => Math.max(0, c.hp / (c.hpMax || 100));
export const stage = c => c.wreck ? 'wreck' : c.hp <= 0 ? 'burning' : health(c) < 0.25 ? 'heavy' : health(c) < 0.5 ? 'smoke' : 'ok';
export const isUsable = c => !c.wreck && c.hp > 0;                       // can be entered / driven
export function damageCar(c, amount) { if (c.wreck || !(amount > 0)) return false; const was = c.hp > 0; c.hp = Math.max(0, c.hp - amount); return was && c.hp <= 0; }
export const damageFromCrash = (c, impact) => damageCar(c, (c.hpMax || 100) * Math.max(0, impact - 30) / 420);
export const damageFromWall = (c, v) => damageCar(c, (c.hpMax || 100) * Math.max(0, v - 70) / 600);

// Advances the fire of one car; returns events [{ type: 'smoke' | 'flame' | 'explode', x, y, heavy }] for the effects layer.
export function stepCarFire(c, dt, rnd = Math.random) {
  const ev = [], st = stage(c); c.acc = (c.acc || 0);
  const [fx, fy] = fwd(c.heading), hx = c.x + fx * HL * 0.55, hy = c.y + fy * HL * 0.55;        // the engine bay
  const emit = (rate, make) => { c.acc += dt * rate; while (c.acc >= 1) { c.acc -= 1; ev.push(make()); } };
  if (st === 'ok') { c.acc = 0; return ev; }
  if (st === 'smoke') emit(9, () => ({ type: 'smoke', x: hx + (rnd() - 0.5) * 8, y: hy, heavy: false }));
  else if (st === 'heavy') { emit(16, () => ({ type: rnd() < 0.3 ? 'flame' : 'smoke', x: hx + (rnd() - 0.5) * 8, y: hy, heavy: true })); }
  else if (st === 'burning') {
    c.burn = (c.burn || 0) + dt; c.fuse = c.fuse || (2.5 + rnd() * 1.5);
    emit(34, () => ({ type: rnd() < 0.55 ? 'flame' : 'smoke', x: c.x + (rnd() - 0.5) * 28, y: c.y + (rnd() - 0.5) * 8, heavy: true }));
    if (c.burn >= c.fuse) { c.wreck = true; c.ai = false; c.speed = 0; c.kx = c.ky = c.spin = 0; c.fireT = 16 + rnd() * 6; c.smolder = 55; c.hp = 0; ev.push({ type: 'explode', x: c.x, y: c.y }); }
  } else if (st === 'wreck') {
    c.fireT = Math.max(0, (c.fireT || 0) - dt); c.smolder = Math.max(0, (c.smolder || 0) - dt);
    if (c.fireT > 0) emit(24, () => ({ type: rnd() < 0.6 ? 'flame' : 'smoke', x: c.x + (rnd() - 0.5) * 30, y: c.y + (rnd() - 0.5) * 10, heavy: true }));
    else if (c.smolder > 0) emit(5, () => ({ type: 'smoke', x: c.x + (rnd() - 0.5) * 24, y: c.y + (rnd() - 0.5) * 8, heavy: false }));
  }
  return ev;
}
export const burning = c => !c.wreck ? c.hp <= 0 : (c.fireT || 0) > 0;     // on fire right now (crackling, hurts those standing in it)

// The blast of an exploding car at (c.x, c.y). world = { peds, cops, hero, cars, driving }. Returns what happened for scoring / effects.
export const BLAST_R = 80;
export function explode(c, world, rnd = Math.random) {
  const out = { killed: [], hurtCops: [], killedCops: [], heroDamage: 0, hitCars: [] };
  const R = BLAST_R, away = (o) => { const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d, d]; };
  for (const q of world.peds || []) { if (q.dead) continue; const [ux, uy, d] = away(q); if (d > R) continue;
    if (d < R * 0.65) { q.dead = true; q.deadT = 0; q.down = 30; q.lie = { x: ux, y: uy }; out.killed.push(q); } else q.down = 4;
    launchBody(q, ux, uy, 130 * (1 - d / R) + 50, 150 + 100 * (1 - d / R), rnd); }
  for (const k of world.cops || []) { if (k.dead) continue; const [ux, uy, d] = away(k); if (d > R) continue;
    k.hp -= Math.max(1, Math.ceil(3 * (1 - d / R) + 0.3)); k.down = 3.5; k.aiming = false; k.lie = { x: ux, y: uy };
    if (k.hp <= 0) { k.dead = true; k.deadT = 0; k.down = 30; out.killedCops.push(k); } else out.hurtCops.push(k);
    launchBody(k, ux, uy, 120 * (1 - d / R) + 40, 140 + 90 * (1 - d / R), rnd); }
  const h = world.hero;
  if (h) {
    if (world.driving === c) { out.heroDamage = 55; }
    else if (!h.dead) { const [ux, uy, d] = away(h); if (d <= R) { out.heroDamage = Math.round(45 * (1 - d / R)) + 8; if (h.down <= 0) { h.down = 1.6; h.lie = { x: ux, y: uy }; launchBody(h, ux, uy, 110 * (1 - d / R) + 40, 140 + 80 * (1 - d / R), rnd); } } }
  }
  for (const o of world.cars || []) { if (o === c || o.wreck) continue; const [ux, uy, d] = away(o); if (d > R * 1.2) continue;
    const k = 1 - d / (R * 1.2); o.kx = (o.kx || 0) + ux * 140 * k; o.ky = (o.ky || 0) + uy * 140 * k; o.spin = (o.spin || 0) + (rnd() - 0.5) * 220 * k; damageCar(o, (o.hpMax || 100) * 0.45 * k); out.hitCars.push(o); }
  return out;
}
