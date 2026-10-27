# APITable 优化执行计划

> **状态说明**：本文是历史执行计划，部分步骤已完成或已调整；
> 当前构建行为以 `packaging/`、`docker-bake.hcl` 和 `.github/workflows/` 中的代码为准。

配套文档：`docs/BUILD_OPTIMIZATION_REVIEW.md`（构建与镜像体积）、`docs/RUNTIME_PERFORMANCE_REVIEW.md`（启动 / 内存 / 流畅度）

本文按**执行顺序**列出每一步。每一步都是可独立提交、可独立回滚的原子改动，完成定义统一为：改动落地 + 验收命令通过 + 回退方式明确。

---

## 使用约定

- 每步一个 commit，commit message 前缀标明步骤号，便于回滚：`perf(step-07): backend runner 换 headless JRE`
- 每步的"验收"都是可复制的命令，数字不达标不进入下一步
- 涉及镜像的步骤，先本地 `docker buildx bake <target> --load --set *.platform=linux/arm64`（或 amd64）验证，再走 CI
- 任何一步失败，`git revert` 该 commit 即可，不依赖后续步骤

---

## 前置确认（不写代码，但决定后续几步的走法）

**P-1 `init-appdata load` 是否幂等**
在测试环境连续启动两次同一版本容器，对比 `apitable_` 库中模板/组件中心相关表的行数与 `update_time`。若第二次行数不变 → `load` 是 upsert，可安全跳过（step-15 成立）。若每次都会重建 → step-15 只能降级为"仅在升级时执行"。

**P-2 `/_next/static` 之外是否还有静态路径依赖**
在容器内 `curl -I http://localhost:3000/web_build/static/chunks/<file>`、`/widget-stage/...`，确认 `/web_build` 是否真的 404。若 404，step-22 可安全删除该 location。

**P-3 room-server 是否有运行期 dlopen 的原生模块**
`docker run --rm <room-server镜像> sh -c 'find /app -name "*.node" | head'`。若有，step-10 换 slim 基础镜像前必须确认它们在 glibc 下可加载（slim 与 bookworm 同为 glibc，通常没问题，但 `@parcel/watcher` 这类包要单独确认）。

**P-4 当前 CI 单次全量构建耗时**
记录一次 `force_rebuild=true` 的 workflow 总时长，作为 step-13 的对照基线。

---

## 第一阶段：基线与护栏

### step-01 记录体积基线

改动：新增 `docs/perf-baseline.md`，只记录数字，不改代码。

```bash
docker pull benxianyu/apitable-new:latest
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' | grep -E 'apitable|node|nodepy'
docker run --rm --entrypoint sh benxianyu/apitable-room-server:latest -c 'du -sh /app/* | sort -hr | head'
docker run --rm --entrypoint sh benxianyu/apitable-web-server:latest -c 'du -sh /app/* | sort -hr | head'
```

验收：`docs/perf-baseline.md` 里 8 个镜像的体积、room-server 与 web-server 的 `/app` 构成、构建上下文大小全部有数。

### step-02 写冒烟脚本

改动：新增 `scripts/smoke-test.sh`，后续每步都用它回归。

```bash
#!/usr/bin/env bash
set -euo pipefail
IMG="${1:?image}"
NAME="apitable-smoke-$$"
docker run -d --name "$NAME" -p 18080:80 -v "$PWD/.smoke-data:/apitable" "$IMG"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# 等到健康检查通过，最多 180s
for i in $(seq 1 180); do
  if curl -fs "http://localhost:18080/api/v1/actuator/health" >/dev/null 2>&1; then
    echo "healthy after ${i}s"; break
  fi
  sleep 1
done

curl -fs -o /dev/null -w 'login=%{http_code}\n' http://localhost:18080/login
curl -fs -o /dev/null -w 'static=%{http_code}\n' "http://localhost:18080$(curl -s http://localhost:18080/login | grep -o '/_next/static/[^"]*\.js' | head -1)"
docker exec "$NAME" sh -c 'curl -fs http://127.0.0.1:3333/actuator/health' && echo "room-server=ok"
```

验收：`scripts/smoke-test.sh benxianyu/apitable-new:latest` 输出 `healthy after Ns` + `login=200` + `static=200` + `room-server=ok`。

### step-03 记录启动、内存、首屏三项运行时基线

改动：把数字追加到 `docs/perf-baseline.md`。

