import { decodeMessage, encodeMessage } from "./protocol.mjs";

export class WebSerialClient extends EventTarget {
  constructor() {
    super();
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.reading = false;
    this.buffer = "";
    this.discardFirstLine = true;
  }

  static get supported() {
    return "serial" in navigator && window.isSecureContext;
  }

  async grantedPorts() {
    if (!WebSerialClient.supported) return [];
    return navigator.serial.getPorts();
  }

  async requestPort() {
    if (!WebSerialClient.supported) {
      throw new Error("Web Serial requiere Chrome o Edge de escritorio y una página HTTPS.");
    }
    return navigator.serial.requestPort();
  }

  async connect(port) {
    await this.disconnect(false);
    this.port = port;
    await port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none" });
    this.writer = port.writable.getWriter();
    this.buffer = "";
    this.discardFirstLine = true;
    this.reading = true;
    this.dispatchEvent(new CustomEvent("connection", { detail: { connected: true, info: port.getInfo() } }));
    void this.readLoop();
    try {
      await this.send({ type: "command", command: "get_state" });
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async send(message) {
    if (!this.writer) throw new Error("Conecta el instrumento antes de enviar una orden.");
    const bytes = new TextEncoder().encode(encodeMessage(message));
    await this.writer.write(bytes);
  }

  async readLoop() {
    while (this.port?.readable && this.reading) {
      this.reader = this.port.readable.getReader();
      try {
        while (this.reading) {
          const { value, done } = await this.reader.read();
          if (done) break;
          this.consume(new TextDecoder().decode(value, { stream: true }));
        }
      } catch (error) {
        if (this.reading) this.emitError(`Conexión serial interrumpida: ${error.message}`);
      } finally {
        this.reader.releaseLock();
        this.reader = null;
      }
    }
    if (this.reading) await this.disconnect();
  }

  consume(chunk) {
    this.buffer += chunk;
    if (this.buffer.length > 16384) {
      this.buffer = "";
      this.discardFirstLine = true;
      this.emitError("Se descartó un bloque serial sin saltos de línea.");
      return;
    }
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, "");
      this.buffer = this.buffer.slice(newline + 1);
      if (this.discardFirstLine) {
        this.discardFirstLine = false;
      } else if (line.length > 1024) {
        this.emitError("Se descartó una línea serial demasiado larga.");
      } else if (line.trim()) {
        try {
          this.dispatchEvent(new CustomEvent("message", { detail: decodeMessage(line) }));
        } catch (error) {
          this.emitError(error.message);
        }
      }
      newline = this.buffer.indexOf("\n");
    }
  }

  async disconnect(notify = true) {
    this.reading = false;
    if (this.reader) {
      try { await this.reader.cancel(); } catch { /* already closed */ }
    }
    if (this.writer) {
      try { this.writer.releaseLock(); } catch { /* already released */ }
      this.writer = null;
    }
    if (this.port) {
      try { await this.port.close(); } catch { /* unplugged or already closed */ }
      this.port = null;
    }
    this.buffer = "";
    if (notify) this.dispatchEvent(new CustomEvent("connection", { detail: { connected: false } }));
  }

  emitError(message) {
    this.dispatchEvent(new CustomEvent("error", { detail: { message } }));
  }
}
