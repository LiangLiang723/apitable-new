#!/usr/bin/env bash
#
# Configures the Docker Hub credentials used by the release workflow.
#
# The workflow reads two repository secrets:
#   DOCKERHUB_USERNAME - the Docker Hub namespace, e.g. benxianyu
#   DOCKERHUB_TOKEN   - a Docker Hub access token with Read & Write scope
#
# Usage:
#   DOCKERHUB_TOKEN=dckr_pat_xxx scripts/setup-dockerhub-secrets.sh [repo]
#
# The token is read from the environment so that it never ends up in the shell
# history or in a file on disk.

set -euo pipefail

REPO="${1:-LiangLiang723/apitable-new}"
USERNAME="${DOCKERHUB_USERNAME:-benxianyu}"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI not found. Install it from https://cli.github.com" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

if [[ -z "${DOCKERHUB_TOKEN:-}" ]]; then
  cat >&2 <<'EOF'
ERROR: DOCKERHUB_TOKEN is not set.

Create a Docker Hub access token first:
  1. Open https://hub.docker.com/settings/access-tokens
  2. "Generate new token" -> Scope: Read & Write
  3. Copy the generated token, it is only shown once

Then run:
  DOCKERHUB_TOKEN=dckr_pat_xxx scripts/setup-dockerhub-secrets.sh
EOF
  exit 1
fi

echo "配置 ${REPO} 的 Docker Hub 凭据..."
gh secret set DOCKERHUB_USERNAME --repo "${REPO}" --body "${USERNAME}"
gh secret set DOCKERHUB_TOKEN --repo "${REPO}" --body "${DOCKERHUB_TOKEN}"

echo
echo "当前仓库的 Actions Secrets:"
gh secret list --repo "${REPO}"

echo
echo "注意: GITHUB_TOKEN 由 GitHub 自动提供，无需配置。"
echo "下一步可以打 tag 触发发布: git tag v1.13.0 && git push origin v1.13.0"
