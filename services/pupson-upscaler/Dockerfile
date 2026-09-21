FROM golang:1.25-alpine AS builder

ARG REAL_ESRGAN_SERVE_COMMIT=064efcf90bd5130373e5f756c5b2c77a24081245
WORKDIR /src

RUN apk add --no-cache ca-certificates curl tar

RUN curl -fsSL "https://github.com/ls-ads/real-esrgan-serve/archive/${REAL_ESRGAN_SERVE_COMMIT}.tar.gz" \
    | tar -xz --strip-components=1

RUN cp models/MANIFEST.json internal/modelfetch/manifest.json && \
    CGO_ENABLED=0 go build \
      -trimpath \
      -ldflags "-s -w -X main.version=pupson-${REAL_ESRGAN_SERVE_COMMIT}" \
      -o /out/real-esrgan-serve \
      ./cmd/real-esrgan-serve

RUN mkdir -p /out/models && \
    curl -fsSL \
      "https://github.com/ls-ads/real-esrgan-serve/releases/download/v0.2.0-rc1/realesrgan-x4plus_fp16.onnx" \
      -o /out/models/realesrgan-x4plus_fp16.onnx && \
    echo "e662cfd8c4280d1247b0bf248a09b9a410b5ee231e1c1b24374f03546d53ae6b  /out/models/realesrgan-x4plus_fp16.onnx" \
      | sha256sum -c -

FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    XDG_CACHE_HOME=/var/cache \
    REAL_ESRGAN_RUNTIME=/usr/share/real-esrgan-serve/runtime/upscaler.py \
    REAL_ESRGAN_FLAVOR=cpu \
    REAL_ESRGAN_MODEL=/var/cache/real-esrgan-serve/models/realesrgan-x4plus_fp16.onnx

RUN pip install --no-cache-dir --no-deps \
      onnxruntime==1.20.1 \
      numpy==1.26.4 \
      Pillow==10.4.0

COPY --from=builder /out/real-esrgan-serve /usr/local/bin/real-esrgan-serve
COPY --from=builder /src/runtime/ /usr/share/real-esrgan-serve/runtime/
COPY --from=builder /out/models/realesrgan-x4plus_fp16.onnx \
  /var/cache/real-esrgan-serve/models/realesrgan-x4plus_fp16.onnx
COPY --from=builder /src/LICENSE /usr/share/doc/real-esrgan-serve/LICENSE
COPY --from=builder /src/NOTICE.md /usr/share/doc/real-esrgan-serve/NOTICE.md
COPY --from=builder /src/third-party-licenses/ \
  /usr/share/doc/real-esrgan-serve/third-party-licenses/

RUN chmod +x /usr/share/real-esrgan-serve/runtime/upscaler.py

EXPOSE 8311

CMD ["real-esrgan-serve", "serve", "--bind", "0.0.0.0", "--port", "8311", "--gpu-id", "-1", "--concurrency", "1"]
