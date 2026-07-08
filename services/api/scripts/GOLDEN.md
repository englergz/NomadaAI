# Golden test del pipeline de riesgo (referencia intocable del refactor)

Los CSV siguientes son la salida del pipeline ACTUAL (pesos fijos 0.35/0.30/0.20/0.15,
NIGHT_FLOOR=0.5) y respaldan TODAS las figuras y cifras de OE2/OE4 de la tesis.
Regla: el refactor a `risk_config.<city>.json` con la configuración EQUIVALENTE debe
reproducir estos hashes EXACTOS (mismo dato de entrada). Si un hash cambia sin cambiar
la config, el refactor está mal.

```
sha256(tumaco_riesgo_horario.csv)  = 8b5fe9e33c0abd25be9566a5486b886bcfd1096be028e73ad4cbe2109f0abc64
sha256(tumaco_zonas_riesgo_v2.csv) = ec21c361e18eaf6ff2e946f786916961e207cbf8f758669f165667f6eafecc61
```

Verificación rápida:
```bash
cd services/api && shasum -a 256 -c scripts/golden.sha256
```

Nota: correr el pipeline re-descarga DANE/OSM (red); si la fuente remota cambió, comparar
contra estos artefactos versionados, no contra una re-descarga.
