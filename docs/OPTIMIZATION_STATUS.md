# 优化落地状态

日期：2026-10-26
配套：`docs/BUILD_OPTIMIZATION_REVIEW.md`、`docs/RUNTIME_PERFORMANCE_REVIEW.md`、`docs/OPTIMIZATION_PLAN.md`

## 交付状态（v1.17.0）

- 分支 `self-hosted-enterprise`，commit `cb0515cb1`，标签 `v1.17.0`
- 版本号：`.version`、13 个 `package.json`、`backend-server/.version`、`init-db/.version`、`.bumpversion.cfg` 全部为 `1.17.0`
- 本次落地后追加修复的两个缺陷（在离线验证阶段发现）：
  1. `node-fetch` 声明在 `devDependencies`，但 automation 的 webhook / slack / ruliu 与 `automation.service` 在运行时 `require('node-fetch')`。原先镜像安装全量依赖时不会暴露，一旦按生产依赖安装就会缺包 → 已移到 `dependencies` 并同步 lockfile。
  2. `docker-compose.unit-test.yaml` 以 `target: builder` 构建并传入 `KEEP_DEV_DEP=1`，若删除该 ARG 会产生构建告警 → 已保留声明（无实际作用）。

离线验证结论见文末"v1.17.0 验证记录"。

---

本次改动共 **19 个文件**，全部可在仓库内独立回滚（`git revert` 单个 commit 即可）。下面先列已落地的，再列没改的以及为什么没改。

---

## 一、已落地

### A. 构建上下文

| 文件 | 改动 | 预期收益 |
|---|---|---|
| `.dockerignore` | 补 `docs`、`**/*.md`、`**/build`、`**/.gradle`、`**/dist`、`**/coverage`、根 `.env`、`.workbuddy`；去掉文件头 BOM | 构建上下文 **≈800 MB → ≈170 MB**（`docs` 339 MB、`backend-server/application/build` 229 MB、`code-coverage-report/build` 43 MB 全部移出）。同时防止宿主机的旧 `dist` 混进构建（历史上"core dist 过期导致 tsc 报错"就是这类问题） |

说明：`.env` 用 `/.env` 根路径写法，避免误伤 `packages/datasheet/.env`（web-server 构建要用它做 `NEXT_PUBLIC_*` 内联）。

### B. 镜像体积

| 文件 | 改动 | 预期收益 |
|---|---|---|
| `packaging/Dockerfile.room-server` | 拆成 `deps → prod-deps → builder → runner` 四阶段；runner 从 `apitable-node`（1.16 GB）换成 `node:22.22.2-bookworm-slim`；只拷 `dist` + 生产依赖 + workspace 包；删除 `COPY /app` 与同层 `rm -fr packages/*/src`；删除构建期那次重复 `pnpm install`；pm2 改为构建期安装后 `COPY` | **≈1.6 GB → ≈450 MB**；同时去掉历史上导致发版失败的第二次 `pnpm install`（canvas-shim 不在该阶段上下文里时必崩） |
| `packaging/Dockerfile.web-server` | runner 从 `apitable-nodepy`（489 MB）换成 `node:22.22.2-alpine`（60 MB）；删除 runner 里的 `pnpm-lock.yaml`/`package.json` 拷贝；`NEXT_TELEMETRY_DISABLED` 提前到 builder；deps 阶段加 pnpm store 缓存挂载 | **643 MB → ≈250 MB** |
| `packaging/Dockerfile.backend-server` | 运行镜像 `amazoncorretto:17-al2023` → `17-al2023-headless`；Gradle 双缓存挂载（`/root/.gradle` + `/app/.gradle`）；JVM 内存参数写进 `ENTRYPOINT` | **≈650 MB → ≈420 MB**；重复构建时依赖解析走缓存 |
| `init-db/Dockerfile` | `liquibase:4.21.1` → `4.21.1-alpine` | **≈600 MB → ≈300 MB**（官方自 4.21 起提供 alpine 变体） |
| `packaging/Dockerfile.openresty` | `buster-fat` → `1.21.4.1-4-alpine` | **≈380 MB → ≈120 MB** |

### C. 构建流程

