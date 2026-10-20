import test from "node:test";
import assert from "node:assert/strict";
import { command, decodeMessage, displayLines, encodeMessage, parseTelemetry, ProtocolError } from "../js/protocol.mjs";

function frame(overrides = {}) {
  const channels = Object.fromEntries([
    "415", "445", "480", "515", "555", "590", "630", "680", "nir", "clear",
  ].map((key, index) => [key, 100 + index]));
  const value = {
    type: "telemetry", sequence: 4, millis: 2000, gain: "128x", integration_time: "300ms",
    pwm_percent: 25, pwm_raw: 64, page: 0, channels, capture_id: "", display_mode: "multi",
    display_channel: "415", ...overrides,
  };
  value.display_lines = displayLines(value);
  return value;
}

test("decodifica y valida una telemetría compatible con firmware 2.3.0", () => {
  const parsed = parseTelemetry(decodeMessage(JSON.stringify(frame())));
  assert.equal(parsed.channels["555"], 104);
  assert.equal(parsed.pwm_raw, 64);
  assert.deepEqual(parsed.display_lines, ["G128x T300 1/2", "415     100", "445     101", "480     102", "515     103", "555     104"]);
});

test("rechaza cuentas fuera del rango del AS7341", () => {
  const invalid = frame();
  invalid.channels["415"] = 65536;
  assert.throws(() => parseTelemetry(invalid), ProtocolError);
});

test("rechaza un espejo OLED que no corresponde a la telemetría", () => {
  const invalid = frame({ display_lines: ["alterado"] });
  invalid.display_lines = ["alterado"];
  assert.throws(() => parseTelemetry(invalid), /pantalla/);
});

test("codifica la orden explícita para aplicar el PWM", () => {
  assert.equal(encodeMessage(command("set_pwm", 50)), '{"type":"command","command":"set_pwm","value":50}\n');
});
