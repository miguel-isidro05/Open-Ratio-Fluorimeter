# Carcasa v2.2 — versión vigente

Esta carpeta contiene la revisión mecánica v2.2 del instrumento. La base aloja el Arduino Mega dentro del volumen de la carcasa y conserva aberturas independientes para el USB tipo B y el jack de alimentación. La tapa corresponde a la misma longitud exterior.

## Archivos

| Archivo | Uso |
| --- | --- |
| [`base_final.step`](base_final.step) | Fuente CAD editable de la base |
| [`tapa_final.step`](tapa_final.step) | Fuente CAD editable de la tapa |
| [`carcasa_final.stl`](carcasa_final.stl) | Base v2.2 lista para preparar en el laminador |
| [`tapa_final.stl`](tapa_final.stl) | Tapa v2.2 correspondiente a la base |
| [`ensamble_verificacion_v2_2.FCStd`](ensamble_verificacion_v2_2.FCStd) | Ensamble de FreeCAD usado para revisar la ubicación del Mega y los conectores |

Los STEP son los archivos preferidos para modificar la geometría. Los STL son mallas secundarias y no conservan el historial paramétrico.

## Verificación de integridad

| Archivo | SHA-256 |
| --- | --- |
| `base_final.step` | `459c6f9d73faceac942b11d65c625341c168dc7742481575f61e0a083b5f380c` |
| `tapa_final.step` | `8fbf238e9201bb421e47efde4413d8d8fa85824b3a4e4aa45a6c6557edcad046` |
| `carcasa_final.stl` | `8520d787a37eeadc34b66e952ac9ec8e3efe7e498803a0c1ee3c195bf89926de` |
| `tapa_final.stl` | `4fd16addc071bdd1f8069f13d358b6740688bfb62b773c978c6571ed0146f7f2` |
| `ensamble_verificacion_v2_2.FCStd` | `c6ffeec6bd28563f573bda80000684fe8cb057380726ce633f2c363d083ece3a` |

La base se extendió 3 mm en la dirección del panel de conectores. La revisión geométrica dejó 0,6 mm frente al separador del fluorímetro y aberturas con 0,6 mm de holgura alrededor del USB y del jack. Los cuatro apoyos roscados del Mega se retiraron para mantener la superficie plana. Antes de imprimir, confirma unidades, orientación, tolerancias, soportes y espacio para conectores y cableado en el laminador.
