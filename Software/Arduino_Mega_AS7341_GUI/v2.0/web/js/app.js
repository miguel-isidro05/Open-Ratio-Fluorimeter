import { CHANNEL_KEYS, GAINS, INTEGRATION_TIMES, command, parseTelemetry } from "./protocol.mjs";
import { buildCapture, intensityResult, linearFit, ratioResult, uuid32 } from "./analysis.mjs";
import { PLOT_ANIMATION_MS, interpolatePlotValues } from "./plot.mjs";
import { WebSerialClient } from "./serial.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const client = new WebSerialClient();

const state = {
  connected: false,
  verified: false,
  port: null,
  grantedPorts: [],
  lastFrame: null,
  frameHistory: [],
  plotValues: null,
  plotAnimationFrame: null,
  deviceState: null,
  recording: false,
  recordingRows: [],
  pending: null,
  activeCaptures: {},
  lastResult: null,
  selectedEvidence: null,
  session: {
    version: 3,
    source: "Spectral Lab Web Serial",
    created_at: new Date().toISOString(),
    captures: {},
    capture_history: [],
    results: [],
    intensity_results: [],
    points: [],
    fit: null,
    optics: "",
  },
};

const ui = {};

function configureTabs(buttonSelector, panelSelector, dataKey, prefix) {
  const buttons = $$(buttonSelector);
  const panels = $$(panelSelector);
  buttons.forEach((button) => {
    button.tabIndex = button.getAttribute("aria-selected") === "true" ? 0 : -1;
    button.addEventListener("click", () => {
      const target = button.dataset[dataKey];
      buttons.forEach((item) => {
        const selected = item === button;
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel) => {
        const active = panel.id === `${prefix}${target}`;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
    });
  });
}

function bindUi() {
  configureTabs(".nav-tab", ".view", "view", "view-");
  configureTabs(".subtab", ".experiment-page", "experiment", "experiment-");
  configureTabs(".detail-tab", ".detail-page", "detail", "detail-");
  document.addEventListener("keydown", (event) => {
    if (!event.target.matches('[role="tab"]') || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const tabs = $$('[role="tab"]', event.target.closest('[role="tablist"]'));
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(tabs.indexOf(event.target) + delta + tabs.length) % tabs.length];
    next.focus();
    next.click();
    event.preventDefault();
  });

  const connectionGroups = $$(".connection-bar .connection-group");
  ui.portSelect = $("select", connectionGroups[0]);
  [ui.refreshButton, ui.connectButton] = $$("button", connectionGroups[0]);
  ui.connectionLabels = $$(".status-inline", document);
  ui.sampleSelect = $("select", connectionGroups[1]);
  ui.newSampleButton = $("button", connectionGroups[1]);
  [ui.recordButton] = $$("button", connectionGroups[2]);
  ui.recordStatus = $(".status-inline", connectionGroups[2]);
  ui.footerMessage = $(".statusbar span");
  ui.topStatus = $(".top-actions .status-inline");
  ui.connectionStatus = $(".connection-state", connectionGroups[0]);

  ui.gain = $("#gain");
  ui.integration = $("#integration");
  ui.pwm = $("#pwm");
  ui.scale = $("#scale");
  ui.average = $("#average");
  ui.plotSvg = $(".plot-svg");
  ui.emptyPlot = $(".empty-state");
  ui.acquisitionCells = $$(".acquisition-view .inspector-panel tbody td.numeric");
  ui.contextValues = $$(".acquisition-view .context-grid span:nth-child(even)");
  ui.copyValuesButton = $(".acquisition-view .context-block button");
  ui.instrumentCells = $$(".instrument-main .instrument-pane:first-child tbody td.numeric");
  ui.instrumentRows = $$(".instrument-main .instrument-pane:first-child tbody tr");
  ui.notice = $(".instrument-view .notice-bar");
  ui.oled = $(".lcd");
  ui.autoPage = $(".lcd-foot input");
  ui.pageLabel = $(".lcd-foot span");
  ui.deviceItems = $$(".device-list li");
  ui.verifyButton = $(".instrument-main aside button");
  ui.instrumentSummary = $$(".instrument-summary strong");
  ui.sessionStatus = $(".session-status");
  ui.resultStrip = $(".result-strip .muted");
  ui.historyBody = $(".mini-history tbody");
  ui.experimentActions = $$(".session-panel .action-stack button");
  ui.resultsEvidence = $(".results-toolbar select");
  ui.resultsOpen = $$(".results-toolbar button")[0];
  ui.resultsExport = $$(".results-toolbar button")[1];
  ui.resultsSummary = $(".empty-evidence", $(".results-summary"));
  ui.componentsBody = $("#detail-signals tbody");
  ui.replicasBody = $$("#detail-signals tbody")[1];
  ui.interpretationMetrics = $$(".interpretation-panel .metric-line strong");

  fillSelect(ui.gain, GAINS, "128x");
  fillSelect(ui.integration, INTEGRATION_TIMES, "300ms", (value) => value.replace("ms", " ms"));
  fillSelect(ui.pwm, Array.from({ length: 21 }, (_, index) => String(index * 5)), "25", (value) => `${value} %`);
  fillSelect(ui.scale, ["auto", "500", "1000", "2000", "5000", "10000", "65535"], "auto",
    (value) => value === "auto" ? "Automática" : `${value} cuentas`);
  fillSelect(ui.average, ["1", "3", "5", "10"], "1", (value) => `${value} lectura${value === "1" ? "" : "s"}`);

  ui.refreshButton.addEventListener("click", refreshPorts);
  ui.connectButton.addEventListener("click", toggleConnection);
  ui.newSampleButton.addEventListener("click", addSample);
  ui.sampleSelect.addEventListener("change", syncSample);
  ui.recordButton.addEventListener("click", toggleRecording);
  ui.gain.addEventListener("change", () => changeSetting(command("set_gain", ui.gain.value)));
  ui.integration.addEventListener("change", () => changeSetting(command("set_integration", ui.integration.value)));
  ui.pwm.addEventListener("change", () => changeSetting(command("set_pwm", Number(ui.pwm.value))));
  ui.scale.addEventListener("change", renderPlot);
  ui.average.addEventListener("change", renderPlot);
  ui.copyValuesButton.addEventListener("click", copyCurrentValues);
  ui.verifyButton.addEventListener("click", () => sendCommand(command("get_state")));
  ui.autoPage.addEventListener("change", () => sendCommand(command("set_auto_page", ui.autoPage.checked)));
  ui.instrumentRows.forEach((row, index) => {
    row.tabIndex = 0;
    row.title = "Mostrar este canal en la pantalla OLED";
    const activate = () => sendCommand(command("set_display_channel", CHANNEL_KEYS[index]));
    row.addEventListener("click", activate);
    row.addEventListener("keydown", (event) => {
      if (["Enter", " "].includes(event.key)) { activate(); event.preventDefault(); }
    });
  });
  bindExperiments();
  ui.experimentActions[0].addEventListener("click", saveSession);
  ui.experimentActions[1].addEventListener("click", openSession);
  ui.experimentActions[2].addEventListener("click", exportPoints);
  ui.resultsOpen.addEventListener("click", openSession);
  ui.resultsExport.addEventListener("click", exportResults);
  ui.resultsEvidence.addEventListener("change", renderSelectedEvidence);

  client.addEventListener("connection", ({ detail }) => setConnected(detail.connected, detail.info));
  client.addEventListener("message", ({ detail }) => handleMessage(detail));
  client.addEventListener("error", ({ detail }) => showMessage(detail.message, "error"));
  navigator.serial?.addEventListener("disconnect", (event) => {
    if (event.target === state.port) void client.disconnect();
  });
}

function fillSelect(select, values, selected, label = (value) => value) {
  select.replaceChildren(...values.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label(value);
    option.selected = value === selected;
    return option;
  }));
}