| 文件 | 改动 | 预期收益 |
|---|---|---|
| `docker-bake.hcl` | 新增 `NODE_RUNTIME_IMAGE` / `NODE_RUNTIME_TAG` / `NODE_RUNTIME_TAG_ALPINE` / `PLATFORMS` 变量；room-server、web-server 传入 runtime 参数 | runner 与 builder 的基础镜像解耦，后续换运行时可独立升级 |
| `Makefile` | 新增 `PLATFORM`（按 `uname -m` 推导）；`build-docker` 用 `--set '*.platform=$(PLATFORM)'`；`$(target)` 为空时回落到 `default` 组 | 修复 `buildx bake --load` 与多平台清单冲突导致本地构建失败的问题 |
| `.github/workflows/dockerhub-all-in-one.yml` | 组件矩阵补 runtime 参数；缓存策略分档：`backend-server` 保留 `mode=max`，其余改 `mode=min` 并加 `ignore-error=true` | 避免 web/room 每次导出 ~3 GB（node_modules + webpack 缓存）把 10 GB 的 GHA 缓存池挤爆 |
| `scripts/detect-changed-components.sh` | room-server / web-server 的指纹加入 `Dockerfile.node-base` / `Dockerfile.nodepy-base`；backend-server 加入 `docker-bake.hcl` | 基础镜像或 bake 参数变化时不会再错误复用旧镜像 |
| `backend-server/gradle.properties` | `org.gradle.caching` false → true | 配合缓存挂载，源码小改动时复用编译产物 |

### D. 启动耗时

| 文件 | 改动 | 预期收益 |
|---|---|---|
| `packaging/all-in-one/all-in-one/script/init-appdata.sh` | ① `load` 用 `SEMVER_FULL` 作版本戳（`/apitable/.appdata-stamp`）跳过，支持 `FORCE_APPDATA_RELOAD=true` 强制重跑；② `clearChecksums` 从"每次前置"改成"`update` 失败后的补偿"；③ 修掉 `-Dtable.prefix="${...}` 缺右引号的 bug（原来 `-DDB_ENGINE` 被吞进同一个参数，从未真正传给 liquibase） | 冷启动 **81 s → ≈45 s**（`load` −24 s、liquibase −4~6 s） |
| `packaging/all-in-one/dataenv-pm2/script/init-dataenv.sh` | 重建 MySQL 数据目录时 `rm -f /apitable/.appdata-stamp` | 空库重建后内置数据仍会重新导入，不会因为残留 stamp 而跳过 |
| `packaging/all-in-one/all-in-one/ecosystem.config.js` | minio/mysql/rabbitmq/redis 加 `nice -n 10`；backend 加 JVM 内存参数；room-server/web-server 加 `NODE_OPTIONS` 堆上限；redis 加 `--maxmemory 384mb --maxmemory-policy noeviction` | 启动时 JVM/Node 优先拿到 CPU；内存从"随宿主无限扩张"变为可预测 |

### E. 内存与流畅度

| 文件 | 改动 | 预期收益 |
|---|---|---|
| `packaging/all-in-one/dataenv-pm2/conf/my.cnf` | `innodb_buffer_pool_size=512M`、`innodb_redo_log_capacity=512M`（8.0.30+ 已弃用 `innodb_log_file_size`） | 大表格查询不再频繁穿透到磁盘 |
| `docker-compose.yaml` | 12 个服务补 `mem_limit`，全部可用 `.env` 覆盖（`*_MEM_LIMIT`）；room-server 补 `NODE_OPTIONS` 堆上限、`INSTANCE_COUNT=2`、`INSTANCE_MAX_MEMORY=1280M`；web-server 补 `NODE_OPTIONS`；redis 补 `--maxmemory 768mb --maxmemory-policy noeviction` | JVM 的 `MaxRAMPercentage` 有准确基准；Node 不会用默认 4G 堆撞穿容器上限；Redis 先自己拒绝写入而不是被内核 OOM kill |
| `gateway/conf.d/server/web-server.conf` | 新增 `location ^~ /_next/static/`（`proxy_cache` + `max-age=31536000, immutable` + `X-Cache-Status`），其余 `/_next/` 明确 `no-store` | 静态资源不再逐次穿透到单进程 Node，多人同时打开表格时的卡顿主要来源 |
| `gateway/conf.d/default.conf` | `gzip_types` 补 `image/svg+xml`、`application/xml`、`application/wasm` | 图标与 wasm 也开始压缩 |
| `packages/datasheet/next.config.js` | `compiler.removeConsole`（生产构建剔除 `console.*`，保留 error/warn） | 减少渲染热路径上的日志开销；已确认 Next 12.3.4 的 schema 支持该配置 |

### 已落地的行为变更（需要知晓）

