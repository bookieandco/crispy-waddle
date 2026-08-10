FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv ffmpeg git libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/wav2lip
COPY requirements.txt .
RUN python3 -m pip install --upgrade pip && pip install -r requirements.txt

# Supply a licensed Wav2Lip checkout at build time. Do not bake credentials into the image.
ARG WAV2LIP_SOURCE=./Wav2Lip
COPY ${WAV2LIP_SOURCE}/ ./Wav2Lip/
COPY app.py ./app.py

RUN mkdir -p /data/inputs /data/outputs /models

EXPOSE 8080
CMD ["python3", "app.py"]