function portName(port, index) {
  const info = port.getInfo();
  const vendor = info.usbVendorId ? info.usbVendorId.toString(16).padStart(4, "0") : "----";
  const product = info.usbProductId ? info.usbProductId.toString(16).padStart(4, "0") : "----";
  return `Puerto autorizado ${index + 1} · USB ${vendor}:${product}`;
}

async function refreshPorts() {
  if (!WebSerialClient.supported) {
    ui.portSelect.innerHTML = '<option value="">Web Serial no disponible</option>';
    showBrowserRequirement();
    return;
  }
  state.grantedPorts = await client.grantedPorts();
  const options = ['<option value="">Selecciona o autoriza un puerto</option>'];
  state.grantedPorts.forEach((port, index) => options.push(`<option value="${index}">${portName(port, index)}</option>`));
  ui.portSelect.innerHTML = options.join("");
}

async function toggleConnection() {
  if (state.connected) {
    await stopRecording(false);
    await client.disconnect();
    return;
  }
  try {
    let port = ui.portSelect.value === "" ? null : state.grantedPorts[Number(ui.portSelect.value)];
    if (!port) port = await client.requestPort();
    state.port = port;
    await client.connect(port);
  } catch (error) {
    if (error.name !== "NotFoundError") showMessage(`No se pudo abrir el puerto: ${error.message}`, "error");
  }
}

function setConnected(connected, info = null) {
  state.connected = connected;
  state.verified = false;
  if (!connected) cancelPending("Captura cancelada al desconectar el instrumento.");
  ui.connectButton.textContent = connected ? "Desconectar" : "Conectar";
  ui.connectButton.classList.toggle("primary", !connected);
  [ui.topStatus, ui.connectionStatus].forEach((label) => {
    label.lastChild.textContent = connected ? "Conectando…" : "Sin conexión";
    label.classList.toggle("connected", connected);
  });
  [ui.gain, ui.integration, ui.pwm, ui.autoPage, ui.verifyButton].forEach((control) => { control.disabled = !connected; });
  ui.recordButton.disabled = !connected;
  updateCaptureButtons();
  if (!connected) {
    state.port = null;
    state.pending = null;
    ui.oled.textContent = "Esperando líneas\ndel firmware";
    ui.notice.innerHTML = '<strong>Sin telemetría vigente.</strong> Conecta el instrumento para verificar el enlace.';
    showMessage("Instrumento desconectado.");
  } else {
    const suffix = info?.usbVendorId ? ` (USB ${info.usbVendorId.toString(16).padStart(4, "0")})` : "";
    showMessage(`Puerto abierto a 115200 baudios${suffix}. Verificando firmware…`);
  }
}

