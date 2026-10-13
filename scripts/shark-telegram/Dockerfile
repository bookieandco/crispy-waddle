# Research-only Telegram inbox. No wallet/signing dependencies or public HTTP server.
# Configure Railway service root directory as /scripts/shark-telegram.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --disable-pip-version-check -r requirements.txt
COPY telegram_intake.py telegram_research_bridge.py ./
# Fail closed unless the private env variables and Railway volume exist.
CMD ["python", "-u", "telegram_intake.py", "forwarded-bot"]
