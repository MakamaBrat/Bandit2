import { starsOf, heatFrac, flashColor, drawStars, drawAlertEdge, STAR_STEP } from '../js/hud.js';
import { drawPoliceLights, lightsOn, lamps, phaseAt, PATTERN, SLOT } from '../js/lights.js';
import { stars as policeStars } from '../js/police.js';
import { newCar, GEARS, stepCar, kmh, gearLabel, IDLE_RPM } from '../js/vehicle.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
// a recording canvas context
const rec = () => { const log = []; const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (...a) => { log.push([k, ...a]); }, set: (o, k, v) => { o[k] = v; log.push(['set:' + k, v]); return true; } }); return { ctx, log }; };
// ---- stars HUD ----
ok(starsOf(0) === 0 && starsOf(1) === 1 && starsOf(34) === 1 && starsOf(35) === 2 && starsOf(69) === 3 && starsOf(100) === 3, 'stars follow the heat (34 per star, up to 3)');
ok([0, 1, 20, 34, 35, 50, 68, 69, 100].every(h => starsOf(h) === policeStars({ heat: h })), 'and agree with the police module');
ok(heatFrac(0) === 0 && Math.abs(heatFrac(17) - 0.5) < 1e-9 && heatFrac(34) === 1 && heatFrac(35) > 0 && heatFrac(35) < 0.05 && heatFrac(100) > 0.9, 'the bar shows how far the current star is filled');
ok(flashColor(0) !== flashColor(0.13) && ['#ff3b3b', '#4a7dff'].includes(flashColor(0.3)), 'the alarm alternates police red and blue');
{ const { ctx, log } = rec(); drawStars(ctx, 200, 4, 2, 50, 0, 0); const fills = log.filter(l => l[0] === 'fill').length;
  ok(fills === 6, `three stars are drawn (outline + fill each): ${fills} fills`); const cols = log.filter(l => l[0] === 'set:fillStyle').map(l => l[1]);
  ok(cols.filter(c => c === '#ffd23c').length >= 3 && cols.includes('#3a3a46'), 'two gold stars and one grey one at 2 stars'); ok(log.some(l => l[0] === 'fillText' && l[1] === 'РОЗЫСК'), 'with the РОЗЫСК label'); }
{ const { ctx, log } = rec(); drawStars(ctx, 200, 4, 0, 0, 0, 0); ok(!log.some(l => l[0] === 'fillText'), 'no label and an empty bar when there is no wanted level'); ok(log.filter(l => l[0] === 'set:fillStyle').every(l => l[1] !== '#ffd23c'), 'all stars are grey'); }
{ const a = rec(), b = rec(); drawStars(a.ctx, 200, 4, 3, 100, 2, 0.0); drawStars(b.ctx, 200, 4, 3, 100, 2, 0.13); const ca = a.log.filter(l => l[0] === 'set:fillStyle').map(l => l[1]).join(), cb = b.log.filter(l => l[0] === 'set:fillStyle').map(l => l[1]).join(); ok(ca !== cb, 'while the alarm runs the stars flash red / blue'); }
{ const { ctx, log } = rec(); drawStars(ctx, 200, 4, 1, 10, 0, 0); const bar = log.filter(l => l[0] === 'fillRect'); const small = bar[bar.length - 1][3], { ctx: c2, log: l2 } = rec(); drawStars(c2, 200, 4, 1, 30, 0, 0); const big = l2.filter(l => l[0] === 'fillRect').pop()[3]; ok(big > small, `the heat bar grows with the heat (${small} -> ${big} px)`); }
{ const a = rec(); drawAlertEdge(a.ctx, 240, 320, 0, 0); ok(a.log.length === 0, 'no edge strips when there is no alarm'); const b = rec(); drawAlertEdge(b.ctx, 240, 320, 1.5, 0); ok(b.log.filter(l => l[0] === 'fillRect').length === 4, 'four edge strips while the alarm runs'); }
// ---- police lights ----
{ const c = newCar('k_00', 100, 100, 0); c.police = true; c.ai = true; ok(lightsOn(c), 'a chasing police car has its lights on');
  c.ai = false; ok(!lightsOn(c), 'a parked / abandoned one does not'); c.ai = true; c.wreck = true; ok(!lightsOn(c), 'a wreck does not'); c.wreck = false; c.hp = 0; ok(!lightsOn(c), 'a burning one does not'); c.hp = 100; const civ = newCar('k_01', 0, 0, 0); civ.ai = true; ok(!lightsOn(civ), 'a civilian car never does'); }
{ const c = newCar('k_00', 100, 100, 0); const [r, b] = lamps(c); ok(r.color === 'R' && b.color === 'B' && Math.abs((r.x + b.x) / 2 - c.x) < 1e-9 && Math.hypot(r.x - b.x, r.y - b.y) > 8, 'red and blue lamps sit on either side of the roof');
  const up = newCar('k_00', 100, 100, 90); const [r2, b2] = lamps(up); ok(Math.abs(r2.y - b2.y) < 1e-9 && Math.abs(r2.x - b2.x) > 8, 'and turn with the car (facing up: side by side horizontally)'); }
