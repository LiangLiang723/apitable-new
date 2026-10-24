# Self-hosted enterprise mode

This fork adds a self-hosted enterprise mode for legal self-hosted deployments.

## Enable

This fork defaults to self-hosted enterprise mode. These environment variables are set by the bundled all-in-one image and compose defaults:

```bash
SELF_HOSTED_ENTERPRISE=true
IS_ENTERPRISE=true
IS_SELFHOST=true
SKIP_USAGE_VERIFICATION=false
SKIP_API_USAGE_VERIFICATION=false
API_MAX_MODIFY_RECORD_COUNTS=9007199254740991
MAX_ROBOT_ACTION_COUNT=9007199254740991
SERVER_TRANSFORM_LIMIT=9007199254740991
SERVER_MAX_VIEW_COUNT=9007199254740991
SERVER_MAX_FIELD_COUNT=9007199254740991
SERVER_MAX_RECORD_COUNT=9007199254740991
SPACE_MAX_COUNT=2147483647
EXPORT_MAX_FILE_SIZE=2147483647
MAX_COLUMN_COUNT=2147483647
MAX_ROW_COUNT=2147483647
TEMPLATE_MAX_COUNT=2147483647
DSB_WIDGET_MAX_COUNT=2147483647
DST_ROBOT_MAX_COUNT=2147483647
MAX_INVITE_COUNT_FOR_FREE=2147483647
```

Set `SELF_HOSTED_ENTERPRISE=false` only if you are intentionally testing a non-enterprise deployment profile.

## What it changes

By default:

- backend entitlement returns `Enterprise / enterprise` subscription info;
- default subscription features become enterprise-like/unlimited;
- Fusion API usage guard is skipped by room-server in self-hosted enterprise mode;
- backend usage statistics remain enabled so the space overview can calculate current usage;
- Fusion API write/page limits are effectively unlimited unless explicitly overridden;
- frontend enterprise/security/permission feature switches default to visible;
- room-server usage verification is skipped automatically from `SELF_HOSTED_ENTERPRISE=true`;
- payment reminder / usage warning modal is disabled for enterprise/self-hosted mode;
- enterprise and self-hosted entry points remain visible; integrations that require unavailable private/cloud services should return a clear unsupported or unconfigured response.

## Limits opened

The following plan limits are returned as unlimited (`-1`) unless otherwise noted:

- seats;
- file nodes;
- columns per sheet;
- rows per sheet;
- archived rows per sheet;
- total rows;
- mirrors;
- admins;
- monthly API calls;
- gallery/kanban/architecture/gantt/calendar/form/dashboard views;
- field permissions;
- node permissions;
- widgets;
- dashboard widgets;
- AI agents;
- AI message credits;
- automation runs;
- automation actions/triggers;
- trash/time-machine/activity/audit retention.

Capacity is set to a very large positive value, 1 PiB, instead of `-1`, because several code paths perform byte arithmetic.

API QPS is set to `1_000_000` instead of `-1`, to avoid breaking rate limiter assumptions. Hard runtime/config limits such as import rows, columns, spaces, templates, dashboard widgets, robot counts, and daily invite counts are raised to Java integer/long upper bounds.

## Features not restored automatically

This change intentionally does not force-enable features whose implementation is missing or depends on private enterprise/hosted services, such as private enterprise modules, official hosted cloud services, third-party commercial integrations, or missing database-backed implementations.

Use the audit script to identify removed-feature candidates:

```bash
python3 scripts/audit_apitable_feature_changes.py \
  --base d112100dde24c44c7288fd0a6e4339ad1cb273b3 \
  --head develop \
  --out apitable_feature_audit.csv
```

Review the generated CSV manually before restoring any feature. If a feature cannot be restored safely, keep its UI hidden or return an explicit unsupported response.

## Image sources

Every image this fork ships is referenced through the `benxianyu` Docker Hub
namespace. Ten of the thirteen images are built here from source. The remaining
three are mirrored, because their sources are not part of this repository:

