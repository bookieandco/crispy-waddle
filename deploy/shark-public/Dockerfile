# SHARK-LIVE.HOST — operator-built source artifact only, NOT an auto-deploy.
# Build from the crispy-waddle repository root with -f deploy/shark-public/Dockerfile .
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SHARK_PUBLIC_HOST_COMMISSIONED=false \
    ENABLE_SHARK_PUBLIC_ALERTS=false \
    SHARK_RAILWAY_VOLUME_BOOTSTRAP=false \
    SHARK_RAILWAY_WORKER_ENABLED=false \
    SHARK_RAILWAY_ALERTS_ENABLED=false

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

# Intentionally NO VOLUME instruction: Docker would silently create an
# anonymous, potentially disposable volume that looks like a valid mount.
# The operator MUST explicitly mount an approved durable /state volume.
# CI verifies that omitting this mount fails the dedicated-mount check.

# Deliberately no EXPOSE, HTTP server, key mount, real-money actions, or
# background poller in this image's default command.\n# Railway root-mounted volume compatibility occurs ONLY at startup with\n# an explicit host-scoped RAILWAY_RUN_UID=0 plus separate bootstrap grant.\n# The bootstrap drops to UID/GID 10001 before running the preflight or worker.
ENTRYPOINT ["python3", "-u", "ops/meme/shark_railway_bootstrap.py"]
CMD ["--mode", "preflight", "--state-dir", "/state"]