ok(PATTERN.length === 8 && PATTERN.filter(p => p === 'R').length === 2 && PATTERN.filter(p => p === 'B').length === 2 && phaseAt(0) === 'R' && phaseAt(4 * SLOT + 0.001) === 'B' && phaseAt(SLOT + 0.001) === '', 'double red flash, then double blue, with dark gaps');
{ const c = newCar('k_00', 100, 100, 0); c.police = true; c.ai = true; const on = rec(), off = rec(), civ = rec(); const cc = newCar('k_01', 300, 100, 0); cc.ai = true;
  drawPoliceLights(on.ctx, [c, cc], 0, 0, 0); ok(on.log.filter(l => l[0] === 'arc').length === 4, 'in a lit slot four glow rings are drawn, only for the police car'); drawPoliceLights(off.ctx, [c], 0, 0, SLOT + 0.001); ok(off.log.length === 0, 'in a dark slot nothing is drawn');
  const red = on.log.filter(l => l[0] === 'set:fillStyle').some(l => /255,40,40/.test(l[1])), blue = (() => { const r = rec(); drawPoliceLights(r.ctx, [c], 0, 0, 4 * SLOT + 0.001); return r.log.some(l => l[0] === 'set:fillStyle' && /70,120,255/.test(l[1])); })(); ok(red && blue, 'red in the red slots, blue in the blue slots'); }
// ---- gearbox ----
{ const map = { tileAt: () => ({ collision: 0 }), data: { tileSize: 24 } }; const c = newCar('k_01', 3000, 2000, 0); const shifts = []; let last = c.gear, t = 0, minRpmAfterShift = 1, topT = null, maxRpm = 0;
  for (let i = 0; i < 30 * 5; i++) { const g0 = c.gear, r0 = c.rpm; stepCar(map, c, { up: true }, 1 / 30); t += 1 / 30; maxRpm = Math.max(maxRpm, c.rpm); if (c.gear > g0) { shifts.push(Math.round(c.speed)); minRpmAfterShift = Math.min(minRpmAfterShift, c.rpm); } if (!topT && c.speed >= 149) topT = t; }
  ok(c.gear === 5 && shifts.length === 4, `it shifts up through all five gears (at ${shifts.join(', ')} px/s)`); ok(shifts.every((s, i) => s >= GEARS[i].hi - 6 && s <= GEARS[i].hi + 8), 'each shift happens at the top of its gear');
  ok(topT > 1.8 && topT < 3, `full acceleration takes ${topT.toFixed(1)} s (a real pull, not a rocket)`); ok(maxRpm <= 1.06, 'the revs stay below the limiter');
  const acc = []; const c2 = newCar('k_01', 3000, 2000, 0); let prev = 0; for (let g = 1; g <= 5; g++) { acc.push(GEARS[g - 1].acc); } ok(acc.every((a, i) => i === 0 || a < acc[i - 1]), 'lower gears pull harder than higher ones'); }
{ const map = { tileAt: () => ({ collision: 0 }), data: { tileSize: 24 } }; const c = newCar('k_01', 3000, 2000, 0); c.speed = 140; c.gear = 5; c.rpm = 0.9; const g = []; for (let i = 0; i < 12; i++) { stepCar(map, c, { down: true }, 1 / 30); g.push(c.gear); }
  ok(c.speed > 0 && g.at(-1) <= 2 && g[0] >= 4, `braking downshifts the gearbox (gear ${g[0]} -> ${g.at(-1)}, speed now ${Math.round(c.speed)})`); ok(g.every((x, i) => i === 0 || x <= g[i - 1]), 'it never shifts up while braking');
  const r = newCar('k_01', 3000, 2000, 0); for (let i = 0; i < 40; i++) stepCar(map, r, { down: true }, 1 / 30); ok(r.speed < -10 && r.gear === -1 && gearLabel(r) === 'R', 'holding the brake from rest reverses: gear R');
  const n = newCar('k_01', 3000, 2000, 0); stepCar(map, n, {}, 1 / 30); ok(gearLabel(n) === 'N' && Math.abs(n.rpm - IDLE_RPM) < 0.05, 'standing still: N and idle revs'); }
ok(kmh(150) === 135 && kmh(-50) === 45 && kmh(0) === 0, 'speedometer: top speed 150 px/s reads 135 km/h');
{ const map = { tileAt: () => ({ collision: 0 }), data: { tileSize: 24 } }; const c = newCar('k_01', 3000, 2000, 0); const trace = []; for (let i = 0; i < 30 * 3; i++) { stepCar(map, c, { up: true }, 1 / 30); trace.push(c.rpm); }
  let drops = 0; for (let i = 1; i < trace.length; i++) if (trace[i] < trace[i - 1] - 0.05) drops++; ok(drops >= 3, `the revs fall at gear changes, so the engine note rises and drops like a real car (${drops} drops)`); }
process.exit(fail ? 1 : 0);