async function sendCommand(payload) {
  try {
    await client.send(payload);
    return true;
  } catch (error) {
    showMessage(error.message, "error");
    return false;
  }
}

function handleMessage(message) {
  if (message.type === "state") {
    handleDeviceState(message);
  } else if (message.type === "telemetry") {
    try { handleTelemetry(parseTelemetry(message)); }
    catch (error) { showMessage(error.message, "error"); }
  } else if (message.type === "error") {
    const meanings = {
      sensor_missing: "El firmware no detecta el AS7341.",
      sensor_config_failed: "No se pudo aplicar la configuración del AS7341.",
      sensor_read_failed: "Falló una lectura del AS7341.",
      capture_invalid: "La solicitud de captura no es válida.",
    };
    showMessage(meanings[message.code] ?? `Error del instrumento: ${message.code}`, "error");
  }
}

function handleDeviceState(device) {
  state.deviceState = device;
  const compatible = device.device === "upch-mega-as7341"
    && device.protocol === 2
    && device.firmware === "2.3.0"
    && device.sensor_ready === true
    && Array.isArray(device.capabilities)
    && device.capabilities.includes("pwm_control");
  state.verified = compatible;
  ui.gain.value = device.gain ?? ui.gain.value;
  ui.integration.value = device.integration_time ?? ui.integration.value;
  ui.pwm.value = String(device.pwm_percent ?? ui.pwm.value);
  ui.autoPage.checked = Boolean(device.auto_page);
  if (Array.isArray(device.display_lines)) ui.oled.textContent = device.display_lines.join("\n");
  updateInstrumentState(device, compatible);
  ui.recordButton.disabled = !compatible;
  updateCaptureButtons();
  [ui.topStatus, ui.connectionStatus].forEach((label) => {
    label.lastChild.textContent = compatible ? "Conectado" : "Equipo incompatible";
    label.classList.toggle("connected", compatible);
    label.classList.toggle("error", !compatible);
  });
  showMessage(compatible ? "Instrumento verificado. Adquisición habilitada." : "El equipo no cumple el protocolo 2.3.0 requerido.", compatible ? "success" : "error");
}

function updateInstrumentState(device, compatible) {
  ui.notice.classList.toggle("notice-success", compatible);
  ui.notice.innerHTML = compatible
    ? '<strong>Telemetría vigente.</strong> Firmware, sensor, OLED y control PWM verificados.'
    : '<strong>Verificación incompleta.</strong> Revisa firmware 2.3.0, sensor y capacidades.';
  ui.deviceItems[2].lastElementChild.innerHTML = `<span class="status-dot"></span>${device.sensor_ready ? "Disponible" : "No disponible"}`;
  ui.deviceItems[3].lastElementChild.innerHTML = `<span class="status-dot"></span>${Array.isArray(device.display_lines) ? "Disponible" : "No verificada"}`;
  ui.deviceItems[4].lastElementChild.innerHTML = `<span class="status-dot"></span>${device.capabilities?.includes("pwm_control") ? "Disponible" : "No verificado"}`;
  ui.pageLabel.textContent = `Página física: ${Number.isInteger(device.page) ? device.page + 1 : "-"}`;
}

function handleTelemetry(frame) {
  if (state.lastFrame && frame.sequence <= state.lastFrame.sequence) {
    if (state.recording) void stopRecording(true, "Grabación detenida por reinicio de secuencia.");
    state.frameHistory = [];
  }
  state.lastFrame = frame;
  state.frameHistory.push(frame);
  state.frameHistory = state.frameHistory.slice(-20);
  updateReadings(frame);
  renderPlot({ animate: true });
  if (state.recording) state.recordingRows.push(recordingRow(frame));
  collectCapture(frame);
}

function updateReadings(frame) {
  CHANNEL_KEYS.forEach((key, index) => {
    const text = frame.channels[key] >= 65535 ? "OVFL" : String(frame.channels[key]);
    ui.acquisitionCells[index].textContent = text;
    ui.instrumentCells[index].textContent = text;
  });
  ui.contextValues[0].textContent = ui.sampleSelect.value || "Sin asignar";
  ui.contextValues[1].textContent = `${frame.millis} ms`;
  ui.contextValues[2].textContent = frame.gain;
  ui.contextValues[3].textContent = frame.integration_time.replace("ms", " ms");
  ui.contextValues[4].textContent = "USB";
  ui.gain.value = frame.gain;
  ui.integration.value = frame.integration_time;
  ui.pwm.value = String(frame.pwm_percent);
  if (Array.isArray(frame.display_lines)) ui.oled.textContent = frame.display_lines.join("\n");
  ui.pageLabel.textContent = `Página física: ${frame.page + 1}`;
  ui.instrumentSummary[0].textContent = ui.sampleSelect.value || "-";
  ui.instrumentSummary[1].textContent = `${frame.millis} ms`;
  ui.instrumentSummary[2].textContent = frame.gain;
  ui.instrumentSummary[3].textContent = frame.integration_time;
  ui.instrumentSummary[4].textContent = "Recibiendo";
  ui.emptyPlot.hidden = true;
}