1. **启动时不再每次都导入内置数据**。同一版本重启会打印 `built-in application data already loaded for <version>, skipping`。
2. **Liquibase 不再每次清校验和**，只在 `update` 失败后补偿。人为改动历史 changeset 时，第一次启动会多花一次重试。
3. **`-DDB_ENGINE` 现在真正传给 liquibase**（此前的引号 bug 让它从未生效，默认值恰好也是 mysql 才没暴露）。
4. **`/$_next/static` 长缓存**：升级后浏览器仍可能持有旧构建的哈希文件，但文件名含 buildId，不会串版本。
5. **compose 内存上限**：`mem_limit` 是上限而非预占，默认值之和约 12.75 G，但实测常驻 3–5 G。全部可用 `.env` 覆盖（`BACKEND_MEM_LIMIT`、`ROOM_SERVER_MEM_LIMIT`、`WEB_SERVER_MEM_LIMIT`、`REDIS_MEM_LIMIT`、`REDIS_MAXMEMORY`、`ROOM_SERVER_NODE_OLD_SPACE` 等）。4 G 宿主机建议把 backend/room 降到 2g 并把 `ROOM_SERVER_INSTANCES=1`；推荐 8 G 以上。

### 内存上限的影响边界（补充说明）

- **不影响性能**：`mem_limit` 只是 cgroup 的 memory.max，不改变 CPU 配额、不限制 IO，也不预留内存。服务用不到上限时，行为与不设限完全一致。
- **唯一风险是触顶**：超过上限时内核发 OOM kill，容器按 `restart: always` 重启，表现为"偶发重启/请求 502"。所以上限必须高于"服务自己的堆上限 + 堆外内存"，这也是这次同时设置 `-XX:MaxRAMPercentage=50`、`--max-old-space-size`、`--maxmemory` 的原因——让进程在被内核杀之前先自己收敛。
- **需要监控的信号**：`docker stats` 里 RSS/limit 长期 > 80% 就该调高；JVM 侧配合 `-XX:+ExitOnOutOfMemoryError` 会主动退出而不是僵死。
- **宿主机不足时的表现**：多个容器同时逼近各自上限，但宿主机物理内存不够时，内核仍会挑一个进程杀。上限不解决"机器太小"的问题，只解决"单个服务失控"的问题。

---

## 二、尚未修改

### 1. 需要构建/运行验证才能安全落地（本地拿不到镜像仓库，无法实测）

| 项 | 为什么没做 |
|---|---|
| Spring Boot 分层 jar（`layertools`） | 分层后镜像里不再有 `app.jar`，all-in-one 的 `java -jar app.jar` 必须同步改成 `JarLauncher`。类名/布局错一个字符 backend 就起不来，而这条链路只能靠真实构建验证。收益也仅是"增量推拉更小"，不改变镜像体积 |
| Next 构建缓存挂载到 `web_build/cache` | `packages/datasheet/package.json` 的 `build` 脚本是 `rm -rf ./web_build && next build`，缓存目录正好在 `web_build` 里，会被自己删掉。要先把缓存目录移出 distDir 才能挂 |
| all-in-one 里 room-server 多实例 | 涉及 `@nestjs/schedule` 定时任务在多实例下是否重复执行（自动化任务），需要压测确认幂等 |
| 非 root 运行 + HEALTHCHECK | pm2 要在 `~/.pm2` 落盘、日志路径与 `chown` 需实测；runner 里没有 `curl`，healthcheck 得自己写或装 |

### 2. 需要改 lockfile / 依赖

| 项 | 为什么没做 |
|---|---|
| 移除未使用的 `moment`（源码 0 引用，已用 dayjs） | 要重算 `pnpm-lock.yaml`，而本地无法稳定执行全量 `pnpm install`（会牵连 4000+ 包） |
| 统一 pnpm 版本（`packageManager` 8.6.12 / 镜像 8.13.1 / CI 8.7.5） | 换版本会触发 `node_modules` 重装与 lockfile 重写，属于独立任务 |
| 锁文件里的 `registry.npmmirror.com` 地址 | 现在靠 web-server 构建期 `sed` 改写，要彻底解决需换公共 registry 重新生成 lockfile |
| 自托管构建剥离 `posthog-js` / `@sentry/nextjs` | 简单 alias 成空模块会让 `PostHogProvider` 变成 `undefined` 组件，`IS_SELFHOST=false` 且无 key 的构建会直接崩。需要按 edition 做条件打包，属于产品决策 |

