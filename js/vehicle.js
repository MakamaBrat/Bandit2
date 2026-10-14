// Pure vehicle logic (no DOM). Heading in degrees, CCW from "right" (matches the 16 animations of the k_* sprites: anim i = i*22.5 deg).
// Screen coords: y grows down, so forward = (cos h, -sin h).
import { blockedAt } from './player.js';
export const CAR_SPRITES = ['k_00', 'k_01', 'k_02', 'k_03', 'k_04'];
export const HL = 34, HW = 15;               // half length / half width of the collision box (px); the car art is ~72-86 x 33-41
const BRAKE = 320, DRAG = 55, MAXF = 150, MAXR = -50, TURN = 120, REV_ACCEL = 100;
// Automatic 5-speed gearbox: each gear covers a speed range [lo, hi] (px/s) with its own pull; the engine revs (0..1) climb inside the gear and drop at a shift.
export const GEARS = [{ lo: 0, hi: 38, acc: 150 }, { lo: 30, hi: 66, acc: 122 }, { lo: 56, hi: 96, acc: 94 }, { lo: 84, hi: 124, acc: 74 }, { lo: 110, hi: 150, acc: 58 }];
export const SHIFT_UP = 0.16, SHIFT_DOWN = 0.09, IDLE_RPM = 0.2;
export const kmh = speed => Math.round(Math.abs(speed) * 0.9);                    // speedometer: 150 px/s (top speed) = 135 km/h
export const gearLabel = c => c.gear < 0 ? 'R' : Math.abs(c.speed) < 1.5 && !c.rpmUp ? 'N' : String(c.gear || 1);
// gear + revs for the current speed. up = throttle pressed. Returns true while the gearbox is mid-shift (no pull).
export function gearbox(c, up, dt) {
  c.shiftT = Math.max(0, (c.shiftT || 0) - dt);
  if (c.speed < -1) { c.gear = -1; c.rpm += (IDLE_RPM + (1 - IDLE_RPM) * Math.min(1, -c.speed / -MAXR) - c.rpm) * Math.min(1, dt * 10); return false; }
  if (!(c.gear > 0)) c.gear = 1;
  if (!c.shiftT) {
    const g = GEARS[c.gear - 1];
    if (c.gear < 5 && c.speed > g.hi - 1.5 && up) { c.gear++; c.shiftT = SHIFT_UP; c.shifted = 'up'; }
    else if (c.gear > 1 && c.speed < g.lo - 3) { c.gear--; c.shiftT = SHIFT_DOWN; c.shifted = 'down'; }
  }
  const g = GEARS[c.gear - 1], lo = c.gear === 1 ? 0 : g.lo, f = Math.max(0, Math.min(1, (c.speed - lo) / (g.hi - lo)));
  const target = IDLE_RPM + (1 - IDLE_RPM) * f + (up && c.shiftT === 0 ? 0.04 : 0);
  c.rpm = (c.rpm ?? IDLE_RPM) + (target - (c.rpm ?? IDLE_RPM)) * Math.min(1, dt * (c.shiftT > 0 ? 7 : 16));
  c.rpmUp = up; return c.shiftT > 0;
}
const rad = d => d * Math.PI / 180;
export const fwd = h => [Math.cos(rad(h)), -Math.sin(rad(h))];
export const side = h => [Math.sin(rad(h)), Math.cos(rad(h))];

export function samples(x, y, h) {
  const [fx, fy] = fwd(h), [sx, sy] = side(h), pts = [];
  for (const l of [-HL, -HL / 2, 0, HL / 2, HL]) for (const w of [-HW, 0, HW]) if (l || w) pts.push([x + fx * l + sx * w, y + fy * l + sy * w]);
  return pts;
}
export const carBlocked = (map, x, y, h) => samples(x, y, h).some(([px, py]) => map.tileAt(px, py).collision === 2);

export function newCar(type, x, y, heading) { return { type, x, y, heading, speed: 0, driver: false, anim: 0, hp: 100, hpMax: 100, slip: 0, gear: 1, rpm: 0.2 }; }
// wheel contact points (rear pair first, then the front pair)
export function wheels(c) {
  const [fx, fy] = fwd(c.heading), [sx, sy] = side(c.heading), l = HL * 0.55, w = HW * 0.75;
  return [[-l, -w], [-l, w], [l, -w], [l, w]].map(([a, b]) => [c.x + fx * a + sx * b, c.y + fy * a + sy * b]);
}

export function stepCar(map, c, input, dt) {
  const up = !!input.up, down = !!input.down, steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const onWalk = map.tileAt(c.x, c.y).collision === 1;
  const maxF = onWalk ? MAXF * 0.55 : MAXF;
  const shifting = gearbox(c, up, dt);
  if (up) c.speed += (c.speed < 0 ? BRAKE : shifting ? 0 : GEARS[Math.max(0, c.gear - 1)].acc) * dt;
  else if (down) c.speed -= (c.speed > 5 ? BRAKE : REV_ACCEL) * dt;
  else { const d = Math.min(Math.abs(c.speed), DRAG * dt); c.speed -= Math.sign(c.speed) * d; }
  if (onWalk && c.speed > maxF) c.speed = Math.max(maxF, c.speed - 200 * dt);
  c.speed = Math.max(MAXR, Math.min(MAXF, c.speed));
  { // how much the tyres slip: hard braking, fast corners, sliding after a hit, spinning
    const sp = Math.abs(c.speed); let slip = 0;
    if (down && c.speed > 30) slip = Math.max(slip, Math.min(1, (c.speed - 10) / 70));
    if (steer && sp > 85) slip = Math.max(slip, Math.min(1, (sp - 85) / 60));
    if (c.kx || c.ky) slip = Math.max(slip, Math.min(1, Math.hypot(c.kx, c.ky) / 80));
    if (Math.abs(c.spin || 0) > 40) slip = Math.max(slip, Math.min(1, Math.abs(c.spin) / 150));
    c.slip = c.hp > 0 ? slip : 0;
  }
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
