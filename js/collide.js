// Entity collisions that are not part of a car's own tick (those live in physics.js: walls, pedestrians, car vs car).
import { bodyBoxes } from './physics.js';
import { hitByCar } from './ped.js';

// Callback set for physics.advance(): people hit by a moving car, cars crashing.
export function makeWorld(game) {
  return {
    peds: game.peds, cars: game.cars,
    onPed(car, p) {
      if (p.hero) { if (p.down > 0) return; const fast = Math.abs(car.c) + Math.abs(car.d) > 2560; car.c = Math.trunc(car.c * 0.8); car.d = Math.trunc(car.d * 0.8); p.down = 1.2; if (game.hurtHero && fast) game.hurtHero(10); return; }
      if (hitByCar(p, car)) game.onPedHit && game.onPedHit(car, p);
    },
    onCarCrash(a, b, force) { game.onCrash && game.onCrash(a, b, force); },
    fx: game.fx,
  };
}

// The hero on foot cannot walk through a car body.
const inBox = (c, x, y, m) => bodyBoxes(c).some(r => x > r.x0 - m && x < r.x1 + m && y > r.y0 - m && y < r.y1 + m);
export const insideCar = (cars, x, y, skip) => cars.some(c => c !== skip && inBox(c, x, y, 3));
export function keepOutOfCars(cars, p, px, py) {
  if (!insideCar(cars, p.x, p.y)) return;
  if (insideCar(cars, px, py)) return;
  if (!insideCar(cars, p.x, py)) { p.y = py; return; }
  if (!insideCar(cars, px, p.y)) { p.x = px; return; }
  p.x = px; p.y = py;
}
