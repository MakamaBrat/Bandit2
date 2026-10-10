// Traffic: AI cars drive along roads (collision 0) in cardinal directions using the same physics as the player's car.
// Numbers from the original (b.O / b.g): cruise speed 2050, 1000 while turning, accel 500 / tick, brake up to 700 / tick, one heading step per tick.
import { newCar, carBlocked, CAR_TYPES, HL, HW } from './vehicle.js';
import { setDir, aiAccel, aiBrake, setSpeed } from './physics.js';
export const CRUISE = 2050, TURN_SPEED = 1000;
const HEADS = [0, 4, 8, 12];                               // dir indices: right, up, left, down
const DXY = { 0: [1, 0], 4: [0, -1], 8: [-1, 0], 12: [0, 1] };
const roadAhead = (map, x, y, dir, d) => { const [fx, fy] = DXY[dir]; return !carBlocked(map, x + fx * d, y + fy * d, dir * 22.5) && map.tileAt(x + fx * d, y + fy * d).collision === 0; };
const cardinal = dir => (Math.round(dir / 4) * 4) & 15;
const dirDiff = (a, b) => ((b - a + 24) & 15) - 8;       // signed steps from a to b, -8..7

export function newTrafficCar(type, x, y, heading) { const c = newCar(type, x, y, heading); c.ai = true; c.parked = false; c.want = c.dir; c.think = 0; c.stuck = 0; c.blockT = 0; c.ignore = 0; return c; }

// obstacles: things a car should not drive into (hero, peds, other cars)
export function stepTraffic(map, c, obstacles, rnd = Math.random) {
  const dt = 0.1;
  c.think -= dt;
  const cur = cardinal(c.dir);
  if (c.think <= 0 && c.dir === cur) {
    c.think = 0.2 + rnd() * 0.2;
    const look = 36 + Math.max(0, c.h) * 0.012;
    if (!roadAhead(map, c.x, c.y, cur, look)) {
      const back = (cur + 8) & 15, opts = HEADS.filter(h => h !== back && roadAhead(map, c.x, c.y, h, look));
      c.want = opts.length ? opts[Math.floor(rnd() * opts.length)] : (roadAhead(map, c.x, c.y, back, look) ? back : cur);
    } else c.want = cur;
  }
  const [fx, fy] = [Math.cos(c.dir * Math.PI / 8), -Math.sin(c.dir * Math.PI / 8)];
  const reach = HL + 22 + Math.max(0, c.h) * 0.016;
  const blocked = !(c.ignore > 0) && obstacles.some(o => {
    if (o === c) return false; if (o.dir === undefined && map.tileAt(o.x, o.y).collision !== 0) return false;   // people on the pavement do not stop traffic
    const dx = o.x - c.x, dy = o.y - c.y, f = dx * fx + dy * fy, sd = Math.abs(dx * fy - dy * fx); return f > 0 && f < reach && sd < HW + 8;
  });
  c.blockT = blocked ? c.blockT + dt : 0;
  if (c.blockT > 2.5) { c.want = (cardinal(c.dir) + 8) & 15; c.blockT = 0; c.ignore = 1.5; }
  if (c.ignore > 0) c.ignore -= dt;
  const turning = c.dir !== c.want;
  if (turning) { const st = dirDiff(c.dir, c.want); if (c.h <= TURN_SPEED + 200 || Math.abs(st) > 0) setDir(c, (c.dir + Math.sign(st) + 16) & 15); }   // one step per tick
  if (blocked) aiBrake(c, 700);
  else if (turning || c.h > CRUISE) { if (c.h > TURN_SPEED) aiBrake(c, c.h - TURN_SPEED); else aiAccel(c, TURN_SPEED - c.h + 1, 500, TURN_SPEED); }
  else aiAccel(c, CRUISE - c.h, 500, CRUISE);
  const px = c.x, py = c.y;
  return { px, py };
}
export function trackStuck(c, before) {
  const blocked = c.blockT > 0;
  c.stuckT = !blocked && Math.hypot(c.x - before.px, c.y - before.py) < 0.3 ? (c.stuckT || 0) + 0.1 : 0;
  if (c.stuckT > 1.5) { c.want = (cardinal(c.dir) + 8) & 15; c.stuckT = 0; if (c.h === 0) setDir(c, c.want); }
}

const TYPES = i => CAR_TYPES[i % CAR_TYPES.length];
const free = (map, x, y, d) => HEADS.find(h => roadAhead(map, x, y, h, 40) && !carBlocked(map, x, y, h * 22.5) && map.tileAt(x, y).collision === 0);
export function spawnTraffic(map, around, n = 8, rnd = Math.random) {
  const T = map.data.tileSize, out = [], R = 30;
  for (let tries = 0; tries < 6000 && out.length < n; tries++) {
    const x = Math.floor((around.x + (rnd() * 2 - 1) * R * T) / T) * T + T / 2, y = Math.floor((around.y + (rnd() * 2 - 1) * R * T) / T) * T + T / 2;
    if (Math.hypot(x - around.x, y - around.y) < 140 || out.some(o => Math.hypot(o.x - x, o.y - y) < 90)) continue;
    const h = free(map, x, y); if (h === undefined) continue;
    out.push(newTrafficCar(out.length % CAR_TYPES.length, x, y, h * 22.5));
  }
  return out;
}
export function topUpTraffic(map, around, cars, n = 8, rnd = Math.random, minR = 150, maxR = 450) {
  const T = map.data.tileSize;
  for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; if (c.ai && Math.hypot(c.x - around.x, c.y - around.y) > maxR + 250) cars.splice(i, 1); }
  let count = cars.filter(c => c.ai).length;
  for (let tries = 0; tries < 40 && count < n; tries++) {
    const a = rnd() * Math.PI * 2, r = minR + rnd() * (maxR - minR);
    const x = Math.floor((around.x + Math.cos(a) * r) / T) * T + T / 2, y = Math.floor((around.y + Math.sin(a) * r) / T) * T + T / 2;
    if (x < 0 || y < 0 || x > map.w || y > map.h || cars.some(o => Math.hypot(o.x - x, o.y - y) < 90)) continue;
    const h = free(map, x, y); if (h === undefined) continue;
    const c = newTrafficCar(Math.floor(rnd() * CAR_TYPES.length), x, y, h * 22.5); setSpeed(c, CRUISE); cars.push(c); count++;
  }
  return cars;
}
