// Lying poses for knocked-down / dead characters (anims of i_00). The head points the way the body was thrown.
// kind: 'man' | 'woman' | 'cop'; (dx, dy): direction of the throw (screen coords). Returns { anim, xor } - xor is XORed into the frame's flip flags
// (1 = mirror left/right, 2 = mirror up/down). Only frames that really show a body lying down are used (the "down" group of the men and the cops
// has no lying frame of its own, which is why the old +27 / +10 offsets looked like a stumble).
const POSES = {
  man:   { left: [27, 0], right: [87, 0], down: [59, 0], up: [59, 2] },       // 27 head left, 87 head right, 59 vertical head down
  woman: { left: [212, 0], right: [222, 0], down: [217, 0], up: [227, 0] },   // 212 head left, 222 head right, 217 head down, 227 head up
  cop:   { left: [174, 0], right: [174, 1], down: [185, 0], up: [185, 2] },   // 174 head left (mirrored for right), 185 head down (mirrored for up)
};
export const LYING_ANIMS = [...new Set(Object.values(POSES).flatMap(p => Object.values(p).map(v => v[0])))];
export function lyingPose(kind, lie, facing = 'down') {
  const set = POSES[kind] || POSES.man;
  let dx = lie ? lie.x : 0, dy = lie ? lie.y : 0;
  if (!dx && !dy) { dx = facing === 'left' ? -1 : facing === 'right' ? 1 : 0; dy = facing === 'up' ? -1 : facing === 'down' ? 1 : 0; }
  const k = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  const [anim, xor] = set[k]; return { anim, xor };
}
export const facingOf = (DIR, dir) => dir === DIR.LEFT ? 'left' : dir === DIR.RIGHT ? 'right' : dir === DIR.UP ? 'up' : 'down';
