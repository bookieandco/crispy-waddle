FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8092

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY services/director-speaker-qc/requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip wheel \
    && python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.14.0 torchaudio==2.14.0 \
    && python -m pip install --no-cache-dir -r /app/requirements.txt

COPY services/director-speaker-qc/app.py services/director-speaker-qc/worker.py /app/

CMD ["sh","-c","uvicorn app:app --host 0.0.0.0 --port ${PORT:-8092}"]
