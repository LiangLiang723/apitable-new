#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

IMAGE_TAG="${IMAGE_TAG:-local}"
FINAL_IMAGE="${FINAL_IMAGE:-benxianyu/apitable-new}"
SEMVER_FULL="${SEMVER_FULL:-v$(cat .version 2>/dev/null || echo 0.0.0)-local}"
PLATFORM="${PLATFORM:-linux/amd64}"
FINAL_BUILD_NO_CACHE="${FINAL_BUILD_NO_CACHE:-1}"
DRY_RUN="${DRY_RUN:-0}"
# Optional buildx builder to use. Set this when Docker Hub is not directly
# reachable, e.g. to a builder that is configured with a registry mirror:
#   docker buildx create --name mirror --driver docker-container \
#     --buildkitd-config /path/to/buildkitd.toml
BUILDER="${BUILDER:-}"

# Registry used for the intermediate images that later serve as a `FROM` base.
#
# BuildKit always resolves `FROM` through a registry and never falls back to the
# local image store, so every intermediate image has to be published before it
# can be used as a build base. A throwaway local registry keeps this script
# self-contained; set LOCAL_REGISTRY to an empty value to publish to the public
# registry instead (that requires `docker login`).
#
# The default port is 5001 because 5000 is taken by the macOS AirPlay receiver.
LOCAL_REGISTRY="${LOCAL_REGISTRY-localhost:5001}"
LOCAL_REGISTRY_CONTAINER="${LOCAL_REGISTRY_CONTAINER:-apitable-local-registry}"

BACKEND_IMAGE="${BACKEND_IMAGE:-benxianyu/apitable-backend-server}"
ROOM_IMAGE="${ROOM_IMAGE:-benxianyu/apitable-room-server}"
WEB_IMAGE="${WEB_IMAGE:-benxianyu/apitable-web-server}"
INIT_DB_IMAGE="${INIT_DB_IMAGE:-benxianyu/apitable-init-db}"
DATAENV_IMAGE="${DATAENV_IMAGE:-benxianyu/apitable-dataenv-pm2}"
DATAENV_LIQUIBASE_IMAGE="${DATAENV_LIQUIBASE_IMAGE:-benxianyu/apitable-dataenv-liquibase-pm2}"
DATABUS_IMAGE="${DATABUS_IMAGE:-benxianyu/apitable-databus-server}"
INIT_APPDATA_IMAGE="${INIT_APPDATA_IMAGE:-benxianyu/apitable-init-appdata}"
IMAGEPROXY_IMAGE="${IMAGEPROXY_IMAGE:-benxianyu/apitable-imageproxy-server}"
OPENRESTY_IMAGE="${OPENRESTY_IMAGE:-benxianyu/apitable-openresty}"

# Build base images.
#
# The Node base images used to be mirrors of apitable/node and apitable/nodepy.
# They are now built from packaging/Dockerfile.node-base and
# packaging/Dockerfile.nodepy-base, which provide Node 22.22.2 plus the native
# toolchain (build-essential / build-base, pkg-config, python3) needed to compile
# any dependency without a prebuilt binary.
NODE_BASE_IMAGE="${NODE_BASE_IMAGE:-benxianyu/apitable-node}"
NODE_BASE_TAG="${NODE_BASE_TAG:-v22.22.2}"
NODEPY_BASE_IMAGE="${NODEPY_BASE_IMAGE:-benxianyu/apitable-nodepy}"
NODEPY_BASE_TAG="${NODEPY_BASE_TAG:-22.22.2-alpine}"

# Runtime component images. Their sources live in separate upstream repositories,
# so they are mirrored as well. They are pinned to a digest: upstream only
# publishes a moving `:latest` tag for them, and a republish would otherwise
# change the content of a local build without any change in this repository.
DATABUS_SOURCE_IMAGE="${DATABUS_SOURCE_IMAGE:-apitable/databus-server@sha256:462fa8bea11df94642b80a58d683aaf9995d79061588843a9d6b7ee66a421600}"
INIT_APPDATA_SOURCE_IMAGE="${INIT_APPDATA_SOURCE_IMAGE:-apitable/init-appdata@sha256:4fa2ed5d1a5a3e2f7bd449352ec3054747127aabe4f91c62fc13f4660b25558b}"
IMAGEPROXY_SOURCE_IMAGE="${IMAGEPROXY_SOURCE_IMAGE:-apitable/imageproxy-server@sha256:09ce6fc6817c99247e40cfb52489f217481a867b45d308d9525e13d38aa1e340}"