```bash
# 启动耗时：上一步脚本输出的 healthy after Ns
# 内存
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'
# 首屏传输量
curl -s http://localhost:18080/login | grep -o '/_next/static/[^"]*' | sort -u | \
  xargs -I{} curl -s -o /dev/null -w '%{size_download} {}\n' http://localhost:18080{}
```

验收：启动秒数、各进程内存、首屏字节数三项有明确基线值（当前已知：启动 81s、CSS gzip 323KB、最大 chunk gzip 256KB）。

---

## 第二阶段：构建上下文与轻量镜像（低风险，先做）

### step-04 补齐 `.dockerignore`

改动：`/.dockerignore` 追加：

```dockerignore
docs
**/*.md
!packaging/**/*.md
deleted_features_audit.md
**/build
**/.gradle
**/coverage
**/tsconfig.tsbuildinfo
**/.nx
**/.turbo
.workbuddy
.env
.env.*
!.env.example
```

验收：

```bash
docker buildx build -f packaging/Dockerfile.web-server . --progress=plain --target deps 2>&1 | grep -i "transferring context"
```

预期：从 ≈800 MB 降到 ≈80 MB。若报"找不到文件"，检查是否误伤了构建需要的目录（`**/build` 只匹配名为 build 的目录，仓库内无源码目录同名）。

回退：`git revert`。

### step-05 pm2 安装移出运行阶段

改动：`packaging/Dockerfile.room-server` 的 builder 阶段加一行，runner 阶段的 `npm install -g pm2` 删除，改为 COPY。

```dockerfile
# builder 阶段末尾
RUN npm install -g pm2@5.4.3 --no-audit --no-fund

# runner 阶段
COPY --from=builder /usr/local/lib/node_modules/pm2 /usr/local/lib/node_modules/pm2
RUN ln -sf ../lib/node_modules/pm2/bin/pm2-runtime /usr/local/bin/pm2-runtime \
 && ln -sf ../lib/node_modules/pm2/bin/pm2 /usr/local/bin/pm2
```

验收：`docker run --rm <img> pm2-runtime --version` 输出 `5.4.3`；构建日志中不再出现 npm 下载。

回退：恢复原 `RUN npm install pm2@5.4.3 --global`。

### step-06 web-server 运行阶段换纯 Node 镜像

改动：`packaging/Dockerfile.web-server`

1. 新增 `ARG NODE_RUNTIME_IMAGE=node` / `ARG NODE_RUNTIME_TAG=22.22.2-alpine`，runner 阶段改用它。
2. 删除 runner 里 `pnpm-workspace.yaml` / `package.json` / `pnpm-lock.yaml` 的 COPY（约 1.4 MB，运行时不读）。
3. 在 **builder** 阶段加 `ENV NEXT_TELEMETRY_DISABLED=1`（当前只在 runner 设置）。
4. `docker-bake.hcl` 的 `web-server` target 增加这两个变量，workflow 的 `extra_args` 同步。

验收：

```bash
docker images | grep web-server     # 预期 643MB → ≈250MB
bash scripts/smoke-test.sh benxianyu/apitable-web-server:test   # login=200 static=200
```

回退：worker 阶段改回 `NODEPY_BASE_IMAGE`。

### step-07 backend 运行阶段换 headless JRE

改动：`packaging/Dockerfile.backend-server` 第三个阶段 `FROM amazoncorretto:17-al2023` → `amazoncorretto:17-al2023-headless`。

验收：镜像体积减少 ≥150 MB；容器内 `java -version` 正常；`scripts/smoke-test.sh` 走一遍 backend 相关接口（`/api/v1/actuator/health`）。

回退：改回 `al2023`。若日后引入 `java.awt` 相关导出，必须回退。

### step-08 init-db 与 openresty 换 alpine 变体

改动：
- `init-db/Dockerfile`：`liquibase/liquibase:4.21.1` → `liquibase/liquibase:4.21.1-alpine`
- `packaging/Dockerfile.openresty`：`openresty/openresty:1.21.4.1-4-buster-fat` → 同期 alpine 变体

验收：

```bash
docker run --rm benxianyu/apitable-init-db:test sh -c 'liquibase --version'   # 4.21.1
docker compose run --rm init-db                                               # 能跑完 update
```

回退：改回原 tag。注意 `lpm add mysql` 在 alpine 下首次构建需联网，CI 已有网络。