function averagedChannels() {
  const count = Number(ui.average.value);
  const frames = state.frameHistory.slice(-count);
  if (!frames.length) return null;
  return CHANNEL_KEYS.slice(0, 8).map((key) => (
    frames.reduce((sum, frame) => sum + frame.channels[key], 0) / frames.length
  ));
}

function niceMaximum(value) {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.min(65535, step * magnitude);
}

function renderPlot(options = {}) {
  const target = averagedChannels();
  if (state.plotAnimationFrame !== null) {
    window.cancelAnimationFrame(state.plotAnimationFrame);
    state.plotAnimationFrame = null;
  }
  if (!target) {
    state.plotValues = null;
    drawPlot(null);
    return;
  }
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!options.animate || reduceMotion) {
    state.plotValues = target.slice();
    drawPlot(state.plotValues);
    return;
  }

  const start = state.plotValues?.slice() ?? target.map(() => 0);
  const startedAt = performance.now();
  const advance = (now) => {
    const progress = Math.min(1, (now - startedAt) / PLOT_ANIMATION_MS);
    state.plotValues = interpolatePlotValues(start, target, progress);
    drawPlot(state.plotValues);
    if (progress < 1) state.plotAnimationFrame = window.requestAnimationFrame(advance);
    else state.plotAnimationFrame = null;
  };
  state.plotAnimationFrame = window.requestAnimationFrame(advance);
}

function drawPlot(values) {
  let layer = $("#live-series", ui.plotSvg);
  if (!layer) {
    layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.id = "live-series";
    ui.plotSvg.append(layer);
  }
  layer.replaceChildren();
  if (!values) return;
  const finite = values.filter((value) => value < 65535);
  const maximum = ui.scale.value === "auto" ? niceMaximum(Math.max(...finite, 1) * 1.08) : Number(ui.scale.value);
  const xs = [55, 132.55, 222.98, 313.4, 416.79, 507.26, 610.66, 740];
  const points = values.map((value, index) => value >= 65535 || value > maximum
    ? null : [xs[index], 470 - (value / maximum) * 440]);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "live-line");
  path.setAttribute("d", points.map((point, index) => point ? `${index === 0 || !points[index - 1] ? "M" : "L"}${point[0]} ${point[1]}` : "").join(" "));
  layer.append(path);
  points.forEach((point, index) => {
    if (!point) return;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point[0]);
    circle.setAttribute("cy", point[1]);
    circle.setAttribute("r", "4");
    circle.setAttribute("class", `live-point band-${index}`);
    layer.append(circle);
  });
  const yLabels = $$('g[fill="#52677a"] text', ui.plotSvg).slice(0, 6);
  yLabels.forEach((label, index) => { label.textContent = Math.round(maximum * index / 5); });
  yLabels.reverse().forEach((label, index) => { label.setAttribute("y", String(34 + index * 88)); });
  ui.plotSvg.setAttribute("aria-label", `Espectro actual del AS7341; escala máxima ${maximum} cuentas`);
}

function recordingRow(frame) {
  return {
    received_at: new Date().toISOString(), sequence: frame.sequence, millis: frame.millis,
    gain: frame.gain, integration_time: frame.integration_time, pwm_percent: frame.pwm_percent,
    pwm_raw: frame.pwm_raw, page: frame.page, ...frame.channels,
  };
}

function toggleRecording() {
  if (state.recording) void stopRecording(true);
  else {
    state.recording = true;
    state.recordingRows = [];
    ui.recordButton.innerHTML = '<span class="record-dot"></span>Detener y guardar';
    ui.recordButton.disabled = false;
    ui.recordStatus.lastChild.textContent = "Grabando";
    ui.recordStatus.classList.add("recording");
    showMessage("Grabación iniciada. El CSV se descargará al detenerla.");
  }
}

async function stopRecording(download = true, message = "Grabación finalizada") {
  if (!state.recording) return;
  state.recording = false;
  ui.recordButton.innerHTML = '<span class="record-dot"></span>Iniciar grabación';
  ui.recordStatus.lastChild.textContent = "Sin grabar";
  ui.recordStatus.classList.remove("recording");
  if (download && state.recordingRows.length) {
    downloadCsv(state.recordingRows, `as7341_${fileTimestamp()}.csv`);
  }
  showMessage(`${message}: ${state.recordingRows.length} lecturas.`);
}

function addSample() {
  const name = window.prompt("Identificador de la nueva muestra:")?.trim();
  if (!name) return;
  if (!$$('option', ui.sampleSelect).some((option) => option.value === name)) {
    ui.sampleSelect.add(new Option(name, name));
  }
  ui.sampleSelect.value = name;
  syncSample();
}

