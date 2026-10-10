import { loadMap, loadSprite, drawMap, drawFrame, animAt } from './engine.js';
import { newPlayer, step, animIndex, DIR } from './player.js';
import { lyingPose, facingOf } from './lying.js';
import { spawnCars, stepCar, nearestCar, exitSpot, carDist, side, CAR_SPRITES } from './vehicle.js';
import { spawnPeds, stepPed, pedAnim, topUpPeds } from './ped.js';
import { spawnTraffic, stepTraffic, topUpTraffic, managePoliceCars } from './traffic.js';
import { carHits, carVsCar, keepOutOfCars, flyStep } from './collide.js';
import { newFx, addSparks, addPuff, stepFx, drawFx, shake, addBlood, addPool, smear, stepBlood, drawStains, drawDrops } from './fx.js';
import { newCop, stepCop, copAnim, copAnimTime, newWanted, addHeat, stars, stepWanted, manageCops, hurtHero, reviveHero, HERO_HP } from './police.js';
import { findSpawn } from './player.js';
import { WEAPONS, arm, nextWeapon, stepArm, fire, armAnim, stepBullets, scare } from './weapons.js';
const cv = document.getElementById('c'), ctx = cv.getContext('2d'), $ = id => document.getElementById(id);
let VW = 240, VH = 320, zoom = 3;
function resize() { VW = Math.ceil(innerWidth / zoom); VH = Math.ceil(innerHeight / zoom); cv.width = VW; cv.height = VH; cv.style.width = VW * zoom + 'px'; cv.style.height = VH * zoom + 'px'; ctx.imageSmoothingEnabled = false; }
function setZoom(z) { zoom = Math.max(1, Math.min(8, z)); try { localStorage.setItem('zoom', zoom); } catch (e) {} resize(); }
{ let z = NaN; try { z = parseFloat(localStorage.getItem('zoom')); } catch (e) {} zoom = z >= 1 && z <= 8 ? z : Math.max(2, Math.min(4, Math.round(Math.min(innerWidth, innerHeight) / 200))); resize(); }
addEventListener('resize', resize);
const fxs = newFx();
try { if (localStorage.getItem('blood') === '0') fxs.blood = false; } catch (e) {}
function toggleBlood() { fxs.blood = !fxs.blood; if (!fxs.blood) { fxs.stains.length = 0; fxs.drops.length = 0; } try { localStorage.setItem('blood', fxs.blood ? '1' : '0'); } catch (e) {} }
let rammed = 0, cops = [], wanted = newWanted(), wastedT = -1, bullets = [], map, hero, heroPal = {}, peds = [], p, cam = { x: 0, y: 0 }, debug = false, cars = [], carSpr = {}, drive = null, hint = '';
const keys = {};
const map_ = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', left: 'left', right: 'right', up: 'up', down: 'down' };
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = keys[e.key] = true; if (e.key === 'f') debug = !debug; if ((e.key === 'e' || e.key === 'E') && !e.repeat) toggleCar(); if ((e.key === 'q' || e.key === 'Q') && !e.repeat && !drive) nextWeapon(p); if ((e.key === 'b' || e.key === 'B') && !e.repeat) toggleBlood(); if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); });
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
    let best = null, bd = 6; for (const c of cars) { const d = carDist(c, w.x, w.y); if (d < bd) { bd = d; best = c; } }
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
  if (drive) { const [sx, sy] = side(drive.heading), r = (w.x - drive.x) * sx + (w.y - drive.y) * sy; if (r > 10) i.right = true; else if (r < -10) i.left = true; return i; }   // touch right/left of the car's body = steer that way; gas and brake are separate buttons
  const dx = w.x - p.x, dy = w.y - (p.y - 12); i.run = true;
  if (Math.hypot(dx, dy) < 8) return {};
  if (Math.abs(dx) > Math.abs(dy)) i[dx < 0 ? 'left' : 'right'] = true; else i[dy < 0 ? 'up' : 'down'] = true;
  return i;
};
// walk to the tapped car and get in
const autoInput = dt => {
  if (!auto || drive) return {}; const c = auto.car, dx = c.x - p.x, dy = c.y - p.y; auto.t += dt;
  if (carDist(c, p.x, p.y) <= 10) { drive = c; c.ai = false; auto = null; return {}; }
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
document.querySelectorAll('[data-k]').forEach(b => { const k = b.dataset.k; b.onpointerdown = () => keys[k] = true; b.onpointerup = b.onpointerleave = b.onpointercancel = () => keys[k] = false; });

$('ebtn').onpointerdown = toggleCar;
$('bl').onclick = toggleBlood;
$('zp').onclick = () => setZoom(zoom * 1.25); $('zm').onclick = () => setZoom(zoom / 1.25);
$('fs').onclick = () => { const el = document.documentElement; try { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) {} };
$('city').onfocus = () => { for (const k in keys) keys[k] = false; };
$('qbtn').onpointerdown = () => { if (!drive) nextWeapon(p); };
// draws a character; while flying it gets a ground shadow, height and a spin around its middle
function drawBody(spr, a, x, y, fly, xor = 0) {
  if (!fly) { drawFrame(ctx, spr, a.frame, x + a.dx, y + a.dy, a.flip ^ xor); return; }
  if (fly.z <= 2) { drawFrame(ctx, spr, a.frame, x + a.dx, y + a.dy - fly.z, a.flip ^ xor); return; }   // sliding on the ground: lying flat, no spin
  ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0.12, 0.35 - fly.z * 0.006).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(x, y, Math.max(3, 8 - fly.z * 0.08), 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(x, y - fly.z - 10); ctx.rotate(fly.rot); drawFrame(ctx, spr, a.frame, a.dx, a.dy + 10, a.flip ^ xor); ctx.restore();
}
globalThis.__dbg = () => ({ get drive() { return drive; }, cars, peds, cops, p, cam, zoom, VW, VH, map, fxs });
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  let inp = p.dead ? {} : input();
  document.body.classList.toggle('driving', !!drive);
  if (drive && !p.dead) { const pi = pointerInput(); if (!inp.left && !inp.right) { if (pi.left) inp.left = true; if (pi.right) inp.right = true; } auto = null; }
  else if (!p.dead && !Object.keys(inp).some(k => k !== 'run' && inp[k])) { const pi = pointerInput(); inp = Object.keys(pi).length ? pi : autoInput(dt); } else auto = null;
  const px0 = p.x, py0 = p.y;
  if (drive) stepCar(map, drive, inp, dt); else { step(map, p, inp, dt); keepOutOfCars(cars, p, px0, py0); }
  const tx = (drive || p).x, ty = (drive || p).y;
  if (p.dead) { wastedT += dt; if (wastedT > 2.5) { const s = findSpawn(map); reviveHero(p, s.x, s.y); p.poolMade = false; p.lie = null; cops = []; wanted = newWanted(); wastedT = -1; } }
  rammed -= dt;
  const obst = [p, ...peds, ...cars];
  for (const c of cars) if (c !== drive) { if (c.ai) stepTraffic(map, c, c.police ? obst.filter(o => o !== p && o !== drive) : obst, dt); else if (Math.abs(c.speed) > 0) stepCar(map, c, {}, dt); }   // traffic drives, abandoned cars roll to a stop
  for (const q of peds) stepPed(map, q, dt);
  stepArm(p, dt);
  if (!drive && !p.dead && (keys[' '] || keys.fire)) { const nb = fire(p); if (nb.length) { bullets.push(...nb); scare(peds, p.x, p.y); } }
  const onHit = (kind, t) => {
    if (kind === 'cop') addBlood(fxs, t.x, t.y - 8, t.dead ? 0.9 : 0.5, t.lie ? t.lie.x : 0, t.lie ? t.lie.y : 0);
    if (kind === 'hero' && !drive) { p.lie = { x: t.vx, y: t.vy }; addBlood(fxs, p.x, p.y - 8, 0.5, t.vx, t.vy); }
    if (kind === 'policecar') { if (t.hp <= 0 && t.ai) { t.ai = false; t.police = false; addHeat(wanted, 25); } }
    else if (kind === 'cop') { if (t.dead) addHeat(wanted, 60); else addHeat(wanted, 10); }
    else if (kind === 'hero' && hurtHero(p, drive ? 4 : 8)) { if (drive) { p.x = drive.x; p.y = drive.y; drive = null; } wastedT = 0; }
  };
  for (const q of stepBullets(map, bullets, peds, cars, dt, { cops, hero: p, driving: drive, onHit })) { scare(peds, q.x, q.y, 120); addHeat(wanted, 30); addBlood(fxs, q.x, q.y - 8, 0.8, q.lie ? q.lie.x : 0, q.lie ? q.lie.y : 0); }
  manageCops(map, wanted, cops, tx, ty); stepWanted(wanted, cops, tx, ty, dt);
  for (const c of cops) { const b = stepCop(map, c, tx, ty, dt); if (b) bullets.push(b); }
  const viewR = Math.hypot(VW, VH) / 2;
  managePoliceCars(map, stars(wanted), drive || p, cars, Math.random, viewR + 40, viewR + 240);
  topUpPeds(map, drive || p, peds, 14, Math.random, viewR + 20, viewR + 320); topUpTraffic(map, drive || p, cars, 12, Math.random, viewR + 20, viewR + 230);
  for (const q of peds) { if (q.fly) { flyStep(map, q, dt); if (q.fly && q.fly.hard) { q.fly.hard = false; addPuff(fxs, q.x, q.y - 2, 3); } } }
  for (const k2 of cops) if (k2.fly) { flyStep(map, k2, dt); if (k2.fly && k2.fly.hard) { k2.fly.hard = false; addPuff(fxs, k2.x, k2.y - 2, 3); } }
  if (p.fly) { flyStep(map, p, dt); if (p.fly && p.fly.hard) { p.fly.hard = false; addPuff(fxs, p.x, p.y - 2, 3); } }
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    const hit = carHits(map, c, peds, drive ? null : p, Math.random, c.police ? [] : cops);   // police cars do not run over their own
    for (const o of hit) { addBlood(fxs, o.x, o.y - 6, Math.min(1.5, Math.abs(c.speed) / 90), Math.cos(c.heading * Math.PI / 180) * Math.sign(c.speed), -Math.sin(c.heading * Math.PI / 180) * Math.sign(c.speed)); addSparks(fxs, o.x, o.y - 8, 0.35, Math.cos(c.heading * Math.PI / 180) * Math.sign(c.speed), -Math.sin(c.heading * Math.PI / 180) * Math.sign(c.speed)); addPuff(fxs, o.x, o.y - 6, 4); if (c === drive) shake(fxs, 2); }
    if (c === drive) for (const o of hit) if (o !== p) addHeat(wanted, cops.includes(o) ? (o.dead ? 60 : 25) : 20);
    if (c.police && hit.includes(p) && hurtHero(p, 15)) wastedT = 0;
    if (c.bump) { addSparks(fxs, c.bump.x, c.bump.y, Math.min(1.3, c.bump.v / 120)); if (c.bump.v > 90) addPuff(fxs, c.bump.x, c.bump.y, 3); if (c === drive) shake(fxs, Math.min(7, c.bump.v / 22)); c.bump = null; }
    for (let j = i + 1; j < cars.length; j++) {
      const r = carVsCar(map, c, cars[j]); if (!r) continue;
      if (r.impact > 25) { addSparks(fxs, r.x, r.y, Math.min(1.6, r.impact / 100)); if (r.impact > 80) addPuff(fxs, r.x, r.y, 4); if (c === drive || cars[j] === drive) shake(fxs, Math.min(8, r.impact / 16)); }
      if (drive && (c === drive || cars[j] === drive) && (c.police || cars[j].police) && !(rammed > 0)) { rammed = 0.6; if (hurtHero(p, 6)) { p.x = drive.x; p.y = drive.y; drive = null; wastedT = 0; } }
    }
  }
  stepFx(fxs, dt); stepBlood(fxs, dt);
  for (const o of [...peds, ...cops, p]) {                                     // smears while a body slides, a pool once it lies still
    if (o.fly && o.fly.z === 0 && (o.fly.vx || o.fly.vy)) smear(fxs, o, o.x, o.y);
    if (o.dead && !o.fly && !o.poolMade) { o.poolMade = true; addPool(fxs, o.x, o.y); }
  }
  const fx = drive ? drive.x : p.x, fy = drive ? drive.y : p.y;
  cam.x = fx - VW / 2 + (Math.random() - 0.5) * 2 * fxs.shake; cam.y = fy - VH / 2 + (Math.random() - 0.5) * 2 * fxs.shake;
  const c = drawMap(ctx, map, cam.x, cam.y, VW, VH); cam.x = c.camX; cam.y = c.camY;
  drawStains(ctx, fxs, cam.x, cam.y);
  const sx = p.x - cam.x, sy = p.y - cam.y;
  const lyingH = !drive && (p.down > 0 || p.dead), lpH = lyingH ? lyingPose('man', p.lie, facingOf(DIR, p.dir)) : null;
  const aa = !drive && !lyingH && armAnim(p), ai = lpH ? lpH.anim : (aa || animIndex(p)), a = animAt(hero, ai, aa ? p.since * 1000 : p.t * 1000);
  const items = cars.map(c => ({ y: c.y, draw: () => { const spr = carSpr[c.type], an = spr.info.animations[c.anim][0]; drawFrame(ctx, spr, an.frame, c.x - cam.x, c.y - cam.y, an.flip); } }));
  for (const q of peds) items.push({ y: q.y + 1, draw: () => { const s = q.kind === 'woman' ? hero : heroPal[q.pal], lp = (q.dead || q.down > 0) ? lyingPose(q.kind === 'woman' ? 'woman' : 'man', q.lie, facingOf(DIR, q.dir)) : null, a = animAt(s, lp ? lp.anim : pedAnim(q), q.t * 1000); if (a) drawBody(s, a, q.x - cam.x, q.y - cam.y, q.fly, lp ? lp.xor : 0); } });
  for (const c of cops) items.push({ y: c.y + 1, draw: () => { const lp = (c.dead || c.down > 0) ? lyingPose('cop', c.lie, facingOf(DIR, c.dir)) : null, k = lp ? lp.anim : copAnim(c), a = animAt(hero, k, copAnimTime(c) * 1000); if (a) drawBody(hero, a, c.x - cam.x, c.y - cam.y, c.fly, lp ? lp.xor : 0); } });
  if (!drive) items.push({ y: p.y + 1, draw: () => { if (a) drawBody(hero, a, sx, sy, p.fly, lpH ? lpH.xor : 0); } });
  items.sort((u, v) => u.y - v.y).forEach(i => i.draw());
  drawFx(ctx, fxs, cam.x, cam.y); drawDrops(ctx, fxs, cam.x, cam.y);
  ctx.fillStyle = '#ff0'; for (const b of bullets) ctx.fillRect(b.x - cam.x - 1, b.y - cam.y - 18, 2, 2);
  ctx.fillStyle = '#400'; ctx.fillRect(4, 14, 52, 5); ctx.fillStyle = '#e33'; ctx.fillRect(4, 14, 52 * Math.max(0, p.hp) / HERO_HP, 5);
  ctx.fillStyle = '#fc0'; ctx.font = '10px monospace'; ctx.fillText('★'.repeat(stars(wanted)) + '☆'.repeat(3 - stars(wanted)), VW - 44, 12);
  if (p.dead) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, VW, VH); ctx.fillStyle = '#e33'; ctx.font = 'bold 20px monospace'; ctx.fillText('WASTED', VW / 2 - 40, VH / 2); ctx.font = '8px monospace'; }
  const near = !drive && nearestCar(cars, p);
  if (!drive) { ctx.fillStyle = '#fff'; ctx.fillText(WEAPONS[p.weapon].name + ' (Q)', 4, 10); }
  hint = drive ? 'E — выйти · ↑ газ · ↓ тормоз/назад · ←→ руль (или касание сбоку от машины)' : near ? 'E — сесть в машину' : 'Пробел — огонь · Q — оружие';
  ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.fillText(hint, 4, VH - 6);
  if (drive) ctx.fillText(Math.round(Math.abs(drive.speed)) + ' km/h', 4, 10);
  if (debug) {
    ctx.fillStyle = 'rgba(255,0,0,.8)'; ctx.fillRect(sx - 1, sy - 1, 3, 3);
    const t = map.tileAt(p.x, p.y); $('info').textContent = `x ${(drive||p).x|0} y ${(drive||p).y|0} · тайл ${t.tile} · коллизия ${t.collision} · anim ${ai}`;
  } else $('info').textContent = '';
  requestAnimationFrame(frame);
}
hero = await loadSprite('i_00'); for (const k of [1, 2, 3]) heroPal[k] = await loadSprite('i_00', k); for (const id of CAR_SPRITES) carSpr[id] = await loadSprite(id); await start('city1_h'); requestAnimationFrame(frame);
