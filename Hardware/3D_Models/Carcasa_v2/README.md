# Carcasa v2 — versión vigente

Esta carpeta contiene la entrega mecánica actual del instrumento. Los nombres originales se conservan para mantener la trazabilidad con el flujo de CAD y fusión.

## Archivos

| Archivo | Uso |
| --- | --- |
| [`base_final.step`](base_final.step) | Fuente CAD editable de la base |
| [`tapa_final.step`](tapa_final.step) | Fuente CAD editable de la tapa |
| [`arduino_mega_case_base_fusionada.stl`](arduino_mega_case_base_fusionada.stl) | Malla STL de la base fusionada entregada para impresión |
| [`arduino_mega_case_body_for_fusion.stl`](arduino_mega_case_body_for_fusion.stl) | Malla STL del cuerpo preparado para el flujo de fusión |

Los STEP son los archivos preferidos para modificar la geometría. Los STL son mallas secundarias y no conservan el historial paramétrico.

## Verificación de integridad

| Archivo | SHA-256 |
| --- | --- |
| `base_final.step` | `7e2286db1d4c14d06a9aac64b5e7283712f1091ba49ac8d93996737af22230f3` |
| `tapa_final.step` | `01ddb464e69c3bb53519b2ec0171445a0929b6f548c367d74d69bff92adb4768` |
| `arduino_mega_case_base_fusionada.stl` | `2e695e71e029927eb5984d6189c9edfcbb7edbf17392b2218850355d3c030a94` |
| `arduino_mega_case_body_for_fusion.stl` | `918fecbcbb0bb1818a44c0c6117f17d25468f2ad62d0715bbafaa77f44161560` |

Los STEP contienen un sólido cerrado cada uno. Las mallas suministradas contienen 20 306 y 9 340 triángulos, respectivamente. Antes de imprimir, confirma unidades, orientación, tolerancias, soportes y espacio para conectores y cableado en el laminador.
