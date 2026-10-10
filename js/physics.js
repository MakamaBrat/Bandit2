// Vehicle physics ported from the original J2ME game (tools/decompiled_java/b.java: b(int), c(int), C(), u(), w(), f(), a(b,bool,bool)).
// The original runs the whole world in fixed 100 ms ticks (see d.run: one frame per >=100 ms, every entity c() adds 100 to its timers),
// so everything here is "per tick". A body is a plain object; x / y are pixels, c / d (velocity) and h (speed along the heading) keep
// the original integer units, k is the heading as a 16.16 angle (65536 = 360 deg), dir is the 16-step heading (0 = right, 4 = up, 8 = left, 12 = down).
import { COS, cosU, sinU, DA, GEAR_TOP, GEAR_ACC } from './tables.js';

const ID = (a, b) => Math.trunc(a / b);              // Java integer division
const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const TILE = 24, T8 = TILE * 256;
export const CAR_HP = 40;
export const PED_W = 12, PED_H = 28;                  // pedestrian sprite size (px); the hit box is its lower quarter and middle half (see a(): j[5]/4, j[4]/2)
export const A16 = i => [COS[(i * 16) & 255], -COS[(64 - i * 16) & 255]];   // not used by physics, handy for tests: (cos, -sin) of heading i

export function newBody(o) {
  const b = {
    x: 0, y: 0, c: 0, d: 0, h: 0, s: 0, dir: 0, k: 0, gear: 0,
    thr: false, brk: false, rev: false, snap: false,          // b.t / b.w / b.v / b.u (key state flags)
    slide: false, wallX: false, wallY: false, bump: false,    // 0x400000, 0x40000, 0x80000, 0x200000
    cls: 0, w8: 75, w9: 24, hp: CAR_HP, hero: false, heavy: false, parked: false,
    lastX: 0, lastY: 0, lastK: 0, stuck: 6, ...o,
  };
  b.k = (256 - b.dir * 16) << 8; b.px = b.x; b.py = b.y; b.lastX = b.x; b.lastY = b.y; b.lastK = b.k;
  return b;
}
export const headingDeg = b => b.dir * 22.5;
export const speedPx = b => b.h * 0.005859375 * 10;   // signed px / second (for display and rough comparisons)

// ---- driver controls -------------------------------------------------------------------------------------------------
export function setDir(o, n) {          // b.i(n)
  if (o.dir === n) return;
  o.dir = n; o.k = (256 - n * 16) << 8;
  if (o.h > 0) setVel(o);
}
export function setVel(o) { o.c = COS[(o.dir * 16) & 255] * ID(o.h, DA); o.d = -COS[(64 - o.dir * 16) & 255] * ID(o.h, DA); }   // b.s(): c = A[2i] * (h / 100)
export function setSpeed(o, n) { o.h = n; o.s = 0; setVel(o); }                                                                   // b.f(n)

// b.b(n): gas (+1) / brake and reverse (-1) for a player driven car, gears and all
export function throttle(o, n) {
  const T = GEAR_TOP[o.cls], Q = GEAR_ACC[o.cls], n2 = o.gear + 1;
  if (o.gear === 0) o.gear = n;
  const n4 = ID(Q[n2] * 100, DA), n5 = ID(Q[2] * 100, DA);
  if (n > 0) {
    if (o.gear === -1) { o.h += 2 * n5; if (o.h >= T[n2 + 1]) { o.h = T[n2 + 1]; o.gear = 0; } }
    else { o.h += n4; if (o.h >= T[n2]) { if (o.gear < 5 && o.thr) o.gear++; else o.h = T[n2]; } }
  } else if (n < 0) {
    if (o.gear === -1) { o.h += n4; if (o.h <= T[n2]) o.h = T[n2]; }
    else { o.h -= 2 * n5; if (n2 >= 1 && o.h <= T[n2 - 1]) { o.h = T[n2 - 1]; o.gear--; } }
  }
}
// b.c(n): steering, n = +1 clockwise on screen (right), -1 counter clockwise, 0 centre
export function steer(o, n) {
  const T = GEAR_TOP[o.cls];
  if (n === 0) { o.s = 0; return; }
  const h0 = o.h; let h = o.h;
  if (h < 0) h = ID(h * 17, 10); else if (h < T[2]) h = ID(h * 3, 2); else if (h < T[3]) h = ID(h * 5, 4);
  o.h = h;
  if (Math.abs(o.s) < Math.abs(ID(o.h * 2, 3))) o.s += n > 0 ? ID(o.h * 60, 100) : -ID(o.h * 60, 100);
  o.h = h0;
}
// AI throttle: b.g(n) accelerates by at most `acc` per tick up to `vmax`, b.h(n) brakes by at most 700 per tick
export function aiAccel(o, n, acc = 500, vmax = 3300) { o.h += Math.min(n, acc); if (o.h > vmax) o.h = vmax; setVel(o); }
export function aiBrake(o, n) { if (o.h <= 0) return; o.h -= Math.min(n, 700); if (o.h <= 0) o.h = 0; setVel(o); }

