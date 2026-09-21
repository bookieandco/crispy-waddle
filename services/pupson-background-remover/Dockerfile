FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000 \
    U2NETP_PATH=/tmp/u2net

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg build-essential && \
    rm -rf /var/lib/apt/lists/*

# Pin the exact audited BackgroundRemover source revision. Use GitHub's
# immutable commit archive so git itself is not needed in the runtime image.
RUN pip install --no-cache-dir \
    "https://github.com/nadermx/backgroundremover/archive/fa480627829759b902f8c233388d7aa67ab38099.tar.gz" \
    flask \
    waitress

RUN mkdir -p /tmp/u2net

EXPOSE 5000

CMD ["python", "-m", "backgroundremover.cmd.server", "--addr", "0.0.0.0", "--port", "5000"]
