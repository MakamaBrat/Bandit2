// Wanted-level interface: three stars, a bar showing how close the next star is, and an alarm flash when the level changes.
export const STAR_STEP = 34;                                         // heat per star (see police.js: stars = ceil(heat / 34))
export const starsOf = heat => heat <= 0 ? 0 : Math.min(3, Math.ceil(heat / STAR_STEP));
export const heatFrac = heat => { if (heat <= 0) return 0; const s = Math.min(3, Math.ceil(heat / STAR_STEP)); return Math.max(0, Math.min(1, (heat - (s - 1) * STAR_STEP) / STAR_STEP)); };
export const flashColor = t => Math.floor(t * 8) % 2 ? '#ff3b3b' : '#4a7dff';      // police red / blue
export function starPath(ctx, cx, cy, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R, x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.closePath();
}
// x, y = top-right corner of the panel; n = stars, heat 0..100, flash = seconds of alarm left, t = clock
export function drawStars(ctx, x, y, n, heat, flash, t, size = 6) {
  const gap = size * 2.5, left = x - gap * 3 + size * 0.2;
  if (n > 0 || flash > 0) { ctx.fillStyle = flash > 0 ? flashColor(t) : '#ffd23c'; ctx.font = '6px monospace'; ctx.fillText('РОЗЫСК', left + 1, y - 1); }
  for (let i = 0; i < 3; i++) {
    const on = i < n, newest = on && i === n - 1 && flash > 0, k = newest ? 1 + 0.35 * Math.abs(Math.sin(t * 10)) : 1, cx = left + gap * i + size, cy = y + size + 2;
    starPath(ctx, cx, cy + 1, size * k + 1, size * 0.45 * k + 0.6); ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fill();            // dark outline
    starPath(ctx, cx, cy, size * k, size * 0.45 * k);
    ctx.fillStyle = on ? (flash > 0 ? flashColor(t + i * 0.06) : '#ffd23c') : '#3a3a46'; ctx.fill();
    if (on) { ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 0.6; ctx.stroke(); }
  }
  const w = gap * 3 - size * 0.5, by = y + size * 2 + 6;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(left, by, w, 3);
  if (heat > 0) { ctx.fillStyle = n >= 3 ? '#ff5a3c' : '#ffd23c'; ctx.fillRect(left, by, Math.max(1, Math.round(w * heatFrac(heat))), 3); }
}
// red / blue strips on the top and bottom edges while the alarm flash runs
export function drawAlertEdge(ctx, w, h, flash, t) {
  if (!(flash > 0)) return; const a = Math.min(0.55, flash * 0.5), c = Math.floor(t * 8) % 2;
  ctx.fillStyle = (c ? 'rgba(255,50,50,' : 'rgba(70,120,255,') + a.toFixed(2) + ')'; ctx.fillRect(0, 0, w, 3); ctx.fillRect(0, h - 3, w, 3);
  ctx.fillStyle = (c ? 'rgba(70,120,255,' : 'rgba(255,50,50,') + (a * 0.6).toFixed(2) + ')'; ctx.fillRect(0, 3, 2, h - 6); ctx.fillRect(w - 2, 3, 2, h - 6);
}
