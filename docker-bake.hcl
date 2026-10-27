group "default" {
  targets = ["backend-server", "room-server", "web-server", "init-db", "openresty"]
}

variable "IMAGE_REGISTRY" {
  default = "docker.io"
}

variable "NODE_BASE_IMAGE" {
  default = "benxianyu/apitable-node"
}

variable "NODE_BASE_TAG" {
  default = "v22.22.2"
}

variable "NODEPY_BASE_IMAGE" {
  default = "benxianyu/apitable-nodepy"
}

variable "NODEPY_BASE_TAG" {
  default = "22.22.2-alpine"
}

# Runtime base images. The component images are built on a toolchain image, but
# they only need a plain Node.js runtime. Keeping the two separate is what makes
# room-server ~900MB smaller; override these when a component needs a different
# runtime (for example a glibc toolchain at runtime).
variable "NODE_RUNTIME_IMAGE" {
  default = "node"
}

variable "NODE_RUNTIME_TAG" {
  default = "22.22.2-bookworm-slim"
}

variable "NODE_RUNTIME_TAG_ALPINE" {
  default = "22.22.2-alpine"
}

# Default platform list for `bake --push`. `make build-docker` overrides it with
# the host platform, because `--load` cannot export a multi-platform manifest.
variable "PLATFORMS" {
  default = ["linux/amd64", "linux/arm64"]
}

variable "OPENRESTY_IMAGE" {
  default = "benxianyu/apitable-openresty"
}

variable "SEMVER_FULL" {
  default = "v0.0.0-alpha"
}

variable "IMAGE_TAG" {
  default = "latest"
}

variable "FINAL_IMAGE" {
  default = "benxianyu/apitable-new"
}

variable "DATAENV_IMAGE_TAG" {
  default = "latest"
}

variable "DATAENV_IMAGE" {
  default = "benxianyu/apitable-dataenv-pm2"
}

variable "BACKEND_IMAGE" {
  default = "benxianyu/apitable-backend-server"
}

variable "ROOM_IMAGE" {
  default = "benxianyu/apitable-room-server"
}

variable "WEB_IMAGE" {
  default = "benxianyu/apitable-web-server"
}

variable "INIT_DB_IMAGE" {
  default = "benxianyu/apitable-init-db"
}

variable "DATABUS_IMAGE" {
  default = "benxianyu/apitable-databus-server"
}

variable "DATABUS_IMAGE_TAG" {
  default = "latest"
}

variable "INIT_APPDATA_IMAGE" {
  default = "benxianyu/apitable-init-appdata"
}

variable "INIT_APPDATA_IMAGE_TAG" {
  default = "latest"
}

variable "IMAGEPROXY_IMAGE" {
  default = "benxianyu/apitable-imageproxy-server"
}

variable "IMAGEPROXY_IMAGE_TAG" {
  default = "latest"
}

variable "DATAENV_LIQUIBASE_IMAGE" {
  default = "benxianyu/apitable-dataenv-liquibase-pm2"
}

target "backend-server" {
  context = "."
  dockerfile = "packaging/Dockerfile.backend-server"
  args = {
    SEMVER_FULL = SEMVER_FULL
  }
  platforms = PLATFORMS
  tags = ["${BACKEND_IMAGE}:latest", "${BACKEND_IMAGE}:${IMAGE_TAG}"]
}

target "room-server" {
  context = "."
  dockerfile = "packaging/Dockerfile.room-server"
  args = {
    SEMVER_FULL = SEMVER_FULL
    NODE_BASE_IMAGE = NODE_BASE_IMAGE
    NODE_BASE_TAG = NODE_BASE_TAG
    NODE_RUNTIME_IMAGE = NODE_RUNTIME_IMAGE
    NODE_RUNTIME_TAG = NODE_RUNTIME_TAG
  }
  platforms = PLATFORMS
  tags = ["${ROOM_IMAGE}:latest", "${ROOM_IMAGE}:${IMAGE_TAG}"]
}

