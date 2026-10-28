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
TAG="${IMAGE##*:}"
DATA_DIR="${2:-$(pwd)/.smoke-data}"
PORT="${SMOKE_PORT:-18080}"
BASE="http://127.0.0.1:${PORT}"
HEALTH_PATH="/api/v1/actuator/health"
WAIT_SECONDS="${SMOKE_WAIT_SECONDS:-300}"
NAME="apitable-smoke-$$"

log() { printf '[smoke] %s\n' "$*"; }
fail() { printf '[smoke] FAIL: %s\n' "$*" >&2; FAILED=1; }

# 镜像里没有 ps/top，超时后只能靠 /proc 和容器内命令取证；
# 否则看到的永远只是"健康检查超时"这一句，不知道该看哪。
dump_diagnostics() {
    log "容器日志（末尾 80 行）："
    docker logs --tail 80 "$NAME" 2>&1 || true

    log "进程（/proc）："
    docker exec "$NAME" sh -c 'for p in /proc/[0-9]*; do c=$(tr "\0" " " < "$p/comm" 2>/dev/null); [ -n "$c" ] && echo "${p#/proc/} $c"; done | sort -n | tail -20' 2>&1 || true

    log "java："
    docker exec "$NAME" sh -c 'java -version 2>&1 | head -3' 2>&1 || true

    log "MySQL 可达性："
    docker exec "$NAME" sh -c 'mysqladmin ping -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u"$MYSQL_USERNAME" -p"$MYSQL_PASSWORD" 2>&1 | tail -1' 2>&1 || true

    log "changelog 锁："
    docker exec "$NAME" sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -D "${MYSQL_DATABASE:-apitable}" -e "SELECT ID,LOCKED,LOCKEDBY FROM ${DATABASE_TABLE_PREFIX:-apitable_}db_changeloglock" 2>&1 | grep -v Warning | tail -5' 2>&1 || true

    log "负载/内存："
    docker exec "$NAME" sh -c 'cat /proc/loadavg; grep -E "MemTotal|MemAvailable" /proc/meminfo' 2>&1 || true
}
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

log "--- 1/5 冷启动 ---"
start_container
if SECONDS_USED=$(wait_healthy); then
    log "健康检查通过，用时 ${SECONDS_USED}s"
    if (( SECONDS_USED > 90 )); then
        log "注意：冷启动超过 90s，低于预期"
    fi
else
    fail "冷启动超时（${WAIT_SECONDS}s 内未通过健康检查）"
    dump_diagnostics
fi

log "--- 2/5 HTTP 与静态资源 ---"
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

log "--- 3/5 pm2 应用状态（观察 30 秒，确认没有反复重启） ---"
# 只查一次会被"崩溃-重启"的应用骗过去（pm2 在两次重启之间也显示 online）。
# 隔 30 秒取两次快照：状态必须 online，且 restart_time 不变。
PM2_BEFORE="$(docker exec "$NAME" pm2 jlist 2>/dev/null || true)"
sleep 30
PM2_AFTER="$(docker exec "$NAME" pm2 jlist 2>/dev/null || true)"
if [[ -n "${PM2_BEFORE}" && -n "${PM2_AFTER}" ]]; then
    if ! printf '%s\n@@SPLIT@@\n%s' "${PM2_BEFORE}" "${PM2_AFTER}" | python3 -c '
import json, sys

raw = sys.stdin.read()
before, _, after = raw.partition("@@SPLIT@@")


def load(text):
    i, j = text.find("["), text.rfind("]")
    return json.loads(text[i:j + 1]) if i >= 0 and j > i else []


a, b = load(before), load(after)
if not b:
    print("    pm2 jlist 输出无法解析")
    sys.exit(1)

prev = dict((x["name"], x["pm2_env"].get("restart_time", 0)) for x in a)
bad = []
for x in b:
    name = x["name"]
    env = x["pm2_env"]
    status = env["status"]
    restarts = env.get("restart_time", 0)
    if status != "online":
        bad.append(name + " 状态 " + str(status))
    elif restarts != prev.get(name, 0):
        bad.append(name + " 30 秒内又重启 " + str(restarts - prev.get(name, 0)) + " 次")

for item in bad:
    print("    " + item)
print("    应用总数 " + str(len(b)) + "，异常 " + str(len(bad)))
sys.exit(1 if bad else 0)
'; then
        fail "有 pm2 应用不在 online 状态或仍在反复重启"
        docker exec "$NAME" pm2 status --no-color 2>&1 | tail -20 || true
    fi
else
    log "pm2 jlist 不可用，跳过该项"
fi

log "--- 4/5 重启后跳过内置数据导入 ---"
docker restart "$NAME" >/dev/null
if SECONDS_USED=$(wait_healthy); then
    log "重启后健康检查通过，用时 ${SECONDS_USED}s"
else
    fail "重启后未通过健康检查"
    dump_diagnostics
fi
# 版本戳文件是最可靠的证据：脚本的 stdout 会经过 pm2 的日志管道，
# 有时被吞掉；容器内文件不会骗人。
STAMP="$(docker exec "$NAME" cat /apitable/.appdata-stamp 2>/dev/null | tr -d '\r\n')"
if [[ "${STAMP}" == "${TAG}" ]]; then
    log "版本戳生效：/apitable/.appdata-stamp = ${STAMP}"
elif docker logs "$NAME" 2>&1 | grep -q "built-in application data already loaded"; then
    log "版本戳生效（通过日志确认）"
else
    fail "版本戳未生效（stamp='${STAMP}'，期望 '${TAG}'）"
    docker logs --tail 60 "$NAME" 2>&1 | grep -iE "appdata|liquibase" || true
fi

log "--- 5/5 资源占用 ---"
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' || true

if (( FAILED == 0 )); then
    log "全部检查通过"
else
    log "存在失败项，见上方 FAIL 行"
fi
exit "$FAILED"
