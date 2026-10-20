# Spectral Lab Web Serial

Esta carpeta contiene la versión estática de Spectral Lab que GitHub Pages publica en:

<https://miguel-isidro05.github.io/Open-Ratio-Fluorimeter/>

No necesita servidor Python. El navegador se comunica directamente con el Arduino Mega mediante Web Serial y el protocolo JSON Lines v2 del firmware 2.3.0.

## Requisitos

- Chrome o Edge de escritorio.
- Página servida por HTTPS o desde `localhost`.
- Arduino Mega con el firmware `mega_as7341_multichannel` del repositorio.
- Velocidad serial de 115200 baudios.

## Uso

1. Conecta el Arduino Mega por USB.
2. Abre la página y pulsa **Conectar**.
3. Selecciona el puerto del Mega en el diálogo del navegador.
4. Espera la verificación del firmware, el AS7341, la OLED y el PWM.
5. Trabaja desde Adquisición, Instrumento, Experimentos o Resultados.

El permiso serial queda bajo control del navegador. La página no puede elegir un dispositivo ni abrirlo sin una acción del usuario.

## Desarrollo local

Desde esta carpeta:

```bash
python3 -m http.server 8766
```

Abre `http://127.0.0.1:8766/`. No abras `index.html` mediante `file://`, porque Web Serial exige un contexto seguro.

## Pruebas

```bash
node --test tests/*.test.mjs
```

Las pruebas cubren el contrato serial y los cálculos de captura, blanco, cociente y calibración. La comprobación final debe hacerse con el Arduino conectado.
