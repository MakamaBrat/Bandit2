// Collisions between entities (pure logic). Car box is HL x HW around the car centre; car angle h: forward = (cos h, -sin h).
import { fwd, side, carBlocked, HL, HW } from './vehicle.js';
import { blockedAt } from './player.js';
const HIT_SPEED = 35;
const local = (c, o) => { const [fx, fy] = fwd(c.heading), [sx, sy] = side(c.heading), dx = o.x - c.x, dy = o.y - c.y; return { f: dx * fx + dy * fy, s: dx * sx + dy * sy }; };

// A moving car knocks over pedestrians (and the hero on foot) and launches them. Returns the list of things hit.
export function carHits(map, c, peds, hero, rnd = Math.random, cops = []) {
  const hit = [];
  if (Math.abs(c.speed) < HIT_SPEED) return hit;
  const [fx, fy] = fwd(c.heading), dir = Math.sign(c.speed), v = Math.abs(c.speed);
  for (const o of [...peds, ...cops, ...(hero ? [hero] : [])]) {
    if (o.down > 0 || o.dead) continue;
    const { f, s } = local(c, o);
    if (Math.abs(f) < HL + 3 && Math.abs(s) < HW + 3) {
      o.down = o === hero ? 1.4 : 6; hit.push(o);
      if (cops.includes(o)) { o.hp -= Math.max(1, Math.round(v / 35)); o.down = 3.5; o.aiming = false; if (o.hp <= 0) { o.dead = true; o.deadT = 0; o.down = 30; } }   // a cop takes damage by impact speed
      const [sx, sy] = side(c.heading), sg = s >= 0 ? 1 : -1, launch = 40 + v * 0.9, lat = sg * (25 + rnd() * 35);
      o.fly = { vx: fx * dir * launch + sx * lat, vy: fy * dir * launch + sy * lat, z: 0, vz: 100 + v * 0.7, rot: 0, spin: (rnd() < 0.5 ? -1 : 1) * (10 + rnd() * 8), v };
      o.lie = { x: o.fly.vx, y: o.fly.vy };
      c.speed *= 0.88;
    }
  }
  return hit;
}

// Launch a body (pedestrian, cop, hero) along (ux, uy): speed px/s horizontally, vz px/s upwards.
export function launchBody(o, ux, uy, speed, vz, rnd = Math.random) {
  o.fly = { vx: ux * speed, vy: uy * speed, z: 0, vz, rot: 0, spin: (rnd() < 0.5 ? -1 : 1) * (10 + rnd() * 8), v: speed };
  o.lie = { x: ux, y: uy };
}

// Flight of a launched pedestrian / hero: arc with gravity, bounces, slides to a stop. Walls stop the slide.
export function flyStep(map, o, dt) {
  const f = o.fly; if (!f) return false;
  const nx = o.x + f.vx * dt, ny = o.y + f.vy * dt;
  if (!blockedAt(map, nx, o.y)) o.x = nx; else f.vx *= -0.3;
  if (!blockedAt(map, o.x, ny)) o.y = ny; else f.vy *= -0.3;
  f.z += f.vz * dt; f.vz -= 520 * dt; f.rot += f.spin * dt;
  if (f.z <= 0) { f.z = 0; if (f.vz < -80) { f.vz = -f.vz * 0.35; f.spin *= 0.5; f.hard = true; } else f.vz = 0; }
  if (f.z === 0) { const d = Math.exp(-5 * dt); f.vx *= d; f.vy *= d; f.spin *= Math.exp(-6 * dt); }
  if (f.z === 0 && f.vz === 0 && Math.hypot(f.vx, f.vy) < 8) { o.fly = null; return false; }
  return true;
}

// ---- car vs car: oriented rectangles (separating axis test), push apart, impulse, spin ----
const SPIN = 0.07, RESTITUTION = 0.35;
const ax2 = h => { const [fx, fy] = fwd(h), [sx, sy] = side(h); return [[fx, fy], [sx, sy]]; };
const dot = (u, v) => u[0] * v[0] + u[1] * v[1];
// null when the cars do not overlap, otherwise { depth, n (from a to b), x, y (contact point) }
export function obbOverlap(a, b) {
  const A = ax2(a.heading), B = ax2(b.heading), dx = b.x - a.x, dy = b.y - a.y; let best = null;
  for (const ax of [A[0], A[1], B[0], B[1]]) {
    const ra = HL * Math.abs(dot(A[0], ax)) + HW * Math.abs(dot(A[1], ax)), rb = HL * Math.abs(dot(B[0], ax)) + HW * Math.abs(dot(B[1], ax));
    const d = dx * ax[0] + dy * ax[1], ov = ra + rb - Math.abs(d);
    if (ov <= 0) return null;
    if (!best || ov < best.depth) { const n = d >= 0 ? ax : [-ax[0], -ax[1]]; best = { depth: ov, n, x: a.x + n[0] * (ra - ov / 2), y: a.y + n[1] * (ra - ov / 2) }; }
  }
  return best;
}
const vel = c => { const [fx, fy] = fwd(c.heading); return [fx * c.speed + (c.kx || 0), fy * c.speed + (c.ky || 0)]; };
function setVel(c, v) { const [fx, fy] = fwd(c.heading), s = v[0] * fx + v[1] * fy; c.speed = Math.max(-60, Math.min(160, s)); c.kx = v[0] - fx * s; c.ky = v[1] - fy * s; }