function syncSample() {
  $("#sample-id").value = ui.sampleSelect.value === "Sin asignar" ? "" : ui.sampleSelect.value;
}

async function copyCurrentValues() {
  if (!state.lastFrame) return showMessage("Todavía no hay una lectura para copiar.", "error");
  const rows = CHANNEL_KEYS.map((key) => `${key.toUpperCase()}\t${state.lastFrame.channels[key]}`).join("\n");
  await navigator.clipboard.writeText(`Canal\tCuenta\n${rows}`);
  showMessage("Lectura actual copiada al portapapeles.", "success");
}

function bindExperiments() {
  const definitions = [
    ["#experiment-led", ["leda", "ledb"]],
    ["#experiment-reference", ["refa", "refb"]],
    ["#experiment-background", ["blank", "signal"]],
  ];
  definitions.forEach(([selector, slots]) => {
    const page = $(selector);
    const blocks = $$(".capture-block", page);
    slots.forEach((slot, index) => {
      const block = blocks[index];
      const select = $("select", block);
      const button = $("button", block);
      const status = $(".capture-status", block);
      select.value = "415";
      ui[`capture_${slot}`] = { select, button, status };
      button.addEventListener("click", () => beginCapture(slot));
    });
  });

  ui.ledCalculate = $("#experiment-led .blank-settings > button");
  ui.refCalculate = $("#experiment-reference .blank-settings > button");
  ui.correctedCalculate = $("#experiment-background .blank-settings > button");
  ui.ledCalculate.addEventListener("click", () => calculateRatio("led"));
  ui.refCalculate.addEventListener("click", () => calculateRatio("ref"));
  ui.correctedCalculate.addEventListener("click", calculateCorrectedIntensity);

  const calibration = $("#experiment-calibration");
  ui.calibrationInputs = $$("input, select", calibration);
  const calibrationButtons = $$("button", calibration);
  ui.addPointButton = calibrationButtons[0];
  ui.fitButton = calibrationButtons[1];
  ui.undoPointButton = calibrationButtons[2];
  ui.addPointButton.addEventListener("click", addCalibrationPoint);
  ui.fitButton.addEventListener("click", fitCalibration);
  ui.undoPointButton.addEventListener("click", undoCalibrationPoint);
  updateCaptureButtons();
}

function experimentMetadata(slot) {
  const role = slot === "blank" ? "blank" : slot === "signal" ? "signal" : slot;
  return {
    label: $("#capture-notes").value.trim() || slot.toUpperCase(),
    role,
    sample_id: $("#sample-id").value.trim(),
    optics: $("#optical-protocol").value.trim(),
    exposure: $("#exposure").value.trim(),
    notes: $("#capture-notes").value.trim(),
    channel: ui[`capture_${slot}`].select.value.toLowerCase(),
  };
}

async function beginCapture(slot) {
  if (!state.verified || state.pending) return;
  const metadata = experimentMetadata(slot);
  if (!metadata.optics) return showMessage("Describe el protocolo óptico antes de capturar.", "error");
  if (["blank", "signal"].includes(slot) && !metadata.exposure) {
    return showMessage("Identifica la exposición antes de capturar el blanco o la señal.", "error");
  }
  if (slot === "signal" && !metadata.sample_id) return showMessage("Identifica la muestra.", "error");
  const count = Math.max(1, Math.min(100, Number($("#capture-count").value) || 5));
  const settleText = $("#settle-time").value;
  const settleMs = Math.max(0, Math.min(10000, Number.parseInt(settleText, 10) || 0));
  const token = uuid32();
  state.pending = { slot, token, frames: [], count, metadata, timeoutId: null };
  state.pending.timeoutId = window.setTimeout(() => {
    cancelPending("Captura cancelada: no llegaron suficientes lecturas nuevas.");
  }, Math.max(15000, count * 4000));
  ui[`capture_${slot}`].status.textContent = `Capturando 0/${count}…`;
  ui.sessionStatus.textContent = `Capturando ${slot}: 0/${count} lecturas posteriores al clic.`;
  updateCaptureButtons();
  const sent = await sendCommand({ type: "command", command: "begin_capture", capture_id: token, settle_ms: settleMs });
  if (!sent) cancelPending("No se pudo iniciar la captura.");
}

function collectCapture(frame) {
  const pending = state.pending;
  if (!pending || frame.capture_id !== pending.token) return;
  if (pending.frames.at(-1)?.sequence >= frame.sequence) {
    return cancelPending("Captura cancelada por secuencia duplicada o reinicio.");
  }
  pending.frames.push(frame);
  ui[`capture_${pending.slot}`].status.textContent = `Capturando ${pending.frames.length}/${pending.count}…`;
  if (pending.frames.length < pending.count) return;
  try {
    const capture = buildCapture(pending.frames, pending.metadata);
    state.activeCaptures[pending.slot] = capture;
    state.session.captures[pending.slot] = capture;
    state.session.capture_history.push(capture);
    ui[`capture_${pending.slot}`].status.textContent = `Guardada · n=${capture.n} · ${capture.gain} · ${capture.integration_time}`;
    ui.sessionStatus.textContent = "Captura guardada. Conserva la configuración antes de continuar.";
    showMessage(`Captura ${pending.slot} guardada con ${capture.n} lecturas.`, "success");
    refreshEvidenceControls();
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    window.clearTimeout(pending.timeoutId);
    state.pending = null;
    updateCaptureButtons();
  }
}

