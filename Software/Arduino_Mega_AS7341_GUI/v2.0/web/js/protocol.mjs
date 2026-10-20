export const CHANNEL_KEYS = Object.freeze([
  "415", "445", "480", "515", "555", "590", "630", "680", "nir", "clear",
]);

export const GAINS = Object.freeze([
  "0.5x", "1x", "2x", "4x", "8x", "16x", "32x", "64x", "128x", "256x", "512x",
]);

export const INTEGRATION_TIMES = Object.freeze([
  "50ms", "100ms", "200ms", "300ms", "400ms", "600ms",
]);

export class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProtocolError";
  }
}

export function encodeMessage(message) {
  validateEnvelope(message);
  return `${JSON.stringify(message)}\n`;
}

export function decodeMessage(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    throw new ProtocolError("El dispositivo envió JSON inválido.");
  }
  validateEnvelope(message);
  return message;
}

function validateEnvelope(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new ProtocolError("Cada mensaje debe ser un objeto JSON.");
  }
  if (typeof message.type !== "string" || message.type.length === 0) {
    throw new ProtocolError("Cada mensaje debe incluir un campo 'type'.");
  }
}

function isIntegerInRange(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function displayLines(frame) {
  if (frame.display_mode === "channel") {
    const key = frame.display_channel;
    const label = key === "nir" ? "NIR" : key === "clear" ? "CLR" : key;
    const value = frame.channels[key] >= 65535 ? "OVFL" : String(frame.channels[key]);
    return [
      "AS7341 @90",
      `CANAL ${label}`,
      value,
      "cuentas ADC",
      `G${frame.gain} T${frame.integration_time.slice(0, -2)}`,
      "LECTURA REAL",
    ];
  }

  const start = frame.page * 5;
  const rows = [`G${frame.gain} T${frame.integration_time.slice(0, -2)} ${frame.page + 1}/2`];
  CHANNEL_KEYS.slice(start, start + 5).forEach((key) => {
    const label = key === "nir" ? "NIR" : key === "clear" ? "CLR" : key;
    const value = frame.channels[key] >= 65535 ? "OVFL" : String(frame.channels[key]);
    rows.push(`${label.padEnd(5, " ")} ${value.padStart(5, " ")}`);
  });
  return rows;
}

export function parseTelemetry(message) {
  if (message.type !== "telemetry") {
    throw new ProtocolError("El mensaje no es telemetría.");
  }
  if (!message.channels || CHANNEL_KEYS.some((key) => !(key in message.channels))) {
    throw new ProtocolError("Faltan canales AS7341.");
  }
  if (CHANNEL_KEYS.some((key) => !isIntegerInRange(message.channels[key], 0, 65535))) {
    throw new ProtocolError("Las cuentas deben ser enteros de 0 a 65535.");
  }
  if (!isIntegerInRange(message.sequence, 0, Number.MAX_SAFE_INTEGER)
      || !isIntegerInRange(message.millis, 0, Number.MAX_SAFE_INTEGER)) {
    throw new ProtocolError("Secuencia o tiempo inválidos.");
  }
  if (!isIntegerInRange(message.page, 0, 1)) {
    throw new ProtocolError("Página inválida.");
  }
  if (!GAINS.includes(message.gain) || !INTEGRATION_TIMES.includes(message.integration_time)) {
    throw new ProtocolError("Configuración de sensor inválida.");
  }
  const captureId = message.capture_id ?? "";
  if (typeof captureId !== "string" || (captureId && !/^[0-9a-f]{32}$/.test(captureId))) {
    throw new ProtocolError("Identificador de captura inválido.");
  }
  const displayMode = message.display_mode ?? "multi";
  const displayChannel = message.display_channel ?? "415";
  if (!["multi", "channel"].includes(displayMode) || !CHANNEL_KEYS.includes(displayChannel)) {
    throw new ProtocolError("Canal o modo de pantalla inválido.");
  }
  const pwmPercent = message.pwm_percent ?? 25;
  const pwmRaw = message.pwm_raw ?? Math.floor((pwmPercent * 255 + 50) / 100);
  if (!isIntegerInRange(pwmPercent, 0, 100) || !isIntegerInRange(pwmRaw, 0, 255)
      || pwmRaw !== Math.floor((pwmPercent * 255 + 50) / 100)) {
    throw new ProtocolError("PWM inválido o inconsistente.");
  }

  const frame = {
    sequence: message.sequence,
    millis: message.millis,
    gain: message.gain,
    integration_time: message.integration_time,
    pwm_percent: pwmPercent,
    pwm_raw: pwmRaw,
    page: message.page,
    channels: Object.fromEntries(CHANNEL_KEYS.map((key) => [key, message.channels[key]])),
    capture_id: captureId,
    display_mode: displayMode,
    display_channel: displayChannel,
    display_lines: message.display_lines ?? null,
  };
  if (frame.display_lines !== null
      && JSON.stringify(frame.display_lines) !== JSON.stringify(displayLines(frame))) {
    throw new ProtocolError("Las líneas de la pantalla no coinciden con la telemetría.");
  }
  return frame;
}

export function command(name, value) {
  const payload = { type: "command", command: name };
  if (value !== undefined) payload.value = value;
  return payload;
}
