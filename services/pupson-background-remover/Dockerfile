FROM continuumio/miniconda3:23.5.2-0 AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends git build-essential && \
    rm -rf /var/lib/apt/lists/*

RUN conda install -y 'ffmpeg>=4.4.0' -c conda-forge && conda clean -afy

# Pin the exact audited upstream BackgroundRemover commit used by PS-RECON.8.
RUN pip install --no-cache-dir \
    "git+https://github.com/nadermx/backgroundremover.git@fa480627829759b902f8c233388d7aa67ab38099" \
    flask \
    waitress

FROM debian:bullseye-slim

COPY --from=builder /opt/conda /opt/conda
ENV PATH=/opt/conda/bin:$PATH \
    PORT=5000 \
    U2NETP_PATH=/tmp/u2net

RUN mkdir -p /tmp/u2net

EXPOSE 5000

CMD ["python", "-m", "backgroundremover.cmd.server", "--addr", "0.0.0.0", "--port", "5000"]