### 3. 需要业务/产品回归

| 项 | 为什么没做 |
|---|---|
| CSS 3.5 MB 单文件拆分、antd `style: 'css'` | 会影响 less 变量与主题能力，必须视觉回归 |
| 1.1 MB chunk 拆包 | 要先跑 `ANALYZE=true pnpm build:dst` 拿到报告定位构成，盲拆风险高 |
| dataenv 版本锁定（RabbitMQ 4.3.1 / Erlang 27 / MySQL 8.0.37 / Redis 6.2 / Openresty） | 需要先确认目标版本可用，再完整回归 quorum queue 与 liquibase |
| 构建基础镜像瘦身（`node:22-bookworm` 是 buildpack-deps，1.16 GB） | 要重建 `apitable-node` 并 bump `NODE_BASE_TAG`，会改变发布顺序（先推分支触发 base-images，再推 tag），收益也只落在 CI |

### 4. 收益/风险不对等，暂缓

| 项 | 说明 |
|---|---|
| AIO 里清理 `/usr/share/doc`、`/usr/share/locale`、mysql test suite | 约 30–50 MB，但 locale 清理有概率影响 mysqld 的字符集/locale 行为 |
| `docs/` 339 MB 从 Git 迁出（LFS 或独立文档站） | 属于仓库治理，影响所有协作者，不适合夹在优化里做 |
| 把 `.env` 打进镜像的问题 | 目前 `.env` 不进镜像（Dockerfile 显式 COPY），只是会进构建上下文，已经用 `.dockerignore` 挡住 |

---

## 三、上线前验证清单（按风险从高到低）

1. **语法/静态检查（已在本机通过）**
   - `docker buildx bake --print`（HCL 可解析，room-server 的 runtime 参数已注入）
   - `bash -n` 两个启动脚本
   - `docker compose config --quiet`（mem_limit 生效）
   - `js-yaml` 解析 workflow 与 compose
   - `node -e "require('./packaging/all-in-one/all-in-one/ecosystem.config.js')"`

2. **先单独构建 room-server**（改动最大）
   ```bash
   docker buildx bake room-server --load --set '*.platform=linux/arm64'
   docker run --rm --entrypoint sh <img> -c 'ls packages/room-server/dist/main.js && du -sh /app'
   ```
   若启动报 `Cannot find module`，按报错补 `COPY --from=builder` 的路径；这一步是唯一需要人工兜底的。

3. **再构建 backend / web-server / init-db / openresty**，逐个比对体积是否达到预期。

4. **起全部服务冒烟**
   ```bash
   docker run -d --name apitable-test -p 8080:80 -v "$PWD/.data:/apitable" <all-in-one>
   curl -fs http://localhost:8080/api/v1/actuator/health
   curl -fs -o /dev/null -w '%{http_code}\n' http://localhost:8080/login
   ```

5. **验证启动优化生效**
   - 第一次启动：日志应出现 liquibase `update` 与 `load`
   - `docker restart`：日志应出现 `built-in application data already loaded for <version>, skipping`
   - 对比两次 `healthy after Ns`

6. **验证静态缓存**
   ```bash
   for i in 1 2; do curl -sI http://localhost:8080/_next/static/chunks/<file> | grep -i x-cache-status; done
   ```
   第二次应为 `HIT`。

7. **验证内存**
   ```bash
   docker stats --no-stream
   docker exec apitable-test jcmd <pid> VM.flags | grep -E 'MaxHeapSize|MaxRAMPercentage'
   ```

---

## 四、预期效果汇总

| 指标 | 改动前 | 改动后（预期） |
|---|---|---|
| room-server 镜像 | ≈1.6 GB | ≈450 MB |
| web-server 镜像 | 643 MB | ≈250 MB |
| backend-server 镜像 | ≈650 MB | ≈420 MB |
| init-db 镜像 | ≈600 MB | ≈300 MB |
| openresty 镜像 | ≈380 MB | ≈120 MB |
| 构建上下文 | ≈800 MB | ≈170 MB |
| 冷启动 | 81 s | ≈45 s（稳态重启 ≈30 s） |
| all-in-one 常驻内存 | 不可预测（峰值 6–8 GB） | ≈2.5–3 GB |
| 首屏静态资源 | 每次都回源 Node | nginx 命中，`immutable` 长缓存 |

---

## v1.17.0 验证记录（已发布并端到端验证）

