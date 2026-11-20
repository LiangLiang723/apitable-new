#!/bin/bash

set -e

for i in /apitable/minio/data /apitable/minio/config; do
    if [[ ! -d "${i}" ]]; then
        mkdir -p "${i}"
    fi
done

for i in /apitable/mysql /apitable/redis /apitable/rabbitmq; do
    if [[ ! -d "${i}" ]]; then
        install --directory --owner "${GOSU_USER}" --group "${GOSU_USER}" "${i}"
    fi
done

# docker restart 时 /var/run 属于容器可写层，会保留上一次运行留下的 socket 与
# socket 锁文件；mysqld 启动时发现锁文件里的 PID 在新 PID 命名空间里“还活着”，
# 就会报 "Another process with pid xxx is using unix socket file" 并退出，表现为
# 重启后 MySQL 反复重启、backend 一直等不到数据库。启动前先清掉。
rm -f /var/run/mysqld/mysqld.sock /var/run/mysqld/mysqld.sock.lock \
      /var/run/mysqld/mysqlx.sock /var/run/mysqld/mysqlx.sock.lock

# 数据卷的属主必须与当前镜像里的 GOSU_USER 一致。旧镜像用 useradd --system 分配
# UID，重建后可能从 998 变成 997，导致 rabbitmq/mysql/redis 全部 EACCES 起不来。
# 只在顶层目录属主不一致时递归修正一次，正常重启不会触发。
want_uid="$(id -u "${GOSU_USER}")"
want_gid="$(id -g "${GOSU_USER}")"
for d in /apitable/mysql /apitable/rabbitmq /apitable/redis; do
    [[ -d "${d}" ]] || continue
    have="$(stat -c '%u:%g' "${d}")"
    if [[ "${have}" != "${want_uid}:${want_gid}" ]]; then
        echo "data dir ${d} owned by ${have}, fixing to ${want_uid}:${want_gid}" >&2
        chown -R "${want_uid}:${want_gid}" "${d}"
    fi
done

mysql_dir=/apitable/mysql
database="${MYSQL_DATABASE:-}"
root_password="${MYSQL_ROOT_PASSWORD:-}"
complete=.apitable-initialized
staging=/apitable/.mysql-bootstrap

# Existing volumes predate the marker. A system schema and the configured
# application schema are sufficient to recognize the usual completed volume.
if [[ -d "$mysql_dir/mysql" ]] &&
   [[ -f "$mysql_dir/$complete" || -z "$database" || -d "$mysql_dir/$database" ]]; then
    exit 0
fi

bootstrap_dir="$mysql_dir"
if [[ -z "$(ls -A "$mysql_dir")" ]]; then
    # Bootstrap a fresh database separately. The real data directory becomes
    # populated only once credentials and schema are durable.
    if [[ -L "$staging" ]]; then
        echo "Unexpected symbolic link at $staging" >&2
        exit 1
    fi
    if [[ -f "$staging/.apitable-bootstrap" ]]; then
        rm -rf -- "$staging"
    fi
    install -d -m 0755 "$staging"
    if [[ -n "$(ls -A "$staging")" ]]; then
        echo "Unexpected contents in $staging" >&2
        exit 1
    fi
    touch "$staging/.apitable-bootstrap"
    bootstrap_dir="$staging/data"
    install -d -o "$GOSU_USER" -g "$GOSU_USER" "$bootstrap_dir"
    init_mode=--initialize
    [[ -n "$root_password" ]] || init_mode=--initialize-insecure
    gosu "$GOSU_USER" mysqld "$init_mode" --datadir="$bootstrap_dir"
elif [[ ! -d "$mysql_dir/mysql" ]]; then
    echo "Incomplete MySQL system tables in $mysql_dir. Retaining the existing files for recovery." >&2
    exit 1
fi

# This server is reachable only through a private socket during bootstrap.
socket=/var/run/mysqld/apitable-bootstrap.sock
pid_file=/var/run/mysqld/apitable-bootstrap.pid
rm -f "$socket" "$socket.lock" "$pid_file"
gosu "$GOSU_USER" mysqld --daemonize --skip-grant-tables --skip-networking \
    --datadir="$bootstrap_dir" --socket="$socket" --pid-file="$pid_file"
trap 'if [[ -s "$pid_file" ]]; then kill -TERM "$(cat "$pid_file")" 2>/dev/null || true; fi' EXIT
mysql_args=(--protocol=socket --socket="$socket" --user=root)

if [[ "$bootstrap_dir" == "$mysql_dir" ]]; then
    # An interrupted legacy bootstrap can have valid system tables. Check the
    # schemas before configuring credentials on an existing volume.
    if mysql "${mysql_args[@]}" --database="$database" -e 'SELECT 1' >/dev/null 2>&1; then
        mysqladmin "${mysql_args[@]}" shutdown
        touch "$mysql_dir/$complete"
        exit 0
    fi
    schemas="$(mysql "${mysql_args[@]}" -Nse "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('mysql', 'sys', 'performance_schema', 'information_schema')")"
    if [[ -n "$schemas" ]]; then
        echo "Configured database $database is missing from an existing MySQL volume." >&2
        exit 1
    fi
fi

if [[ -n "$root_password" ]]; then
    sql_password="${root_password//\'/\'\'}"
    mysql "${mysql_args[@]}" <<SQL
FLUSH PRIVILEGES;
SET SESSION sql_mode = 'NO_BACKSLASH_ESCAPES';
ALTER USER 'root'@'localhost' IDENTIFIED BY '$sql_password';
GRANT ALL ON *.* TO 'root'@'localhost' WITH GRANT OPTION;
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '$sql_password';
ALTER USER 'root'@'%' IDENTIFIED BY '$sql_password';
GRANT ALL ON *.* TO 'root'@'%' WITH GRANT OPTION;
SQL
fi

export MYSQL_PWD="$root_password"
rm -f /apitable/.appdata-stamp
if [[ -n "$database" ]]; then
    sql_database="${database//\`/\`\`}"
    mysql "${mysql_args[@]}" -e "CREATE DATABASE IF NOT EXISTS \`${sql_database}\`"
fi
mysqladmin "${mysql_args[@]}" shutdown
touch "$bootstrap_dir/$complete"
if [[ "$bootstrap_dir" != "$mysql_dir" ]]; then
    mv -T -- "$bootstrap_dir" "$mysql_dir"
    rm -f "$staging/.apitable-bootstrap"
    rmdir "$staging"
fi
