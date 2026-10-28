# APITable <https://github.com/apitable/apitable>
# Copyright (C) 2022 APITable Ltd. <https://apitable.com>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

FROM liquibase/liquibase:4.21.1-alpine

# MySQL 驱动钉版本并校验。原来用 `lpm add mysql --global`：它会跟随上游索引解析版本，
# 构建时可能拉到别的版本，甚至因为校验失败直接中断（v1.17.7 首次构建就是这样）。
# 直连 Maven Central + SHA256 校验，版本与内容都固定。busybox 自带 wget 与
# sha256sum，镜像里未必有 curl，也不一定允许 apk，所以优先用 wget。
ARG MYSQL_DRIVER_VERSION=8.0.33
ARG MYSQL_DRIVER_SHA256=e2a3b2fc726a1ac64e998585db86b30fa8bf3f706195b78bb77c5f99bf877bd9
RUN set -eux; \
    url="https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/${MYSQL_DRIVER_VERSION}/mysql-connector-j-${MYSQL_DRIVER_VERSION}.jar"; \
    if command -v wget >/dev/null 2>&1; then wget -q -T 60 -t 5 -O /liquibase/lib/mysql-connector-j.jar "${url}"; \
    else curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --max-time 300 -o /liquibase/lib/mysql-connector-j.jar "${url}"; fi; \
    echo "${MYSQL_DRIVER_SHA256}  /liquibase/lib/mysql-connector-j.jar" | sha256sum -c -
ADD src/main/resources /liquibase/changelog

ARG SEMVER_FULL
ENV SEMVER_FULL=${SEMVER_FULL}

CMD ["sh", "-c", "echo \"clearChecksums\"; \
                    docker-entrypoint.sh \
                        --classpath=/liquibase/changelog \
                        --changelog-file=${CHANGELOG_FILE:=db/changelog/db.changelog-master.xml} \
                        --log-level=warning \
                        --username=${DB_USERNAME} \
                        --password=${DB_PASSWORD} \
                        --driver=\"com.mysql.cj.jdbc.Driver\" \
                        --database-changelog-table-name=\"${DATABASE_TABLE_PREFIX:=apitable_}db_changelog\" \
                        --database-changelog-lock-table-name=\"${DATABASE_TABLE_PREFIX:=apitable_}db_changelog_lock\" \
                        --url=\"jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME}?characterEncoding=utf8&autoReconnect=true&useSSL=true\" \
                         clearChecksums; \
                    echo ACTION=${ACTION}; docker-entrypoint.sh \
                        --classpath=/liquibase/changelog \
                        --changelog-file=${CHANGELOG_FILE:=db/changelog/db.changelog-master.xml} \
                        --log-level=warning \
                        --username=${DB_USERNAME} \
                        --password=${DB_PASSWORD} \
                        --driver=\"com.mysql.cj.jdbc.Driver\" \
                        --database-changelog-table-name=\"${DATABASE_TABLE_PREFIX:=apitable_}db_changelog\" \
                        --database-changelog-lock-table-name=\"${DATABASE_TABLE_PREFIX:=apitable_}db_changelog_lock\" \
                        --url=\"jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME}?characterEncoding=utf8&autoReconnect=true&useSSL=true\" \
                         ${ACTION:=update} \
                        -Dtable.prefix=${DATABASE_TABLE_PREFIX:=apitable_} \
                        -DDB_ENGINE=${DB_ENGINE:=mysql}"]
