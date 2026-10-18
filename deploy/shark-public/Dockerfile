# SHARK-LIVE.HOST — operator-built source artifact only, NOT an auto-deploy.
# Build from the crispy-waddle repository root with -f deploy/shark-public/Dockerfile .
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SHARK_PUBLIC_HOST_COMMISSIONED=false \
    ENABLE_SHARK_PUBLIC_ALERTS=false

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates age \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 shark \
    && useradd --uid 10001 --gid 10001 --no-create-home \
        --home-dir /nonexistent --shell /usr/sbin/nologin shark \
    && mkdir -p /state \
    && chown 10001:10001 /state \
    && chmod 0700 /state

WORKDIR /app
COPY --chown=10001:10001 ops/meme/ /app/ops/meme/
COPY --chown=10001:10001 ops/telegram/ /app/ops/telegram/

USER 10001:10001
VOLUME ["/state"]

# Deliberately no EXPOSE, HTTP server, key mount, real-money actions, or
# background poller in this image's default command.
ENTRYPOINT ["python3", "-u", "ops/meme/shark_host_acceptance.py"]
CMD ["--mode", "preflight", "--state-dir", "/state"]
