// Collisions between entities (pure logic). Car box is HL x HW around the car centre; car angle h: forward = (cos h, -sin h).
import { fwd, side, carBlocked, HL, HW } from './vehicle.js';
import { blockedAt } from './player.js';
const HIT_SPEED = 35;
const local = (c, o) => { const [fx, fy] = fwd(c.heading), [sx, sy] = side(c.heading), dx = o.x - c.x, dy = o.y - c.y; return { f: dx * fx + dy * fy, s: dx * sx + dy * sy }; };

// A moving car knocks over pedestrians (and the hero on foot). Returns the list of things hit.
export function carHits(map, c, peds, hero) {
  const hit = [];
  if (Math.abs(c.speed) < HIT_SPEED) return hit;
  const [fx, fy] = fwd(c.heading), dir = Math.sign(c.speed);
  for (const o of [...peds, ...(hero ? [hero] : [])]) {
    if (o.down > 0) continue;
    const { f, s } = local(c, o);
    if (Math.abs(f) < HL + 3 && Math.abs(s) < HW + 3) {
      o.down = o === hero ? 1.2 : 6; hit.push(o);
      const k = Math.min(1, Math.abs(c.speed) / 120) * 14, [sx, sy] = side(c.heading), sg = s >= 0 ? 1 : -1;
      const nx = o.x + (fx * dir * 0.4 + sx * sg * 0.9) * k, ny = o.y + (fy * dir * 0.4 + sy * sg * 0.9) * k;
      if (!blockedAt(map, nx, ny)) { o.x = nx; o.y = ny; }
      c.speed *= 0.85;
    }
  }
  return hit;
}

// Each car is two circles (front and rear); the closest pair decides the overlap.
const circles = c => { const [fx, fy] = fwd(c.heading), o = HL - HW; return [[c.x + fx * o, c.y + fy * o], [c.x - fx * o, c.y - fy * o]]; };
export function carVsCar(map, a, b) {
  if (Math.hypot(a.x - b.x, a.y - b.y) > 2 * HL + 4) return false;
  let best = null;
  for (const [ax, ay] of circles(a)) for (const [bx, by] of circles(b)) { const d = Math.hypot(bx - ax, by - ay); if (!best || d < best.d) best = { d, dx: bx - ax, dy: by - ay }; }
  const min = 2 * HW, d = best.d || 0.001;
  if (d >= min) return false;
  const nx = best.dx / d, ny = best.dy / d, push = (min - d) / 2;
  for (const [c, sg] of [[a, -1], [b, 1]]) {
    const x = c.x + nx * push * sg, y = c.y + ny * push * sg;
    if (!carBlocked(map, x, y, c.heading)) { c.x = x; c.y = y; }
  }
  const sa = a.speed, sb = b.speed; a.speed = sb * 0.5 + sa * 0.2; b.speed = sa * 0.5 + sb * 0.2;
  return true;
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
