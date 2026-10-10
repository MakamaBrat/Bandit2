// Traffic: AI cars drive along roads (collision 0) in cardinal directions. Pure logic.
import { stepCar, carBlocked, fwd, newCar, CAR_SPRITES, HL, HW } from './vehicle.js';
const CRUISE = 70, POLICE_CRUISE = 100, LOOK = HL + 14;
export const CIVIL_SPRITES = CAR_SPRITES.filter(s => s !== 'k_00');
const HEADS = [0, 90, 180, 270];
const roadAhead = (map, x, y, h, d) => { const [fx, fy] = fwd(h); return !carBlocked(map, x + fx * d, y + fy * d, h) && map.tileAt(x + fx * d, y + fy * d).collision === 0; };
const angDiff = (a, b) => ((b - a + 540) % 360) - 180;

export function newTrafficCar(type, x, y, heading) { const c = newCar(type, x, y, heading); c.ai = true; c.think = 0; c.want = heading; c.stuck = 0; return c; }

// obstacles: [{x,y}] things a car should not drive into (hero, peds, other cars)
export function stepTraffic(map, c, obstacles, dt, rnd = Math.random) {
  c.think -= dt;
  if (c.think <= 0) {
    c.think = 0.25 + rnd() * 0.2;
    const cur = HEADS.reduce((b, h) => Math.abs(angDiff(c.heading, h)) < Math.abs(angDiff(c.heading, b)) ? h : b, 0);
    if (c.police && c.chase) {                                              // police: head for the target along the road grid
      const bearing = (Math.atan2(-(c.chase.y - c.y), c.chase.x - c.x) * 180 / Math.PI + 360) % 360, back = (cur + 180) % 360;
      const free = HEADS.filter(h => h !== back && roadAhead(map, c.x, c.y, h, LOOK));
      if (free.includes(cur) && Math.abs(angDiff(cur, bearing)) <= 50) c.want = cur;
      else if (free.length) c.want = free.reduce((b, h) => Math.abs(angDiff(h, bearing)) < Math.abs(angDiff(b, bearing)) ? h : b);
      else c.want = roadAhead(map, c.x, c.y, back, LOOK) ? back : cur;
    } else if (!roadAhead(map, c.x, c.y, cur, LOOK)) {
      const opts = HEADS.filter(h => h !== (cur + 180) % 360 && roadAhead(map, c.x, c.y, h, LOOK));
      const back = (cur + 180) % 360;
      c.want = opts.length ? opts[Math.floor(rnd() * opts.length)] : (roadAhead(map, c.x, c.y, back, LOOK) ? back : cur);
    } else c.want = cur;
  }
  const [fx, fy] = fwd(c.heading);
  const blocked = !(c.ignore > 0) && obstacles.some(o => { if (o === c) return false; if (o.heading === undefined && map.tileAt(o.x, o.y).collision !== 0) return false;   // people on the pavement do not stop traffic
    const dx = o.x - c.x, dy = o.y - c.y, f = dx * fx + dy * fy, s = Math.abs(dx * fy - dy * fx); return f > 0 && f < HL + 30 && s < HW + 6; });
  c.blockT = blocked ? (c.blockT || 0) + dt : 0;                       // head-on deadlock: back off and turn round
  if (c.blockT > 2) { c.want = (c.want + 180) % 360; c.blockT = 0; c.ignore = 1.5; }
  if (c.ignore > 0) c.ignore -= dt;
  const turning = Math.abs(angDiff(c.heading, c.want)) > 4;
  if (turning && !blocked && Math.abs(c.speed) < 4) {                    // standing still against a wall: steering needs movement, so pivot on the spot
    const diff = angDiff(c.heading, c.want), nh = (c.heading + Math.sign(diff) * Math.min(Math.abs(diff), 150 * dt) + 360) % 360;
    if (!carBlocked(map, c.x, c.y, nh)) c.heading = nh;
  }
  const steer = turning ? Math.sign(angDiff(c.heading, c.want)) : 0;
  const cruise = blocked ? 0 : turning ? (c.police ? 50 : 35) : (c.police ? POLICE_CRUISE : CRUISE);
  const inp = { up: c.speed < cruise, down: c.speed > cruise + 8, left: steer > 0, right: steer < 0 };
  const px = c.x, py = c.y;
  stepCar(map, c, inp, dt);
  c.stuck = !blocked && Math.hypot(c.x - px, c.y - py) < 0.2 * dt * 60 * 0.1 ? c.stuck + dt : 0;
  if (c.stuck > 1.5) { c.want = (c.want + 180) % 360; c.stuck = 0; }   // dead end: turn around
  return c;
}

