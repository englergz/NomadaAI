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
sha256(artifacts/eval/t2_destino_direccion.csv)  = 819df55f328e3dd33e2fb3526b0e9d051618ab99744ce9957cbf3b2acd311340
sha256(artifacts/eval/oe3_alerta_nivel_alto.csv) = a028246359666416af0f23c153efe25838d4053cb9c2a2e18a6a0c8e5b679a36
```


## T6b-B — factor socioeconomico (2026-08-10)

```
sha256(artifacts/eval/t6b_socioeconomico.csv) = 87b9cfb0b286f958748425ba1b5e538cb8c9f6b2a546b622e190c55e7b726182
```
Reproducir: `python services/api/scripts/t6b_socioeconomico.py`


## T8 / I5 — contribuciones sobre la malla de 475 (2026-08-10)

```
sha256(artifacts/eval/t8_contribuciones.csv) = 6b0bda5a8e9634da67dd4dd5b096e7d2b5460466b45f0ff977c1c389d045220a
```
Reproducir: `python services/api/scripts/t8_contribuciones.py`


## Figuras 6, 7 y 8 regeneradas (2026-08-10)

```
sha256(artifacts/figuras/fig6_curva_horaria.png) = 846badc0139876501bb4ef0a9a2d79aaf3e2a49a0af00803477c2ae0274dd064
sha256(artifacts/figuras/fig7_umbral_cobertura.png) = 46546ce6f7f5187cc11da4ca55e8d8955563b9da12461886458d1bfc1269b0ce
sha256(artifacts/figuras/fig8_alerta_operacion.png) = b1698a693b3ff93a5ca28a2fdde5f31a473d83d2ffa06457ba794c92069c6c6d
```
Reproducir: `python services/api/scripts/figuras_6_7_8.py`
