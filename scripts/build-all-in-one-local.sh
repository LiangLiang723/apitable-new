#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

IMAGE_TAG="${IMAGE_TAG:-local}"
FINAL_IMAGE="${FINAL_IMAGE:-benxianyu/apitable-new}"
SEMVER_FULL="${SEMVER_FULL:-v$(cat .version 2>/dev/null || echo 0.0.0)-local}"
PLATFORM="${PLATFORM:-linux/amd64}"
FINAL_BUILD_NO_CACHE="${FINAL_BUILD_NO_CACHE:-1}"

BACKEND_IMAGE="${BACKEND_IMAGE:-benxianyu/apitable-backend-server}"
ROOM_IMAGE="${ROOM_IMAGE:-benxianyu/apitable-room-server}"
WEB_IMAGE="${WEB_IMAGE:-benxianyu/apitable-web-server}"
INIT_DB_IMAGE="${INIT_DB_IMAGE:-benxianyu/apitable-init-db}"
DATAENV_IMAGE="${DATAENV_IMAGE:-benxianyu/apitable-dataenv-pm2}"
DATAENV_LIQUIBASE_IMAGE="${DATAENV_LIQUIBASE_IMAGE:-benxianyu/apitable-dataenv-liquibase-pm2}"
DATABUS_IMAGE="${DATABUS_IMAGE:-benxianyu/apitable-databus-server}"
INIT_APPDATA_IMAGE="${INIT_APPDATA_IMAGE:-benxianyu/apitable-init-appdata}"
IMAGEPROXY_IMAGE="${IMAGEPROXY_IMAGE:-benxianyu/apitable-imageproxy-server}"

DATABUS_SOURCE_IMAGE="${DATABUS_SOURCE_IMAGE:-apitable/databus-server}"
INIT_APPDATA_SOURCE_IMAGE="${INIT_APPDATA_SOURCE_IMAGE:-apitable/init-appdata}"
IMAGEPROXY_SOURCE_IMAGE="${IMAGEPROXY_SOURCE_IMAGE:-apitable/imageproxy-server}"

build() {
  echo
  echo "==> $*"
  "$@"
}

final_build_cache_args=()
if [[ "${FINAL_BUILD_NO_CACHE}" == "1" ]]; then
  final_build_cache_args+=(--no-cache)
fi

mirror_image() {
  local source_image="$1"
  local target_image="$2"
  local attempt

  for attempt in 1 2 3; do
    if build docker pull --platform "${PLATFORM}" "${source_image}:latest"; then
      break
    fi
    if [[ "${attempt}" == "3" ]]; then
      return 1
    fi
    echo "Pull failed, retrying..."
    sleep 3
  done
  build docker tag "${source_image}:latest" "${target_image}:${IMAGE_TAG}"
  build docker tag "${source_image}:latest" "${target_image}:latest"
}

echo "APITable all-in-one local build"
echo "  image:    ${FINAL_IMAGE}:${IMAGE_TAG}"
echo "  semver:   ${SEMVER_FULL}"
echo "  platform: ${PLATFORM}"
echo "  backend:  ${BACKEND_IMAGE}:${IMAGE_TAG}"
echo "  room:     ${ROOM_IMAGE}:${IMAGE_TAG}"
echo "  web:      ${WEB_IMAGE}:${IMAGE_TAG}"
echo "  final no-cache: ${FINAL_BUILD_NO_CACHE}"

build docker build \
  --platform "${PLATFORM}" \
  -f packaging/all-in-one/dataenv-pm2/Dockerfile \
  -t "${DATAENV_IMAGE}:latest" \
  -t "${DATAENV_IMAGE}:${IMAGE_TAG}" \
  packaging/all-in-one/dataenv-pm2

build docker build \
  --platform "${PLATFORM}" \
  -f packaging/all-in-one/dataenv-liquibase-pm2/Dockerfile \
  --build-arg DATAENV_PM2_IMAGE="${DATAENV_IMAGE}" \
  --build-arg DATAENV_PM2_IMAGE_TAG="${IMAGE_TAG}" \
  -t "${DATAENV_LIQUIBASE_IMAGE}:latest" \
  -t "${DATAENV_LIQUIBASE_IMAGE}:${IMAGE_TAG}" \
  packaging/all-in-one/dataenv-liquibase-pm2

mirror_image "${DATABUS_SOURCE_IMAGE}" "${DATABUS_IMAGE}"
mirror_image "${INIT_APPDATA_SOURCE_IMAGE}" "${INIT_APPDATA_IMAGE}"
mirror_image "${IMAGEPROXY_SOURCE_IMAGE}" "${IMAGEPROXY_IMAGE}"

build docker build \
  --platform "${PLATFORM}" \
  -f packaging/Dockerfile.backend-server \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t "${BACKEND_IMAGE}:latest" \
  -t "${BACKEND_IMAGE}:${IMAGE_TAG}" \
  .

build docker build \
  --platform "${PLATFORM}" \
  -f packaging/Dockerfile.room-server \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t "${ROOM_IMAGE}:latest" \
  -t "${ROOM_IMAGE}:${IMAGE_TAG}" \
  .

build docker build \
  --platform "${PLATFORM}" \
  -f packaging/Dockerfile.web-server \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t "${WEB_IMAGE}:latest" \
  -t "${WEB_IMAGE}:${IMAGE_TAG}" \
  .

build docker build \
  --platform "${PLATFORM}" \
  -f init-db/Dockerfile \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t "${INIT_DB_IMAGE}:latest" \
  -t "${INIT_DB_IMAGE}:${IMAGE_TAG}" \
  ./init-db

build docker build \
  "${final_build_cache_args[@]}" \
  --platform "${PLATFORM}" \
  -f packaging/all-in-one/all-in-one/Dockerfile \
  --build-arg IMAGE_TAG="${IMAGE_TAG}" \
  --build-arg DATAENV_IMAGE_TAG="${IMAGE_TAG}" \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  --build-arg BACKEND_IMAGE="${BACKEND_IMAGE}" \
  --build-arg ROOM_IMAGE="${ROOM_IMAGE}" \
  --build-arg WEB_IMAGE="${WEB_IMAGE}" \
  --build-arg INIT_DB_IMAGE="${INIT_DB_IMAGE}" \
  --build-arg DATAENV_LIQUIBASE_IMAGE="${DATAENV_LIQUIBASE_IMAGE}" \
  --build-arg DATABUS_IMAGE="${DATABUS_IMAGE}" \
  --build-arg DATABUS_IMAGE_TAG="${IMAGE_TAG}" \
  --build-arg INIT_APPDATA_IMAGE="${INIT_APPDATA_IMAGE}" \
  --build-arg INIT_APPDATA_IMAGE_TAG="${IMAGE_TAG}" \
  --build-arg IMAGEPROXY_IMAGE="${IMAGEPROXY_IMAGE}" \
  --build-arg IMAGEPROXY_IMAGE_TAG="${IMAGE_TAG}" \
  -t "${FINAL_IMAGE}:${IMAGE_TAG}" \
  -t "${FINAL_IMAGE}:latest" \
  .

echo
echo "Built ${FINAL_IMAGE}:${IMAGE_TAG}"
echo "Run it with:"
echo "  docker run -d --name apitable -p 80:80 -v \"\${PWD}/.data:/apitable\" ${FINAL_IMAGE}:${IMAGE_TAG}"
