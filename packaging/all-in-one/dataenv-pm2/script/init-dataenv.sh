#!/bin/bash

set -e

GOSU_UID="$(id -u "${GOSU_USER}")"
GOSU_GID="$(id -g "${GOSU_USER}")"

ensure_dir() {
    local dir="$1"
    if [[ ! -d "${dir}" ]]; then
        mkdir -p "${dir}"
    fi
}

is_gosu_owned_dir() {
    local dir="$1"
    [[ "$(stat -c '%u:%g' "${dir}")" == "${GOSU_UID}:${GOSU_GID}" ]]
}

ensure_owned_dir() {
    local dir="$1"
    ensure_dir "${dir}"

    if is_gosu_owned_dir "${dir}" && gosu "${GOSU_USER}" test -w "${dir}"; then
        return
    fi

    if ! chown -R "${GOSU_USER}:${GOSU_USER}" "${dir}"; then
        echo "ERROR: failed to repair ownership for ${dir}. Please chown the host bind mount to ${GOSU_UID}:${GOSU_GID}." >&2
        exit 1
    fi
    if ! chmod -R u+rwX,go-rwx "${dir}"; then
        echo "ERROR: failed to repair permissions for ${dir}. Please fix the host bind mount permissions." >&2
        exit 1
    fi
    if ! is_gosu_owned_dir "${dir}" || ! gosu "${GOSU_USER}" test -w "${dir}"; then
        echo "ERROR: ${dir} is not writable by ${GOSU_USER}. Please chown the host bind mount to ${GOSU_UID}:${GOSU_GID}." >&2
        exit 1
    fi
}

for i in /apitable/minio/data /apitable/minio/config; do
    ensure_dir "${i}"
done

# Old all-in-one volumes may have been created by root or by a different image.
# MySQL, Redis and RabbitMQ are started through gosu ${GOSU_USER}; therefore all
# persisted runtime directories must be writable by that user on every boot.
# Only recurse when the top-level data directory still has stale ownership or is
# no longer writable by ${GOSU_USER}; otherwise large healthy volumes avoid an
# expensive chmod/chown pass on every restart.
for i in /apitable/mysql /apitable/redis /apitable/rabbitmq; do
    ensure_owned_dir "${i}"
done

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
