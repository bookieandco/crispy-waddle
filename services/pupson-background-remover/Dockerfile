FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000 \
    U2NETP_PATH=/tmp/u2net

# This service handles still-image segmentation only. The upstream package
# also supports video, but installing Debian ffmpeg here drags in hundreds of
# packages we do not need for PupsonStuff's POST image path.
#
# Install CPU-only PyTorch first so backgroundremover's broad "torch>=1.13"
# requirement cannot resolve to multi-gigabyte CUDA/NVIDIA wheels.
RUN pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cpu \
      torch torchvision && \
    pip install --no-cache-dir \
      "https://github.com/nadermx/backgroundremover/archive/fa480627829759b902f8c233388d7aa67ab38099.tar.gz" \
      flask \
      waitress

RUN mkdir -p /tmp/u2net

EXPOSE 5000

CMD ["python", "-m", "backgroundremover.cmd.server", "--addr", "0.0.0.0", "--port", "5000"]