### step-09 修复 bake 多平台与 `--load` 冲突

改动：
- `docker-bake.hcl`：把 `platforms` 从各 target 移除，改为在 `Makefile` 里按需传入。
- `Makefile`：`build-docker` 与 `buildpush-docker` 显式指定平台与 target。

```makefile
PLATFORM ?= linux/$(shell uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')

build-docker:
	$(BUILDER) $(or $(target),default) --load --set '*.platform=$(PLATFORM)'
```

验收：`make build-docker target=web-server` 在本机成功产出单平台镜像（此前会报 manifest list 不支持）。

回退：恢复 bake 里的 `platforms`。

### step-10 room-server 三阶段重写（最大改动）

改动：`packaging/Dockerfile.room-server` 重写为 `deps → builder → prod-deps → runner` 四段。

关键点：
1. 新增 `prod-deps` 阶段，只装生产依赖：`pnpm install --prod --frozen-lockfile --filter @apitable/room-server --filter root`。
2. runner 阶段改用 `node:22.22.2-bookworm-slim`（新增 `NODE_RUNTIME_IMAGE` / `NODE_RUNTIME_TAG` 变量，`docker-bake.hcl` 与 workflow 同步）。
3. 删除 builder 阶段的第二次 `pnpm install`（`KEEP_DEV_DEP` 那段），它是历史上 canvas-shim 缺失导致发版失败的根源。
4. 删除 `COPY --from=builder /app /app` 与 `RUN rm -fr packages/*/src`，改为精确拷贝：`node_modules`（来自 prod-deps）、`room-server/dist`、`core/dist`、`i18n-lang/dist`、`i18n-lang/src/config`、`databus-wasm-nodejs`、`app-config.json`、`ecosystem.config.js`、`package.json`。
5. 保留 `EXPOSE` 端口列表。

验收：

```bash
docker images | grep room-server                  # 预期 ≈1.6GB → ≈450MB
docker run --rm <img> ls packages/room-server/dist/main.js
bash scripts/smoke-test.sh benxianyu/apitable-room-server:test   # room-server=ok
```

额外验证：容器内 `node -e "require('./packages/room-server/dist/main.js')"` 若报缺模块，按报错补 COPY 项。

回退：`git revert` 该 commit，恢复 `COPY /app`。这一步是唯一需要完整回归的镜像改动，建议单独发一个 tag 验证。

### step-11 同步组件指纹脚本

改动：`scripts/detect-changed-components.sh` 的 `room-server` 输入里加入 `NODE_RUNTIME_TAG` 的语义说明（脚本按文件路径比对，基础镜像 tag 变更靠 `docker-bake.hcl` 内容变化触发），并在 `ROOT_INPUTS` 里补 `packaging/Dockerfile.node-base`。

验收：

```bash
scripts/detect-changed-components.sh v1.16.0 HEAD    # 改动 Dockerfile.room-server 后应含 room-server
```

回退：无风险。

### step-12 Gradle 分层与 build cache

改动：`packaging/Dockerfile.backend-server`

1. 拆成"先拷构建脚本预热依赖 → 再拷源码编译"两段（先 `gradlew help`，再 `bootJar`）。
2. `backend-server/gradle.properties` 增加 `org.gradle.caching=true`、`org.gradle.parallel=true`。
3. 运行阶段用 `java -Djarmode=layertools` 解包，分层 COPY（`dependencies` / `spring-boot-loader` / `snapshot-dependencies` / `application`）。

验收：

```bash
# 只改一个 java 文件后重建，观察命中缓存的层
docker buildx bake backend-server --progress=plain 2>&1 | grep -E "CACHED|bootJar"
```

预期：依赖解析步骤 CACHED；推送时只有 `application` 层变化（≈5 MB）。

回退：`configuration-cache` 若与插件冲突，只回退该行，其余保留。

### step-13 CI 缓存策略调整

改动：`.github/workflows/dockerhub-all-in-one.yml`

1. `web-server`、`room-server` 的 `cache-to` 从 `mode=max` 改为 `mode=min`（或 `type=registry,ref=<image>:buildcache`）。
2. 所有 `cache-to` 加 `ignore-error=true`。
3. `backend-server` 保留 `mode=max`。

验收：连续两次 `force_rebuild=true`，第二次的 `Build and push` 步骤耗时下降，且 GHA 缓存用量不撞 10 GB 上限。

回退：恢复 `mode=max`。

