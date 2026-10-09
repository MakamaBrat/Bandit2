// Pure game logic (no DOM): player on foot with tile collision. Units: pixels, seconds.
// Collision values per tile (from collision table, verified visually): 0 road, 1 sidewalk, 2 solid, 3 door/special.
export const DIR = { LEFT: 0, UP: 30, RIGHT: 60, DOWN: 90 }; // first animation index of each direction group in i_00
export const ANIM = { IDLE: 0, WALK: 1, RUN: 2 };           // offsets inside a group
export const WALK_SPEED = 55, RUN_SPEED = 100;
const HALF_W = 5, HALF_H = 3;                                 // foot hitbox half-size around the anchor

export const isSolid = (map, x, y) => map.tileAt(x, y).collision === 2;

export function blockedAt(map, x, y) {
  return isSolid(map, x - HALF_W, y - HALF_H) || isSolid(map, x + HALF_W, y - HALF_H) ||
         isSolid(map, x - HALF_W, y + HALF_H) || isSolid(map, x + HALF_W, y + HALF_H);
}

export function findSpawn(map) {
  const T = map.data.tileSize, cx = map.w / 2, cy = map.h / 2;
  for (let r = 0; r < 200; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = Math.floor(cx / T + dx) * T + T / 2, y = Math.floor(cy / T + dy) * T + T / 2;
        const c = map.tileAt(x, y).collision;
        if (c === 1 && !blockedAt(map, x, y)) return { x, y };
      }
  return { x: cx, y: cy };
}

export function newPlayer(map) { const p = findSpawn(map); return { ...p, dir: DIR.DOWN, moving: false, running: false, t: 0, down: 0 }; }

// input: {left,right,up,down,run}
export function step(map, p, input, dt) {
  if (p.down > 0) { p.down -= dt; p.moving = false; p.t += dt; return p; }   // knocked down: no control
  let ax = (input.right ? 1 : 0) - (input.left ? 1 : 0), ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  p.moving = ax !== 0 || ay !== 0; p.running = !!input.run;
  if (p.moving) {
    const len = Math.hypot(ax, ay), v = (p.running ? RUN_SPEED : WALK_SPEED) * dt;
    const mx = ax / len * v, my = ay / len * v;
    if (!blockedAt(map, p.x + mx, p.y)) p.x += mx;   // axis-separated -> slide along walls
    if (!blockedAt(map, p.x, p.y + my)) p.y += my;
    if (ax !== 0 && (ay === 0 || p.dir === DIR.LEFT || p.dir === DIR.RIGHT)) p.dir = ax < 0 ? DIR.LEFT : DIR.RIGHT;
    else if (ay !== 0) p.dir = ay < 0 ? DIR.UP : DIR.DOWN;
    p.t += dt;
  } else p.t += dt;
  return p;
}

export const animIndex = p => p.dir + (p.down > 0 ? 27 : p.moving ? (p.running ? ANIM.RUN : ANIM.WALK) : ANIM.IDLE);
