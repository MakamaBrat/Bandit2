// Flashing red / blue lights of police cars (a double flash on each side, alternating).
import { side } from './vehicle.js';
export const PATTERN = ['R', '', 'R', '', 'B', '', 'B', ''];            // 8 slots, 0.075 s each: two red flashes, two blue ones
export const SLOT = 0.075;
export const lightsOn = c => !!c.police && !!c.ai && !c.wreck && c.hp > 0;
export const phaseAt = t => PATTERN[Math.floor(t / SLOT) % PATTERN.length];
// the two lamps on the roof bar: red on the left of the car, blue on the right
export function lamps(c) { const [sx, sy] = side(c.heading); return [{ color: 'R', x: c.x - sx * 5, y: c.y - sy * 5 - 3 }, { color: 'B', x: c.x + sx * 5, y: c.y + sy * 5 - 3 }]; }
const RGB = { R: '255,40,40', B: '70,120,255' };
export function drawPoliceLights(ctx, cars, camX, camY, t) {
  const ph = phaseAt(t); if (!ph) return;
  const prev = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
  for (const c of cars) {
    if (!lightsOn(c)) continue;
    const l = lamps(c).find(m => m.color === ph), x = l.x - camX, y = l.y - camY, rgb = RGB[ph];
    for (const [r, a] of [[30, 0.07], [19, 0.13], [11, 0.24], [6, 0.45]]) { ctx.fillStyle = `rgba(${rgb},${a})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }
  ctx.globalCompositeOperation = prev;
}
