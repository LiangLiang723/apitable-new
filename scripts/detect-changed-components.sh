#!/usr/bin/env bash
#
# Detects which build components have to be rebuilt for a new release.
#
# The result is a JSON array of component names. Components whose inputs did not
# change do not have to be rebuilt: the image published for the previous release
# can simply be re-tagged.
#
# Usage:
#   scripts/detect-changed-components.sh [<previous-tag>] [<current-ref>]
#
# When the previous tag is missing or unknown, every component is reported as
# changed so that the first release of a branch always builds from scratch.

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PREV_TAG="${1:-}"
CURRENT_REF="${2:-HEAD}"

ALL_COMPONENTS=(
  backend-server
  room-server
  web-server
  init-db
  dataenv-pm2
  dataenv-liquibase-pm2
  openresty
)

# Root level files that are part of every Node.js package build.
# `.dockerignore` decides which of these files reach the build context at all,
# so a change there can change the produced image without touching any source.
ROOT_INPUTS=(
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  .pnpmfile.cjs
  .dockerignore
  patches
  build.js
  nx.json
  common-tsconfig.json
  tsconfig.json
  .eslintrc
)

# The input paths of every component. Only the paths that can actually change
# the produced image are listed, so that an unrelated change does not force a
# rebuild of a component that does not depend on it.
component_inputs() {
  case "$1" in
    backend-server)
      echo "backend-server packaging/Dockerfile.backend-server docker-bake.hcl"
      ;;
    room-server)
      # Dockerfile.node-base and docker-bake.hcl carry the build and runtime
      # base image references, so a change there has to rebuild the component.
      echo "packages/room-server packages/core packages/i18n-lang \
packages/databus-wasm-web packages/databus-wasm-nodejs \
packages/canvas-shim \
packaging/Dockerfile.room-server packaging/Dockerfile.node-base \
docker-bake.hcl ${ROOT_INPUTS[*]}"
      ;;
    web-server)
      # The web image copies packages/canvas-shim and builds @apitable/core,
      # which depends on both databus-wasm packages, so all three are build
      # inputs even though no Dockerfile mentions the wasm packages directly.
      echo "packages/datasheet packages/core packages/components \
packages/widget-sdk packages/i18n-lang packages/icons \
packages/ai-components packages/api-client \
packages/canvas-shim packages/databus-wasm-web packages/databus-wasm-nodejs \
packaging/Dockerfile.web-server packaging/Dockerfile.nodepy-base \
docker-bake.hcl ${ROOT_INPUTS[*]}"
      ;;
    init-db)
      echo "init-db"
      ;;
    dataenv-pm2)
      echo "packaging/all-in-one/dataenv-pm2"
      ;;
    dataenv-liquibase-pm2)
      # 它的 FROM 是 dataenv-pm2，基础层变了必须重建，否则会复用带旧 node 的镜像
      echo "packaging/all-in-one/dataenv-liquibase-pm2 packaging/all-in-one/dataenv-pm2"
      ;;
    openresty)
      echo "gateway packaging/Dockerfile.openresty"
      ;;
    *)
      echo "ERROR: unknown component $1" >&2
      return 1
      ;;
  esac
}

