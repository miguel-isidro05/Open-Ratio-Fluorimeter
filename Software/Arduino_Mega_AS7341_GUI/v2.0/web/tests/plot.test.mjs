import test from "node:test";
import assert from "node:assert/strict";
import { easeOutCubic, interpolatePlotValues, smoothSvgPath } from "../js/plot.mjs";

test("interpola la curva espectral con la misma salida cúbica de la GUI PyQt", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(0.5), 0.875);
  assert.deepEqual(interpolatePlotValues([0, 100], [100, 300], 0.5), [87.5, 275]);
});

test("no inventa valores intermedios cuando un canal está saturado", () => {
  assert.deepEqual(interpolatePlotValues([200, 65535], [65535, 400], 0.5), [65535, 400]);
});

test("genera la misma curva cúbica suave de la primera versión PyQt", () => {
  assert.equal(
    smoothSvgPath([[0, 0], [10, 10], [20, 0]]),
    "M0 0 C5 0 5 10 10 10 C15 10 15 0 20 0",
  );
  assert.equal(
    smoothSvgPath([[0, 0], [10, 10], null, [20, 5], [30, 0]]),
    "M0 0 C5 0 5 10 10 10 M20 5 C25 5 25 0 30 0",
  );
});
