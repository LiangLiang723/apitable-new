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

if [[ -n "$(ls -A /apitable/mysql)" ]]; then
    exit
fi

# A fresh MySQL data directory means the built-in application data (templates,
# widget center, ...) has to be loaded again: drop the stamp that
# init-appdata.sh uses to skip the loader on plain restarts.
rm -f /apitable/.appdata-stamp

gosu "${GOSU_USER}" mysqld --initialize

gosu "${GOSU_USER}" mysqld --daemonize --skip-grant-tables --skip-networking

if [[ -n "${MYSQL_ROOT_PASSWORD}" ]]; then
    mysql -u root -h localhost -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}'; GRANT ALL ON *.* TO 'root'@'localhost' WITH GRANT OPTION; CREATE USER 'root'@'%' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}'; GRANT ALL ON *.* TO 'root'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;"
fi

if [[ -n "${MYSQL_DATABASE}" ]]; then
    mysql -u root -h localhost -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE DATABASE ${MYSQL_DATABASE};"
fi

mysqladmin -u root -h localhost shutdown -p"${MYSQL_ROOT_PASSWORD}"