function cancelPending(message) {
  if (!state.pending) return;
  window.clearTimeout(state.pending.timeoutId);
  const slot = state.pending.slot;
  state.pending = null;
  if (ui[`capture_${slot}`]) ui[`capture_${slot}`].status.textContent = "Sin captura";
  updateCaptureButtons();
  showMessage(message, "error");
}

function changeSetting(payload) {
  if (state.pending) cancelPending("Captura cancelada porque cambió la configuración del instrumento.");
  void sendCommand(payload);
}

function updateCaptureButtons() {
  const enabled = state.verified && !state.pending;
  ["leda", "ledb", "refa", "refb", "blank", "signal"].forEach((slot) => {
    if (ui[`capture_${slot}`]) ui[`capture_${slot}`].button.disabled = !enabled;
  });
  if (ui.ledCalculate) ui.ledCalculate.disabled = !(state.activeCaptures.leda && state.activeCaptures.ledb);
  if (ui.refCalculate) ui.refCalculate.disabled = !(state.activeCaptures.refa && state.activeCaptures.refb);
  if (ui.correctedCalculate) ui.correctedCalculate.disabled = !state.session.capture_history.some((capture) => capture.role === "signal")
    || !state.session.capture_history.some((capture) => capture.role === "blank");
  if (ui.addPointButton) ui.addPointButton.disabled = state.session.capture_history.length === 0 && !state.lastResult;
}

function blankSelections(page) {
  const selects = $$(".blank-row select", page);
  const checked = $(".blank-settings input[type=checkbox]", page)?.checked;
  if (!checked) return { blankA: null, blankB: null };
  const get = (select) => state.session.capture_history.find((capture) => capture.id === select.value) ?? null;
  return { blankA: get(selects[0]), blankB: get(selects[1]) };
}

