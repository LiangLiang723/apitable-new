#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

IMAGE_TAG="${IMAGE_TAG:-local}"
FINAL_IMAGE="${FINAL_IMAGE:-apitable/all-in-one-local}"
SEMVER_FULL="${SEMVER_FULL:-v$(cat .version 2>/dev/null || echo 0.0.0)-local}"
PLATFORM="${PLATFORM:-linux/amd64}"

build() {
  echo
  echo "==> $*"
  "$@"
}

echo "APITable all-in-one local build"
echo "  image:    ${FINAL_IMAGE}:${IMAGE_TAG}"
echo "  semver:   ${SEMVER_FULL}"
echo "  platform: ${PLATFORM}"

build docker build \
  --platform "${PLATFORM}" \
  -f packaging/all-in-one/dataenv-pm2/Dockerfile \
  -t apitable/dataenv-pm2:latest \
  -t apitable/dataenv-pm2:"${IMAGE_TAG}" \
  packaging/all-in-one/dataenv-pm2

build docker build \
  --platform "${PLATFORM}" \
  -f packaging/all-in-one/dataenv-liquibase-pm2/Dockerfile \
  -t apitable/dataenv-liquibase-pm2:latest \
  -t apitable/dataenv-liquibase-pm2:"${IMAGE_TAG}" \
  packaging/all-in-one/dataenv-liquibase-pm2

build docker build \
  --platform "${PLATFORM}" \
  -f packaging/Dockerfile.backend-server \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t apitable/backend-server:"${IMAGE_TAG}" \
  .

build docker build \
  --platform "${PLATFORM}" \
  -f packaging/Dockerfile.room-server \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t apitable/room-server:"${IMAGE_TAG}" \
  .

build docker build \
  --platform "${PLATFORM}" \
  -f packaging/Dockerfile.web-server \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t apitable/web-server:"${IMAGE_TAG}" \
  .

build docker build \
  --platform "${PLATFORM}" \
  -f init-db/Dockerfile \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t apitable/init-db:"${IMAGE_TAG}" \
  ./init-db

build docker build \
  --platform "${PLATFORM}" \
  -f packaging/all-in-one/all-in-one/Dockerfile \
  --build-arg IMAGE_TAG="${IMAGE_TAG}" \
  --build-arg DATAENV_IMAGE_TAG="${IMAGE_TAG}" \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t "${FINAL_IMAGE}:${IMAGE_TAG}" \
  -t "${FINAL_IMAGE}:latest" \
  .

echo
echo "Built ${FINAL_IMAGE}:${IMAGE_TAG}"
echo "Run it with:"
echo "  docker run -d --name apitable -p 80:80 -v \"\${PWD}/.data:/apitable\" ${FINAL_IMAGE}:${IMAGE_TAG}"