build() {
  echo
  echo "==> $*"
  if [[ "${DRY_RUN}" == "1" ]]; then
    return 0
  fi
  if [[ -n "${BUILDER}" ]]; then
    BUILDX_BUILDER="${BUILDER}" "$@"
  else
    "$@"
  fi
}

final_build_cache_args=()
if [[ "${FINAL_BUILD_NO_CACHE}" == "1" ]]; then
  final_build_cache_args+=(--no-cache)
fi

# Returns the reference an image has to be addressed by inside a build.
reg_ref() {
  if [[ -n "${LOCAL_REGISTRY}" ]]; then
    echo "${LOCAL_REGISTRY}/$1"
  else
    echo "$1"
  fi
}

# Publishes an image into the build registry so it can be used as a `FROM` base.
publish_base() {
  local image="$1"   # local image ref, e.g. benxianyu/apitable-node:v22.22.2
  local repo="$2"    # repository under the build registry
  local tag="$3"

  if [[ -z "${LOCAL_REGISTRY}" ]]; then
    return 0
  fi

  build docker tag "${image}" "${LOCAL_REGISTRY}/${repo}:${tag}"
  build docker push "${LOCAL_REGISTRY}/${repo}:${tag}"
}

ensure_local_registry() {
  if [[ -z "${LOCAL_REGISTRY}" ]]; then
    return 0
  fi

  local port="${LOCAL_REGISTRY##*:}"
  if [[ "${port}" == "${LOCAL_REGISTRY}" ]]; then
    port="5000"
  fi

  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${LOCAL_REGISTRY_CONTAINER}"; then
    return 0
  fi

  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "${LOCAL_REGISTRY_CONTAINER}"; then
    build docker start "${LOCAL_REGISTRY_CONTAINER}"
  else
    build docker run -d --name "${LOCAL_REGISTRY_CONTAINER}" -p "${port}:5000" registry:2
  fi
}

# mirror_image <source-ref> <target-repo> <target-tag>
#
# Pulls the upstream image and re-tags it under our own registry so that no
# build step has to reach out to the upstream `apitable` namespace. The target
# tag keeps the upstream tag name so the mapping stays obvious.
mirror_image() {
  local source_ref="$1"
  local target_image="$2"
  local target_tag="$3"
  local attempt

  for attempt in 1 2 3; do
    if build docker pull --platform "${PLATFORM}" "${source_ref}"; then
      break
    fi
    if [[ "${attempt}" == "3" ]]; then
      echo "ERROR: failed to pull ${source_ref}" >&2
      return 1
    fi
    echo "Pull failed, retrying..."
    sleep 3
  done

  build docker tag "${source_ref}" "${target_image}:${target_tag}"
  if [[ "${target_tag}" != "latest" ]]; then
    build docker tag "${source_ref}" "${target_image}:latest"
  fi
  build docker tag "${source_ref}" "${target_image}:${IMAGE_TAG}"

  publish_base "${target_image}:${target_tag}" "${target_image}" "${target_tag}"
  if [[ "${target_tag}" != "${IMAGE_TAG}" ]]; then
    publish_base "${target_image}:${IMAGE_TAG}" "${target_image}" "${IMAGE_TAG}"
  fi
}