| Image | Source | Notes |
|---|---|---|
| `benxianyu/apitable-backend-server` | built from source | Gradle bootJar on `amazoncorretto:17` |
| `benxianyu/apitable-room-server` | built from source | Needs `benxianyu/apitable-node` |
| `benxianyu/apitable-web-server` | built from source | Needs `benxianyu/apitable-nodepy` |
| `benxianyu/apitable-init-db` | built from source | Liquibase changelog only |
| `benxianyu/apitable-openresty` | built from source | Official `openresty/openresty` base + our `gateway/conf.d` |
| `benxianyu/apitable-dataenv-pm2` | built from source | AlmaLinux 8 + MySQL/MinIO/Redis/RabbitMQ/OpenResty/PM2 |
| `benxianyu/apitable-dataenv-liquibase-pm2` | built from source | dataenv-pm2 + Corretto 17 + Liquibase |
| `benxianyu/apitable-new` | built from source | The all-in-one delivery image |
| `benxianyu/apitable-node` | built from source | `packaging/Dockerfile.node-base`, Node 16.15.0 + canvas toolchain |
| `benxianyu/apitable-nodepy` | built from source | `packaging/Dockerfile.nodepy-base`, alpine variant |
| `benxianyu/apitable-databus-server` | **mirrored** | `apitable/databus-server:latest`, no source in this repository |
| `benxianyu/apitable-init-appdata` | **mirrored** | `apitable/init-appdata:latest`, no source in this repository |
| `benxianyu/apitable-imageproxy-server` | **mirrored** | `apitable/imageproxy-server:latest`, no source in this repository |

### Why the three cannot be rebuilt

- `databus-server` — the realtime data bus on port 8625. `packages/` only contains
  the `databus-client` / `databus-wasm` client libraries, the server itself has
  never been part of this repository.
- `init-appdata` — it runs `init-appdata.jar init-user` and `init-appdata.jar load`
  (see `packaging/all-in-one/all-in-one/script/init-appdata.sh`). The jar carries
  the initial user seeding and the template data, and neither the source nor the
  data files exist here. The repository only has `init-db`, which is a Liquibase
  changelog and does not contain that application.
- `imageproxy-server` — an on-the-fly image resize proxy. The frontend requests
  thumbnails with Aliyun OSS semantics (`?imageView2/1/w/<size>/q/100!`, see
  `packages/core/src/utils/file.ts`), and the gateway forwards those requests to
  it (`gateway/conf.d/server/imageproxy.conf`). A plain nginx `proxy_pass` cannot
  resize, so replacing it means reimplementing the `imageView2` subset.

Replacing them would be a reimplementation project rather than a build change.

### Digest pinning and syncing

Upstream only publishes a moving `:latest` tag for these three, so they are
pinned to a digest in the workflow environment (`DATABUS_SOURCE`,
`INIT_APPDATA_SOURCE`, `IMAGEPROXY_SOURCE`).

The `同步外部镜像` workflow (`.github/workflows/mirror-external-images.yml`) is the
only place that talks to the upstream namespace. It copies the pinned digests
into `benxianyu` as `latest`, as `sha256-<digest>`, and optionally as an extra
traceable tag. Run it after bumping a digest.

The release workflow does not pull from upstream at all: it verifies that
`benxianyu/<image>:latest` still has the pinned digest and re-tags the copy with
the release version and commit SHA. If the digest does not match, the release
stops with a message pointing at the sync workflow.

The upstream tags have not moved since 2023-10 / 2024-01. To pick up a newer
upstream build on purpose, resolve the new digest, update the three values, and
run the sync workflow.

### Rebuilding the base images

`benxianyu/apitable-node` and `benxianyu/apitable-nodepy` are built by the
`构建基础镜像` workflow (`.github/workflows/base-images.yml`), which runs on
`workflow_dispatch` and on changes to the two Dockerfiles. It publishes
`linux/amd64` and `linux/arm64`, because the local all-in-one build runs natively
on arm64 machines while the release build runs on amd64 runners.

The local build (`scripts/build-all-in-one-local.sh`) builds the same two images
from the same Dockerfiles, so it does not need the upstream namespace at all.

### Bumping a base image

The base image tag is part of the component fingerprint used by the incremental
build. After changing a base image Dockerfile, bump the tag
(`NODE_BASE_TAG=v16.15.0-r1`, `NODEPY_BASE_TAG=16.15.0-alpine-r1`) in
`.github/workflows/dockerhub-all-in-one.yml` and in `.env`. Without the bump the
fingerprint stays identical and the dependent component images would be reused
from the previous release.

### Rebuilding the mirrored images

```bash
# Build everything locally (also mirrors the base images into the local cache)
bash scripts/build-all-in-one-local.sh

# Print the resolved image matrix without executing anything
DRY_RUN=1 bash scripts/build-all-in-one-local.sh
```

The script publishes every intermediate image to a throwaway local registry
(`localhost:5001`, container `apitable-local-registry`) before using it as a
build base. This is required because BuildKit always resolves `FROM` through a
registry and never falls back to the local image store — a purely local mirror
would make the build fail with `manifest unknown`.

> The default port is 5001 on purpose: port 5000 is taken by the macOS AirPlay
> receiver, so a registry on 5000 cannot be reached from the host.