// ---- collision boxes (w(): three squares along the car, a(): same for other cars) --------------------------------------
function boxes(o) {
  const j8 = o.w8 * 256, j9 = o.w9 * 256, a = 256 - o.dir * 16;
  let S = j9 >> 1, T = S;
  const n = ID(j8 * cosU(a), 3) >> 8; let n2 = ID(j8 * sinU(a), 3) >> 8;
  const m = o.dir % 8;
  if (m === 2 || m === 6) { n2 = ID(n2 * 90, 100); T -= 256; S -= 256; }
  else if (m === 1 || m === 7) { n2 = ID(n2 * 95, 100); T -= 256; }
  else if (m === 3 || m === 5) { n2 = ID(n2 * 85, 100); S -= 256; }
  else if (m === 4) { n2 = ID(n2 * 80, 100); }
  const g = o.gear >= 0 ? 1 : -1, ax = o.x * 256, ay = o.y * 256;
  return { S, T, U: S * 2, V: T * 2, P: [ax - S, ax + g * n - S, ax - g * n - S], Q: [ay - T, ay + g * n2 - T, ay - g * n2 - T] };
}
export const bodyBoxes = o => { const B = boxes(o), out = []; for (let i = 0; i < 3; i++) out.push({ x0: B.P[i] / 256, y0: B.Q[i] / 256, x1: (B.P[i] + B.U) / 256, y1: (B.Q[i] + B.V) / 256 }); return out; };

const tileType = (map, x8, y8) => map.tileAt(x8 / 256, y8 / 256).collision;

