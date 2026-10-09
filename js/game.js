import { loadMap, loadSprite, drawMap, drawFrame, animAt } from './engine.js';
import { newPlayer, step, animIndex } from './player.js';
import { spawnCars, stepCar, nearestCar, exitSpot, CAR_SPRITES } from './vehicle.js';
import { spawnPeds, stepPed, pedAnim, topUpPeds } from './ped.js';
import { spawnTraffic, stepTraffic, topUpTraffic } from './traffic.js';
import { carHits, carVsCar } from './collide.js';
import { newCop, stepCop, copAnim, newWanted, addHeat, stars, stepWanted, manageCops, hurtHero, reviveHero, HERO_HP } from './police.js';
import { findSpawn } from './player.js';
import { WEAPONS, arm, nextWeapon, stepArm, fire, armAnim, stepBullets, scare } from './weapons.js';
const cv = document.getElementById('c'), ctx = cv.getContext('2d'), $ = id => document.getElementById(id);
let VW = 240, VH = 320, zoom = 3;
function resize() { VW = Math.ceil(innerWidth / zoom); VH = Math.ceil(innerHeight / zoom); cv.width = VW; cv.height = VH; cv.style.width = VW * zoom + 'px'; cv.style.height = VH * zoom + 'px'; ctx.imageSmoothingEnabled = false; }
function setZoom(z) { zoom = Math.max(1, Math.min(8, z)); try { localStorage.setItem('zoom', zoom); } catch (e) {} resize(); }
{ let z = NaN; try { z = parseFloat(localStorage.getItem('zoom')); } catch (e) {} zoom = z >= 1 && z <= 8 ? z : Math.max(2, Math.min(4, Math.round(Math.min(innerWidth, innerHeight) / 200))); resize(); }
addEventListener('resize', resize);
let cops = [], wanted = newWanted(), wastedT = -1, bullets = [], map, hero, heroPal = {}, peds = [], p, cam = { x: 0, y: 0 }, debug = false, cars = [], carSpr = {}, drive = null, hint = '';
const keys = {};
const map_ = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', left: 'left', right: 'right', up: 'up', down: 'down' };
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = keys[e.key] = true; if (e.key === 'f') debug = !debug; if ((e.key === 'e' || e.key === 'E') && !e.repeat) toggleCar(); if ((e.key === 'q' || e.key === 'Q') && !e.repeat && !drive) nextWeapon(p); if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = keys[e.key] = false; });
const input = () => { const i = { run: !!(keys.Shift || keys.shift) }; for (const k in map_) if (keys[k]) i[map_[k]] = true; return i; };
// ---- pointer / touch: hold left/right/above/below the hero to run that way (any direction for a car), tap a car to get in, wheel / pinch to zoom ----
const ptrs = new Map(); let pinch = null, aim = null, auto = null;
const world = pt => ({ x: cam.x + pt.x / zoom, y: cam.y + pt.y / zoom });
const pdist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { pinch = { d: pdist(), z: zoom }; aim = null; auto = null; return; }
  if (ptrs.size > 2 || p.dead) return;
  const w = world({ x: e.clientX, y: e.clientY });
  if (!drive) {
    let best = null, bd = 26; for (const c of cars) { const d = Math.max(Math.abs(w.x - c.x), Math.abs(w.y - c.y)); if (d < bd) { bd = d; best = c; } }
    if (best) { auto = { car: best, t: 0, lx: p.x, ly: p.y, still: 0, axis: null }; aim = null; return; }
  }
  auto = null; aim = { x: e.clientX, y: e.clientY };
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2 && pinch) setZoom(pinch.z * pdist() / pinch.d); else if (aim && ptrs.size === 1) aim = { x: e.clientX, y: e.clientY };
});
const pend = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) aim = null; };
cv.addEventListener('pointerup', pend); cv.addEventListener('pointercancel', pend);
cv.addEventListener('wheel', e => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
const pointerInput = () => {
  const i = {}; if (!aim) return i; const w = world(aim);
  if (drive) { const dx = w.x - drive.x, dy = w.y - drive.y; if (dy > 22) i.down = true; else i.up = true; if (dx < -14) i.left = true; else if (dx > 14) i.right = true; return i; }
  const dx = w.x - p.x, dy = w.y - (p.y - 12); i.run = true;
  if (Math.hypot(dx, dy) < 8) return {};
  if (Math.abs(dx) > Math.abs(dy)) i[dx < 0 ? 'left' : 'right'] = true; else i[dy < 0 ? 'up' : 'down'] = true;
  return i;
};
// walk to the tapped car and get in
const autoInput = dt => {
  if (!auto || drive) return {}; const c = auto.car, dx = c.x - p.x, dy = c.y - p.y; auto.t += dt;
  if (Math.hypot(dx, dy) <= 30) { drive = c; c.ai = false; auto = null; return {}; }
  if (auto.t > 8) { auto = null; return {}; }
  auto.still = Math.hypot(p.x - auto.lx, p.y - auto.ly) < 0.3 ? auto.still + dt : 0; auto.lx = p.x; auto.ly = p.y;
  if (auto.axis === null) auto.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  if (auto.still > 0.25) { auto.axis = auto.axis === 'x' ? 'y' : 'x'; auto.still = 0; }
  const i = { run: true }; if (auto.axis === 'x' && Math.abs(dx) > 4) i[dx < 0 ? 'left' : 'right'] = true; else if (Math.abs(dy) > 4) i[dy < 0 ? 'up' : 'down'] = true; else i[dx < 0 ? 'left' : 'right'] = true;
  return i;
};

function toggleCar() {
  if (drive) { const sp = exitSpot(map, drive); if (!sp) return; p.x = sp.x; p.y = sp.y; drive.speed = 0; drive = null; return; }
  const c = nearestCar(cars, p); if (c) { drive = c; c.ai = false; }
}
async function start(tag) { map = await loadMap(tag); p = arm(newPlayer(map)); p.hp = HERO_HP; bullets = []; cops = []; wanted = newWanted(); wastedT = -1; drive = null; cars = [...spawnCars(map, p, 5), ...spawnTraffic(map, p, 6)]; topUpTraffic(map, p, cars, 8, Math.random, 60, 260); peds = spawnPeds(map, p, 14); }
$('city').onchange = e => start(e.target.value);
// touch / on-screen buttons
document.querySelectorAll('[data-k]').forEach(b => { const k = b.dataset.k; b.onpointerdown = () => keys[k] = true; b.onpointerup = b.onpointerleave = () => keys[k] = false; });

$('ebtn').onpointerdown = toggleCar;
$('zp').onclick = () => setZoom(zoom * 1.25); $('zm').onclick = () => setZoom(zoom / 1.25);
$('fs').onclick = () => { const el = document.documentElement; try { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) {} };
$('city').onfocus = () => { for (const k in keys) keys[k] = false; };
$('qbtn').onpointerdown = () => { if (!drive) nextWeapon(p); };
globalThis.__dbg = () => ({ get drive() { return drive; }, cars, peds, cops, p, cam, zoom, VW, VH });
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  let inp = p.dead ? {} : input();
  if (!p.dead && !Object.keys(inp).some(k => k !== 'run' && inp[k])) { const pi = pointerInput(); inp = Object.keys(pi).length ? pi : autoInput(dt); } else auto = null;
  if (drive) stepCar(map, drive, inp, dt); else step(map, p, inp, dt);
  const tx = (drive || p).x, ty = (drive || p).y;
  if (p.dead) { wastedT += dt; if (wastedT > 2.5) { const s = findSpawn(map); reviveHero(p, s.x, s.y); cops = []; wanted = newWanted(); wastedT = -1; } }
  const obst = [p, ...peds, ...cars];
  for (const c of cars) if (c !== drive) { if (c.ai) stepTraffic(map, c, obst, dt); else if (Math.abs(c.speed) > 0) stepCar(map, c, {}, dt); }   // traffic drives, abandoned cars roll to a stop
  for (const q of peds) stepPed(map, q, dt);
  stepArm(p, dt);
  if (!drive && !p.dead && (keys[' '] || keys.fire)) { const nb = fire(p); if (nb.length) { bullets.push(...nb); scare(peds, p.x, p.y); } }
  const onHit = (kind, t) => {
    if (kind === 'cop') { if (t.dead) addHeat(wanted, 60); else addHeat(wanted, 10); }
    else if (kind === 'hero' && hurtHero(p, drive ? 4 : 8)) { if (drive) { p.x = drive.x; p.y = drive.y; drive = null; } wastedT = 0; }
  };
  for (const q of stepBullets(map, bullets, peds, cars, dt, { cops, hero: p, driving: drive, onHit })) { scare(peds, q.x, q.y, 120); addHeat(wanted, 30); }
  manageCops(map, wanted, cops, tx, ty); stepWanted(wanted, cops, tx, ty, dt);
  for (const c of cops) { const b = stepCop(map, c, tx, ty, dt); if (b) bullets.push(b); }
  const viewR = Math.hypot(VW, VH) / 2;
  topUpPeds(map, drive || p, peds, 14, Math.random, viewR + 20, viewR + 320); topUpTraffic(map, drive || p, cars, 12, Math.random, viewR + 20, viewR + 230);
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    const hit = carHits(map, c, peds, drive ? null : p); if (c === drive) for (const o of hit) if (o !== p) addHeat(wanted, 20);
    for (let j = i + 1; j < cars.length; j++) carVsCar(map, c, cars[j]);
  }
  const fx = drive ? drive.x : p.x, fy = drive ? drive.y : p.y;
  cam.x = fx - VW / 2; cam.y = fy - VH / 2;
  const c = drawMap(ctx, map, cam.x, cam.y, VW, VH); cam.x = c.camX; cam.y = c.camY;
  const sx = p.x - cam.x, sy = p.y - cam.y;
  const aa = !drive && armAnim(p), ai = aa || animIndex(p), a = animAt(hero, ai, aa ? p.since * 1000 : p.t * 1000);
  const items = cars.map(c => ({ y: c.y, draw: () => { const spr = carSpr[c.type], an = spr.info.animations[c.anim][0]; drawFrame(ctx, spr, an.frame, c.x - cam.x, c.y - cam.y, an.flip); } }));
  for (const q of peds) items.push({ y: q.y + 1, draw: () => { const s = q.kind === 'woman' ? hero : heroPal[q.pal], a = animAt(s, pedAnim(q), q.t * 1000); if (a) drawFrame(ctx, s, a.frame, q.x - cam.x + a.dx, q.y - cam.y + a.dy, a.flip); } });
  for (const c of cops) items.push({ y: c.y + 1, draw: () => { const k = copAnim(c), a = animAt(hero, k, (c.since < 0.6 ? c.since : c.t) * 1000); if (a) drawFrame(ctx, hero, a.frame, c.x - cam.x + a.dx, c.y - cam.y + a.dy, a.flip); } });
  if (!drive) items.push({ y: p.y + 1, draw: () => { if (a) drawFrame(ctx, hero, a.frame, sx + a.dx, sy + a.dy, a.flip); } });
  items.sort((u, v) => u.y - v.y).forEach(i => i.draw());
  ctx.fillStyle = '#ff0'; for (const b of bullets) ctx.fillRect(b.x - cam.x - 1, b.y - cam.y - 18, 2, 2);
  ctx.fillStyle = '#400'; ctx.fillRect(4, 14, 52, 5); ctx.fillStyle = '#e33'; ctx.fillRect(4, 14, 52 * Math.max(0, p.hp) / HERO_HP, 5);
  ctx.fillStyle = '#fc0'; ctx.font = '10px monospace'; ctx.fillText('★'.repeat(stars(wanted)) + '☆'.repeat(3 - stars(wanted)), VW - 44, 12);
  if (p.dead) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, VW, VH); ctx.fillStyle = '#e33'; ctx.font = 'bold 20px monospace'; ctx.fillText('WASTED', VW / 2 - 40, VH / 2); ctx.font = '8px monospace'; }
  const near = !drive && nearestCar(cars, p);
  if (!drive) { ctx.fillStyle = '#fff'; ctx.fillText(WEAPONS[p.weapon].name + ' (Q)', 4, 10); }
  hint = drive ? 'E — выйти · ↑ газ · ↓ тормоз/назад · ←→ руль' : near ? 'E — сесть в машину' : 'Пробел — огонь · Q — оружие';
  ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.fillText(hint, 4, VH - 6);
  if (drive) ctx.fillText(Math.round(Math.abs(drive.speed)) + ' km/h', 4, 10);
  if (debug) {
    ctx.fillStyle = 'rgba(255,0,0,.8)'; ctx.fillRect(sx - 1, sy - 1, 3, 3);
    const t = map.tileAt(p.x, p.y); $('info').textContent = `x ${(drive||p).x|0} y ${(drive||p).y|0} · тайл ${t.tile} · коллизия ${t.collision} · anim ${ai}`;
  } else $('info').textContent = '';
  requestAnimationFrame(frame);
}
hero = await loadSprite('i_00'); for (const k of [1, 2, 3]) heroPal[k] = await loadSprite('i_00', k); for (const id of CAR_SPRITES) carSpr[id] = await loadSprite(id); await start('city1_h'); requestAnimationFrame(frame);
