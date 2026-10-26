#!/usr/bin/env bash
#
# 对已发布的 all-in-one 镜像做一次端到端冒烟：
#   1. 冷启动并等待后端健康检查通过，记录耗时
#   2. 校验首页、登录页与 /_next/static 静态资源
#   3. 重启容器，确认内置数据不再重复导入（版本戳生效）
#   4. 打印各进程内存占用
#
# 用法：scripts/smoke-test.sh <image:tag> [数据目录]
# 退出码：0 全部通过；非 0 表示有检查项失败（脚本会打印失败原因）

set -uo pipefail

IMAGE="${1:?用法: scripts/smoke-test.sh <image:tag> [数据目录]}"
DATA_DIR="${2:-$(pwd)/.smoke-data}"
PORT="${SMOKE_PORT:-18080}"
BASE="http://127.0.0.1:${PORT}"
HEALTH_PATH="/api/v1/actuator/health"
WAIT_SECONDS="${SMOKE_WAIT_SECONDS:-300}"
NAME="apitable-smoke-$$"

log() { printf '[smoke] %s\n' "$*"; }
fail() { printf '[smoke] FAIL: %s\n' "$*" >&2; FAILED=1; }
FAILED=0

cleanup() {
    docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

mkdir -p "$DATA_DIR"

start_container() {
    docker run -d --name "$NAME" -p "${PORT}:80" -v "${DATA_DIR}:/apitable" "$IMAGE" >/dev/null
}

wait_healthy() {
    local i
    for ((i = 1; i <= WAIT_SECONDS; i++)); do
        if curl -fs -o /dev/null "${BASE}${HEALTH_PATH}"; then
            echo "$i"
            return 0
        fi
        if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
            log "容器已退出，最近日志："
            docker logs --tail 80 "$NAME" 2>&1 || true
            return 1
        fi
        sleep 1
    done
    return 1
}

log "镜像 $IMAGE，数据目录 $DATA_DIR，端口 $PORT"

log "--- 1/4 冷启动 ---"
start_container
if SECONDS_USED=$(wait_healthy); then
    log "健康检查通过，用时 ${SECONDS_USED}s"
    if (( SECONDS_USED > 90 )); then
        log "注意：冷启动超过 90s，低于预期"
    fi
else
    fail "冷启动超时（${WAIT_SECONDS}s 内未通过健康检查）"
fi

log "--- 2/4 HTTP 与静态资源 ---"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/login")
[[ "$CODE" == "200" ]] && log "GET /login -> 200" || fail "GET /login -> $CODE"

ASSET=$(curl -s "${BASE}/login" | grep -o '/_next/static/[^"]*\.js' | head -1)
if [[ -n "$ASSET" ]]; then
    A_CODE=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}${ASSET}")
    [[ "$A_CODE" == "200" ]] && log "GET ${ASSET} -> 200" || fail "GET ${ASSET} -> $A_CODE"

    curl -s -o /dev/null "${BASE}${ASSET}"
    CACHE=$(curl -sI "${BASE}${ASSET}" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-cache-status"{print $2}')
    log "静态资源 X-Cache-Status=${CACHE:-未返回}"
else
    fail "登录页未引用任何 /_next/static 资源"
fi

log "--- 3/4 重启后跳过内置数据导入 ---"
docker restart "$NAME" >/dev/null
if SECONDS_USED=$(wait_healthy); then
    log "重启后健康检查通过，用时 ${SECONDS_USED}s"
else
    fail "重启后未通过健康检查"
fi
if docker logs "$NAME" 2>&1 | grep -q "built-in application data already loaded"; then
    log "版本戳生效：内置数据已跳过"
else
    fail "未看到内置数据跳过日志（可能是首次启动或版本戳未生效）"
fi

log "--- 4/4 资源占用 ---"
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' || true

if (( FAILED == 0 )); then
    log "全部检查通过"
else
    log "存在失败项，见上方 FAIL 行"
fi
exit "$FAILED"
