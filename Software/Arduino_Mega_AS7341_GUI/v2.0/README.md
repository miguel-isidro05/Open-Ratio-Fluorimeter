# Spectral Lab v2.0

Esta es la versión vigente de la GUI para Arduino Mega 2560 y AS7341. Mantiene la lógica funcional de adquisición y análisis, pero reorganiza la aplicación en cuatro áreas: **Adquisición**, **Instrumento**, **Experimentos** y **Resultados**.

## Contenido

| Ruta | Función |
| --- | --- |
| [`main.py`](main.py) | Lanzador estable de la versión actual |
| [`design_prototype/main/main_v2.py`](design_prototype/main/main_v2.py) | Composición visual PyQt6 aprobada |
| [`desktop_gui/`](desktop_gui/) | Protocolo serial, adquisición, experimentos, almacenamiento y análisis |
| [`web/`](web/) | Aplicación estática con Web Serial para GitHub Pages |
| [`design_prototype/index.html`](design_prototype/index.html) | Prototipo HTML estático usado para validar la distribución |
| [`design_prototype/references/`](design_prototype/references/) | Capturas de referencia de las cuatro vistas |
| [`tests/`](tests/) | Pruebas funcionales y de distribución |

## Instalación

En macOS o Linux:

```bash
cd Software/Arduino_Mega_AS7341_GUI/v2.0
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r desktop_gui/requirements.txt
python main.py
```

El puerto del Mega suele aparecer como `/dev/cu.usbmodem*` o `/dev/cu.usbserial*` en macOS. La comunicación usa 115200 baudios.

## Versión web

La misma distribución se publica en:

<https://miguel-isidro05.github.io/Open-Ratio-Fluorimeter/>

Abre la página en Chrome o Edge de escritorio, conecta el Arduino Mega por USB y pulsa **Conectar**. El navegador siempre muestra su propio selector de puertos antes de conceder acceso. Safari y Firefox no implementan Web Serial actualmente.

La versión web usa el mismo protocolo JSON Lines v2 y firmware 2.3.0 que la aplicación PyQt6. Puede configurar ganancia, integración y PWM; visualizar las diez bandas y la pantalla OLED; grabar CSV; realizar capturas experimentales; y abrir o descargar sesiones JSON. Los archivos se descargan desde el navegador porque GitHub Pages no tiene acceso directo al sistema de archivos local.

## Flujo de uso

1. Selecciona el puerto USB y conecta el instrumento.
2. Confirma la verificación del AS7341, la pantalla y el control PWM.
3. Ajusta ganancia, integración y PWM antes de iniciar una serie.
4. Asigna una muestra y registra el protocolo óptico.
5. Guarda el experimento en JSON y exporta los datos necesarios a CSV.

No compares cuentas obtenidas con configuraciones ópticas, ganancias o tiempos de integración distintos sin una normalización justificada.

## Pruebas

Con el entorno activado:

```bash
QT_QPA_PLATFORM=offscreen PYTHONPATH=".:desktop_gui" \
python -m unittest discover -s tests -v

node --test web/tests/*.test.mjs
```

Las pruebas automatizadas no sustituyen la comprobación física del cableado, los niveles lógicos, la respuesta del sensor ni la calibración óptica.