---

## 第三阶段：启动耗时

### step-14 启动脚本加"只在需要时初始化"的骨架

改动：`packaging/all-in-one/all-in-one/script/init-appdata.sh`，先把两段逻辑拆成函数，不改行为（纯重构，便于下一步最小化 diff）。

```bash
run_liquibase() { ... }        # 原 clearChecksums + update
run_appdata() { ... }          # 原 for action in init-user load
run_liquibase
run_appdata
```

验收：启动日志与改动前一致，`load` 仍然执行，耗时不变。

回退：`git revert`。

### step-15 `load` 加版本 stamp 门控

改动：同上文件。

```bash
STAMP=/apitable/.appdata-stamp
if [[ "${FORCE_APPDATA_RELOAD:-}" == "true" ]] \
   || [[ ! -f "${STAMP}" ]] \
   || [[ "$(cat "${STAMP}")" != "${SEMVER_FULL}" ]]; then
    run_appdata
    echo "${SEMVER_FULL}" > "${STAMP}"
else
    echo "appdata already loaded for ${SEMVER_FULL}, skip"
fi
```

验收：同一镜像连续 `docker restart` 两次，第二次日志出现 `skip`，`healthy after` 秒数下降 ≥20 s。

回退：删除 stamp 判断即可恢复原行为；`FORCE_APPDATA_RELOAD=true` 可临时强制重跑。

### step-16 Liquibase 从"每次清校验和"改为"失败后补偿"

改动：同文件 `run_liquibase()`。

```bash
if ! liquibase ... update; then
    echo "update failed, retry after clearChecksums" >&2
    liquibase ... clearChecksums
    liquibase ... update
fi
```

验收：无新 changeset 时启动日志不再出现 `clearChecksums`，启动再降 4–6 s；人为改一个 changelog 的 checksum 后启动，应能在第二次重试中恢复。

回退：恢复"先 clearChecksums 再 update"。

### step-17 合并两个 appdata JVM

改动：先确认 P-1；若 `init-appdata` 支持多 action，改为一次调用：

```bash
java -jar /app/init-appdata/init-appdata.jar init-user load
```

若镜像不支持多参数，则本步跳过，并在 `docs/RUNTIME_PERFORMANCE_REVIEW.md` 标注"需上游支持"。

验收：启动日志只有一个 `AppDataApplication` PID；启动再降 ≈5 s。

回退：恢复 `for action in init-user load`。

### step-18 启动编排解耦

改动：
1. `packaging/all-in-one/all-in-one/ecosystem.config.js`：给 mysql/redis/rabbitmq/minio 的 `script` 前加 `nice -n 10`。
2. `gateway` 的就绪探测从 `curl .../favicon.ico` 改为 `curl -fs http://backend-server:8081/api/v1/actuator/health`（web-server 侧保留 `/login` 探测）。
3. `packaging/Dockerfile` 的 `CMD`：把 `init-dataenv.sh` 从"串行阻塞"改为"后台执行 + 由 mysql 就绪探测兜底"，或将首次初始化与 `pm2-runtime` 并行（需确认 mysql `--initialize` 与连接建立的时序安全）。

验收：4 核以下机器上启动再降 3–5 s；`docker logs` 中 `Available IP Pools` 类噪音减少。

回退：单条配置回退即可，第 3 点风险最高，可先不做。

### step-19 AppCDS（可选）

改动：`.github/workflows/dockerhub-all-in-one.yml` 的 backend job 增加 service containers（mysql/redis/rabbitmq），构建阶段生成归档：

```dockerfile
RUN java -XX:ArchiveClassesAtExit=/app/app.jsa -Dspring.context.exit=onRefresh -jar /app/app.jar || true
ENTRYPOINT ["java","-XX:SharedArchiveFile=/app/app.jsa", ..., "-jar","/app/app.jar"]
```

验收：启动日志 `Started Application in N seconds` 从 29.4 降到 ≤22。

回退：删除 `-XX:SharedArchiveFile` 参数，归档文件留着无害。

---

## 第四阶段：运行时内存

### step-20 JVM 内存参数

改动：`packaging/all-in-one/all-in-one/ecosystem.config.js` 的 backend 启动命令 + `docker-compose.yaml` 的 backend 环境变量。

```
-XX:MaxRAMPercentage=50 -XX:InitialRAMPercentage=20
-XX:MaxMetaspaceSize=256m -XX:ReservedCodeCacheSize=128m
-Xss512k -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError
```

