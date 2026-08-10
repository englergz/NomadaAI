FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Los artefactos de Research se montan o copian en /research (ver RESEARCH_DIR).
# Sin esto, iterar cualquier `set` de cadenas da un orden distinto en cada arranque del
# contenedor, y con él cambian los pares O-D que devuelve /trajectories/sample y el ruido
# GPS de get_demo — aunque el código use semilla fija. Es la causa raíz de que dos
# barridos "reproducibles" dieran resultados distintos.
ENV PYTHONHASHSEED=0
ENV RESEARCH_DIR=/research
ENV PORT=8000

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
