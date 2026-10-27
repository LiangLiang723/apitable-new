FROM almalinux/8-minimal:8.9-20231124

COPY conf/yum.repos.d/*.repo /etc/yum.repos.d/

ARG GOSU_VERSION=1.17

ENV GOSU_USER=rabbitmq

# Runtime components are pinned to the versions the v1.17.0 image shipped
# (the full list is kept at /sbom/rpms.txt inside the image). Without the pin
# a rebuild silently picks up a newer broker/database, so two builds of the
# same Dockerfile would behave differently. Bump them deliberately, with a
# smoke test (gh workflow run image-smoke-test.yml).
#
# The node tarball is verified right after extraction: a stale layer once shipped
# node 16.15.1 while this file asked for 22, and nothing failed at build time.
#
# GOSU_USER gets a fixed uid/gid (998:996) on purpose: the data volume is owned by
# that user, and `useradd --system` hands out a different id when the package set
# changes, which once made rabbitmq/mysql/redis fail with EACCES after an upgrade.
# The user must be created before redis/rabbitmq are installed: their RPM scriptlets
# create system users too, and whoever runs first gets 998:996 -- the id the data
# volume is owned by.
#
# No blanket `microdnf -y update` here: it upgraded the whole base from 8.9 to 8.10
# and left the superseded files in the base layer (~150MB of dead weight), while
# `microdnf install` below already pulls whatever dependency versions it needs.
RUN set -euxo pipefail; \
  arch="$(uname -m)"; \
  case "${arch}" in \
  aarch64) pkgArch='arm64' ;; \
  x86_64) pkgArch='amd64' ;; \
  *) echo >&2 "error: unsupported architecture: '${arch}'"; exit 1 ;; \
  esac; \
  \
  curl -fsSL https://repo.mysql.com/RPM-GPG-KEY-mysql-2025 -o /etc/pki/rpm-gpg/RPM-GPG-KEY-mysql; \
  curl -fL --retry 5 --retry-delay 3 -o /etc/pki/rpm-gpg/cloudsmith.rabbitmq-erlang.E495BB49CC4BBE5B.key https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-erlang.E495BB49CC4BBE5B.key; \
  curl -fL --retry 5 --retry-delay 3 -o /etc/pki/rpm-gpg/cloudsmith.rabbitmq-server.9F4587F226208342.key https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-server.9F4587F226208342.key; \
  curl -fL --retry 5 --retry-delay 3 -o /etc/pki/rpm-gpg/rabbitmq-release-signing-key.asc https://github.com/rabbitmq/signing-keys/releases/download/3.0/rabbitmq-release-signing-key.asc; \
  rpm --import /etc/pki/rpm-gpg/cloudsmith.rabbitmq-erlang.E495BB49CC4BBE5B.key; \
  rpm --import /etc/pki/rpm-gpg/cloudsmith.rabbitmq-server.9F4587F226208342.key; \
  rpm --import /etc/pki/rpm-gpg/rabbitmq-release-signing-key.asc; \
  microdnf -y install shadow-utils; \
  getent group "${GOSU_USER}" >/dev/null || groupadd --system --gid 996 "${GOSU_USER}"; \
  id -u "${GOSU_USER}" >/dev/null 2>&1 || useradd --system --uid 998 --gid "${GOSU_USER}" --create-home "${GOSU_USER}"; \
  test "$(id -u "${GOSU_USER}")" = "998" -a "$(id -g "${GOSU_USER}")" = "996" || { echo >&2 "GOSU_USER uid/gid drift: $(id -u "${GOSU_USER}"):$(id -g "${GOSU_USER}")"; exit 1; }; \
  MINIO_RELEASE=RELEASE.2023-01-25T00-19-54Z; \
  MINIO_RPM="minio-20230125001954.0.0.${arch}.rpm"; \
  curl -fL --retry 5 --retry-delay 3 -o "/tmp/${MINIO_RPM}" \
    "https://github.com/minio/minio/releases/download/${MINIO_RELEASE}/${MINIO_RPM}"; \
  curl -fL --retry 5 --retry-delay 3 -o "/tmp/${MINIO_RPM}.sha256sum" \
    "https://github.com/minio/minio/releases/download/${MINIO_RELEASE}/${MINIO_RPM}.sha256sum"; \
  test "$(cut -d' ' -f1 "/tmp/${MINIO_RPM}.sha256sum")" = "$(sha256sum "/tmp/${MINIO_RPM}" | cut -d' ' -f1)"; \
  rpm -Uvh "/tmp/${MINIO_RPM}"; \
  rm -f "/tmp/${MINIO_RPM}" "/tmp/${MINIO_RPM}.sha256sum"; \
  MC_RELEASE=RELEASE.2023-01-28T20-29-38Z; \
  MC_BIN="mc.linux-${pkgArch}.${MC_RELEASE}"; \
  curl -fL --retry 5 --retry-delay 3 -o "/tmp/${MC_BIN}" \
    "https://github.com/minio/mc/releases/download/${MC_RELEASE}/${MC_BIN}"; \
  curl -fL --retry 5 --retry-delay 3 -o "/tmp/${MC_BIN}.sha256sum" \
    "https://github.com/minio/mc/releases/download/${MC_RELEASE}/${MC_BIN}.sha256sum"; \
  test "$(cut -d' ' -f1 "/tmp/${MC_BIN}.sha256sum")" = "$(sha256sum "/tmp/${MC_BIN}" | cut -d' ' -f1)"; \
  install -m 0755 "/tmp/${MC_BIN}" /usr/local/bin/mc; \
  rm -f "/tmp/${MC_BIN}" "/tmp/${MC_BIN}.sha256sum"; \
  microdnf -y module enable redis:6; \
  microdnf -y install \
  mysql-community-server-minimal-8.0.37-1.el8 \
  openresty-1.29.2.5-1.el8 \
  rabbitmq-server-4.3.1-1.el8 \
  erlang-27.3.4.11-1.el8 \
  redis-6.2.20-1.module_el8.10.0+4056+739731b0; \
  microdnf -y install tar xz; \
  microdnf clean all; \
  mkdir -p /sbom; rpm -qa | sort > /sbom/rpms.txt; \
  \
  mkdir -p /etc/mysql/conf.d; \
  chown -R "${GOSU_USER}:${GOSU_USER}" /var/lib/mysql /var/run/mysqld /var/log/mysqld.log; \
  chown -R "${GOSU_USER}:${GOSU_USER}" /var/lib/redis /var/log/redis; \
  mkdir -p /var/run/openresty; \
  \
  NODE_VERSION=v22.22.2; \
  case "${arch}" in \
  aarch64) NODE_ARCH='arm64' ;; \
  x86_64) NODE_ARCH='x64' ;; \
  *) echo >&2 "error: unsupported architecture: '${arch}'"; exit 1 ;; \
  esac; \
  curl -fsSLO --compressed "https://nodejs.org/download/release/${NODE_VERSION}/node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"; \
  tar -xJf "node-$NODE_VERSION-linux-$NODE_ARCH.tar.xz" -C /usr/local --strip-components=1 --no-same-owner; \
  rm "node-$NODE_VERSION-linux-$NODE_ARCH.tar.xz"; \
  test "$(node -v)" = "${NODE_VERSION}" || { echo >&2 "node version mismatch: $(node -v), expected ${NODE_VERSION}"; exit 1; }; \
  echo "node $(node -v) installed"; \
  corepack enable; \
  npm i -g pm2@5.4.3; \
  \
  curl -fL -o /usr/local/bin/gosu "https://github.com/tianon/gosu/releases/download/${GOSU_VERSION}/gosu-${pkgArch}"; \
  chmod +x /usr/local/bin/gosu; \
  gosu --version; \
  gosu nobody true

COPY conf/my.cnf /etc/
COPY conf/nginx.conf /usr/local/openresty/nginx/conf/
COPY conf/nginx.vh.default.conf /etc/nginx/conf.d/default.conf
COPY conf/rabbitmq.conf /etc/rabbitmq/

ENV PATH=$PATH:/usr/local/openresty/luajit/bin:/usr/local/openresty/nginx/sbin:/usr/local/openresty/bin

EXPOSE 80 3306 5672 6379 9000

VOLUME /apitable

COPY script/ /usr/local/bin/
COPY ecosystem.config.js /

CMD ["bash", "-c", "init-dataenv.sh && pm2-runtime start ecosystem.config.js"]