验收：`docker exec <c> jcmd 1 VM.flags | grep -E 'MaxHeapSize|MaxRAMPercentage'`；`docker stats` 中 backend 常驻内存有明确上限。

回退：删除参数即回到默认（25% 宿主内存）。

### step-21 Node 堆参数

改动：
- all-in-one：room-server 的启动脚本前加 `NODE_OPTIONS=--max-old-space-size=1536 --max-semi-space-size=64 --max-http-header-size=80000`；web-server 加 `--max-old-space-size=1024`。
- compose：`INSTANCE_MAX_MEMORY` 从 `4096M` 调整为与实例数匹配（单实例 1536M）。

验收：`docker exec <c> node -e 'console.log(require("v8").getHeapStatistics().heap_size_limit/1048576)'` 输出接近设定值。

回退：删除环境变量。

### step-22 MySQL / Redis 参数

改动：
- `packaging/all-in-one/dataenv-pm2/conf/my.cnf` 的 `[mysqld]` 段：`innodb_buffer_pool_size=512M`、`innodb_flush_method=O_DIRECT`、`innodb_redo_log_capacity=512M`。
- redis 启动命令（`ecosystem.config.js` 与 compose）加 `--maxmemory 384mb --maxmemory-policy noeviction`。

验收：`SHOW VARIABLES LIKE 'innodb_buffer_pool_size'` = 536870912；`redis-cli config get maxmemory` 生效；大表格首屏 TTFB 有改善。

回退：改回默认值。**注意不要用 `allkeys-lru`**，会淘汰 bull 队列数据。

### step-23 compose 资源限制与 pm2 托管对齐

改动：
- `docker-compose.yaml` 每个服务加 `deploy.resources.limits.memory`（backend 2G、room-server 2G、web-server 1G、mysql 1G、redis 512M、rabbitmq 512M），让 `MaxRAMPercentage` 有准确基准。
- all-in-one 的 room-server 改由 `pm2-runtime packages/room-server/ecosystem.config.js` 托管（`INSTANCE_COUNT` 默认 `min(2, nproc)`），或删除 `ecosystem.config.js` 里失效的 `max_memory_restart`。

验收：`docker stats` 各项不超限；`pm2 list` 能看到 room-server 实例数。

回退：恢复 `node ./dist/main.js`。

---

## 第五阶段：流畅度

### step-24 网关静态资源缓存

改动：`gateway/conf.d/server/web-server.conf`

```nginx
location ~* ^/_next/static/ {
    proxy_pass http://web-server;
    proxy_cache cache_one;
    proxy_cache_valid 200 365d;
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header X-Cache-Status $upstream_cache_status;
    access_log off;
}

location ~* ^/_next/(?!static/) {
    proxy_pass http://web-server;
    add_header Cache-Control "no-store";
}
```

同时 `gateway/conf.d/default.conf` 的 `gzip_types` 补 `image/svg+xml application/xml font/woff2`。

验收：

```bash
for i in 1 2; do curl -sI http://localhost/_next/static/chunks/<file> | grep -i -E 'x-cache-status|cache-control'; done
```

第二次应为 `HIT`，`Cache-Control` 含 `immutable`。

回退：恢复原 `location /_next`。

### step-25 清理无效 location

改动：确认 P-2 后，删除 `/web_build`、`/widget-stage` 两条 location；若实际有流量，改为指向正确路径并保留缓存。

验收：`grep -r "web_build" gateway/` 只剩预期引用；`nginx -t` 通过。

回退：恢复配置片段。

### step-26 前端剥离自托管用不到的 SDK

改动：`packages/datasheet/pages/_app.tsx` + `packages/datasheet/next.config.js`

1. `posthog` 改为条件加载：`NEXT_PUBLIC_POSTHOG_KEY` 存在时 `await import('posthog-js')`，`PostHogProvider` 同步改为条件渲染。
2. `@sentry/nextjs` 在 `IS_SELFHOST` 且无 DSN 时用 webpack `NormalModuleReplacementPlugin` 替换为空模块。

验收：

```bash
ANALYZE=true pnpm build:dst     # 对比主包体积
grep -rl "posthog" packages/datasheet/web_build/static/chunks | wc -l
```

未配置 key 时主包不应包含 posthog 实现。

回退：恢复静态 import。

### step-27 生产构建剥离 console

