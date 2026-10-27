#!/bin/bash

set -e

# ---------------------------------------------------------------------------
# Database migrations
# ---------------------------------------------------------------------------
# `clearChecksums` used to run before every single start, which forces liquibase
# to recompute the checksum of all ~350 changesets on every boot. It is only
# needed when a historical changeset was edited (the checksum then no longer
# matches and `update` aborts), so it became a retry path instead of a
# precondition.
liquibase_run() {
    liquibase \
        "--defaultsFile=/liquibase/liquibase.docker.properties" \
        --classpath=/liquibase/changelog \
        --changelog-file="${CHANGELOG_FILE:=db/changelog/db.changelog-master.xml}" \
        --log-level=warning \
        --username="${MYSQL_USERNAME}" \
        --password="${MYSQL_PASSWORD}" \
        --driver="com.mysql.cj.jdbc.Driver" \
        --database-changelog-table-name="${DATABASE_TABLE_PREFIX:=apitable_}db_changelog" \
        --database-changelog-lock-table-name="${DATABASE_TABLE_PREFIX:=apitable_}db_changelog_lock" \
        --url="jdbc:mysql://${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}?characterEncoding=utf8&autoReconnect=true&useSSL=true" \
        "$@"
}

run_update() {
    liquibase_run "${ACTION:=update}" \
        -Dtable.prefix="${DATABASE_TABLE_PREFIX:=apitable_}" \
        -DDB_ENGINE="${DB_ENGINE:=mysql}"
}

run_migrations() {
    local out
    if out="$(run_update 2>&1)"; then
        [[ -n "${out}" ]] && printf '%s\n' "${out}"
        return 0
    fi
    printf '%s\n' "${out}" >&2

    # 上一次启动在做迁移时被 kill（docker restart、OOM、Ctrl-C）会在
    # DATABASECHANGELOGLOCK 里留下 LOCKED=1，之后每次启动都报
    # "Could not acquire change log lock" 并卡住 backend，必须显式释放。
    if grep -q "Could not acquire change log lock" <<<"${out}"; then
        echo "changelog lock 被上一次运行占用，执行 releaseLocks 后重试" >&2
        liquibase_run releaseLocks || true
    else
        # checksum 不一致（历史上改过 changeset）时清掉校验和再试
        echo "liquibase update 失败，按 checksum 冲突处理：clearChecksums 后重试" >&2
        liquibase_run clearChecksums || true
    fi

    run_update
}

# ---------------------------------------------------------------------------
# Built-in application data (templates, widget center, automation, ...)
# ---------------------------------------------------------------------------
# The loader parses and upserts the bundled data on every run, which is the
# single most expensive step of a container start (~24s in the reference boot
# log). It only has to run for a new version, so the image version is used as a
# stamp. Set FORCE_APPDATA_RELOAD=true to run it again (for example after
# restoring a database dump into an existing volume).
APP_DATA_STAMP=/apitable/.appdata-stamp

run_app_data() {
    cd /app/init-appdata
    for action in init-user load; do
        java \
            -Dlogging.level.com.amazonaws.services.s3.AmazonS3Client=ERROR \
            -Dlogging.level.com.apitable.appdata.shared.starter.oss.AwsOssClientRequest=WARN \
            '-Dlogging.level.org.springframework.context.support.PostProcessorRegistrationDelegate$BeanPostProcessorChecker=ERROR' \
            -jar /app/init-appdata/init-appdata.jar "${action}"
    done
}

app_data_is_current() {
    [[ "${FORCE_APPDATA_RELOAD:-}" != "true" ]] \
        && [[ -f "${APP_DATA_STAMP}" ]] \
        && [[ "$(cat "${APP_DATA_STAMP}")" == "${SEMVER_FULL}" ]]
}

# ---------------------------------------------------------------------------

run_migrations

if app_data_is_current; then
    echo "built-in application data already loaded for ${SEMVER_FULL}, skipping"
else
    run_app_data
    echo "${SEMVER_FULL}" > "${APP_DATA_STAMP}"
fi