function calculateRatio(mode) {
  try {
    const page = $(`#experiment-${mode === "led" ? "led" : "reference"}`);
    const a = state.activeCaptures[`${mode}a`];
    const b = state.activeCaptures[`${mode}b`];
    if (!a || !b) throw new Error("Completa las dos capturas primero.");
    const channels = $$(".capture-block select", page).map((select) => select.value.toLowerCase());
    const blanks = blankSelections(page);
    const referenceType = mode === "ref" ? $("#reference-kind").value : "LED sucesivos";
    if (referenceType === "Blanco sin fluoróforo") throw new Error("El blanco se resta; no se usa como denominador.");
    const result = ratioResult(a, b, channels[0], channels[1], { mode, referenceType, ...blanks });
    state.session.results.push(result);
    state.lastResult = result;
    ui.resultStrip.textContent = `${result.formula} = ${result.value.toPrecision(6)}`;
    showMessage("Cociente guardado con sus capturas raw.", "success");
    refreshEvidenceControls();
    renderHistory();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function refreshEvidenceControls() {
  const blanks = state.session.capture_history.filter((capture) => capture.role === "blank");
  $$('.blank-row select, select[aria-label*="Blanco"], select[aria-label*="blanco"]').forEach((select) => {
    const old = select.value;
    select.replaceChildren(new Option("Selecciona un blanco guardado", ""));
    blanks.forEach((capture) => select.add(new Option(
      `${capture.exposure} · ${capture.gain} · ${capture.integration_time} · ${capture.id.slice(0, 8)}`,
      capture.id,
    )));
    select.value = old;
  });
  const signalSelect = $('select[aria-label="Señal guardada"]');
  if (signalSelect) {
    const old = signalSelect.value;
    signalSelect.replaceChildren(new Option("Selecciona una señal guardada", ""));
    state.session.capture_history.filter((capture) => capture.role === "signal").forEach((capture) => {
      signalSelect.add(new Option(`${capture.sample_id} · ${capture.exposure} · ${capture.id.slice(0, 8)}`, capture.id));
    });
    signalSelect.value = old;
  }
  renderEvidenceSelect();
  updateCaptureButtons();
}

function calculateCorrectedIntensity() {
  try {
    const page = $("#experiment-background");
    const selects = $$(".blank-settings select", page);
    const signalCapture = state.session.capture_history.find((capture) => capture.id === selects[0].value);
    const blank = state.session.capture_history.find((capture) => capture.id === selects[1].value);
    if (!signalCapture || !blank) throw new Error("Selecciona una señal y su blanco compatible.");
    const result = intensityResult(signalCapture, signalCapture.channel, blank);
    state.session.intensity_results.push(result);
    state.lastResult = result;
    ui.resultStrip.textContent = `Intensidad corregida = ${result.value.toPrecision(6)} cuentas`;
    showMessage("Intensidad corregida guardada.", "success");
    refreshEvidenceControls();
    renderHistory();
  } catch (error) { showMessage(error.message, "error"); }
}

function addCalibrationPoint() {
  try {
    const [concentration, unit, source, channel, blankSelect] = ui.calibrationInputs;
    const x = Number(concentration.value);
    if (!Number.isFinite(x) || x < 0 || !unit.value.trim()) throw new Error("Indica una concentración y unidad válidas.");
    let evidence;
    if (source.selectedIndex === 1) {
      evidence = state.lastResult;
      if (!evidence) throw new Error("Calcula un cociente primero.");
    } else {
      const capture = [...state.session.capture_history].reverse().find((item) => item.role !== "blank");
      if (!capture) throw new Error("Realiza una captura para el estándar.");
      const blank = source.selectedIndex === 2
        ? state.session.capture_history.find((item) => item.id === blankSelect.value) : null;
      evidence = intensityResult(capture, channel.value.toLowerCase(), blank);
    }
    const point = { x, y: evidence.value, unit: unit.value.trim(), analysis_method: evidence.analysis_method, evidence };
    if (state.session.points.length && (state.session.points[0].analysis_method !== point.analysis_method
      || state.session.points[0].unit !== point.unit)) {
      throw new Error("La curva requiere el mismo método, canal, unidad y configuración.");
    }
    state.session.points.push(point);
    renderCalibration();
    showMessage("Punto de calibración guardado.", "success");
  } catch (error) { showMessage(error.message, "error"); }
}

function undoCalibrationPoint() {
  state.session.points.pop();
  state.session.fit = null;
  renderCalibration();
}

function fitCalibration() {
  try {
    state.session.fit = linearFit(state.session.points);
    renderCalibration();
    showMessage(`Ajuste lineal: R² ${state.session.fit.r2.toFixed(5)}.`, "success");
  } catch (error) { showMessage(error.message, "error"); }
}

function renderCalibration() {
  const label = $("#experiment-calibration .calibration-plot text");
  const help = $$("#experiment-calibration .calibration-plot text")[1];
  if (!state.session.points.length) {
    label.textContent = "Sin puntos de calibración";
    help.textContent = "Guarda al menos tres concentraciones distintas";
  } else if (!state.session.fit) {
    label.textContent = `${state.session.points.length} punto(s) guardado(s)`;
    help.textContent = "Pulsa Ajustar curva lineal para calcular";
  } else {
    const fit = state.session.fit;
    label.textContent = `y = ${fit.slope.toPrecision(5)}x + ${fit.intercept.toPrecision(5)}`;
    help.textContent = `R² ${fit.r2.toFixed(5)} · RMSE ${fit.rmse.toPrecision(4)} · n=${fit.n}`;
  }
}

function sessionPayload() {
  state.session.optics = $("#optical-protocol").value.trim();
  return structuredClone(state.session);
}

function saveSession() {
  downloadBlob(JSON.stringify(sessionPayload(), null, 2), `experimento_as7341_${fileTimestamp()}.json`, "application/json");
  showMessage("Experimento JSON descargado.", "success");
}

function openSession() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", async () => {
    try {
      const file = input.files[0];
      if (!file || file.size > 50_000_000) throw new Error("Archivo ausente o mayor de 50 MB.");
      const data = JSON.parse(await file.text());
      validateSession(data);
      state.session = data;
      state.activeCaptures = {};
      state.lastResult = [...data.results, ...data.intensity_results].at(-1) ?? null;
      $("#optical-protocol").value = data.optics ?? "";
      refreshEvidenceControls();
      renderHistory();
      renderCalibration();
      showMessage("Experimento recuperado para revisión.", "success");
    } catch (error) { showMessage(`No se pudo abrir: ${error.message}`, "error"); }
  });
  input.click();
}

function validateSession(data) {
  if (!data || data.version !== 3 || !Array.isArray(data.capture_history)
      || !Array.isArray(data.results) || !Array.isArray(data.intensity_results)
      || !Array.isArray(data.points)) throw new Error("El archivo no es una sesión Spectral Lab v3 válida.");
}

function exportPoints() {
  downloadCsv(state.session.points.map((point) => ({
    concentration: point.x, signal: point.y, unit: point.unit, analysis_method: point.analysis_method,
  })), `calibracion_${fileTimestamp()}.csv`);
}

function exportResults() {
  const rows = [...state.session.results, ...state.session.intensity_results].map((result) => ({
    id: result.id, kind: result.kind, sample_id: result.sample_id, formula: result.formula,
    value: result.value, corrected: result.corrected, received_at: result.received_at,
  }));
  downloadCsv(rows, `resultados_${fileTimestamp()}.csv`);
}

function renderHistory() {
  const results = [...state.session.results, ...state.session.intensity_results];
  ui.historyBody.innerHTML = results.length ? results.map((result) =>
    `<tr><td>${escapeHtml(result.sample_id || result.kind)}</td><td class="numeric">${Number(result.value).toPrecision(6)}</td></tr>`
  ).join("") : '<tr><td colspan="2" class="muted" style="text-align:center">Sin evidencia</td></tr>';
  renderEvidenceSelect();
}