```bash
# Use a different local registry
LOCAL_REGISTRY=localhost:5002 bash scripts/build-all-in-one-local.sh

# Publish to the public registry instead (requires `docker login`)
LOCAL_REGISTRY= bash scripts/build-all-in-one-local.sh
```

The base image references can be overridden through build args:

```bash
docker build -f packaging/Dockerfile.room-server \
  --build-arg NODE_BASE_IMAGE=benxianyu/apitable-node \
  --build-arg NODE_BASE_TAG=v16.15.0 .

docker build -f packaging/Dockerfile.web-server \
  --build-arg NODEPY_BASE_IMAGE=benxianyu/apitable-nodepy \
  --build-arg NODEPY_BASE_TAG=16.15.0-alpine .
```

### Known limitations

- The mirror step resolves a single platform, so the mirrored runtime component
  images are `linux/amd64` only even though some upstream tags are multi-arch.
  The build base images keep every platform of the upstream manifest list.
- The all-in-one image is `linux/amd64` only, because the `node-canvas` binary
  it patches in is only published for x64 glibc.
- `apitable/init-appdata` is pinned to a digest that corresponds to the upstream
  `1.8.0` release line, while this repository is at `1.14.0`. The seeded template
  space has to be verified after every deployment, see the smoke check script.
## Release process

Pushing a `v*.*.*` tag triggers `.github/workflows/dockerhub-all-in-one.yml`,
which publishes the images to Docker Hub (`benxianyu`) and attaches an offline
bundle to the GitHub Release of that tag.

### Incremental builds

Only the components whose inputs changed are rebuilt. The change detection
compares the release tag against the previous version tag:

```bash
scripts/detect-changed-components.sh [<previous-tag>] [<current-ref>]
# -> {"previous_tag":"v1.13.0","changed":["room-server","web-server"]}
```

| Component | Rebuilt when |
|---|---|
| `backend-server` | `backend-server/**` changed |
| `room-server` | `packages/{room-server,core,i18n-lang,databus-wasm-*}/**` changed, or the node base image reference changed |
| `web-server` | `packages/{datasheet,core,components,widget-sdk,i18n-lang,icons,ai-components,api-client}/**` changed, or the nodepy base image reference changed |
| `init-db` | `init-db/**` changed |
| `dataenv-pm2` | `packaging/all-in-one/dataenv-pm2/**` changed |
| `dataenv-liquibase-pm2` | `packaging/all-in-one/dataenv-liquibase-pm2/**` changed, or the dataenv base image changed |
| `openresty` | `gateway/**` changed |

A component that did not change is not rebuilt. The image published for the
previous release is re-tagged to the new version instead, so every version tag
always resolves to a complete set of images.

The all-in-one image is always rebuilt, it only assembles the components.

#### Build configuration

The build arguments live in the release workflow and not in the source tree, so
a plain file diff would not notice a changed base image version. The build
configuration of every component is therefore fingerprinted separately:

```bash
scripts/component-build-fingerprint.py <revision-a> <revision-b>
# -> {"fingerprints": {...}, "changed": ["room-server"]}
```

A component is rebuilt when its build arguments or the referenced base image
sources changed, even if not a single source file was touched.

### Offline bundle

The GitHub Release of a version tag contains `apitable-offline-<version>.tar.gz`
with every image of that release, plus a `SHA256` file and a
`OFFLINE-README.md` with the import and startup instructions. The bundle is
built for `linux/amd64`, which matches the all-in-one image.

```bash
sha256sum -c apitable-offline-v1.14.0.tar.gz.sha256
gunzip -c apitable-offline-v1.14.0.tar.gz | docker load
docker run -d --name apitable -p 80:80 -v "$(pwd)/.data:/apitable" \
  benxianyu/apitable-new:v1.14.0
```

### Manual run

```bash
gh workflow run dockerhub-all-in-one.yml \
  -f version=v1.14.0 \
  -f push_latest=false \
  -f force_rebuild=true
```

`force_rebuild` ignores the change detection and rebuilds every component.

## Smoke test checklist

After building and starting the stack:

1. Register or log in.
2. Create a space.
3. Open space settings and verify the plan displays as enterprise/business-class rather than free.
4. Verify the space overview current usage cards show real member/file/record/capacity values, not all zero.
5. Create a datasheet.
6. Add records past the old free row limit.
7. Upload an attachment larger than the old small quota if your storage backend is configured.
8. Call Fusion API batch write beyond the old free/default batch limits.
9. Confirm no payment reminder, upgrade, renew, or usage warning modal appears.