流水线：`构建并发布 APITable 自托管镜像` run 40308100018（全部 job 成功）+ `镜像冒烟测试` run 40310187039（全部通过）。

### 实测数据

| 指标 | v1.16.0 | v1.17.0（实测） |
|---|---|---|
| all-in-one 镜像 | — | **2.35 GB** |
| room-server | ≈1.6 GB | **520 MB** |
| web-server | 643 MB | **305 MB** |
| backend-server | ≈650 MB | **577 MB** |
| init-db | ≈600 MB | **292 MB** |
| openresty | ≈380 MB | **87.1 MB** |
| 离线交付包（13 镜像 gzip） | 3601 MB | **3299 MB**（−302 MB） |
| 冷启动（空数据卷） | 81 s | **71 s** |
| 同版本重启 | 不可用（见下） | **36 s** |
| all-in-one 常驻内存 | 不可预测 | **2.35 GiB** |

冒烟脚本输出（`scripts/smoke-test.sh`，GitHub 托管 runner）：

```
--- 1/4 冷启动 ---            健康检查通过，用时 71s
--- 2/4 HTTP 与静态资源 ---    GET /login -> 200
                              GET /_next/static/chunks/polyfills-*.js -> 200
                              静态资源 X-Cache-Status=HIT
--- 3/4 重启后跳过内置数据 --- 重启后健康检查通过，用时 36s
                              版本戳生效：内置数据已跳过
--- 4/4 资源占用 ---           apitable-smoke  2.345GiB / 15.61GiB
```

### 冒烟测试发现并修复的缺陷

**1. 容器重启后 MySQL 拒绝启动（长期缺陷，v1.16.0 同样存在）**

集群一直用 `--lower_case_table_names=2` 启动 mysqld。MySQL 8 规定该值必须与数据字典一致，
而大小写敏感的 Linux 上 `mysqld --initialize` 会把它回落为 0（v1.16.0 首次启动日志里就有
`Now setting lower_case_table_names to 0`）。于是重启时 mysqld 直接退出：

```
[ERROR] [MY-011087] Different lower_case_table_names settings for server ('2') and data dictionary ('0').
[ERROR] [MY-010020] Data Dictionary initialization failed.
```

表现为容器重启后 backend 永远在等 `mysqladmin ping`，健康检查永不通过。修复：三处启动参数去掉该选项，
`my.cnf` 显式写 `lower_case_table_names = 0`，让初始化与每次启动一致。

**2. `node-fetch` 误置于 devDependencies**

automation 的 webhook / slack / ruliu 与 `automation.service` 在模块加载时就 `require('node-fetch')`。
原先镜像装全量依赖所以没暴露，改为按生产依赖安装后会直接缺失。已移到 `dependencies` 并同步 lockfile。

### 发布过程中暴露并修复的构建问题

| 现象 | 原因 | 修复 |
|---|---|---|
| `failed to calculate checksum ... /app/packages/i18n-lang/node_modules: not found` | `@apitable/i18n-lang` 没有 dependencies，`pnpm install --prod` 不会创建该目录，逐包 COPY 不可靠 | 改为整棵 `packages` 目录从 prod-deps 拷贝 |
| 单测镜像构建告警 | 单测 compose 以 `target: builder` + `KEEP_DEV_DEP=1` 构建 | 保留 ARG 声明 |
| `--frozen-lockfile` 潜在失败 | 仓库存在历史 specifier 漂移（eslint） | 生产安装不使用 frozen 校验 |

### 交付物

- 分支 `self-hosted-enterprise`，tag `v1.17.0`（commit `c0dea0ab3`）
- Docker Hub：`benxianyu/apitable-{new,room-server,web-server,backend-server,init-db,openresty,dataenv-pm2,...}` 的 `v1.17.0` / sha / latest
- GitHub Release：`https://github.com/LiangLiang723/apitable-new/releases/tag/v1.17.0`，含离线包 2 分片 + sha256 + OFFLINE-README
- 复用命令：`gh workflow run image-smoke-test.yml -f tag=<版本>` 可对任意已发布镜像重跑冒烟

---

## v1.17.1 收尾（第三优先 5 项）