// ---- walls: b.f() -------------------------------------------------------------------------------------------------------
function wallCollide(map, o, B, world) {
  let bl2 = false, n2 = 0, n3 = 0, n4 = 0, n5 = 0, n6 = 0, hit = -1;
  const C = [0, 0, 0, 0];
  o.wallX = false; o.wallY = false;
  for (let n = 0; n < 3; n++) {
    C[0] = C[1] = C[2] = C[3] = 0;
    const n8 = B.P[n] - B.P[0], n9 = B.Q[n] - B.Q[0];
    for (let k = 0; k < 4; k++) {
      let x = B.P[n] + (k % 2) * B.U, y = B.Q[n] + (k >> 1) * B.V;
      if (tileType(map, x, y) !== 2) continue;
      if (x < 0) x += 6144; if (y < 0) y += 6144;
      const ny = -(((y >> 8) % 24)) + 24 * (1 - (k >> 1)) - 1, nx = -(((x >> 8) % 24)) + 24 * (1 - (k % 2)) - 1;
      C[2 + (k % 2)] = C[2 + (k % 2)] !== 0 ? 0 : ny;
      C[k >> 1] = C[k >> 1] !== 0 ? 0 : nx;
      bl2 = true;
      const sg = o.h >= 0 ? 1 : -1;
      n2 += (k >> 1) === 0 ? ID(n8 * sg, 2) : -ID(n8 * sg, 2);
      n2 += k % 2 === 0 ? -ID(n9 * sg, 2) : ID(n9 * sg, 2);
    }
    if (!bl2) continue;
    n3 = Math.abs(C[0]) > Math.abs(C[1]) ? C[0] : C[1]; n4 = Math.abs(C[2]) > Math.abs(C[3]) ? C[2] : C[3];
    n5 = Math.abs(n3); n6 = Math.abs(n4); hit = n; break;
  }
  if (!bl2) { o.bump = false; return false; }
  if (n3 !== 0 || n4 !== 0) {
    if (n3 !== 0) o.wallX = true;
    if (n4 !== 0) o.wallY = true;
    if ((n3 === 0 || n5 > n6) && n4 !== 0) {
      o.y += n4; o.x += n6 * sgn(n3);
      o.hp -= ID((Math.abs(o.d) >> 8) * DA * 5, GEAR_TOP[0][6]);
      o.d = 0;
    } else {
      o.x += n3; o.y += n5 * sgn(n4);
      o.hp -= ID((Math.abs(o.c) >> 8) * DA * 5, GEAR_TOP[0][6]);
      o.c = 0;
    }
  }
  o.k = o.Yk;
  if (n2 !== 0) { o.s = o.h * (n2 >= 0 ? 1 : -1); o.k += o.s; o.s = ID(o.s, 5); }     // a corner hit twists the car
  if (o.h > GEAR_TOP[o.cls][2] && world && world.fx) world.fx(B.P[hit] / 256 + B.U / 512, B.Q[hit] / 256 + B.V / 512, 'spark');
  o.h = ((o.d * sinU(256 - o.dir * 16) + o.c * cosU(256 - o.dir * 16)) >> 8) * DA >> 8;   // keep only the part of the velocity that points along the car
  if (!o.ai) { const T = GEAR_TOP[o.cls]; if (o.gear > 0) { while (o.gear > 0 && T[o.gear] > o.h) o.gear--; } else if (o.gear < 0) o.gear = 0; }
  o.bump = true; o.hitWall = true;
  return true;
}
// the player's car additionally keeps its last good position and halves its speed on every wall hit (b.e)
function wallCollideHero(map, o, B, world) {
  const hit = wallCollide(map, o, B, world);
  if (!o.hero) return hit;
  if (hit) {
    o.c >>= 1; o.d >>= 1; o.h >>= 1;
    if (o.stuck <= 0) { o.x = o.lastX; o.y = o.lastY; o.k = o.lastK; o.stuck = 6; }
    o.stuck--;
  } else { o.lastX = o.x; o.lastY = o.y; o.lastK = o.k; o.stuck = 6; }
  return hit;
}