export function spawnTraffic(map, around, n = 8, rnd = Math.random) {
  const T = map.data.tileSize, out = [], R = 30;
  for (let tries = 0; tries < 6000 && out.length < n; tries++) {
    const x = Math.floor((around.x + (rnd() * 2 - 1) * R * T) / T) * T + T / 2, y = Math.floor((around.y + (rnd() * 2 - 1) * R * T) / T) * T + T / 2;
    if (Math.hypot(x - around.x, y - around.y) < 140 || out.some(o => Math.hypot(o.x - x, o.y - y) < 90)) continue;
    const h = HEADS.find(h => roadAhead(map, x, y, h, 40) && !carBlocked(map, x, y, h) && map.tileAt(x, y).collision === 0);
    if (h === undefined) continue;
    out.push(newTrafficCar(CIVIL_SPRITES[out.length % CIVIL_SPRITES.length], x, y, h));
  }
  return out;
}

// Keeps `n` AI cars around the hero: spawned on roads in a ring just outside the view, removed when far away (cars the hero touched stay).
export function topUpTraffic(map, around, cars, n = 8, rnd = Math.random, minR = 150, maxR = 450) {
  const T = map.data.tileSize;
  for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; if (c.ai && Math.hypot(c.x - around.x, c.y - around.y) > maxR + 250) cars.splice(i, 1); }
  let count = cars.filter(c => c.ai).length;
  for (let tries = 0; tries < 40 && count < n; tries++) {
    const a = rnd() * Math.PI * 2, r = minR + rnd() * (maxR - minR);
    const x = Math.floor((around.x + Math.cos(a) * r) / T) * T + T / 2, y = Math.floor((around.y + Math.sin(a) * r) / T) * T + T / 2;
    if (x < 0 || y < 0 || x > map.w || y > map.h || cars.some(o => Math.hypot(o.x - x, o.y - y) < 90)) continue;
    const h = HEADS.find(h => roadAhead(map, x, y, h, 40) && !carBlocked(map, x, y, h) && map.tileAt(x, y).collision === 0);
    if (h === undefined) continue;
    cars.push(newTrafficCar(CIVIL_SPRITES[Math.floor(rnd() * CIVIL_SPRITES.length)], x, y, h)); count++;
  }
  return cars;
}

// ---- police cars: chase the hero while wanted >= 2 stars ----
export const POLICE_HP = 30;
export function newPoliceCar(x, y, heading) { const c = newTrafficCar('k_00', x, y, heading); c.police = true; c.hp = POLICE_HP; c.chase = null; return c; }
export const policeCarsFor = stars => Math.max(0, stars - 1);        // 2 stars -> 1 car, 3 stars -> 2 cars
export function managePoliceCars(map, stars, target, cars, rnd = Math.random, minR = 300, maxR = 520) {
  for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; if (!c.police) continue;
    const far = Math.hypot(c.x - target.x, c.y - target.y) > maxR + 300;
    if (!c.ai || (stars < 2 && far)) { if (!c.ai) c.police = false; else cars.splice(i, 1); continue; }
    c.chase = stars >= 2 ? { x: target.x, y: target.y } : null; }
  const T = map.data.tileSize; let have = cars.filter(c => c.police && c.ai).length;
  for (let tries = 0; tries < 40 && have < policeCarsFor(stars); tries++) {
    const a = rnd() * Math.PI * 2, r = minR + rnd() * (maxR - minR);
    const x = Math.floor((target.x + Math.cos(a) * r) / T) * T + T / 2, y = Math.floor((target.y + Math.sin(a) * r) / T) * T + T / 2;
    if (x < 0 || y < 0 || x > map.w || y > map.h || cars.some(o => Math.hypot(o.x - x, o.y - y) < 90)) continue;
    const h = HEADS.find(h => roadAhead(map, x, y, h, 40) && !carBlocked(map, x, y, h) && map.tileAt(x, y).collision === 0);
    if (h === undefined) continue;
    const c = newPoliceCar(x, y, h); c.chase = { x: target.x, y: target.y }; cars.push(c); have++;
  }
  return cars;
}
