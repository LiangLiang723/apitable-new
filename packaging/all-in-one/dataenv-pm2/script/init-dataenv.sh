#!/bin/bash

set -e

ensure_dir() {
    local dir="$1"
    if [[ ! -d "${dir}" ]]; then
        mkdir -p "${dir}"
    fi
}

ensure_owned_dir() {
    local dir="$1"
    ensure_dir "${dir}"
    chown -R "${GOSU_USER}:${GOSU_USER}" "${dir}"
    chmod -R u+rwX,go-rwx "${dir}"
}

for i in /apitable/minio/data /apitable/minio/config; do
    ensure_dir "${i}"
done

# Old all-in-one volumes may have been created by root or by a different image.
# MySQL, Redis and RabbitMQ are started through gosu ${GOSU_USER}; therefore all
# persisted runtime directories must be writable by that user on every boot.
# Run this before the MySQL initialized check so upgrades are handled too.
for i in /apitable/mysql /apitable/redis /apitable/rabbitmq; do
    ensure_owned_dir "${i}"
done

# Some old host bind mounts reject recursive chmod/chown for a subset of files.
# Keep the container boot explicit: fail early with a useful message instead of
# letting MySQL/Redis loop with Permission denied.
for i in /apitable/mysql /apitable/redis /apitable/rabbitmq; do
    if [[ ! -w "${i}" ]]; then
        echo "ERROR: ${i} is not writable by root inside container. Please fix the host bind mount permissions." >&2
        exit 1
    fi
    if ! gosu "${GOSU_USER}" test -w "${i}"; then
        echo "ERROR: ${i} is not writable by ${GOSU_USER}. Please chown the host bind mount to the container uid/gid." >&2
        exit 1
    fi
done

# RabbitMQ queue/coordination data is runtime state for the all-in-one bundle.
# When upgrading from old images to RabbitMQ versions with Ra coordination data,
# stale or wrongly-owned files can prevent boot with:
#   Ra could not create its data directory.
# Set APITABLE_RESET_RABBITMQ_ON_START=true once to rebuild RabbitMQ runtime data
# without touching MySQL, Redis, or MinIO data.
if [[ "${APITABLE_RESET_RABBITMQ_ON_START:-false}" == "true" ]]; then
    if [[ -d /apitable/rabbitmq && -n "$(ls -A /apitable/rabbitmq 2>/dev/null || true)" ]]; then
        backup_dir="/apitable/rabbitmq.backup.$(date +%Y%m%d%H%M%S)"
        mv /apitable/rabbitmq "${backup_dir}"
        echo "RabbitMQ data moved to ${backup_dir}"
    fi
    install --directory --owner "${GOSU_USER}" --group "${GOSU_USER}" /apitable/rabbitmq
    chmod -R u+rwX,go-rwx /apitable/rabbitmq
fi

if [[ -n "$(ls -A /apitable/mysql)" ]]; then
    exit
fi

gosu "${GOSU_USER}" mysqld --initialize

gosu "${GOSU_USER}" mysqld --daemonize --skip-grant-tables --skip-networking

if [[ -n "${MYSQL_ROOT_PASSWORD}" ]]; then
    mysql -u root -h localhost -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}'; GRANT ALL ON *.* TO 'root'@'localhost' WITH GRANT OPTION; CREATE USER 'root'@'%' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}'; GRANT ALL ON *.* TO 'root'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;"
fi

if [[ -n "${MYSQL_DATABASE}" ]]; then
    mysql -u root -h localhost -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE DATABASE ${MYSQL_DATABASE};"
fi

mysqladmin -u root -h localhost shutdown -p"${MYSQL_ROOT_PASSWORD}"
