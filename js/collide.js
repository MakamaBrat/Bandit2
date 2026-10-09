// Collisions between entities (pure logic). Car box is HL x HW around the car centre; car angle h: forward = (cos h, -sin h).
import { fwd, side, carBlocked } from './vehicle.js';
import { blockedAt } from './player.js';
const HL = 15, HW = 7, HIT_SPEED = 35;
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

// Two cars overlapping: push apart along the line between centres and swap part of their speed.
export function carVsCar(map, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001, min = 24;
  if (d >= min) return false;
  const nx = dx / d, ny = dy / d, push = (min - d) / 2;
  for (const [c, sg] of [[a, -1], [b, 1]]) {
    const x = c.x + nx * push * sg, y = c.y + ny * push * sg;
    if (!carBlocked(map, x, y, c.heading)) { c.x = x; c.y = y; }
  }
  const sa = a.speed, sb = b.speed; a.speed = sb * 0.5 + sa * 0.2; b.speed = sa * 0.5 + sb * 0.2;
  return true;
}