改动：`packages/datasheet/next.config.js` 增加 `compiler: { removeConsole: process.env.NODE_ENV === 'production' }`（Next 12.1+ 支持布尔值）。

验收：构建后 `grep -c "console.log" packages/datasheet/web_build/static/chunks/*.js` 显著下降。

回退：删除该配置。

### step-28 CSS 拆分

改动：`packages/datasheet` 的样式引入方式，按页面拆 less；`babel` 配置里 antd 的 `style: true`（引入 less 源）评估改为 `style: 'css'`（引入编译后 css，体积更小，但会失去主题变量能力）。

验收：`ls -S web_build/static/css/*.css | head -1` 的首个文件体积下降；`/login` 首屏 CSS 传输量下降。

回退：恢复原样式引入。本步收益不确定，建议先用 step-26/27 的收益决定是否继续。

### step-29 定位并拆最大 chunk

改动：先只做分析，不直接改代码。

```bash
ANALYZE=true pnpm build:dst
```

根据报告对 1.1 MB 的 chunk 做动态 `import()`（候选：rjsf、tiptap、recharts、konva、exceljs）。

验收：最大 chunk < 700 KB（原始）。

回退：逐条 import 改动独立提交。

### step-30 room-server 多实例（仅 AIO）

改动：同 step-23 的 pm2 托管，配置 `exec_mode: 'cluster'`、`instances: INSTANCE_COUNT`。

验收：`pm2 list` 多实例在线；10 并发 socket 压测延迟下降。

回退：单进程。

---

## 第六阶段：可复现性与收尾

### step-31 dataenv 版本锁定

改动：`packaging/all-in-one/dataenv-pm2/Dockerfile`

1. 去掉 `microdnf -y update`（基础镜像已固定 digest）。
2. `rabbitmq-server`、`erlang`、`redis`、`mysql-community-server-minimal`、`openresty` 全部固定到具体版本号（版本取自当前可用的稳定版，日志实测已是 RabbitMQ 4.3.1 / Erlang 27.3.4.11）。
3. 构建末尾输出 `rpm -qa | sort > /sbom/rpms.txt`。

验收：连续两次构建的 `docker images --digests` 与 `rpm -qa` 输出一致。

回退：恢复未固定版本。注意这是一次行为变更，需完整回归（尤其 quorum queue）。

### step-32 非 root 与健康检查

改动：
- room-server / backend runner 阶段 `USER node` / `USER 1000`（需同步 `chown`）。
- 各镜像加 `HEALTHCHECK`（backend `/api/v1/actuator/health`、room `/actuator/health`、web `/login`）。

验收：`docker inspect <img> --format '{{.Config.User}} {{.Config.Healthcheck}}'`。

回退：删除 `USER` 行。

### step-33 文档与发布

改动：
- 更新 `docs/perf-baseline.md` 的"优化后"列。
- `CHANGELOG.md` 增加本次优化条目。
- 打 tag 走一次完整发布，用 `scripts/smoke-test.sh` 验证线上镜像。

验收：最终数字对照表（镜像体积、启动、内存、首屏）全部填写完成，且 `smoke-test` 通过。

---

## 步骤依赖图（谁必须在谁之后）

```
step-01/02/03（基线）
        │
        ├── step-04（.dockerignore）────────────┐
        ├── step-05（pm2）                       │
        ├── step-06（web-server）                │
        ├── step-07（backend JRE）               │
        ├── step-08（init-db/openresty）         │
        ├── step-09（bake/--load）               │
        └── step-10（room-server）── step-11 ────┤
                                                 ├── step-13（CI 缓存）
                        step-12（Gradle 分层）───┘
        │
        ├── step-14 → step-15 → step-16 → step-17（启动）
        │        └── step-18 → step-19（编排 / CDS）
        │
        ├── step-20 → step-21 → step-22 → step-23（内存）
        │
        └── step-24 → step-25（网关）
                 step-26 → step-27 → step-28 → step-29（前端）
                 step-30（多实例，依赖 step-23）
                        │
                   step-31 → step-32 → step-33（收尾）
```

不可并行的硬依赖只有四处：
- step-10 之前必须先完成 step-04（否则上下文太大，镜像验证慢）
- step-23 之前必须先完成 step-20/21（否则资源限制与堆参数互相打架）
- step-30 依赖 step-23 的 pm2 托管
- step-33 必须最后
