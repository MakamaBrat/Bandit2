// Cars: thin wrapper around physics.js (the ported original model). Heading in degrees is CCW from "right" = dir * 22.5.
// Screen coords: y grows down, so forward = (cos h, -sin h).
import { blockedAt } from './player.js';
import { newBody, heroControl, drive, setDir, headingDeg, speedPx, bodyBoxes } from './physics.js';
export const CAR_SPRITES = ['k_00', 'k_01', 'k_02', 'k_03', 'k_04'];
// sprite sheet, animation offset and original handling class (b.r = fl[..][2] - 156)
export const CAR_TYPES = [
  { spr: 'k_00', base: 0, cls: 0, w: 75, h: 35 }, { spr: 'k_01', base: 0, cls: 1, w: 75, h: 34 }, { spr: 'k_01', base: 16, cls: 2, w: 75, h: 34 },
  { spr: 'k_02', base: 0, cls: 3, w: 81, h: 41 }, { spr: 'k_03', base: 0, cls: 4, w: 77, h: 36 }, { spr: 'k_03', base: 16, cls: 5, w: 77, h: 36 }, { spr: 'k_04', base: 0, cls: 6, w: 86, h: 35 },
];
export const HL = 36, HW = 12;               // rough half length / width for touch hit tests and bullets
const rad = d => d * Math.PI / 180;
export const fwd = h => [Math.cos(rad(h)), -Math.sin(rad(h))];
export const side = h => [Math.sin(rad(h)), Math.cos(rad(h))];
export const carBlocked = (map, x, y, h) => { const b = { x, y, dir: Math.round(h / 22.5) & 15, w8: 75, w9: 24, gear: 1 }; return bodyBoxes(b).some(r => [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]].some(([px, py]) => map.tileAt(px, py).collision === 2)); };

function sync(c) { c.heading = headingDeg(c); c.speed = speedPx(c); c.anim = (c.dir & 15) + c.base; }
export function newCar(type, x, y, heading) {
  const t = typeof type === 'number' ? CAR_TYPES[type] : CAR_TYPES.find(t => t.spr === type) || CAR_TYPES[0];
  const c = newBody({ x, y, dir: Math.round(heading / 22.5) & 15, cls: t.cls, w8: t.w, w9: Math.round(t.h * 0.7) });
  Object.assign(c, { type: t.spr, base: t.base, driver: false, input: {}, fresh: {} }); sync(c); return c;
}
// One 100 ms tick. `input` = {up, down, left, right, brake}; `fresh` = keys pressed since the last tick. Traffic / abandoned cars use ai = true / no input.
export function stepCar(map, c, input, world, fresh) {
  c.px = c.x; c.py = c.y;
  if (c.hero) heroControl(c, input || {}, fresh || {});
  drive(map, c, world); sync(c); return c;
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
        const c = newCar(cars.length % CAR_TYPES.length, x, y, [0, 90, 180, 270][(cars.length * 3) % 4]); c.parked = true; cars.push(c);
      }
  return cars;
}
// distance from a point to the car's body rectangle (0 when inside)
export function carDist(c, x, y) {
  const [fx, fy] = fwd(c.heading), [sx, sy] = side(c.heading), dx = x - c.x, dy = y - c.y;
  return Math.hypot(Math.max(0, Math.abs(dx * fx + dy * fy) - HL), Math.max(0, Math.abs(dx * sx + dy * sy) - HW));
}
export function nearestCar(cars, p, maxDist = 14) { let best = null, bd = maxDist; for (const c of cars) { const d = carDist(c, p.x, p.y); if (d < bd) { bd = d; best = c; } } return best; }
export function exitSpot(map, c) {
  const [sx, sy] = side(c.heading), [fx, fy] = fwd(c.heading);
  for (const [s, l] of [[1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) for (const dist of [HW + 10, HW + 16]) { const x = c.x + sx * s * dist + fx * l * 8, y = c.y + sy * s * dist + fy * l * 8; if (!blockedAt(map, x, y)) return { x, y }; }
  for (let r = HW + 10; r <= HL + 40; r += 6) for (let a = 0; a < 360; a += 30) { const x = c.x + Math.cos(a * Math.PI / 180) * r, y = c.y + Math.sin(a * Math.PI / 180) * r; if (!blockedAt(map, x, y)) return { x, y }; }
  return null;
}
