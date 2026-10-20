import test from "node:test";
import assert from "node:assert/strict";
import { buildCapture, intensityResult, linearFit, ratioResult } from "../js/analysis.mjs";

function telemetry(sequence, offset = 0) {
  const channels = Object.fromEntries([
    "415", "445", "480", "515", "555", "590", "630", "680", "nir", "clear",
  ].map((key, index) => [key, 100 + index + offset]));
  return { sequence, millis: sequence * 300, gain: "128x", integration_time: "300ms", pwm_percent: 25, pwm_raw: 64, page: 0, channels, capture_id: "", display_mode: "multi", display_channel: "415", display_lines: null };
}

test("construye una captura con media, SD muestral y evidencia raw", () => {
  const capture = buildCapture([telemetry(1), telemetry(2, 2)], {
    label: "A", role: "leda", sample_id: "M1", optics: "LED azul", exposure: "A", channel: "415",
  });
  assert.equal(capture.channels["415"], 101);
  assert.ok(Math.abs(capture.sd["415"] - Math.SQRT2) < 1e-12);
  assert.equal(capture.frames.length, 2);
});

test("calcula un cociente trazable entre capturas compatibles", () => {
  const a = buildCapture([telemetry(1)], { role: "leda", sample_id: "M1", optics: "protocolo", exposure: "A", channel: "415" });
  const b = buildCapture([telemetry(2, 100)], { role: "ledb", sample_id: "M1", optics: "protocolo", exposure: "B", channel: "415" });
  const result = ratioResult(a, b, "415", "415");
  assert.equal(result.value, 0.5);
  assert.deepEqual(result.measurement_ids, [a.id, b.id]);
});

test("resta un blanco solo cuando la configuración y exposición coinciden", () => {
  const sample = buildCapture([telemetry(1, 20)], { role: "signal", sample_id: "M1", optics: "protocolo", exposure: "misma", channel: "415" });
  const blank = buildCapture([telemetry(2)], { role: "blank", optics: "protocolo", exposure: "misma", channel: "415" });
  assert.equal(intensityResult(sample, "415", blank).value, 20);
});

test("ajusta una recta con tres niveles distintos", () => {
  const fit = linearFit([
    { x: 0, y: 1, analysis_method: "m" },
    { x: 1, y: 3, analysis_method: "m" },
    { x: 2, y: 5, analysis_method: "m" },
  ]);
  assert.equal(fit.slope, 2);
  assert.equal(fit.intercept, 1);
  assert.equal(fit.r2, 1);
});
