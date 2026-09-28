#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required for the official Runpod skills installer." >&2
  exit 1
fi

echo "Installing/updating official Runpod agent skills..."
npx -y skills add runpod/runpod-plugins-official

if ! command -v runpodctl >/dev/null 2>&1; then
  echo "Installing runpodctl from the official Runpod installer..."
  curl -sSL https://cli.runpod.net | bash
fi

if [[ -z "${RUNPOD_API_KEY:-}" ]]; then
  cat >&2 <<'EOF'
RUNPOD_API_KEY is not set.

Official Runpod setup supports either:
  1. export RUNPOD_API_KEY=<your key>
  2. runpodctl doctor and follow its authentication/config prompts
  3. connect the hosted MCP server https://mcp.getrunpod.io/ and use Sign in with Runpod

Do not commit the API key to this repository.
EOF
  exit 2
fi

echo "Checking Runpod CLI authentication..."
runpodctl gpu list >/dev/null

if [[ "${RUNPOD_SKIP_MCP_INSTALL:-false}" != "true" ]]; then
  echo "Running Runpod's official guided hosted-MCP installer..."
  npx -y @runpod/mcp-server@latest add
fi

echo "Runpod CLI is authenticated."
echo "Hosted MCP endpoint: https://mcp.getrunpod.io/"
echo "Docs MCP endpoint:   https://docs.runpod.io/mcp"
echo "Try: runpodctl pod list --all"
