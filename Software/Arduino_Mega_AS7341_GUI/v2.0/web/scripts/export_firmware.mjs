import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = resolve(scriptDirectory, "..");
const repositoryDirectory = resolve(webDirectory, "../../../..");
const firmwareDirectory = resolve(
  repositoryDirectory,
  "Firmware/Arduino_Mega_AS7341/v1.0/firmware/mega_as7341_multichannel",
);
const outputDirectory = resolve(webDirectory, "downloads");
const outputPath = resolve(outputDirectory, "mega_as7341_multichannel_v2_3_0.ino");

const [firmwareSource, pwmHeaderSource] = await Promise.all([
  readFile(resolve(firmwareDirectory, "firmware.cpp"), "utf8"),
  readFile(resolve(firmwareDirectory, "HighSpeedPWMDAC.h"), "utf8"),
]);

const pwmDriver = pwmHeaderSource
  .replace(/\r\n/g, "\n")
  .replace(/^#ifndef HIGHSPEEDPWM_DAC_H\n#define HIGHSPEEDPWM_DAC_H\n\n/, "")
  .replace("#include <Arduino.h>\n\n", "")
  .replace(/\n#endif\s*$/, "");

const standaloneFirmware = firmwareSource
  .replace(/\r\n/g, "\n")
  .replace("#include <HighSpeedPWMDAC.h>\n", "")
  .replace("namespace {\n", `${pwmDriver}\n\nnamespace {\n`);

const banner = `// Spectral Lab · firmware 2.3.0 para Arduino Mega 2560
// Exportación autocontenida generada desde firmware.cpp y HighSpeedPWMDAC.h.
// Bibliotecas requeridas: ArduinoJson, Adafruit AS7341, Adafruit GFX y Adafruit PCD8544.
// Pines: OLED RST 3, CE 4, DC 5; PWM LED D11; AS7341 por I2C.

`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${banner}${standaloneFirmware}`, "utf8");
console.log(outputPath);