echo "APITable all-in-one local build"
echo "  image:      ${FINAL_IMAGE}:${IMAGE_TAG}"
echo "  semver:     ${SEMVER_FULL}"
echo "  platform:   ${PLATFORM}"
echo "  backend:    ${BACKEND_IMAGE}:${IMAGE_TAG}"
echo "  room:       ${ROOM_IMAGE}:${IMAGE_TAG}"
echo "  web:        ${WEB_IMAGE}:${IMAGE_TAG}"
echo "  gateway:    ${OPENRESTY_IMAGE}:${IMAGE_TAG}"
echo "  node:       ${NODE_BASE_IMAGE}:${NODE_BASE_TAG}"
echo "  nodepy:     ${NODEPY_BASE_IMAGE}:${NODEPY_BASE_TAG}"
echo "  build registry: ${LOCAL_REGISTRY:-<public registry>}"
echo "  builder:        ${BUILDER:-<default>}"
echo "  final no-cache: ${FINAL_BUILD_NO_CACHE}"
if [[ "${DRY_RUN}" == "1" ]]; then
  echo "  DRY RUN: no command will be executed"
fi

ensure_local_registry

build docker build \
  --platform "${PLATFORM}" \
  --load \
  -f packaging/all-in-one/dataenv-pm2/Dockerfile \
  -t "${DATAENV_IMAGE}:latest" \
  -t "${DATAENV_IMAGE}:${IMAGE_TAG}" \
  packaging/all-in-one/dataenv-pm2

publish_base "${DATAENV_IMAGE}:${IMAGE_TAG}" "${DATAENV_IMAGE}" "${IMAGE_TAG}"

build docker build \
  --platform "${PLATFORM}" \
  --load \
  -f packaging/all-in-one/dataenv-liquibase-pm2/Dockerfile \
  --build-arg DATAENV_PM2_IMAGE="$(reg_ref "${DATAENV_IMAGE}")" \
  --build-arg DATAENV_PM2_IMAGE_TAG="${IMAGE_TAG}" \
  -t "${DATAENV_LIQUIBASE_IMAGE}:latest" \
  -t "${DATAENV_LIQUIBASE_IMAGE}:${IMAGE_TAG}" \
  packaging/all-in-one/dataenv-liquibase-pm2

publish_base "${DATAENV_LIQUIBASE_IMAGE}:${IMAGE_TAG}" "${DATAENV_LIQUIBASE_IMAGE}" "${IMAGE_TAG}"

mirror_image "${DATABUS_SOURCE_IMAGE}" "${DATABUS_IMAGE}" "latest"
mirror_image "${INIT_APPDATA_SOURCE_IMAGE}" "${INIT_APPDATA_IMAGE}" "latest"
mirror_image "${IMAGEPROXY_SOURCE_IMAGE}" "${IMAGEPROXY_IMAGE}" "latest"

# The node / nodepy base images are built locally from their Dockerfiles, so the
# build no longer pulls the native toolchain from the upstream namespace.
build docker build \
  --platform "${PLATFORM}" \
  --load \
  -f packaging/Dockerfile.node-base \
  -t "${NODE_BASE_IMAGE}:${NODE_BASE_TAG}" \
  .

publish_base "${NODE_BASE_IMAGE}:${NODE_BASE_TAG}" "${NODE_BASE_IMAGE}" "${NODE_BASE_TAG}"

build docker build \
  --platform "${PLATFORM}" \
  --load \
  -f packaging/Dockerfile.nodepy-base \
  -t "${NODEPY_BASE_IMAGE}:${NODEPY_BASE_TAG}" \
  .

publish_base "${NODEPY_BASE_IMAGE}:${NODEPY_BASE_TAG}" "${NODEPY_BASE_IMAGE}" "${NODEPY_BASE_TAG}"

# The gateway image is built from the official openresty base image plus our own
# nginx configuration, so it does not depend on the upstream `apitable` namespace.
build docker build \
  --platform "${PLATFORM}" \
  --load \
  -f packaging/Dockerfile.openresty \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t "${OPENRESTY_IMAGE}:latest" \
  -t "${OPENRESTY_IMAGE}:${IMAGE_TAG}" \
  ./gateway

publish_base "${OPENRESTY_IMAGE}:${IMAGE_TAG}" "${OPENRESTY_IMAGE}" "${IMAGE_TAG}"

