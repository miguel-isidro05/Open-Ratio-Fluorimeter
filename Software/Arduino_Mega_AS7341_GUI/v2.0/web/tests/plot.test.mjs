import test from "node:test";
import assert from "node:assert/strict";
import { easeOutCubic, interpolatePlotValues } from "../js/plot.mjs";

test("interpola la curva espectral con la misma salida cúbica de la GUI PyQt", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(0.5), 0.875);
  assert.deepEqual(interpolatePlotValues([0, 100], [100, 300], 0.5), [87.5, 275]);
});

test("no inventa valores intermedios cuando un canal está saturado", () => {
  assert.deepEqual(interpolatePlotValues([200, 65535], [65535, 400], 0.5), [65535, 400]);
});
