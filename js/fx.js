// Effects: sparks and dust puffs (pure logic + a small draw helper).
export const newFx = () => ({ sparks: [], puffs: [], shake: 0, drops: [], stains: [], blood: true });
const MAX = 400;

// A burst of sparks at (x, y). power ~ 0.3 (scrape) .. 1.5 (hard crash); (dx, dy) biases the direction (optional).
export function addSparks(fx, x, y, power = 1, dx = 0, dy = 0, rnd = Math.random) {
  const n = Math.min(40, Math.round(6 + 14 * power)), biased = dx || dy, base = Math.atan2(dy, dx);
  for (let i = 0; i < n && fx.sparks.length < MAX; i++) {
    const a = biased ? base + (rnd() - 0.5) * 2.6 : rnd() * Math.PI * 2, sp = (50 + rnd() * 150) * (0.5 + power * 0.6);
    const life = 0.25 + rnd() * 0.4; fx.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life });
  }
}
// Dust / smoke puff (ped hit, heavy crash)
export function addPuff(fx, x, y, n = 5, rnd = Math.random) {
  for (let i = 0; i < n && fx.puffs.length < MAX; i++) { const a = rnd() * Math.PI * 2, sp = 10 + rnd() * 30, life = 0.35 + rnd() * 0.3; fx.puffs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 8, life, max: life, r: 2 + rnd() * 2 }); }
}
export const shake = (fx, amp) => { fx.shake = Math.max(fx.shake, Math.min(10, amp)); };

export function stepFx(fx, dt) {
  const damp = Math.exp(-3 * dt);
  for (const s of fx.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= damp; s.vy *= damp; s.life -= dt; }
  for (const p of fx.puffs) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= damp; p.vy *= damp; p.r += 8 * dt; p.life -= dt; }
  fx.sparks = fx.sparks.filter(s => s.life > 0); fx.puffs = fx.puffs.filter(p => p.life > 0);
  fx.shake = Math.max(0, fx.shake - 22 * dt);
}

export function drawFx(ctx, fx, camX, camY) {
  for (const p of fx.puffs) { ctx.fillStyle = `rgba(225,225,225,${(0.5 * p.life / p.max).toFixed(2)})`; ctx.fillRect(Math.round(p.x - camX - p.r / 2), Math.round(p.y - camY - p.r / 2), Math.round(p.r), Math.round(p.r)); }
  ctx.lineWidth = 1;
  for (const s of fx.sparks) {
    const t = s.life / s.max; ctx.strokeStyle = t > 0.65 ? '#ffffff' : t > 0.35 ? '#ffd23c' : '#ff7a1a';
    ctx.beginPath(); ctx.moveTo(Math.round(s.x - camX), Math.round(s.y - camY)); ctx.lineTo(Math.round(s.x - s.vx * 0.04 - camX), Math.round(s.y - s.vy * 0.04 - camY)); ctx.stroke();
  }
}

// ---- blood: flying drops that leave stains, smears while a body slides, pools under bodies that stay down ----
const MAX_STAINS = 220;
const seeded = n => { let s = (n * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
export function addStain(fx, x, y, r, rnd = Math.random, grow = 0) {
  if (!fx.blood) return null;
  const st = { x, y, r, max: r + grow, grow, age: 0, seed: Math.floor(rnd() * 1e6) };
  fx.stains.push(st); if (fx.stains.length > MAX_STAINS) fx.stains.shift(); return st;
}
// A splash at (x, y): power 0.3 (small hit) .. 1.5 (hard crash); (dx, dy) = direction of the blow (most of the spray goes that way)
export function addBlood(fx, x, y, power = 1, dx = 0, dy = 0, rnd = Math.random) {
  if (!fx.blood) return;
  const n = Math.min(26, Math.round(5 + 10 * power)), base = Math.atan2(dy, dx), biased = dx || dy;
  for (let i = 0; i < n && fx.drops.length < 300; i++) {
    const a = biased ? base + (rnd() - 0.5) * 2.2 : rnd() * Math.PI * 2, sp = (25 + rnd() * 90) * (0.5 + power * 0.5), life = 0.25 + rnd() * 0.35;
    fx.drops.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, s: rnd() < 0.3 ? 2 : 1 });
  }
  addStain(fx, x, y + 2, 2 + 2.5 * power, rnd);
}
// a smear along the ground while a body slides: call every frame with the distance moved
export function smear(fx, o, x, y, rnd = Math.random) {
  if (!fx.blood) return;
  o.smearAcc = (o.smearAcc || 0) + Math.hypot(x - (o.smearX ?? x), y - (o.smearY ?? y)); o.smearX = x; o.smearY = y;
  if (o.smearAcc > 7) { o.smearAcc = 0; addStain(fx, x + (rnd() - 0.5) * 3, y + 1, 1.5 + rnd() * 1.5, rnd); }
}
// a pool that grows under a body that has come to rest
export const addPool = (fx, x, y, rnd = Math.random) => addStain(fx, x, y + 2, 3, rnd, 6);

export function stepBlood(fx, dt) {
  const damp = Math.exp(-4 * dt);
  for (const d of fx.drops) { d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= damp; d.vy *= damp; d.life -= dt; if (d.life <= 0 && Math.random() < 0.55) addStain(fx, d.x, d.y, 0.8 + Math.random() * 1.2); }
  fx.drops = fx.drops.filter(d => d.life > 0);
  for (const s of fx.stains) { s.age += dt; if (s.grow && s.r < s.max) s.r = Math.min(s.max, s.r + s.grow * dt / 3); }
  fx.stains = fx.stains.filter(s => s.age < 60);
}
// ground layer: draw before the characters
export function drawStains(ctx, fx, camX, camY) {
  for (const s of fx.stains) {
    const alpha = s.age < 30 ? 0.85 : Math.max(0, 0.85 * (1 - (s.age - 30) / 30)), rnd = seeded(s.seed), cx = Math.round(s.x - camX), cy = Math.round(s.y - camY), R = Math.max(1, Math.round(s.r));
    ctx.fillStyle = `rgba(110,8,8,${alpha.toFixed(2)})`;
    ctx.fillRect(cx - R, cy - Math.max(1, Math.round(R * 0.6)), R * 2, Math.max(2, Math.round(R * 1.2)));
    for (let i = 0; i < 4; i++) { const ox = Math.round((rnd() - 0.5) * R * 2.4), oy = Math.round((rnd() - 0.5) * R * 1.4), w = 1 + Math.floor(rnd() * Math.max(1, R * 0.6)); ctx.fillRect(cx + ox - w, cy + oy, w * 2, Math.max(1, w)); }
    ctx.fillStyle = `rgba(150,16,16,${(alpha * 0.8).toFixed(2)})`; ctx.fillRect(cx - Math.floor(R / 2), cy - 1, Math.max(1, R), 1);
  }
}
export function drawDrops(ctx, fx, camX, camY) {
  for (const d of fx.drops) { ctx.fillStyle = d.life / d.max > 0.5 ? '#b01010' : '#7a0808'; ctx.fillRect(Math.round(d.x - camX), Math.round(d.y - camY), d.s, d.s); }
}
