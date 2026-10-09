# Verificación de Spectral Lab v2.0

Fecha: 9 de octubre de 2026.

## Resultado automatizado

- Compilación sintáctica de `main.py`, `main_v2.py` y los módulos de `desktop_gui`: aprobada.
- Suite Qt en modo offscreen: **65 de 65 pruebas aprobadas**.
- La suite incluye protocolo, adquisición, escala automática, grabación, seguridad de sesiones, experimentos, blancos, cocientes, calibración, resultados y distribución visual v2.
- `pip-audit` sobre `desktop_gui/requirements.txt`: sin vulnerabilidades conocidas.

Comando reproducible desde esta carpeta:

```bash
QT_QPA_PLATFORM=offscreen PYTHONPATH=".:desktop_gui" \
python -m unittest discover -s tests -v
```

## Alcance

Estas pruebas validan el comportamiento del software y la composición de la interfaz. No validan el cableado real, los niveles lógicos, la salida óptica, el ajuste mecánico ni la calibración del instrumento.
