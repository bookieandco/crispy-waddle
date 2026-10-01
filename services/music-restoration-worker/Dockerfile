FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8093 \
    MUSIC_RESTORATION_OUTPUT_DIR=/data/music-restoration

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       ffmpeg ca-certificates libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip wheel \
    && python -m pip install --no-cache-dir -r /app/requirements.txt

COPY app.py worker.py source_fetch.py source_recovery.py convergence_qc.py vercel_oidc.py /app/
RUN mkdir -p /data/music-restoration

CMD ["sh","-c","uvicorn app:app --host 0.0.0.0 --port ${PORT:-8093}"]
