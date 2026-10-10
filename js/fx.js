// Effects: sparks and dust puffs (pure logic + a small draw helper).
export const newFx = () => ({ sparks: [], puffs: [], shake: 0 });
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