target "web-server" {
  context = "."
  dockerfile = "packaging/Dockerfile.web-server"
  args = {
    SEMVER_FULL = SEMVER_FULL
    NODEPY_BASE_IMAGE = NODEPY_BASE_IMAGE
    NODEPY_BASE_TAG = NODEPY_BASE_TAG
    NODE_RUNTIME_IMAGE = NODE_RUNTIME_IMAGE
    NODE_RUNTIME_TAG = NODE_RUNTIME_TAG_ALPINE
  }
  platforms = PLATFORMS
  tags = ["${WEB_IMAGE}:latest", "${WEB_IMAGE}:${IMAGE_TAG}"]
}

# https://github.com/apitable/apitable/issues/1379
target "web-server-experimental" {
  context = "."
  dockerfile = "packaging/Dockerfile.web-server"
  args = {
    SEMVER_FULL = SEMVER_FULL
  }
  platforms = PLATFORMS
  tags = ["${WEB_IMAGE}:latest", "${WEB_IMAGE}:${IMAGE_TAG}"]
}

target "init-db" {
  context = "./init-db"
  dockerfile = "Dockerfile"
  args = {
    SEMVER_FULL = SEMVER_FULL
  }
  platforms = PLATFORMS
  tags = ["${INIT_DB_IMAGE}:latest", "${INIT_DB_IMAGE}:${IMAGE_TAG}"]
}

target "openresty" {
  context = "./gateway"
  dockerfile = "../packaging/Dockerfile.openresty"
  args = {
    SEMVER_FULL = SEMVER_FULL
  }
  platforms = PLATFORMS
  tags = ["${OPENRESTY_IMAGE}:latest", "${OPENRESTY_IMAGE}:${IMAGE_TAG}"]
}

target "dataenv-pm2" {
  context = "packaging/all-in-one/dataenv-pm2"
  dockerfile = "packaging/all-in-one/dataenv-pm2/Dockerfile"
  platforms = PLATFORMS
  tags = ["${DATAENV_IMAGE}:latest", "${DATAENV_IMAGE}:${DATAENV_IMAGE_TAG}"]
}

target "dataenv-liquibase-pm2" {
  context = "packaging/all-in-one/dataenv-liquibase-pm2"
  dockerfile = "packaging/all-in-one/dataenv-liquibase-pm2/Dockerfile"
  args = {
    DATAENV_PM2_IMAGE = DATAENV_IMAGE
    DATAENV_PM2_IMAGE_TAG = DATAENV_IMAGE_TAG
  }
  # The base image has to be pushed before this target can pull it as FROM.
  dependencies = ["dataenv-pm2"]
  platforms = PLATFORMS
  tags = ["${DATAENV_LIQUIBASE_IMAGE}:latest", "${DATAENV_LIQUIBASE_IMAGE}:${DATAENV_IMAGE_TAG}"]
}

target "all-in-one" {
  context = "."
  dockerfile = "packaging/all-in-one/all-in-one/Dockerfile"
  args = {
    SEMVER_FULL = SEMVER_FULL
    IMAGE_TAG = IMAGE_TAG
    DATAENV_IMAGE_TAG = DATAENV_IMAGE_TAG
    BACKEND_IMAGE = BACKEND_IMAGE
    ROOM_IMAGE = ROOM_IMAGE
    WEB_IMAGE = WEB_IMAGE
    INIT_DB_IMAGE = INIT_DB_IMAGE
    DATABUS_IMAGE = DATABUS_IMAGE
    DATABUS_IMAGE_TAG = DATABUS_IMAGE_TAG
    INIT_APPDATA_IMAGE = INIT_APPDATA_IMAGE
    INIT_APPDATA_IMAGE_TAG = INIT_APPDATA_IMAGE_TAG
    IMAGEPROXY_IMAGE = IMAGEPROXY_IMAGE
    IMAGEPROXY_IMAGE_TAG = IMAGEPROXY_IMAGE_TAG
    DATAENV_LIQUIBASE_IMAGE = DATAENV_LIQUIBASE_IMAGE
  }
  platforms = PLATFORMS
  tags = ["${FINAL_IMAGE}:latest", "${FINAL_IMAGE}:${IMAGE_TAG}"]
}