// ---- other cars: the momentum exchange from b.a(b, true, true) -----------------------------------------------------------
function carVsCar(o, b2, B, world) {
  const j8 = b2.w8 * 256, j9 = b2.w9 * 256, a2 = 256 - b2.dir * 16;
  const n7 = ID(j8 * cosU(a2), 3) >> 8, n8 = ID(j8 * sinU(a2), 3) >> 8;
  let n6 = j9 >> 1, n9 = n6; const q = o.dir % 8;
  if (q === 2 || q === 6) { n6--; n9--; } else if (q === 1 || q === 7) n6--; else if (q === 3 || q === 5) n9--;
  const n5 = n6 * 2, n4 = n9 * 2, ax = b2.x * 256, ay = b2.y * 256;
  const Z = [ax - n9, ax + n7 - n9, ax - n7 - n9], AA = [ay - n6, ay + n8 - n6, ay - n8 - n6];
  for (let i = 2; i >= 0; i--) {
    const n11 = B.P[i], n12 = B.Q[i], n13 = n11 + B.U, n14 = n12 + B.V;
    for (let j = 2; j >= 0; j--) {
      if (Z[j] > n13 || Z[j] + n4 < n11 || AA[j] > n14 || AA[j] + n5 < n12) continue;
      if (o.h >= b2.h) o.bump = true; else b2.bump = true;
      if (o.h > GEAR_TOP[o.cls][2] || b2.h > GEAR_TOP[b2.cls][2]) world?.fx?.((n11 + Z[j] + n4) / 512, (n12 + AA[j] + n5) / 512, 'spark');
      let n16 = B.P[i] - Z[0], n17 = AA[0] - B.Q[i];
      if ((Z[j] - B.P[i]) * o.c < 0) n16 = ID(n16, 4);
      if ((AA[j] - B.Q[i]) * o.d < 0) n17 = ID(n17, 4);
      const n18 = ID(b2.w8 * 256 + o.w8 * 256, 2);
      let n19 = Math.abs(o.c) + Math.abs(o.d); const n20 = n19 + 1;
      if (o.hero) n19 *= 2;
      const n21 = ID(o.d * n16 + o.c * n17, n18);
      if (!b2.wallX && !o.wallX) { hurt(b2, Math.abs(ID((n21 - b2.s) * 5, GEAR_TOP[0][6]))); b2.s = n21; if (b2.heavy) b2.s = ID(b2.s, 4); }
      const n22 = Math.abs(b2.c) + Math.abs(b2.d) + 1;
      let n23 = n20 >> 16, n24 = n22 >> 16;
      if (o.hero) n23 *= 2; else if (b2.hero) n24 *= 2;
      if (o.heavy) { n23 *= 4; n23 = ID(n23, 2); }
      if (b2.parked) { n23 = ID(n23, 1000); n24 += 300; }
      if (n23 === 0) n23 = 1; if (n24 === 0) n24 = 1;
      const n25 = ID(n24 * 100, n23), n26 = ID(n23 * 100, n24);
      if (b2.wallX || o.wallX) { o.c = 0; b2.c = 0; }
      else if ((Z[0] - B.P[0]) * o.c > 0) { const v = ID(o.c * Math.abs(n21) + ID(b2.c * n25 + o.c * n26, n25 + n26) * (n19 + 1 - Math.abs(n21)), n19 + 1); b2.c = v; o.c = v; }
      if (b2.wallY || o.wallY) { o.d = 0; b2.d = 0; }
      else if ((AA[0] - B.Q[0]) * o.d > 0) { const v = ID(o.d * Math.abs(n21) + ID(b2.d * n25 + o.d * n26, n25 + n26) * (n19 + 1 - Math.abs(n21)), n19 + 1); b2.d = v; o.d = v; }
      let old = b2.h;
      b2.h = ((b2.d * sinU(256 - b2.dir * 16) + b2.c * cosU(256 - b2.dir * 16)) >> 8 >> 8) * DA;
      hurt(b2, Math.abs(ID((b2.h - old) * 5, GEAR_TOP[0][6])));
      old = o.h;
      o.h = ((o.d * sinU(256 - o.dir * 16) + o.c * cosU(256 - o.dir * 16)) >> 8 >> 8) * DA;
      hurt(o, Math.abs(ID((o.h - old) * 5, GEAR_TOP[0][6])));
      for (const q2 of [o, b2]) if (!q2.ai) { const T = GEAR_TOP[q2.cls]; if (q2.gear > 0) { while (q2.gear > 0 && T[q2.gear] > q2.h) q2.gear--; } else if (q2.gear < 0) q2.gear = 0; }
      const n27 = Z[j] >= n11 ? -(Z[j] - n13) : -(Z[j] + n4 - n11), n28 = AA[j] >= n12 ? -(AA[j] - n14) : -(AA[j] + n5 - n12);
      const m29 = Math.abs(n27), m30 = Math.abs(n28);
      if (m29 <= m30) push(o, b2, n27, m29 * (n28 >= 0 ? 1 : -1), n25, n26); else push(o, b2, m30 * (n27 >= 0 ? 1 : -1), n28, n25, n26);
      world?.onCarCrash?.(o, b2, n19);
      return true;                                         // one contact per car and tick, like the original
    }
  }
  return false;
}
// b.a(b2, n, n2, n3, n4): separate two cars, the lighter one moves more; a car pressed against a wall does not move
function push(o, b2, n, n2, n3, n4) {
  if (b2.wallX || b2.wallY) { if (b2.wallX) { o.x -= n / 256; o.wallX = true; } if (b2.wallY) { o.y -= n2 / 256; o.wallY = true; } }
  else if (o.wallX || o.wallY) { if (o.wallX) b2.x += n / 256; if (o.wallY) b2.y += n2 / 256; }
  else { b2.x += n * n3 / (n3 + n4) / 256; b2.y += n2 * n3 / (n3 + n4) / 256; o.x -= n * n4 / (n3 + n4) / 256; o.y -= n2 * n4 / (n3 + n4) / 256; }
}
export function hurt(o, n) { if (o.invincible) return; o.hp -= n; }

