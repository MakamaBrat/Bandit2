// Pure vehicle logic (no DOM). Heading in degrees, CCW from "right" (matches the 16 animations of the k_* sprites: anim i = i*22.5 deg).
// Screen coords: y grows down, so forward = (cos h, -sin h).
import { blockedAt } from './player.js';
export const CAR_SPRITES = ['k_00', 'k_01', 'k_02', 'k_03', 'k_04'];
export const HL = 34, HW = 15;               // half length / half width of the collision box (px); the car art is ~72-86 x 33-41
const ACCEL = 170, BRAKE = 320, DRAG = 55, MAXF = 150, MAXR = -50, TURN = 120;
const rad = d => d * Math.PI / 180;
export const fwd = h => [Math.cos(rad(h)), -Math.sin(rad(h))];
export const side = h => [Math.sin(rad(h)), Math.cos(rad(h))];

export function samples(x, y, h) {
  const [fx, fy] = fwd(h), [sx, sy] = side(h), pts = [];
  for (const l of [-HL, -HL / 2, 0, HL / 2, HL]) for (const w of [-HW, 0, HW]) if (l || w) pts.push([x + fx * l + sx * w, y + fy * l + sy * w]);
  return pts;
}
export const carBlocked = (map, x, y, h) => samples(x, y, h).some(([px, py]) => map.tileAt(px, py).collision === 2);

export function newCar(type, x, y, heading) { return { type, x, y, heading, speed: 0, driver: false, anim: 0 }; }

export function stepCar(map, c, input, dt) {
  const up = !!input.up, down = !!input.down, steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const onWalk = map.tileAt(c.x, c.y).collision === 1;
  const maxF = onWalk ? MAXF * 0.55 : MAXF;
  if (up) c.speed += (c.speed < 0 ? BRAKE : ACCEL) * dt;
  else if (down) c.speed -= (c.speed > 5 ? BRAKE : ACCEL * 0.6) * dt;
  else { const d = Math.min(Math.abs(c.speed), DRAG * dt); c.speed -= Math.sign(c.speed) * d; }
  if (onWalk && c.speed > maxF) c.speed = Math.max(maxF, c.speed - 200 * dt);
  c.speed = Math.max(MAXR, Math.min(MAXF, c.speed));
  const k = Math.min(1, Math.abs(c.speed) / 50);
  const nh = c.heading + steer * TURN * k * (c.speed < 0 ? -1 : 1) * dt;
  if (!carBlocked(map, c.x, c.y, nh)) c.heading = nh;
  c.heading = ((c.heading % 360) + 360) % 360;
  const [fx, fy] = fwd(c.heading), mx = fx * c.speed * dt, my = fy * c.speed * dt, v0 = Math.abs(c.speed), sg = Math.sign(c.speed) || 1;
  const bump = k => { if (v0 > 45) c.bump = { v: v0 * k, x: c.x + fx * HL * sg, y: c.y + fy * HL * sg }; };   // game reads this to spawn sparks / shake
  if (!carBlocked(map, c.x + mx, c.y + my, c.heading)) { c.x += mx; c.y += my; }
  else if (!carBlocked(map, c.x + mx, c.y, c.heading)) { c.x += mx; c.speed *= 0.9; bump(0.5); }
  else if (!carBlocked(map, c.x, c.y + my, c.heading)) { c.y += my; c.speed *= 0.9; bump(0.5); }
  else { c.speed = Math.abs(c.speed) > 25 ? -c.speed * 0.25 : 0; bump(1); }
  // knock-back from collisions: sideways slide (tyre friction eats it quickly) and spin
  if (c.kx || c.ky) {
    const kx = c.kx * dt, ky = c.ky * dt;
    if (!carBlocked(map, c.x + kx, c.y + ky, c.heading)) { c.x += kx; c.y += ky; } else { c.kx *= -0.2; c.ky *= -0.2; }
    const d = Math.exp(-4 * dt); c.kx *= d; c.ky *= d; if (Math.hypot(c.kx, c.ky) < 2) c.kx = c.ky = 0;
  }
  if (c.spin) {
    const sh = c.heading + c.spin * dt; if (!carBlocked(map, c.x, c.y, sh)) c.heading = ((sh % 360) + 360) % 360; else c.spin *= -0.3;
    c.spin *= Math.exp(-5 * dt); if (Math.abs(c.spin) < 1) c.spin = 0;
  }
  c.anim = Math.round(c.heading / 22.5) % 16;
  return c;
}

export function spawnCars(map, around, n = 5) {
  const T = map.data.tileSize, cars = [];
  const roadClear = (x, y) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (map.tileAt(x + a * T, y + b * T).collision !== 0) return false; return true; };
  for (let r = 2; r < 120 && cars.length < n; r++)
    for (let dy = -r; dy <= r && cars.length < n; dy++)
      for (let dx = -r; dx <= r && cars.length < n; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = Math.floor(around.x / T + dx) * T + T / 2, y = Math.floor(around.y / T + dy) * T + T / 2;
        if (!roadClear(x, y) || cars.some(c => Math.hypot(c.x - x, c.y - y) < 110)) continue;
        cars.push(newCar(CAR_SPRITES[cars.length % CAR_SPRITES.length], x, y, [0, 90, 180, 270][(cars.length * 3) % 4]));
      }
  return cars;
}

// distance from a point to the car's body rectangle (0 when inside)
export function carDist(c, x, y) {
  const [fx, fy] = fwd(c.heading), [sx, sy] = side(c.heading), dx = x - c.x, dy = y - c.y;
  const f = Math.abs(dx * fx + dy * fy) - HL, s = Math.abs(dx * sx + dy * sy) - HW;
  return Math.hypot(Math.max(0, f), Math.max(0, s));
}
export function nearestCar(cars, p, maxDist = 14) {
  let best = null, bd = maxDist;
  for (const c of cars) { const d = carDist(c, p.x, p.y); if (d < bd) { bd = d; best = c; } }
  return best;
}

// Returns a free spot beside the car for the player, or null.
export function exitSpot(map, c) {
  const [sx, sy] = side(c.heading), [fx, fy] = fwd(c.heading);
  for (const [s, l] of [[1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]])
    for (const dist of [HW + 10, HW + 16]) {
      const x = c.x + sx * s * dist + fx * l * 8, y = c.y + sy * s * dist + fy * l * 8;
      if (!blockedAt(map, x, y)) return { x, y };
    }
  // fallback: any free spot on rings around the car (car jammed against walls / in a corner)
  for (let r = HW + 10; r <= HL + 40; r += 6)
    for (let a = 0; a < 360; a += 30) {
      const x = c.x + Math.cos(a * Math.PI / 180) * r, y = c.y + Math.sin(a * Math.PI / 180) * r;
      if (!blockedAt(map, x, y)) return { x, y };
    }
  return null;
}
