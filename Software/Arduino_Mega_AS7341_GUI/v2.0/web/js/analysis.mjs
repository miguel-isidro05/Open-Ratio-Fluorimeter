import { CHANNEL_KEYS } from "./protocol.mjs";

export function uuid32() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replaceAll("-", "");
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deviation(values) {
  if (values.length < 2) return 0;
  const center = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1));
}

export function buildCapture(frames, metadata = {}) {
  if (!frames.length) throw new Error("No hay muestras nuevas para capturar.");
  const signatures = new Set(frames.map((frame) => [
    frame.gain, frame.integration_time, frame.pwm_percent, frame.pwm_raw,
  ].join("|")));
  if (signatures.size !== 1) {
    throw new Error("La ganancia, integración o PWM cambió durante la captura. Repítela.");
  }
  const channels = Object.fromEntries(CHANNEL_KEYS.map((key) => [
    key, average(frames.map((frame) => frame.channels[key])),
  ]));
  const sd = Object.fromEntries(CHANNEL_KEYS.map((key) => [
    key, deviation(frames.map((frame) => frame.channels[key])),
  ]));
  return {
    id: uuid32(),
    label: metadata.label ?? "Captura",
    role: metadata.role ?? "raw",
    sample_id: metadata.sample_id ?? "",
    optics: metadata.optics ?? "",
    exposure: metadata.exposure ?? "",
    notes: metadata.notes ?? "",
    channel: metadata.channel ?? "415",
    received_at: new Date().toISOString(),
    gain: frames[0].gain,
    integration_time: frames[0].integration_time,
    pwm_percent: frames[0].pwm_percent,
    pwm_raw: frames[0].pwm_raw,
    n: frames.length,
    channels,
    sd,
    saturated: CHANNEL_KEYS.filter((key) => frames.some((frame) => frame.channels[key] >= 65535)),
    frames: structuredClone(frames),
  };
}

export function signal(capture, channel) {
  if (capture.saturated.includes(channel)) {
    throw new Error(`Canal ${channel} saturado. Reduce ganancia o integración y repite.`);
  }
  const value = capture.channels[channel];
  if (!Number.isFinite(value) || value < 0) throw new Error("Señal inválida.");
  return value;
}

export function compatibleConfiguration(a, b) {
  return a.gain === b.gain
    && a.integration_time === b.integration_time
    && a.pwm_percent === b.pwm_percent
    && a.optics === b.optics
    && a.exposure === b.exposure;
}

export function correctedSignal(sample, blank, channel) {
  if (sample.role === "blank") throw new Error("La señal de muestra no puede ser un blanco.");
  if (sample.id === blank.id || blank.role !== "blank") throw new Error("Selecciona un blanco distinto y válido.");
  if (!sample.exposure.trim()) throw new Error("Identifica la exposición óptica para corregir el fondo.");
  if (!compatibleConfiguration(sample, blank)) {
    throw new Error("Blanco incompatible: deben coincidir exposición, protocolo, ganancia, integración y PWM.");
  }
  return signal(sample, channel) - signal(blank, channel);
}

export function ratioResult(a, b, channelA, channelB, options = {}) {
  if (a.id === b.id) throw new Error("El ensayo requiere dos capturas nuevas A/B.");
  if (a.sample_id !== b.sample_id) throw new Error("A y B pertenecen a muestras diferentes.");
  if (a.optics !== b.optics) throw new Error("A y B requieren el mismo protocolo óptico.");
  if (a.gain !== b.gain || a.integration_time !== b.integration_time) {
    throw new Error("Las capturas deben tener la misma ganancia e integración.");
  }
  const blankA = options.blankA ?? null;
  const blankB = options.blankB ?? null;
  if (Boolean(blankA) !== Boolean(blankB)) throw new Error("La corrección requiere blanco A y blanco B.");
  const numerator = blankA ? correctedSignal(a, blankA, channelA) : signal(a, channelA);
  const denominator = blankB ? correctedSignal(b, blankB, channelB) : signal(b, channelB);
  if (denominator <= 0) throw new Error("La referencia debe ser mayor que cero.");
  if (blankA && numerator <= 0) throw new Error("La señal corregida A no es positiva.");
  const method = JSON.stringify({
    kind: "ratio",
    mode: options.mode ?? "led",
    channels: [channelA, channelB],
    gain: a.gain,
    integration: a.integration_time,
    optics: a.optics,
    corrected: Boolean(blankA),
  });
  return {
    id: uuid32(),
    kind: "ratio",
    mode: options.mode ?? "led",
    reference_type: options.referenceType ?? "LED sucesivos",
    a: structuredClone(a),
    b: structuredClone(b),
    blank_a: structuredClone(blankA),
    blank_b: structuredClone(blankB),
    value: numerator / denominator,
    numerator,
    denominator,
    corrected: Boolean(blankA),
    formula: blankA
      ? `(${channelA}(A) - blanco A) / (${channelB}(B) - blanco B)`
      : `${channelA}(A) / ${channelB}(B)`,
    sample_id: a.sample_id,
    measurement_ids: [a.id, b.id],
    analysis_method: method,
    received_at: new Date().toISOString(),
  };
}

export function intensityResult(sample, channel, blank = null) {
  const rawValue = signal(sample, channel);
  const value = blank ? correctedSignal(sample, blank, channel) : rawValue;
  const method = JSON.stringify({
    kind: "intensity",
    channel,
    gain: sample.gain,
    integration: sample.integration_time,
    optics: sample.optics,
    corrected: Boolean(blank),
  });
  return {
    id: uuid32(), kind: "intensity", sample: structuredClone(sample), blank: structuredClone(blank),
    channel, value, raw_value: rawValue, corrected: Boolean(blank), analysis_method: method,
    formula: blank ? `${channel}(señal) - ${channel}(blanco)` : `${channel}(señal)`,
    sample_id: sample.sample_id, measurement_ids: [sample.id], received_at: new Date().toISOString(),
  };
}

export function linearFit(points) {
  if (points.length < 3 || new Set(points.map((point) => point.x)).size < 3) {
    throw new Error("Guarda al menos tres concentraciones diferentes.");
  }
  if (new Set(points.map((point) => point.analysis_method)).size !== 1) {
    throw new Error("No mezcles señales, canales ni configuraciones en una curva.");
  }
  const xMean = average(points.map((point) => point.x));
  const yMean = average(points.map((point) => point.y));
  const sxx = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
  const slope = points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / sxx;
  const intercept = yMean - slope * xMean;
  const residuals = points.map((point) => point.y - (slope * point.x + intercept));
  const sse = residuals.reduce((sum, value) => sum + value ** 2, 0);
  const sst = points.reduce((sum, point) => sum + (point.y - yMean) ** 2, 0);
  if (!Number.isFinite(slope) || Math.abs(slope) < 1e-15 || sst === 0) {
    throw new Error("La señal no varía con la concentración; ajuste no utilizable.");
  }
  return { slope, intercept, r2: 1 - sse / sst, rmse: Math.sqrt(sse / points.length), residuals, n: points.length };
}
