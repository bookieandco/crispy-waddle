FROM ubuntu:22.04

WORKDIR /opt/dolby

# The uploaded Dolby Atmos Conversion Tool .deb must be supplied at build time.
# Example: docker build --build-arg DOLBY_DEB=dolby-atmos-conversion-tool.deb .
ARG DOLBY_DEB=dolby-atmos-conversion-tool.deb
COPY ${DOLBY_DEB} /tmp/dolby.deb

RUN apt-get update \
 && apt-get install -y --no-install-recommends /tmp/dolby.deb ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/* /tmp/dolby.deb

COPY presets /opt/dolby/presets
COPY server.py /opt/dolby/server.py

EXPOSE 8090
CMD ["python3", "/opt/dolby/server.py"]