// ---- pedestrians: the car's three squares against the lower quarter of the sprite ---------------------------------------
function carVsPeds(o, B, peds, world) {
  const hit = [];
  for (const p of peds) {
    if (p.flying || p.dead || (p.hero && p.down > 0)) continue;
    const j8 = Math.max(o.w8, PED_W) , dx = Math.abs(o.x - p.x), dy = Math.abs(o.y - p.y);
    if (dx > (Math.max(o.w8, o.w8) + PED_W) / 2 || dy > (Math.max(o.w8, PED_H) + PED_H) / 2) continue;      // broad phase of b.a()
    const zx = (p.x - PED_W / 2 + PED_W / 4) * 256, zy = (p.y - PED_H + PED_H * 3 / 4) * 256, w = PED_W / 2 * 256, hh = PED_H / 4 * 256;
    for (let i = 2; i >= 0; i--) {
      if (zx > B.P[i] + B.U || zx + w < B.P[i] || zy > B.Q[i] + B.V || zy + hh < B.Q[i]) continue;
      hit.push(p); world?.onPed?.(o, p); break;
    }
  }
  return hit;
}

// ---- one tick of motion for a car: t(), w(), walls, people, other cars -----------------------------------------------------
export function advance(map, o, world) {
  o.Yk = o.k;
  if (o.h === 0 && o.c === 0 && o.d === 0 && o.s === 0) { const B = boxes(o); if (o.hero || o.ai) wallCollideHero(map, o, B, world); return; }
  o.x += ID((o.c * 100 >> 8) * 24, 16) / 256; o.y += ID((o.d * 100 >> 8) * 24, 16) / 256;           // b.t()
  const B = boxes(o);
  wallCollideHero(map, o, B, world);
  if (world) {
    const B2 = boxes(o);
    if (world.peds) carVsPeds(o, B2, world.peds, world);
    if (world.cars) for (const b2 of world.cars) { if (b2 === o || b2.dead) continue; if (Math.abs(o.x - b2.x) > 90 || Math.abs(o.y - b2.y) > 90) continue; carVsCar(o, b2, boxes(o), world); }
  }
}