// Returns false, or { x, y, nx, ny, impact } (impact = closing speed along the normal, px/s)
export function carVsCar(map, a, b) {
  if (a.wreck && b.wreck) return false;
  if (Math.hypot(a.x - b.x, a.y - b.y) > 2 * Math.hypot(HL, HW)) return false;
  const o = obbOverlap(a, b); if (!o) return false;
  const [nx, ny] = o.n, push = o.depth / 2 + 0.5, snap = a.wreck ? a : b.wreck ? b : null, keep = snap && { x: snap.x, y: snap.y };
  const finish = r => { if (snap) { snap.x = keep.x; snap.y = keep.y; snap.speed = 0; snap.kx = snap.ky = snap.spin = 0; } return r; };
  const ax = a.x - nx * push, ay = a.y - ny * push, bx = b.x + nx * push, by = b.y + ny * push;
  const aOk = !carBlocked(map, ax, ay, a.heading), bOk = !carBlocked(map, bx, by, b.heading);
  if (a.wreck) { if (!carBlocked(map, b.x + nx * push * 2, b.y + ny * push * 2, b.heading)) { b.x += nx * push * 2; b.y += ny * push * 2; } }
  else if (b.wreck) { if (!carBlocked(map, a.x - nx * push * 2, a.y - ny * push * 2, a.heading)) { a.x -= nx * push * 2; a.y -= ny * push * 2; } }
  else if (aOk && bOk) { a.x = ax; a.y = ay; b.x = bx; b.y = by; }
  else if (aOk) { a.x -= nx * push * 2; a.y -= ny * push * 2; } else if (bOk) { b.x += nx * push * 2; b.y += ny * push * 2; }
  const va = vel(a), vb = vel(b), vn = (vb[0] - va[0]) * nx + (vb[1] - va[1]) * ny;
  let impact = 0;
  if (vn < 0) {
    impact = -vn; const j = (1 + RESTITUTION) * impact / 2;
    setVel(a, [va[0] - j * nx, va[1] - j * ny]); setVel(b, [vb[0] + j * nx, vb[1] + j * ny]);
    const cross = (r, fx2, fy2) => r[0] * fy2 - r[1] * fx2;      // screen coordinates (y down): positive = clockwise = heading decreases
    const clampSpin = s => Math.max(-220, Math.min(220, s));
    a.spin = clampSpin((a.spin || 0) - SPIN * cross([o.x - a.x, o.y - a.y], -j * nx, -j * ny));
    b.spin = clampSpin((b.spin || 0) - SPIN * cross([o.x - b.x, o.y - b.y], j * nx, j * ny));
  }
  return finish({ x: o.x, y: o.y, nx, ny, impact });
}

// The hero on foot cannot walk through a car body. Returns true when (x, y) is inside some car's rectangle (with a small margin).
export const insideCar = (cars, x, y, skip) => cars.some(c => c !== skip && carDistRaw(c, x, y) < 3);
function carDistRaw(c, x, y) { const [fx, fy] = fwd(c.heading), [sx, sy] = side(c.heading), dx = x - c.x, dy = y - c.y; return Math.hypot(Math.max(0, Math.abs(dx * fx + dy * fy) - HL), Math.max(0, Math.abs(dx * sx + dy * sy) - HW)); }
// Undo the part of a move that ended inside a car (slides along the body); moving out of a car is always allowed.
export function keepOutOfCars(cars, p, px, py) {
  if (!insideCar(cars, p.x, p.y)) return;
  if (insideCar(cars, px, py)) return;                       // was already inside: let the hero walk out
  const nx = p.x, ny = p.y;
  if (!insideCar(cars, nx, py)) { p.y = py; return; }
  if (!insideCar(cars, px, ny)) { p.x = px; return; }
  p.x = px; p.y = py;
}
