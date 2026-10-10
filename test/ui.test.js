// Smoke test: runs js/game.js against a tiny fake DOM, simulates touch/zoom input and checks nothing throws.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const listeners = {}, mk = () => ({ style: {}, dataset: {}, onclick: null, onpointerdown: null, onpointerup: null, onpointerleave: null, onchange: null, onfocus: null, textContent: '', width: 240, height: 320, addEventListener(t, f) { (this.l ||= {})[t] = f; }, setPointerCapture() {},
  getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) });
const els = {}; const el = id => els[id] ||= mk();
globalThis.window = globalThis; globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); } };
globalThis.addEventListener = (t, f) => (listeners[t] ||= []).push(f);
const cls = new Set(); const pedal = (id, k) => { const b = el(id); b.dataset.k = k; return b; };
globalThis.document = { getElementById: el, querySelectorAll: () => [pedal('gas', 'up'), pedal('brake', 'down'), pedal('firebtn', 'fire')], documentElement: {}, fullscreenElement: null, body: { classList: { toggle: (c, on) => on ? cls.add(c) : cls.delete(c), has: c => cls.has(c) } } };
globalThis.performance ||= { now: () => Date.now() };
let raf; globalThis.requestAnimationFrame = f => { raf = f; };
const img = { width: 6144, height: 3840 };
globalThis.Image = class { set src(v) { this._s = v; setTimeout(() => this.onload && this.onload(), 0); } get width() { return 6144; } get height() { return 3840; } };
globalThis.fetch = async u => { const path = String(u).replace(/^\//, ''); return { json: async () => JSON.parse(readFileSync(path)), ok: true }; };
globalThis.createImageBitmap = async () => img;
const doc = globalThis.document; doc.createElement = () => { const c = mk(); c.getContext = el('c').getContext; return c; };
let err = null; process.on('unhandledRejection', e => { err = e; });
await import(pathToFileURL(process.cwd() + '/js/game.js').href);
await new Promise(r => setTimeout(r, 400));
let ok = true; const t = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
t(!err, 'game.js loads and starts without errors' + (err ? ': ' + err.message : ''));
t(typeof raf === 'function', 'frame loop is running');
const cv = el('c'); const L = cv.l || {};
t(!!(L.pointerdown && L.pointermove && L.pointerup && L.wheel), 'canvas has pointer + wheel handlers');
let now = 0; const tick = n => { for (let i = 0; i < n; i++) { now += 33; const f = raf; f(now); } };
tick(5); t(true, '5 frames run');
// zoom by wheel
const z0 = cv.width; L.wheel({ preventDefault() {}, deltaY: -100 }); t(cv.width < z0, `wheel zoom in shrinks the logical view (${z0} -> ${cv.width})`);
el('zm').onclick(); el('zm').onclick(); t(cv.width > z0 - 1, 'zoom out button enlarges the view');
// canvas covers the window
t(parseFloat(cv.style.width) >= innerWidth && parseFloat(cv.style.height) >= innerHeight, `canvas covers the window (${cv.style.width} x ${cv.style.height})`);
// touch: press to the left of the hero at the centre of the screen
const cx = cv.width * 0 + innerWidth / 2, cy = innerHeight / 2;
L.pointerdown({ pointerId: 1, clientX: cx - 120, clientY: cy }); tick(30); L.pointerup({ pointerId: 1 }); tick(2);
t(true, 'touch hold left of the hero runs without errors');
L.pointerdown({ pointerId: 1, clientX: cx, clientY: cy }); L.pointerdown({ pointerId: 2, clientX: cx + 100, clientY: cy }); L.pointermove({ pointerId: 2, clientX: cx + 200, clientY: cy }); const wz = cv.width; tick(2); L.pointerup({ pointerId: 1 }); L.pointerup({ pointerId: 2 }); t(true, 'two-finger pinch handled');

// ---- tap a car: hero walks to it and gets in ----
const D = globalThis.__dbg;
const openRoad = (c, heading) => { const m = D().map, T = 24; for (let r = 0; r < 80; r++) for (let a = 0; a < 360; a += 15) { const x = Math.floor((c.x + Math.cos(a * Math.PI / 180) * r * T) / T) * T + 12, y = Math.floor((c.y + Math.sin(a * Math.PI / 180) * r * T) / T) * T + 12;
    let clear = true; for (let dx = -3; dx <= 3 && clear; dx++) for (let dy = -3; dy <= 3; dy++) if (m.tileAt(x + dx * T, y + dy * T).collision !== 0) { clear = false; break; }
    if (clear) { c.x = x; c.y = y; if (c.speed !== undefined) c.speed = 0; if (heading !== undefined) c.heading = heading; return true; } } return false; };
const toScreen = o => ({ x: (o.x - D().cam.x) * D().zoom, y: (o.y - D().cam.y) * D().zoom });
{
  const d = D(), car = d.cars.find(c => !c.ai); d.p.x = car.x - 70; d.p.y = car.y; d.cars.forEach(c => { if (c !== car) c.ai = false; });
  tick(3); const s = toScreen(car);
  L.pointerdown({ pointerId: 1, clientX: s.x, clientY: s.y }); L.pointerup({ pointerId: 1 });
  let sat = false; for (let i = 0; i < 240 && !sat; i++) { tick(1); sat = D().drive === car; }
  t(sat, 'tapping a car makes the hero walk to it and get in');
  tick(1); t(cls.has('driving'), 'pedal buttons are shown while in a car (body.driving)');
  t(openRoad(car, 0), 'found an open stretch of road for the driving checks'); tick(2);
  // touching beside the car without a pedal does not move it
  const x0 = car.x, y0 = car.y, h0 = car.heading, rel = (k) => { const sd = [Math.sin(car.heading * Math.PI / 180), Math.cos(car.heading * Math.PI / 180)]; return toScreen({ x: car.x + sd[0] * k, y: car.y + sd[1] * k }); };
  { const s2 = rel(60); L.pointerdown({ pointerId: 1, clientX: s2.x, clientY: s2.y }); tick(40); L.pointerup({ pointerId: 1 }); }
  t(Math.hypot(car.x - x0, car.y - y0) < 5, 'touching the screen alone does not drive the car (gas is a separate button)');
  // gas pedal + touch on the car's right side: drives and turns clockwise (heading decreases)
  const ad = (a, b) => ((b - a + 540) % 360) - 180;
  el('gas').onpointerdown(); { const s2 = rel(60); L.pointerdown({ pointerId: 1, clientX: s2.x, clientY: s2.y }); } tick(45); 
  const h1 = car.heading; L.pointerup({ pointerId: 1 }); el('gas').onpointerup();
  t(Math.hypot(car.x - x0, car.y - y0) > 20, `gas button drives the car (${Math.round(Math.hypot(car.x - x0, car.y - y0))}px)`);
  t(ad(h0, h1) < -5, `touch on the car's right side steers right (heading ${Math.round(h0)} -> ${Math.round(h1)})`);
  // left side steers the other way (steering is relative to the car's own orientation, whatever way it points)
  { openRoad(car, 90); tick(2); const h2 = car.heading; el('gas').onpointerdown(); const s3 = rel(-60); L.pointerdown({ pointerId: 1, clientX: s3.x, clientY: s3.y }); tick(45); const h3 = car.heading; L.pointerup({ pointerId: 1 }); el('gas').onpointerup();
    t(ad(h2, h3) > 5, `touch on the car's left side steers left (heading ${Math.round(h2)} -> ${Math.round(h3)})`); }
  // brake pedal slows / reverses
  { openRoad(car, 180); tick(2); el('gas').onpointerdown(); tick(30); el('gas').onpointerup(); const v = car.speed; el('brake').onpointerdown(); tick(40); el('brake').onpointerup(); t(car.speed < v - 40, `brake button slows the car (${Math.round(v)} -> ${Math.round(car.speed)})`); }
}
// ---- hold left of the hero on foot: moves left ----
{
  const d = D(); if (d.drive) el('ebtn').onpointerdown(); tick(30); t(!cls.has('driving'), 'pedal buttons are hidden on foot');
  d.cars.forEach(c => { c.x = 20; c.y = 20; c.speed = 0; c.ai = false; }); openRoad(D().p); tick(3);   // no car next to the hero, so taps mean 'run', not 'get in'
  const x0 = D().p.x, sp = toScreen(D().p); L.pointerdown({ pointerId: 1, clientX: sp.x - 150, clientY: sp.y - 12 }); tick(30); L.pointerup({ pointerId: 1 });
  t(D().p.x < x0 - 5, `touch to the left of the hero runs left (${Math.round(D().p.x - x0)}px)`);
  const y1 = D().p.y, sp2 = toScreen(D().p); L.pointerdown({ pointerId: 1, clientX: sp2.x, clientY: sp2.y + 150 }); tick(30); L.pointerup({ pointerId: 1 });
  t(D().p.y > y1 + 5, `touch below the hero runs down (${Math.round(D().p.y - y1)}px)`);
}
// ---- shooting a pedestrian: blood on the ground and a body lying head-first the way the bullet went ----
{
  const d = D(); d.cars.forEach(c => { c.x = 20; c.y = 20; c.speed = 0; c.ai = false; }); openRoad(d.p); d.peds.length = 0; d.cops.length = 0; tick(3);
  d.p.dir = 0; d.p.weapon = 0; d.p.cool = 0; const victim = { x: d.p.x + 45, y: d.p.y, dir: 30, kind: 'man', pal: 1, down: 0, moving: false, wait: 5, turn: 5, t: 0, vx: 0, vy: 0 }; d.peds.push(victim);
  el('firebtn').onpointerdown(); tick(30); el('firebtn').onpointerup();
  t(victim.dead, 'a pedestrian in the line of fire is shot'); t(!!victim.lie && victim.lie.x > 0, 'the body remembers the direction of the shot'); t(d.fxs.stains.length > 0, `blood stains appear (${D().fxs.stains.length})`);
  tick(30 * 4); t(D().fxs.stains.length >= 3 && victim.poolMade, `a pool forms under the body once it lies still (${D().fxs.stains.length} stains)`);
  el('bl').onclick(); t(D().fxs.stains.length === 0 && D().fxs.blood === false, 'the blood button switches blood off and clears it'); el('bl').onclick(); t(D().fxs.blood === true, 'and on again');
}
// ---- tyre marks, smoke, fire and wrecks in the real game loop ----
{
  const d = D(); d.cars.forEach(c => { c.x = 20; c.y = 20; c.speed = 0; c.ai = false; }); d.peds.length = 0; d.cops.length = 0; openRoad(d.p); tick(3);
  const car = d.cars.find(c => !c.ai && !c.wreck); car.x = d.p.x + 40; car.y = d.p.y; car.heading = 0; car.speed = 0; car.hp = car.hpMax = 100; car.wreck = false; car.burn = 0; openRoad(car, 0); d.p.x = car.x - 60; d.p.y = car.y; tick(2);
  const s0 = D().fxs.skids.length; car.speed = 140; for (let i = 0; i < 12; i++) tick(1); el('brake').onpointerdown(); D().p.x = car.x; D().p.y = car.y;
  // brake while driving: get in first
  el('brake').onpointerup();
  const hero = D().p; hero.x = car.x + 10; hero.y = car.y; tick(1); el('ebtn').onpointerdown(); tick(2); t(D().drive === car, 'hero gets into the car for the tyre test');
  car.speed = 140; el('brake').onpointerdown(); tick(12); const fresh = D().fxs.skids.filter(s => s.age < 1 && Math.hypot(s.x2 - car.x, s.y2 - car.y) < 80).length; tick(8); el('brake').onpointerup(); t(fresh > 8, `braking hard leaves fresh tyre marks right behind the car (${fresh} segments)`);
  t(D().fxs.smoke.length > 0, `and tyre smoke (${D().fxs.smoke.length} puffs)`);
  el('ebtn').onpointerdown(); tick(2); t(D().drive === null, 'hero gets out');
  car.speed = 0; car.hp = 35; D().fxs.smoke.length = 0; tick(40); t(D().fxs.smoke.length > 5, `a damaged car (35%) smokes (${D().fxs.smoke.length} puffs)`);
  car.hp = 0; const beforeFlames = D().fxs.flames.length; tick(20); t(D().fxs.flames.length > beforeFlames, 'a burning car shows flames'); t(!car.wreck, 'it is still a car for a moment');
  // someone standing near the burning car gets caught by the blast
  const victim = { x: car.x + 30, y: car.y + 4, dir: 30, kind: 'man', pal: 1, down: 0, moving: false, wait: 50, turn: 50, t: 0, vx: 0, vy: 0 }; D().peds.push(victim);
  let exploded = false; for (let i = 0; i < 30 * 6 && !exploded; i++) { victim.x = car.x + 30; victim.y = car.y + 4; tick(1); exploded = car.wreck; }   // the bystander keeps standing next to the car until it blows
  t(exploded, `after a few seconds the burning car explodes (${(car.burn || 0).toFixed(1)} s)`); tick(3); t(D().fxs.rings.length > 0 || D().fxs.flames.length > 30, 'with a fireball'); t(victim.dead, 'a pedestrian next to it is killed'); t(D().fxs.stains.some(s => s.col), 'and a scorch mark stays on the road');
  tick(60); t(D().fxs.flames.length > 0, 'the wreck keeps burning for a while');
  const h2 = D().p; h2.x = car.x + 6; h2.y = car.y + 20; h2.down = 0; h2.fly = null; tick(2); el('ebtn').onpointerdown(); tick(2); t(D().drive !== car && !(D().drive && D().drive.wreck), 'a burnt-out wreck cannot be entered');
  const sp = el('snd'); t(typeof sp.onclick === 'function', 'there is a sound button'); t(D().audio.supported === false, 'in the test environment audio is a safe no-op');
}
// ---- moving traffic is actually visible around the hero ----
while (D().zoom > 3.2) el('zm').onclick();   // typical zoom
for (const city of ['city1_h', 'city2_s']) {
  el('city').onchange({ target: { value: city } }); await new Promise(r => setTimeout(r, 300));
  let seen = 0, frames = 0, moving = 0;
  for (let i = 0; i < 30 * 60; i++) { tick(1); const d = D(); frames++; const vis = d.cars.filter(c => c.ai && Math.abs(c.x - d.p.x) < d.VW / 2 && Math.abs(c.y - d.p.y) < d.VH / 2); if (vis.length) seen++; if (vis.some(c => Math.abs(c.speed) > 20)) moving++; }
  t(seen / frames > 0.3 && moving / frames > 0.15, `${city}: a traffic car is in view ${Math.round(100 * seen / frames)}% of the time, moving in ${Math.round(100 * moving / frames)}%`);
}
process.exit(ok ? 0 : 1);
