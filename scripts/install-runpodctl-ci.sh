#!/usr/bin/env bash
set -euo pipefail

# CI-pinned RunPod CLI installer.
# Avoids cli.runpod.net's GitHub release-discovery request, which can be
# rate-limited on shared GitHub-hosted runner egress.
VERSION="${RUNPODCTL_VERSION:-v2.14.0}"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

if [[ "$OS" != "linux" ]]; then
  echo "RUNPODCTL_CI_UNSUPPORTED_OS:$OS" >&2
  exit 2
fi

case "$ARCH" in
  x86_64|amd64)
    ASSET="runpodctl-linux-amd64"
    EXPECTED_SHA256="2e0fd370a52a0fc7e43a6434a209348a4f6836fcdf1ad2b093b609e938138be9"
    ;;
  aarch64|arm64)
    ASSET="runpodctl-linux-arm64"
    EXPECTED_SHA256="e9689a0352f83ec3647b163141a43ef5b91365df48e4470f1cfac6289a299b43"
    ;;
  *)
    echo "RUNPODCTL_CI_UNSUPPORTED_ARCH:$ARCH" >&2
    exit 2
    ;;
esac

URL="https://github.com/runpod/runpodctl/releases/download/${VERSION}/${ASSET}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

curl --fail --location --silent --show-error   --retry 5 --retry-all-errors --retry-delay 2   "$URL" -o "$TMP"

ACTUAL_SHA256="$(sha256sum "$TMP" | awk '{print $1}')"
if [[ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then
  echo "RUNPODCTL_CI_CHECKSUM_MISMATCH:expected=$EXPECTED_SHA256:actual=$ACTUAL_SHA256" >&2
  exit 3
fi

chmod 0755 "$TMP"
sudo install -m 0755 "$TMP" /usr/local/bin/runpodctl

runpodctl version
