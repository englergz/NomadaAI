# Roadmap de sesiones — backlog consolidado (fuente de verdad del trabajo pendiente)

> Se actualiza en cada sesión. Lo hecho se marca con fecha y commit. Orden = prioridad acordada.

## Hecho (resumen)
- ✅ Web escritorio: tokens claro/oscuro pares, branding (favicon/PWA/login), menú agrupado, fix crash StrictMode.
- ✅ App móvil Fases 0–4: scaffold Expo + shared, mapa MapLibre (web+nativo), riesgo, buscador destino
  (POIs+Nominatim con direcciones), ruta segura vs directa coloreada POR TRAMO, regla EVITAR/AVISAR,
  alertas graduadas por acción (1×zona), recorrido libre + predicción online por movimiento (~≥15 km/h),
  recorrido automático (opt-in), reporte ciudadano persistente (rate-limit servidor), Ajustes
  (tema en caliente, capas, heatmap paletas/intensidad/opacidad, vehículo B.6.1, umbral), «Tu protección»
  (/history, mode:'mobile'), FABs coherentes, licencia PolyForm NC.

## Cola de trabajo (en orden)

### R1 · Framework de riesgo configurable (brief Parte A1+A2) — SIGUIENTE
1. Golden test: hash de artifacts actuales (ver `services/api/scripts/GOLDEN.md`) — el refactor con
   config equivalente NO debe cambiar un decimal.
2. `risk_config.<city>.json`: registro de 8 factores {enabled, weight, temporal_profile, motivo}
   (densidad, periferia, actividad, policía, socioeconómico, POIs, iluminación, delito-reportado).
3. Refactor `rebuild_risk_full.py` → registro de factores; Σ=1 sobre activos; disabled=0; `--config`.
4. A2 (crítica #11): `temporal_profile` POR FACTOR (flat/night_up/nightlife/custom24) →
   `IRU = Σ w_i·TEMP_i(h)·pctl(F_i)`: el ranking espacial cambia con la hora sin microdato.
   Sincronizar MODELO_RIESGO.md §2/§7 en el mismo commit.
5. Extras acordados: endpoint `/risk/explain?cell=` (desglose w_i·pctl(F_i)); hash de config + fecha
   en los CSV de salida (reproducibilidad); re-correr pipeline y reportar números para figuras/TABLA I/ρ/OE4.

### R1b · A6 — Imagen de riesgo COMPARATIVA (al regenerar)
- Conservar la superficie anterior; presentar AMBAS (config anterior vs. actual) con rótulos de
  factores activos. Aplicar en README y MODELO_RIESGO.md. En tesis: figura adicional o nota, SIN
  solaparse con la Fig. 5 (degenerado vs. multifactor) — rotular las dos comparaciones distinto.
- Reportar números nuevos (correlaciones, zonas, ρ, OE4) para sincronizar docs + tesis.

### R2 · Adquisición de dato (A3)
- Overpass tags correctos (bar/pub/nightclub, shop=alcohol, marketplace, bus_station) Tumaco;
  DANE manzana socioec.; iluminación OSM/VIIRS. Vacío → OFF documentado en §3.2 (hallazgo).

### R3 · Bucle ciudadano (A4) — base ya persiste
- `F_report(z,t)` con decay/verificación/anonimización como factor del registro (OFF hasta volumen).
- A5 calibración/GWR: especificado (§4.2), se activa con dato de resultado.

### U1 · UI app de usuario (brief Parte B + pendientes previos)
- B1 overlaps: pila Perfil/Ajustes/Reportar ARRIBA del FAB ubicación; banners abajo-centro (no tapan).
- B2 nombre «Nómada.AI» flotante arriba-centro. B3 seam de modales (overflow/borde). 
- B4 Lugares con ICONOS por categoría (no puntos). B5 naming: «Directa» (no «Rápida»).
- B6 HISTORIAL DE ALERTAS (hora/zona/acción, persistente, en hoja de perfil).
- B8 Ajustes reordenado: VEHÍCULO / RECORRIDO Y ALERTAS / TEMA / MAPA Y CAPAS / RIESGO (categoría
  propia: toggle + heatmap dentro, deshabilitado si capa OFF). Sin taxi ✓.
- Descargo ético visible en ruta/alerta («índice de referencia relativo, no garantía de seguridad»).
- Estados vacíos/carga/errores API; accesibilidad (touch ≥44pt, contraste, paridad tokens).

### U2 · IDIOMA (pendiente previo)
- expo-localization: detectar idioma del dispositivo; diccionario es/en; selector en Ajustes.

### U3 · CIUDAD estilo inDrive (pendiente previo)
- Selector de ciudad (/risk/cities) con flyTo + recarga por `city`; detección automática de ciudad
  y, si cambió, preguntar «¿Estás en Cali?» antes de cambiar. Honesto: en Cali hoy solo capa de
  riesgo (sin predicción ni ruteo hasta pipeline de esa ciudad).

### U4 · LOGIN (pendiente previo + B7)
- Clerk en el HOME (no pantalla previa): Google (nombre/correo/foto) + «continuar como invitado»;
  fecha de nacimiento y nacionalidad como campos de perfil propios (consentimiento, Ley 1581) → BI.
- Token en escrituras (reportes/históricos); vehículo y tema al perfil; foto en el FAB de perfil.
- Foto en reportes (Storage) cuando haya login.

### U5 · ESCRITORIO (brief Parte C)
- «Menú» → «Ajustes» con TODO lo de la app (tema/vehículo predeterminado/heatmap/umbral) sin quitar
  lo existente (satelital, seguir vehículo, trayectorias, ayuda). Vehículo elegido = predeterminado
  del panel.

### U6 · ADMIN + PORTAL (pendientes previos + brief parte 2)
- Panel admin (B.9) con rol Clerk verificado EN SERVIDOR: editar risk_config por ciudad con vista
  previa; moderación de reportes; BI (mode sim|mobile ya separado).
- Portal appweb: dominio propio pendiente de decisión; smart banner «continuar aquí / descargar app»;
  botón desde el escritorio.

## Reglas permanentes
- Commits 100% autoría de englergz, sin trailer de coautoría. Verificar en preview claro/oscuro y
  responsive. MODELO_RIESGO.md sincronizado con el código. Cambio de factores ⇒ re-correr pipeline,
  regenerar 6 figuras + TABLA I + correlaciones + ρ + OE4 y reportar números.
