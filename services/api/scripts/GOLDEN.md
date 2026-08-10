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

---

## Artefactos de evaluación OE4 (recómputo agosto 2026)

```
sha256(artifacts/eval/oe4_lambda_canonico.csv) = 586432d572a289cba5285ee01bba9eaada4672e50db6d98b507579bc72e5522c
sha256(artifacts/eval/oe4_od_sweep.csv)        = 4f714482ea4b0bf733bf3e21444371df3a7460b3e7441e9733e09dd2844b227c
```

- **`oe4_lambda_canonico.csv`** — corrida canónica: 1.200 filas = 40 pares O-D × 5 horas ×
  6 valores de λ {0 · 1 · 2 · **2,5** · 3 · 5}. Pares fijados con semilla 7.
  Reproducir con `python services/api/scripts/oe4_lambda_canonico.py`.
- **`oe4_od_sweep.csv`** — barrido original (λ=5,0 fijo, 200 filas). **Se conserva sin
  tocar** como referencia histórica: es el que respalda el 7,00 % publicado.

Corrida definitiva del **2026-08-10**, posterior al arreglo de reproducibilidad
(`PYTHONHASHSEED=0` + `sorted()`): **1.200/1.200 rutas, cero fallos**, en una sola pasada
con reintentos. Sustituye a la corrida del 09-08, que se hizo sobre pares no reproducibles.

La versión anterior se midió en **dos pasadas** (λ=2,5 aparte) y se fusionó tras verificar que la superficie
del backend no cambió entre ellas:

```
huella del backend en ambas pasadas (2026-08-09):
  sha256 = 8aa90d5f4465c5c370e14b32444fbec85fb64f4637aa476ab1411aa501252e4e
  n_trajectories=4032 · n_train=3226 · n_test=806 · n_segments=1215776 · n_corridors=47788
  /risk/zones?hour=20 → 475 celdas · max_risk=81.18 · niveles 332/95/48
```

Verificación:
```bash
python services/api/scripts/huella_backend.py --check services/api/scripts/huella_backend.json
```


## OE3 — alerta anticipada en el punto de operacion (2026-08-10)

```
sha256(artifacts/eval/oe3_alerta_punto_operacion.csv) = 51d538181ce85e591731ca8d898f08687702a4310fec994b93d4e06cdd1f2388
```

Medido con `threshold_norm=0.7`, `speed_mps=8.3`, sin horizonte y con reloj de hora de
llegada -- los parametros reales de `app/data/risk.py::lookahead_alert`. Sobre las 4.032
trayectorias del corpus y la malla entregada de 475 celdas.
Reproducir: `python services/api/scripts/oe3_alerta_punto_operacion.py`


## Artefactos anadidos el 2026-08-10

```
sha256(artifacts/eval/oe3_alerta_nivel_alto.csv)   = 125f6f94bd8a85a342d9891951661caa73836981419387fcc08009c5129dffeb
sha256(artifacts/eval/c5_humo_route_build.csv)     = ca8e07e2639ae8189812e2ef842bc95cfd5b1d572b12b5d2922651033ce8f64f
```

- `oe3_alerta_nivel_alto.csv` — cruce de zona de nivel alto (`risk_norm >= 0.90`), el
  contrapeso del 99,1 % de precaucion. Reproducir:
  `python services/api/scripts/oe3_alerta_punto_operacion.py --threshold 0.9`
- `c5_humo_route_build.csv` — 8 invariantes de `/route/build`. Reproducir:
  `python services/api/scripts/c5_humo_route_build.py` (sale con codigo 1 si alguna falla)


## Artefactos T2 y OE3 nivel alto (2026-08-10)

```
sha256(artifacts/eval/t2_destino_direccion.csv)  = f70d8c120439a87857881765ced510c76056b50715a05832bb24216ea87e8869
sha256(artifacts/eval/oe3_alerta_nivel_alto.csv) = a028246359666416af0f23c153efe25838d4053cb9c2a2e18a6a0c8e5b679a36
```