function renderEvidenceSelect() {
  const evidence = [...state.session.results, ...state.session.intensity_results];
  const current = ui.resultsEvidence.value;
  ui.resultsEvidence.replaceChildren(new Option("Sin evidencia guardada", ""));
  evidence.forEach((result) => ui.resultsEvidence.add(new Option(
    `${result.kind === "ratio" ? "Cociente" : "Intensidad"} · ${result.sample_id || "sin muestra"} · ${result.id.slice(0, 8)}`,
    result.id,
  )));
  ui.resultsEvidence.value = evidence.some((result) => result.id === current) ? current : evidence.at(-1)?.id ?? "";
  renderSelectedEvidence();
}

function evidenceComponents(result) {
  if (!result) return [];
  if (result.kind === "ratio") return [
    ["Señal A", result.a, result.a.channel], ["Referencia B", result.b, result.b.channel],
  ];
  return [["Señal", result.sample, result.channel]];
}

function renderSelectedEvidence() {
  const all = [...state.session.results, ...state.session.intensity_results];
  const result = all.find((item) => item.id === ui.resultsEvidence.value);
  state.selectedEvidence = result ?? null;
  if (!result) {
    ui.resultsSummary.textContent = "Sin evidencia guardada. Captura un ensayo en Experimentos o abre un archivo JSON.";
    ui.componentsBody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center">Selecciona una evidencia para mostrar sus componentes</td></tr>';
    ui.interpretationMetrics[0].textContent = "Sin curva compatible";
    ui.interpretationMetrics[1].textContent = "No evaluable";
    ui.interpretationMetrics[2].textContent = "0";
    return;
  }
  ui.resultsSummary.textContent = `${result.formula} = ${Number(result.value).toPrecision(6)}. Evidencia raw conservada en el JSON.`;
  ui.componentsBody.innerHTML = evidenceComponents(result).map(([name, capture, channel]) => `
    <tr><td>${escapeHtml(name)}</td><td>${escapeHtml(String(channel).toUpperCase())}</td><td>${Number(capture.channels[channel]).toPrecision(6)}</td>
    <td>${Number(capture.sd[channel]).toPrecision(4)}</td><td>${Number(capture.n)}</td><td>${escapeHtml(capture.gain)}</td>
    <td>${escapeHtml(capture.integration_time)}</td><td>${Number(capture.pwm_percent)} %</td></tr>`).join("");
  const replicas = all.filter((item) => item.sample_id && item.sample_id === result.sample_id
    && item.analysis_method === result.analysis_method);
  ui.replicasBody.innerHTML = replicas.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.sample_id)}</td><td>${Number(item.value).toPrecision(6)}</td><td>${escapeHtml(item.measurement_ids.join(", ").slice(0, 22))}</td><td>${escapeHtml(item.blank?.id?.slice(0, 8) ?? "-")}</td></tr>`).join("")
    || '<tr><td colspan="5" class="muted" style="text-align:center">Sin réplicas completas disponibles</td></tr>';
  const lowReference = result.kind === "ratio" && result.denominator <= 1;
  const saturated = evidenceComponents(result).some(([, capture]) => capture.saturated.length);
  ui.interpretationMetrics[0].textContent = state.session.fit ? "Curva disponible; revisar rango" : "Sin curva compatible";
  ui.interpretationMetrics[1].textContent = lowReference ? "Referencia baja" : saturated ? "Canal saturado" : "Sin alertas operativas";
  ui.interpretationMetrics[2].textContent = String(replicas.length);
}

function downloadCsv(rows, filename) {
  if (!rows.length) return showMessage("No hay datos para exportar.", "error");
  const headers = Object.keys(rows[0]);
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.map(quote).join(","), ...rows.map((row) => headers.map((key) => quote(row[key])).join(","))].join("\r\n");
  downloadBlob(csv, filename, "text/csv;charset=utf-8");
}

function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileTimestamp() {
  return new Date().toISOString().replaceAll(/[-:]/g, "").replace("T", "_").slice(0, 15);
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = String(value);
  return node.innerHTML;
}

function showMessage(message, tone = "neutral") {
  ui.footerMessage.lastChild.textContent = message;
  ui.footerMessage.closest(".statusbar").dataset.tone = tone;
}

function showBrowserRequirement() {
  if ($(".browser-warning")) return;
  const warning = document.createElement("div");
  warning.className = "browser-warning";
  warning.setAttribute("role", "alert");
  warning.innerHTML = "<strong>Este navegador no ofrece Web Serial.</strong> Abre esta página HTTPS en Chrome o Edge de escritorio para conectar el Arduino Mega. La revisión de archivos sigue disponible.";
  $(".workspace").before(warning);
  ui.connectButton.disabled = true;
}

bindUi();
refreshPorts();
renderEvidenceSelect();
if (!WebSerialClient.supported) showBrowserRequirement();