to_json_array() {
  if [[ $# -eq 0 ]]; then
    echo "[]"
    return
  fi
  local out=""
  local item
  for item in "$@"; do
    out+="\"${item}\","
  done
  echo "[${out%,}]"
}

# Emits {"previous_tag": "...", "changed": [...]} on stdout.
emit_result() {
  local prev_tag="$1"
  shift
  printf '{"previous_tag":"%s","changed":%s}\n' "${prev_tag}" "$(to_json_array "$@")"
}

# Prints the closest previous version tag, skipping the tag that points at the
# current commit. Version tags are sorted by version, not by creation date, so
# that v1.10.0 is considered newer than v1.9.0.
find_previous_tag() {
  local current_commit tag
  current_commit="$(git rev-parse -q --verify "${CURRENT_REF}^{commit}" 2>/dev/null || true)"

  while IFS= read -r tag; do
    [[ -z "${tag}" ]] && continue
    if [[ -n "${current_commit}" ]] && [[ "$(git rev-parse -q --verify "refs/tags/${tag}^{commit}" 2>/dev/null || true)" == "${current_commit}" ]]; then
      continue
    fi
    echo "${tag}"
    return 0
  done < <(git tag --list 'v*.*.*' --sort=-v:refname 2>/dev/null)

  return 0
}

if [[ -z "${PREV_TAG}" ]]; then
  PREV_TAG="$(find_previous_tag)"
fi

if [[ -z "${PREV_TAG}" ]] || ! git rev-parse -q --verify "refs/tags/${PREV_TAG}^{commit}" >/dev/null 2>&1; then
  echo "No usable previous version tag found, rebuilding everything." >&2
  emit_result "" "${ALL_COMPONENTS[@]}"
  exit 0
fi

if ! git rev-parse -q --verify "${CURRENT_REF}^{commit}" >/dev/null 2>&1; then
  echo "ERROR: cannot resolve ${CURRENT_REF}" >&2
  exit 1
fi

changed=()
for component in "${ALL_COMPONENTS[@]}"; do
  inputs="$(component_inputs "${component}")"
  # shellcheck disable=SC2086
  if git diff --name-only "${PREV_TAG}" "${CURRENT_REF}" -- ${inputs} | grep -q .; then
    changed+=("${component}")
  fi
done

# The build arguments live in the release workflow and not in the source tree.
# A changed base image version or an added build argument changes the content
# of the produced image without touching a single source file, so the build
# configuration of every component is compared as well.
build_config_changed=""
build_config_failed=""

if [[ -f "scripts/component-build-fingerprint.py" ]]; then
  # A failure is recognised by the exit status and not by a sentinel inside the
  # output. A sentinel would be word split like any other word, and a "*" would
  # then be expanded to the content of the working directory, so the safety net
  # would be defeated exactly when it is needed.
  fingerprint_err="$(mktemp)"
  if ! fingerprint_output="$(scripts/component-build-fingerprint.py "${PREV_TAG}" "${CURRENT_REF}" 2>"${fingerprint_err}")"; then
    # 把失败原因原样打出来（例如缺 PyYAML），否则只会看到"回退全量"这一句
    cat "${fingerprint_err}" >&2
    build_config_failed=1
  elif ! build_config_changed="$(printf '%s' "${fingerprint_output}" \
    | python3 -c 'import json,sys
data = json.load(sys.stdin)
print(" ".join(str(name) for name in data.get("changed", [])))' 2>/dev/null)"; then
    build_config_failed=1
  fi
else
  # Without the comparison every component could be reused with a stale build
  # configuration, so treat the missing script as "everything changed".
  echo "Build configuration comparison script is missing, rebuilding everything." >&2
  build_config_failed=1
fi
rm -f "${fingerprint_err:-}"

if [[ -z "${build_config_failed}" ]]; then
  # read -a splits the output on whitespace without expanding globbing
  # characters, and every name is validated against ALL_COMPONENTS, so an
  # unexpected value can never be reported as a buildable component.
  read -r -a build_config_components <<< "${build_config_changed}"
  for component in ${build_config_components[@]+"${build_config_components[@]}"}; do
    if [[ "${component}" == "*" ]]; then
      # Older versions of the comparison script reported "*" when the workflow
      # could not be parsed. It must never be silently ignored.
      echo "Build configuration comparison reported every component as changed." >&2
      build_config_failed=1
      break
    fi
    if [[ " ${ALL_COMPONENTS[*]} " != *" ${component} "* ]]; then
      echo "Ignoring unknown component '${component}' from the build configuration comparison." >&2
      continue
    fi
    already_changed=0
    for existing in ${changed[@]+"${changed[@]}"}; do
      [[ "${existing}" == "${component}" ]] && already_changed=1
    done
    if [[ "${already_changed}" == "0" ]]; then
      echo "Build configuration of ${component} changed." >&2
      changed+=("${component}")
    fi
  done
fi

if [[ -n "${build_config_failed}" ]]; then
  echo "Build configuration could not be compared, rebuilding everything." >&2
  changed=("${ALL_COMPONENTS[@]}")
fi

if [[ ${#changed[@]} -eq 0 ]]; then
  echo "No component input changed since ${PREV_TAG}." >&2
  emit_result "${PREV_TAG}"
  exit 0
fi

emit_result "${PREV_TAG}" ${changed[@]+"${changed[@]}"}

if [[ -n "${DEBUG:-}" ]]; then
  echo "--- changed files since ${PREV_TAG} ---" >&2
  git diff --name-only "${PREV_TAG}" "${CURRENT_REF}" >&2
  echo "--- changed components ---" >&2
  echo "${changed[*]}" >&2
fi
