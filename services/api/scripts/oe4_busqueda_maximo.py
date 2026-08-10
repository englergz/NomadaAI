"""¿Existe algún par O-D que alcance el 36,2 % de la Figura 14?
Barrido AMPLIO a protección máxima: 100 pares × 4 horas, λ=5.0."""
import json, random, urllib.request, csv
B="https://englergz-nomadaai.hf.space"
def get(p):
    with urllib.request.urlopen(B+p,timeout=120) as r: return json.load(r)
def post(p,b):
    rq=urllib.request.Request(B+p,data=json.dumps(b).encode(),
        headers={"content-type":"application/json"},method="POST")
    with urllib.request.urlopen(rq,timeout=180) as r: return json.load(r)

ids=sorted(t["id"] for t in get("/trajectories/sample?n=100").get("trips",[]))
rows=[]
for tid in ids:
    try:
        c=get(f"/trajectories/{tid}/track").get("coords",[])
        if len(c)<2: continue
    except Exception: continue
    for h in (6,12,20,22):
        try: j=post("/route/build",{"origin":c[0],"dest":c[-1],"type":None,"hour":h,"risk_weight":5.0})
        except Exception: continue
        cm=j.get("comparison") or {}
        if cm.get("exposure_reduction_pct") is None: continue
        rows.append({"trip_id":tid,"hour":h,"red":cm["exposure_reduction_pct"],
                     "safe_dist_m":cm.get("safe_distance_m"),"direct_dist_m":cm.get("direct_distance_m")})
rows.sort(key=lambda r:-r["red"])
with open("services/api/artifacts/eval/oe4_busqueda_maximo.csv","w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
n=len(rows)
print(f"rutas evaluadas: {n} ({len(set(r['trip_id'] for r in rows))} pares × 4 horas) · λ=5.0")
print(f"MÁXIMO: {rows[0]['red']:.2f}%  · par {rows[0]['trip_id']} · hora {rows[0]['hour']}:00")
for u in (36,30,25,20):
    print(f"  rutas ≥{u}%: {sum(1 for r in rows if r['red']>=u)}/{n}")
print("\nTop 5:")
for r in rows[:5]: print(f"  {r['red']:6.2f}%  {r['trip_id']}  {r['hour']:02d}:00")
