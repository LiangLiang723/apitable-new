group "default" {
  targets = ["backend-server", "room-server", "web-server", "init-db", "openresty"]
}

variable "IMAGE_REGISTRY" {
  default = "docker.io"
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
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["${BACKEND_IMAGE}:latest", "${BACKEND_IMAGE}:${IMAGE_TAG}"]
}

target "room-server" {
  context = "."
  dockerfile = "packaging/Dockerfile.room-server"
  args = {
    SEMVER_FULL = SEMVER_FULL
  }
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["${ROOM_IMAGE}:latest", "${ROOM_IMAGE}:${IMAGE_TAG}"]
}

target "web-server" {
  context = "."
  dockerfile = "packaging/Dockerfile.web-server"
  args = {
    SEMVER_FULL = SEMVER_FULL
  }
  platforms = ["linux/amd64"]
  tags = ["${WEB_IMAGE}:latest", "${WEB_IMAGE}:${IMAGE_TAG}"]
}

# https://github.com/apitable/apitable/issues/1379
target "web-server-experimental" {
  context = "."
  dockerfile = "packaging/Dockerfile.web-server"
  args = {
    SEMVER_FULL = SEMVER_FULL
  }
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["${WEB_IMAGE}:latest", "${WEB_IMAGE}:${IMAGE_TAG}"]
}

target "init-db" {
  context = "./init-db"
  dockerfile = "Dockerfile"
  args = {
    SEMVER_FULL = SEMVER_FULL
  }
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["${INIT_DB_IMAGE}:latest", "${INIT_DB_IMAGE}:${IMAGE_TAG}"]
}

target "openresty" {
  context = "./gateway"
  dockerfile = "../packaging/Dockerfile.openresty"
  args = {
    SEMVER_FULL = SEMVER_FULL
  }
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["${IMAGE_REGISTRY}/apitable/openresty:latest", "${IMAGE_REGISTRY}/apitable/openresty:${IMAGE_TAG}"]
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
  platforms = ["linux/amd64"]
  tags = ["${FINAL_IMAGE}:latest", "${FINAL_IMAGE}:${IMAGE_TAG}"]
}