build docker build \
  --platform "${PLATFORM}" \
  --load \
  -f packaging/Dockerfile.backend-server \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t "${BACKEND_IMAGE}:latest" \
  -t "${BACKEND_IMAGE}:${IMAGE_TAG}" \
  .

publish_base "${BACKEND_IMAGE}:${IMAGE_TAG}" "${BACKEND_IMAGE}" "${IMAGE_TAG}"

build docker build \
  --platform "${PLATFORM}" \
  --load \
  -f packaging/Dockerfile.room-server \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  --build-arg NODE_BASE_IMAGE="$(reg_ref "${NODE_BASE_IMAGE}")" \
  --build-arg NODE_BASE_TAG="${NODE_BASE_TAG}" \
  -t "${ROOM_IMAGE}:latest" \
  -t "${ROOM_IMAGE}:${IMAGE_TAG}" \
  .

publish_base "${ROOM_IMAGE}:${IMAGE_TAG}" "${ROOM_IMAGE}" "${IMAGE_TAG}"

build docker build \
  --platform "${PLATFORM}" \
  --load \
  -f packaging/Dockerfile.web-server \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  --build-arg NODEPY_BASE_IMAGE="$(reg_ref "${NODEPY_BASE_IMAGE}")" \
  --build-arg NODEPY_BASE_TAG="${NODEPY_BASE_TAG}" \
  -t "${WEB_IMAGE}:latest" \
  -t "${WEB_IMAGE}:${IMAGE_TAG}" \
  .

publish_base "${WEB_IMAGE}:${IMAGE_TAG}" "${WEB_IMAGE}" "${IMAGE_TAG}"

build docker build \
  --platform "${PLATFORM}" \
  --load \
  -f init-db/Dockerfile \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  -t "${INIT_DB_IMAGE}:latest" \
  -t "${INIT_DB_IMAGE}:${IMAGE_TAG}" \
  ./init-db

publish_base "${INIT_DB_IMAGE}:${IMAGE_TAG}" "${INIT_DB_IMAGE}" "${IMAGE_TAG}"

build docker build \
  "${final_build_cache_args[@]}" \
  --platform "${PLATFORM}" \
  --load \
  -f packaging/all-in-one/all-in-one/Dockerfile \
  --build-arg IMAGE_TAG="${IMAGE_TAG}" \
  --build-arg DATAENV_IMAGE_TAG="${IMAGE_TAG}" \
  --build-arg SEMVER_FULL="${SEMVER_FULL}" \
  --build-arg BACKEND_IMAGE="$(reg_ref "${BACKEND_IMAGE}")" \
  --build-arg ROOM_IMAGE="$(reg_ref "${ROOM_IMAGE}")" \
  --build-arg WEB_IMAGE="$(reg_ref "${WEB_IMAGE}")" \
  --build-arg INIT_DB_IMAGE="$(reg_ref "${INIT_DB_IMAGE}")" \
  --build-arg DATAENV_LIQUIBASE_IMAGE="$(reg_ref "${DATAENV_LIQUIBASE_IMAGE}")" \
  --build-arg DATABUS_IMAGE="$(reg_ref "${DATABUS_IMAGE}")" \
  --build-arg DATABUS_IMAGE_TAG="${IMAGE_TAG}" \
  --build-arg INIT_APPDATA_IMAGE="$(reg_ref "${INIT_APPDATA_IMAGE}")" \
  --build-arg INIT_APPDATA_IMAGE_TAG="${IMAGE_TAG}" \
  --build-arg IMAGEPROXY_IMAGE="$(reg_ref "${IMAGEPROXY_IMAGE}")" \
  --build-arg IMAGEPROXY_IMAGE_TAG="${IMAGE_TAG}" \
  -t "${FINAL_IMAGE}:${IMAGE_TAG}" \
  -t "${FINAL_IMAGE}:latest" \
  .

echo
echo "Built ${FINAL_IMAGE}:${IMAGE_TAG}"
echo "Run it with:"
echo "  docker run -d --name apitable -p 80:80 -v \"\${PWD}/.data:/apitable\" ${FINAL_IMAGE}:${IMAGE_TAG}"