// b.C(): velocity chases the thrust vector (grip / drift), steering turns the heading, friction, then position update
export function drive(map, o, world) {
  const T = GEAR_TOP[o.cls], Q = GEAR_ACC[o.cls];
  o.hitWall = false;
  let n2 = 0, n3 = 0;
  if (o.h !== 0) {
    n2 = ID(o.h * cosU(256 - 16 * o.dir), DA); n3 = ID(o.h * sinU(256 - 16 * o.dir), DA);
    let n4 = n2, n5 = n3;
    if (o.slide) { n4 >>= 2; n5 >>= 2; }
    if (n4 !== 0 && o.c !== n4 && (n4 * o.c <= 0 || ID(n4, o.c) > 0)) o.c += (n4 * 100) >> 10;
    if (n5 !== 0 && o.d !== n5 && (n5 * o.d <= 0 || ID(n5, o.d) > 0)) o.d += (n5 * 100) >> 10;
  }
  let n6 = ID(o.s * 100, DA);
  if (o.snap && Math.abs(n6) > 16) n6 = 16 * (n6 >= 0 ? 1 : -1);
  if (!o.thr && n6 < 1024 && !o.ai && o.gear > 0) {
    let n = o.gear; while (n > 0 && o.h < T[n]) n--;
    if (o.gear !== n) { o.gear = n; throttle(o, 1); }
  }
  if (o.c !== 0 || o.d !== 0) {
    advance(map, o, world);
    if (Math.abs(o.c) < 512 && Math.abs(o.d) < 512 && (o.ai || (!o.thr && !o.brk))) { o.gear = 0; setSpeed(o, 0); return; }
    if (o.s !== 0) {
      o.k += n6;
      if (!o.ai) { const n8 = (o.h * cosU(n6 >> 8)) >> 8, n7 = ID(T[2], 2); if (o.h > n7) o.h = Math.max(n8, n7 + 1); }
      if (o.k < 0) o.k += 65536; else if (o.k >= 65536) o.k -= 65536;
      o.dir = ID(256 - (o.k >> 8) + 256 - 8, 16) & 15;
      o.s = Math.abs(o.s) > 32 ? (o.slide ? o.s - ID(n6, 16) : o.s - ID(2 * n6, 16)) : 0;
    }
    let n = o.c - n2, n8 = o.d - n3; const n7 = Math.abs(n), n9 = Math.abs(n8);
    if (n === 0 && n8 === 0) { o.s = 0; o.slide = false; }
    else {
      const lat = ((((o.d >> 8) * cosU(256 - o.dir * 16) - (o.c >> 8) * sinU(256 - o.dir * 16)) >> 8)) * DA;
      let n10 = Q[2] * 4;
      if (o.slide) n10 = ID(n10 * 2, 3);
      n = ID(n * n10 * 100, DA * (n9 + n7)); n8 = ID(n8 * n10 * 100, DA * (n9 + n7));
      o.c = n7 < 1024 ? n2 : o.c - 2 * n; o.d = n9 < 1024 ? n3 : o.d - 2 * n8;
      o.slide = !(o.h >= 0 || ID((Math.abs(n) + Math.abs(n8)) * 3, 2) <= n10);
      o.lateral = lat;
    }
  } else o.slide = false;
  if (o.h !== 0) {
    if (o.ai) { const m = ID(o.h * 100 * 2, 16 * DA); o.h = m === 0 ? 0 : o.h - m; }
    else if (!(Math.abs(o.h) >= ID(T[2], 2) || o.thr || o.rev || o.brk)) o.h -= ID((o.h + 1) * 100, DA * 2);
  }
  o.dir = ((256 - (o.k >> 8) + 7) >> 4) & 15;
}

// Player controls for a car, one call per tick (port of d.aG, branch cH == 1). `inp` = {up, down, left, right, brake} held keys,
// `fresh` = {left, right} keys that went down since the previous tick (the original's `ap`): a tap while moving fast turns the car by one
// heading step at once, holding the key steers smoothly through c(n).
export function heroControl(o, inp, fresh = {}) {
  o.thr = o.rev = o.brk = o.snap = false;
  if (inp.up) { o.thr = true; throttle(o, 1); }
  else if (inp.down) { o.brk = true; throttle(o, -1); }
  else if (inp.brake) { o.rev = true; throttle(o, -1); if (o.h <= 0) { o.gear = 0; o.h = 0; } }
  if (!inp.up && !inp.down && !inp.brake && o.h > 0) o.h -= ID(o.h, 14) + 20;   // engine braking: the original never slows a coasting car above ~850 units (assumption, tuned)
  const fast = o.h > 0 && Math.abs(o.c) + Math.abs(o.d) >= 512;
  if (inp.right && !inp.left) {
    if (fresh.right && fast) { o.snap = true; o.dir = (o.dir + 15) & 15; o.k = (256 - o.dir * 16) << 8; o.s = 1; } else steer(o, 1);
  } else if (inp.left && !inp.right) {
    if (fresh.left && fast) { o.snap = true; o.dir = (o.dir + 1) & 15; o.k = (256 - o.dir * 16) << 8; o.s = 1; } else steer(o, -1);
  } else steer(o, 0);
}