| 项 | 状态 | 落地内容 | 验证方式 |
|---|---|---|---|
| Spring Boot 分层 jar | 已做 | builder 用 `layertools` 解包，运行镜像分四层拷贝，ENTRYPOINT 改用 `org.springframework.boot.loader.launch.JarLauncher`；all-in-one 的启动命令同步改为 JarLauncher | 冒烟（backend 起不来会直接卡在健康检查） |
| Next 构建缓存 | 已做 | `webpack.config.js` 支持 `NEXT_WEBPACK_CACHE_DIR`，Dockerfile 里指向 BuildKit cache mount。注意：**CI 是临时 runner，cache mount 不跨 job 复用**，收益只在本地重复构建 | 构建日志中 cache 目录不再位于 `web_build` 下 |
| dataenv 版本锁定 | 已做 | 从 v1.17.0 镜像的 `rpm -qa` 实测值钉死：rabbitmq-server 4.3.1、erlang 27.3.4.11、mysql-community-server-minimal 8.0.37、openresty 1.29.2.5、redis 6.2.20；镜像内输出 `/sbom/rpms.txt` | SBOM 工作流 `image-sbom.yml` 可随时重导 |
| pnpm 版本统一 | 已做 | `packageManager` 8.6.12 → 8.13.1，三个工作流 8.7.5 → 8.13.1（镜像本就是 8.13.1）；移除未被引用的 `apitable@latest` | `pnpm --version` 各环境一致 |
| 前端首屏 | 分析完成，未改代码 | 实测结论：自托管构建的客户端 chunk 中**不存在** `posthog`/`sentry`（tree-shaken），`exceljs`/`recharts`/`xgplayer`/`konva` 都已是异步 chunk；只剩 3.5 MB 全局 CSS | **需要视觉回归**，拆分成独立任务 |

### 为什么第 5 项没动代码

3.5 MB 的 CSS 来自 `_app.tsx` 里逐条 `import 'xxx.less'` 的全局累积，要降下来只能按页面拆分样式入口，
属于"改完必须逐页看外观"的改动。本环境无法做视觉回归，冒烟脚本也只校验 HTTP 状态码，
盲改的风险远大于收益，因此只做了度量与定位，不落代码。

### 遗留（有意为之）

- `dataenv` 镜像仍然保留 `microdnf -y update`：它会把基础层从 8.9 升到 8.10，属于残留的非确定性来源；去掉它风险更高（依赖版本可能对不上），暂不动
- 镜像仍以 root 运行（all-in-one 需要 pm2 管理 mysqld/rabbitmq），未做非 root 化

---

## v1.17.1 实测（已发布并通过冒烟）

发布流水线 run 40366535968 全绿，冒烟 run 40373869428 全绿。

| 指标 | v1.17.0 | v1.17.1（实测） |
|---|---|---|
| 冷启动（空卷） | 71 s | **61 s** |
| 同版本重启 | 36 s | **31 s**（版本戳 = v1.17.1） |
| all-in-one 常驻内存 | 2.345 GiB | **2.247 GiB** |
| all-in-one 镜像 | 2.35 GB | **2.36 GB** |
| backend-server | 577 MB | 587 MB |
| room-server / web-server | 520 MB / 305 MB | 520 MB / 305 MB |
| 离线交付包 | 3299 MB | 3296 MB |

分层 jar 不减小镜像总大小（只是把 183 MB 的单层拆成 178 MB 依赖层 + 19 MB 应用层），
收益体现在**增量推拉**：代码变更时只需推 application 层。

### 这轮踩到的两个既有时区缺陷（都不是本次优化引入的）

1. `MemberServiceImplTest.testShouldPreventInvitationForFreeSpace`：用 `LocalDateTime.now()`
   圈"今天"，而插入的邀请记录不写 `created_at`，落到数据库 `CURRENT_TIMESTAMP`（容器时区
   Asia/Singapore）。CI runner 是 UTC，两者差一天 → 每天 UTC 16:00 之后必然统计到 0 条。
   修复：用例显式写入 `createdAt`。
2. `SpaceInviteRecordMapperTest.testSelectCountBySpaceIdAndBetween`：同一根因（fixture 的
   `created_at` 由数据库写入，查询区间由 JVM 时间构造）。修复：以记录自身的 `createdAt`
   为基准取 ±12h 区间。

两者只在 UTC 16:00-24:00 这个窗口暴露，所以历史上是"偶发失败"，实际是每天必然失败 8 小时。

### 冒烟脚本的一次改进

原来通过 `docker logs | grep "built-in application data already loaded"` 判断版本戳是否生效，
但该行经过 pm2 的日志管道不一定会落到容器 stdout。改为直接读容器内
`/apitable/.appdata-stamp`，与镜像 tag 比对，失败时再回退到日志并打印相关行。
