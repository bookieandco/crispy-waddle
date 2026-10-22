# Railway staging-only container for the Telegram owner's private session.
# Activation deliberately requires a later code change and independent release.
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TELEGRAM_CLOUD_PROCESS_MODE=hold \
    TELEGRAM_CLOUD_MOUNT=/var/lib/jhadina-telegram \
    TELEGRAM_PRIVATE_DIR=/var/lib/jhadina-telegram/private

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates gosu tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 jhadina \
    && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin jhadina

WORKDIR /opt/jhadina
COPY scripts/shark-telegram/requirements.txt /tmp/jhadina-telegram-requirements.txt
RUN pip install --no-cache-dir --disable-pip-version-check -r /tmp/jhadina-telegram-requirements.txt \
    && rm -f /tmp/jhadina-telegram-requirements.txt
COPY scripts/shark-telegram/ /opt/jhadina/scripts/shark-telegram/
COPY ops/telegram-cloud/ /opt/jhadina/ops/telegram-cloud/
RUN chmod 0755 /opt/jhadina/ops/telegram-cloud/entrypoint.sh \
    && python -m compileall -q /opt/jhadina/scripts/shark-telegram /opt/jhadina/ops/telegram-cloud

# No Telegram API keys, bot tokens, HTTP listener or public port in this image.
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/jhadina/ops/telegram-cloud/entrypoint.sh"]
