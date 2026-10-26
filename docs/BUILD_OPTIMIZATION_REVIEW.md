# APITable 构建流程与镜像体积优化审查

审查日期：2026-10-26
审查范围：`docker-bake.hcl`、`packaging/**`、`init-db/Dockerfile`、`.dockerignore`、`Makefile`、`.github/workflows/*`、`packages/{room-server,datasheet}` 构建配置、`backend-server` Gradle 配置
参考：`apitable-20261026151835.log`（真实容器启动日志）

---

## 0. 结论摘要

当前镜像体积的主要矛盾**不是业务代码，而是"把构建工具链当运行环境"**：

1. `room-server` 运行阶段直接复用构建基础镜像 `apitable-node`（1.16 GB，内含 gcc/g++/make/python/git），并且 `COPY --from=builder /app /app` 把 devDependencies、pnpm 目录结构、源码全部带进最终镜像，再用 `rm -fr packages/*/src` 做无效删除（同层删除不减小体积）。
2. `web-server` 已经是 Next standalone 输出（体积最优），但运行基础镜像仍是 `apitable-nodepy`（489 MB，带 build-base/python3），运行时完全用不到。
3. 构建上下文 `context: "."` 带进了 `docs/`（339 MB）、`backend-server/application/build`（229 MB）、`**/.gradle` 等；`.dockerignore` 已挡住 `node_modules`/`web_build`/`dist`/`.git`，但漏了这几类。
4. 依赖安装层次设计不完整：没有 pnpm store 缓存挂载、没有 Gradle 依赖预热层、`pnpm install` 被重复执行且不带 `--prod`、pm2 在运行阶段联网 `npm install`。

**预期总收益（估算）**：room-server ≈1.6 GB → ≈450 MB，web-server 643 MB → ≈250 MB，backend ≈650 MB → ≈400 MB，all-in-one 1.44 GB → ≈0.9 GB；构建上下文 800 MB → ≈80 MB；CI 单次构建时间预计下降 20%–40%（缓存命中时更多）。

| 优先级 | 优化项 | 体积收益 | 构建时间收益 | 风险 |
|---|---|---|---|---|
| P0-1 | room-server 运行阶段改用 slim 基础镜像 | ≈ −900 MB | — | 低（需冒烟验证原生模块） |
| P0-2 | room-server 只拷产物 + 生产依赖 | ≈ −300 MB | 中（省一次全量 `pnpm install`） | 中（拷贝清单需准确） |
| P0-3 | 补齐 `.dockerignore` | — | 高（上下文 10×） | 极低 |
| P0-4 | web-server 运行阶段改 `node:22-alpine` | ≈ −390 MB | — | 低 |
| P0-5 | pm2 改为构建期安装并清缓存 | ≈ −30 MB | 低（去掉联网） | 极低 |
| P1-1 | Gradle 分层 + build cache + 分层 jar | ≈ −50 MB | 高 | 中 |
| P1-2 | backend 运行阶段换 headless JRE | ≈ −180~250 MB | — | 低 |
| P1-3 | init-db / openresty 换 alpine 变体 | ≈ −300 MB（合计） | 低 | 低 |
| P1-4 | pnpm 版本统一 + store 缓存挂载 | — | 高 | 低 |
| P2-1 | CI 缓存策略从 `mode=max` 收敛 | — | 高 | 低 |
| P2-2 | Next 构建缓存挂载 + 并行度 | — | 中 | 低 |
| P2-3 | dataenv 版本锁定（日志已证不锁定） | — | — | 低但需回归 |
| P2-4 | 多架构与 `--load` 冲突修复 | — | — | 极低 |

---

## 1. 基线测量

### 1.1 镜像（实测 / 估算）

| 镜像 | 体积 | 来源 | 构成 |
|---|---|---|---|
| `apitable-node:v22.22.2` | **1.16 GB** | 实测（2026-10-25 本地构建） | `node:22.22.2-bookworm`（buildpack-deps，自带 gcc/g++/make/git）+ python3/pkg-config + pnpm |
| `apitable-nodepy:22.22.2-alpine` | **489 MB** | 实测 | `node:22.22.2-alpine`(≈60 MB) + build-base/python3/py3-setuptools |
| `apitable-web-server` | **643 MB** | 实测 | nodepy 基础 489 MB + standalone 109 MB + static 26 MB + public 25 MB |
| `apitable-room-server` | ≈1.6 GB | 估算 | node 基础 1.16 GB + `/app`（prod+dev 依赖、源码、dist 10 MB） |
| `apitable-backend-server` | ≈650 MB | 估算 | `amazoncorretto:17-al2023` ≈470 MB + `app.jar` **183 MB**（实测） |
| `apitable-init-db` | ≈600 MB | 估算 | `liquibase/liquibase:4.21.1`（JDK 基础） |
| `apitable-openresty` | ≈380 MB | 估算 | `openresty:1.21.4.1-4-buster-fat` |
| `apitable-new`（all-in-one） | **1.44 GB** | Docker Hub 压缩体积 | dataenv（mysql/redis/rabbitmq/minio/openresty/JRE/node）+ 4 个应用 |

### 1.2 构建上下文（`context: "."`）

| 目录 | 体积 | 是否被 `.dockerignore` 排除 |
|---|---|---|
| `docs/` | 339 MB | ❌ |
| `backend-server/`（其中 `application/build` 229 MB） | 333 MB | ❌ |
| `packages/`（不含 node_modules / web_build） | ≈110 MB | 部分 |
| `.git/` | 389 MB | ✅ |
| `node_modules/` | 1.7 GB | ✅ |
| `packages/datasheet/web_build/` | 1.5 GB | ✅ |
| 根 `.env`（含部署默认值） | 3.7 KB | ❌（安全项） |

**结论：每次构建仍要传输 ≈800 MB，其中 42% 是与镜像无关的文档。**

### 1.3 日志证据（`apitable-20261026151835.log`）

- 冷启动：`07:14:58` 容器启动 → `07:16:19` backend 就绪，**≈81 秒**；其中 JVM 直到 `07:15:51` 才启动，被 mysql/rabbitmq 初始化挤占；backend 自身 `Started Application in 29.454 seconds`。
- `init-appdata` 被启动**两次**（PID 483 / 525）：`init-appdata.sh` 顺序跑 `init-user` 和 `load` 两个 JVM，各 ≈4.5 s。
- 运行环境版本未锁定：日志显示 **RabbitMQ 4.3.1 / Erlang 27.3.4.11**，而基础镜像是 `almalinux/8-minimal:8.9-20231124`；`TLS Library: OpenSSL 1.1.1k`（2023-09 已 EOL）。→ dataenv 镜像不可复现。
- `info - Loaded env from /app/web-server/packages/datasheet/.env`：版本库里的 10 KB `.env` 被打进镜像，`NEXT_PUBLIC_*` 在构建期内联，换域名/前缀必须重建镜像。

---

## 2. P0：高收益、低风险，建议本周落地

> 以下 5 项互不冲突，可拆成 2 个 PR：PR-A = P0-3 + P0-5（低风险），PR-B = P0-1/2/4（镜像重写）。

### P0-1 拆分"构建基础镜像"与"运行基础镜像"

**问题**：`Dockerfile.room-server` 的 runner 阶段 `FROM ${NODE_BASE_IMAGE}:${NODE_BASE_TAG}`，即 1.16 GB 的 `apitable-node`。运行时不需要 gcc/g++/make/python3/git/distutils，也不需要用 buildpack-deps。

**改法**：

```dockerfile
# packaging/Dockerfile.room-server
ARG NODE_RUNTIME_IMAGE=node
ARG NODE_RUNTIME_TAG=22.22.2-bookworm-slim

# builder 仍用带工具链的基础镜像
FROM ${NODE_BASE_IMAGE}:${NODE_BASE_TAG} AS builder
...
# 运行阶段换成 slim（glibc 版本一致，ABI 不变）
FROM ${NODE_RUNTIME_IMAGE}:${NODE_RUNTIME_TAG} AS runner
```

`docker-bake.hcl` / workflow 增加 `NODE_RUNTIME_TAG` 变量，并在 `scripts/detect-changed-components.sh` 的 `room-server` 输入里加入该变量（它不在文件指纹里，需靠 tag 值区分，沿用现有"tag 变更即重建"约定）。

**收益**：≈ −900 MB（1.16 GB → ≈230 MB）。
**风险**：低。`bookworm-slim` 与 `bookworm` 同为 glibc，凡是构建期编译好的原生模块都能直接跑；唯一风险是"运行期才 dlopen 的原生模块"，本项目 `canvas` 已用 `packages/canvas-shim` 打桩、其余为纯 JS。
**验证**：`docker run --rm <img> node -e "require('@grpc/grpc-js')"`，再起 compose 打通 `/actuator/health` 与 socket 连接。

---

### P0-2 room-server 只拷产物与生产依赖，删掉无效删除

**问题**（`packaging/Dockerfile.room-server:57-76`）：

```dockerfile
RUN if [ "$KEEP_DEV_DEP" = "" ] ; then pnpm install --filter @apitable/room-server; fi   # 无 --prod，devDeps 保留
...
COPY --from=builder /app /app        # 整个 /app：node_modules(含 dev)、src、dist、patches、锁文件
RUN npm install pm2@5.4.3 --global && rm -fr packages/*/src   # 同层删除，不减体积，反而新增层
```

三个独立问题叠加：① `pnpm install` 不带 `--prod`，`typescript`(66 MB)、`jest`/`ts-jest`、`@nestjs/cli`、`clinic`、`@types/*`、`eslint` 全进镜像；② `COPY /app` 把 `src/` 也带进去；③ `rm` 与 `COPY` 不在同一 `RUN`，被删文件仍占层空间。

**改法**（新增一个 `prod-deps` 阶段 + 精确拷贝）：

```dockerfile
# ---- 仅生产依赖 ----
FROM ${NODE_BASE_IMAGE}:${NODE_BASE_TAG} AS prod-deps
WORKDIR /app
COPY ./pnpm-workspace.yaml ./package.json ./pnpm-lock.yaml ./patches ./
COPY packages/canvas-shim/package.json   ./packages/canvas-shim/
COPY packages/i18n-lang/package.json     ./packages/i18n-lang/
COPY packages/core/package.json          ./packages/core/
COPY packages/databus-wasm-web/package.json    ./packages/databus-wasm-web/
COPY packages/databus-wasm-nodejs/package.json ./packages/databus-wasm-nodejs/
COPY packages/room-server/package.json   ./packages/room-server/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --prod --frozen-lockfile --filter @apitable/room-server --filter root

# ---- 运行 ----
FROM ${NODE_RUNTIME_IMAGE}:${NODE_RUNTIME_TAG} AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG SEMVER_FULL
ENV SEMVER_FULL=${SEMVER_FULL}

COPY --from=builder   /usr/local/lib/node_modules/pm2 /usr/local/lib/node_modules/pm2
RUN ln -s ../lib/node_modules/pm2/bin/pm2-runtime /usr/local/bin/pm2-runtime

COPY --from=prod-deps /app/node_modules                       ./node_modules
COPY --from=prod-deps /app/packages/i18n-lang/node_modules     ./packages/i18n-lang/node_modules
COPY --from=prod-deps /app/packages/core/node_modules          ./packages/core/node_modules
COPY --from=prod-deps /app/packages/room-server/node_modules   ./packages/room-server/node_modules

COPY packages/room-server/package.json packages/room-server/ecosystem.config.js ./packages/room-server/
COPY --from=builder /app/packages/room-server/dist ./packages/room-server/dist
COPY --from=builder /app/packages/room-server/app-config.json ./packages/room-server/
COPY --from=builder /app/packages/core/dist        ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/i18n-lang/dist   ./packages/i18n-lang/dist
COPY --from=builder /app/packages/i18n-lang/package.json ./packages/i18n-lang/
COPY --from=builder /app/packages/i18n-lang/src/config ./packages/i18n-lang/src/config
COPY --from=builder /app/packages/databus-wasm-nodejs ./packages/databus-wasm-nodejs
```

依据：`packages/room-server/nest-cli.json` 的 `assets` 已把 `*.proto` / `*.yaml` / `*.lua` 编译进 `dist/`，所以 `dist/` 自包含；`@apitable/core`、`@apitable/i18n-lang` 的入口是 `dist/index.js`，只需 `dist` + `package.json`。

**收益**：devDeps + 源码 ≈ −300 MB；同时删掉构建期那条浪费 2–5 分钟的二次 `pnpm install`（它正是历史上 `canvas-shim` 缺失导致发版失败的步骤）。
**风险**：中——拷贝清单漏项会在启动时报 `Cannot find module`。务必在 CI 保留"起容器 → `/actuator/health` + socket 连接"的冒烟用例。
**更快落地的替代方案**：若不想手写清单，用 `pnpm --filter @apitable/room-server deploy --prod /out`（pnpm 8 支持）产出独立目录，再整目录拷入 runner。

---

### P0-3 补齐 `.dockerignore`

**问题**：`.gitignore` 已经排除了 `**/build`、`**/.gradle`，但 `.dockerignore` 没有；`docs/`、根 `.env` 完全没挡。

**改法**（追加到 `.dockerignore`）：

```dockerignore
# 与镜像无关的大目录
docs
**/*.md
!packaging/**/*.md
deleted_features_audit.md

# 本地构建产物（.gitignore 有，.dockerignore 缺）
**/build
**/.gradle
**/coverage
**/tsconfig.tsbuildinfo
**/.turbo
**/.nx
/workbuddy
.workbuddy

# 环境与密钥
.env
.env.*
!.env.example
```

注意：`**/build` 只匹配名为 `build` 的目录/文件，不会误伤 `build.js`；仓库中不存在名为 `build/` 的源码目录（`git ls-files` 已确认）。

**收益**：上下文 800 MB → ≈80 MB；CI 每次构建少传 700 MB（约 10–30 s，取决于网络），`bake` 的多目标场景收益叠加。顺带消除根 `.env` 进入上下文的隐患（当前任何未来新增的 `COPY . .` 都会把部署默认值/密钥烤进镜像）。
**风险**：极低。
**验证**：`docker buildx build --target deps -f packaging/Dockerfile.web-server . --progress=plain` 观察 `transferring context` 字节数。

---

### P0-4 web-server 运行阶段换纯 Node 镜像

**问题**（`Dockerfile.web-server:73`）：runner 用 `apitable-nodepy`（489 MB，含 build-base/python3/git），但 standalone 输出已包含全部被 trace 的依赖，运行时不需要编译任何东西。

**改法**：

```dockerfile
FROM node:22.22.2-alpine AS runner     # 60 MB，与 builder 同为 musl，ABI 一致
```

同时删除 runner 中无用的 `pnpm-workspace.yaml` / `pnpm-lock.yaml` / `package.json` 拷贝（1.4 MB 锁文件纯属噪音），并把 `ENV NEXT_TELEMETRY_DISABLED=1` 提到 builder 阶段（当前只在 runner 设置，构建期仍会发遥测请求）。

**收益**：643 MB → ≈250 MB（−390 MB）。
**风险**：低。builder 本身就是 alpine/musl，standalone 里的原生文件与 musl 一致。
**注意**：`output: 'standalone'` + `outputFileTracingRoot` 已正确配置，无需再动。

---

### P0-5 pm2 安装移出运行阶段

**问题**：`RUN npm install pm2@5.4.3 --global` 在最终镜像里执行 → 构建期联网（破坏可离线构建）、npm 缓存残留、且必须保留 npm。

**改法**：在 builder 阶段安装，用 `COPY --from` 搬运（见 P0-2 片段），或直接写进 `Dockerfile.node-base` 由基础镜像统一提供。若坚持在 runner 安装：

```dockerfile
RUN npm install -g pm2@5.4.3 --no-audit --no-fund \
 && npm cache clean --force && rm -rf /root/.npm /tmp/*
```

**收益**：≈ −30 MB，构建不再依赖 npm registry 可用性。

---

## 3. P1：中等收益，需要一次回归

### P1-1 Gradle 分层、build cache 与 Spring Boot 分层 jar

**问题**（`Dockerfile.backend-server`）：

```dockerfile
COPY ./backend-server/. .                            # 229 MB 的 application/build 也进来了
RUN --mount=type=cache,target=/root/.gradle ./gradlew -v
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon ... :application:bootJar
```

任何 Java 改动都会让"依赖解析 + 全模块编译"整层失效；`./gradlew -v` 只预热了 wrapper，没有预热依赖；`build/` 在上下文里每次都要重传。

**改法**：

```dockerfile
FROM amazoncorretto:17-al2023 AS builder
WORKDIR /app
# 1) 只拷构建脚本，先把 Gradle distribution / 插件 / 依赖灌进 cache mount
COPY ./backend-server/gradle ./gradle
COPY ./backend-server/gradlew ./backend-server/settings.gradle ./backend-server/build.gradle ./backend-server/gradle.properties ./
COPY ./backend-server/buildSrc ./buildSrc
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon help
# 2) 再拷源码
COPY ./backend-server/. .
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon --build-cache :application:bootJar
```

`gradle.properties` 增加：

```properties
org.gradle.caching=true
org.gradle.parallel=true
org.gradle.configuration-cache=true
```

运行阶段用 layertools 分层（体积不变，但**推送/拉取从 183 MB 降到 ≈5 MB/次**）：

```dockerfile
FROM amazoncorretto:17-al2023-headless AS runner
WORKDIR /app
COPY --from=builder /app/application/build/libs/*.jar ./app.jar
RUN java -Djarmode=layertools -jar app.jar extract --destination /app/layers
# 依次 COPY dependencies / spring-boot-loader / snapshot-dependencies / application
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75","-Djava.security.egd=file:/dev/./urandom","-jar","/app/app.jar"]
```

**收益**：后端镜像 ≈650 MB → ≈400 MB（headless JRE −250 MB）；源码改动场景编译时间预计 −30%~50%；发布推拉带宽大幅下降。
**风险**：中。`settings.gradle` 引用了全部子模块，第 1 步 `help` 需要各模块目录存在（空项目合法，但 `buildSrc` 与 version catalog 必须齐）；配置缓存与部分插件不兼容，需先在 CI 跑一次验证，不通过就回退 `configuration-cache`。

### P1-2 backend 运行阶段用 headless JRE

`amazoncorretto:17-al2023` 带完整 JDK/GUI 依赖；服务端只需 JRE headless。`amazoncorretto:17-al2023-headless` 是官方 tag（压缩后 ≈129 MB，比完整 JDK 变体小 100 MB 以上，解压后差额更大）。≈ −180~250 MB，风险低（无 GUI 依赖，导出 PDF 用 pdfbox 不需要 AWT 图形环境；若日后引入 `java.awt` 相关导出，换回 `al2023` 即可）。

### P1-3 init-db 与 openresty 换轻量变体

- `init-db/Dockerfile`：`FROM liquibase/liquibase:4.21.1` → `4.21.1-alpine`（官方自 4.21 起提供 `-alpine` 变体；≈600 MB → ≈300 MB）。注意 `lpm add mysql` 在 alpine 下同样可用。
- `packaging/Dockerfile.openresty`：`openresty:1.21.4.1-4-buster-fat` → 同期 `alpine` 变体（若该 patch 版本未发布 alpine tag，就近选取同一 1.21.4.1 系列的 alpine 版本；≈380 MB → ≈120 MB）。仅拷贝 `conf.d/`，不需要 fat 变体自带的编译工具链。
- 两者都建议同步升级到仍在维护的版本（buster 已进入 LTS 尾声）。

### P1-4 依赖管理：pnpm 版本与会话缓存

**问题**：仓库里同时存在三个 pnpm 版本——
- `package.json` → `packageManager: pnpm@8.6.12`
- 镜像 → `pnpm@8.13.1`（`Dockerfile.node-base` / `nodepy-base` / `web-server`）
- CI → `pnpm/action-setup@v2 version: 8.7.5`

再加上 `Dockerfile.web-server:33` 的 `sed -i 's~registry.npmmirror.com~registry.npmjs.org~g' pnpm-lock.yaml`，锁文件在镜像里被改写，出现"本地/CI/镜像三份不同解析结果"的概率不低。

**改法**：
1. 统一到 `packageManager` 声明的版本，镜像里用 `corepack enable && corepack prepare pnpm@8.6.12 --activate`（或反过来把仓库升到 8.13.1 后统一），CI 的 `pnpm/action-setup` 读取同一字段。
2. 所有 `pnpm install` 的 `RUN` 加 `--mount=type=cache,id=pnpm,target=/pnpm/store` + `pnpm config set store-dir /pnpm/store`，锁文件不变时可复用 90% 下载量。
3. 锁文件改为对公共 registry 生成（`registry.npmjs.org`），国内开发用 `NPM_CONFIG_REGISTRY` 覆盖，而不是在镜像里 sed 改写锁文件。

**收益**：依赖安装层次几乎不再重新下载（首次之后 −40%~70% 安装时间）；消除版本漂移导致的 `purge node_modules` 提示。

### P1-5 根 devDependency 里的 `"apitable": "latest"`

`package.json:80` 有 `"apitable": "latest"`。锁文件会钉住具体版本，但任何一次 `pnpm update` / 锁文件重算都会拉到未知内容，属于供应链风险，且它会把无关依赖带进 install 图。建议确认用途后移除或改为精确版本。

---

## 4. P2：构建体验与可复现性

### P2-1 CI 缓存策略收敛

`.github/workflows/dockerhub-all-in-one.yml` 中每个 target 都用 `cache-to: type=gha,mode=max`。`mode=max` 会导出**所有中间层**，包括：
- web-server builder 的 `node_modules`（≈1.6 GB）与 `web_build/cache`（实测 1.4 GB webpack 缓存）
- room-server builder 的整棵 `/app`

GitHub Actions 缓存池每仓库 10 GB 且会被淘汰，结果是"缓存互相挤掉 + 每次导出耗时数分钟"。

**改法**：
- web-server / room-server 用 `mode=min`（只导出最终层），或改用 registry 缓存 `type=registry,ref=<image>:buildcache,mode=max`（不占 GHA 配额，可跨 workflow 复用）；
- 加 `ignore-error=true`，避免缓存导出失败让整个发布失败；
- backend-server 保留 `mode=max`（Gradle 层收益高、体量小）。

**收益**：构建时间稳定性显著提升；避免"缓存命中率随时间下降"的隐性退化。

### P2-2 Next 构建缓存与并行度

1. `distDir: 'web_build'` 意味着 webpack 文件缓存落在 `packages/datasheet/web_build/cache`（实测 1.4 GB）。在 builder 里挂载缓存即可跨构建复用：

```dockerfile
RUN --mount=type=cache,id=next-cache,target=/app/packages/datasheet/web_build/cache \
    pnpm run build:dst
```

2. `next.config.js` 的 `experimental.cpus` 默认 2、`workerThreads: false`。CI runner 是 4 核，建议在 CI 传 `NEXT_BUILD_WORKERS=4`；`workerThreads` 可尝试开启（Terser 并行），但内存峰值会上升（当前 `--max-old-space-size=10240`，需同步确认 runner 内存）。

**风险**：webpack 缓存偶发失效（Next 会自行重建）；缓存与 `rm -rf ./web_build` 的 `build` 脚本冲突——`build` 脚本会先删 `web_build`，**缓存目录也在其中**，直接用上面的挂载会被删掉。落地时需把缓存目录移到 `web_build` 之外（例如 `NEXT_CACHE_DIR` + 软链），或改用 `cacheDirectory` 独立路径。这是落地该优化时最容易踩的坑。

### P2-3 dataenv 镜像不可复现（日志已证）

`packaging/all-in-one/dataenv-pm2/Dockerfile`：
- `microdnf -y update` 会把 `almalinux:8.9-20231124` 的基础包整体升级，镜像 digest 与内容脱钩；
- `microdnf -y install rabbitmq-server erlang redis mysql-community-server-minimal openresty` **未固定版本**，每次构建拉最新。

日志实证：本次运行的是 **RabbitMQ 4.3.1 / Erlang 27.3.4.11**，`OpenSSL 1.1.1k`（已 EOL）。同一份 Dockerfile 隔几个月重建会得到行为不同的数据库环境。

**改法**：固定 `rabbitmq-server-4.x.y`、`erlang-27.x`、`mysql-community-server-minimal-8.0.xx`；去掉 `microdnf -y update`（基础镜像固定 digest 即可）；构建时输出 `rpm -qa` 作为 SBOM 附件。

**风险**：低，但需要一次完整回归（RabbitMQ 主版本升级对 quorum queue 有影响，日志里已在启用 `kheema_db` 等新特性）。

### P2-4 多架构与 `--load` 冲突

`docker-bake.hcl` 给 backend/room/init-db/openresty 都声明了 `platforms = ["linux/amd64","linux/arm64"]`，而 `Makefile:255` 用 `docker buildx bake $(target) --load`。`--load` 不支持多平台（"docker exporter does not currently support exporting manifest lists"），本地 `make build-docker` 实际是坏的。此外，在 CI（amd64）构建 arm64 需要 QEMU 跑 Gradle/Next，耗时数倍。

**改法**：本地目标改用 `--set '*.platform=linux/$(uname -m | sed s/x86_64/amd64/)'`，或把 `platforms` 从 target 移到 workflow 的 `--set` 覆盖；`Makefile` 里 `$(target)` 未定义时显式指向 `default` 组。

### P2-5 运行阶段残留与安全项

- `packages/room-server/tsconfig.json` 的 `sourceMap: true` → `dist` 里 2.6 MB `.js.map` 进入镜像，既占体积也泄露源码路径。建议生产构建关闭，或构建后在**同一层**删除。
- `room-server` / `backend-server` 以 root 运行；web-server 已经用 `nextjs` 用户。建议 `USER node`（需调整 `/app` 属主与 pm2 日志路径）。
- 无 `HEALTHCHECK`；all-in-one 用 `curl` 轮询做就绪判断，可以把健康检查固化成镜像元数据。
- `docs/` 339 MB 全量在 Git 里（347 个文件），建议迁移到独立文档站或 Git LFS —— 它直接放大 clone 与构建上下文。

---

## 5. 日志暴露的非体积问题（顺带记录）

| 现象 | 影响 | 建议 |
|---|---|---|
| 冷启动 81 s，JVM 在 `07:15:51` 才启动 | 体验差、滚动升级慢 | pm2 的 `backend-server` 已用 `mysqladmin ping` 串行等待，但 mysql/rabbitmq 初始化会抢 CPU；可给 `mysqld`/`rabbitmq` 加 `nice`，或把 dataenv 与业务拆成两个容器（`docker-compose.yaml` 已支持） |
| `init-appdata` 跑两个 JVM（`init-user` / `load`） | 多 ≈9 s 启动时间 | 合并为单进程多 action，或仅首次启动执行 |
| `gateway` 用 `curl` 每秒轮询 web/backend | 启动期噪音日志 | 用 `wait-for` 或健康检查替代 |
| RabbitMQ 4.3.1 + OpenSSL 1.1.1k | 版本漂移 + EOL 组件 | 见 P2-3 |
| `web-server` 启动即读 `/app/web-server/packages/datasheet/.env` | 配置在构建期内联 | 需要"同一镜像多环境部署"时，把可变项改为运行时 `env` 注入 |

---

## 6. 落地路线

**PR-1（半天，低风险）**
1. `.dockerignore` 补齐（P0-3）
2. pm2 安装改造（P0-5）
3. web-server runner 换 `node:22-alpine`、删无用锁文件、补 `NEXT_TELEMETRY_DISABLED`（P0-4）
4. `Makefile` 的 `--load`/多平台修复（P2-4）

验收：`docker buildx bake web-server` 体积 < 300 MB；`/login` 200。

**PR-2（1–2 天，中风险）**
1. `Dockerfile.room-server` 三阶段重写（P0-1 + P0-2）
2. `docker-bake.hcl` / workflow 增加 `NODE_RUNTIME_*`
3. 同步更新 `scripts/detect-changed-components.sh` 的 room-server 输入（否则指纹不变，会错误复用旧镜像）

验收：room-server < 500 MB；容器内 `pm2-runtime` 起 4 实例、socket 连接正常、`/fusion/v1` 可访问。

**PR-3（2–3 天，中风险）**
1. backend 分层 jar + headless JRE + gradle 缓存（P1-1、P1-2）
2. init-db / openresty 换 alpine（P1-3）
3. CI 缓存策略调整（P2-1）
4. pnpm 版本统一 + store 缓存（P1-4）

**PR-4（可选）**
dataenv 版本锁定（P2-3）、Next 构建缓存（P2-2）、非 root 与 HEALTHCHECK（P2-5）。

### 统一的度量方式

```bash
# 镜像体积
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'
# 应用层构成（定位是否还有 devDeps/源码残留）
docker run --rm --entrypoint sh <img> -c 'du -sh /app/* /app/node_modules 2>/dev/null | sort -hr | head'
# 构建上下文
docker buildx build -f packaging/Dockerfile.web-server . --progress=plain 2>&1 | grep -i "transferring context"
# 构建缓存占用
docker buildx du --verbose | head -20
```

---

## 7. 一句话总结

**这套构建链的"代码"部分已经优化得不错**（Next standalone、pnpm 工作区、组件级指纹增量发布、GHA 缓存都已到位），**剩下的空间几乎全部在"镜像分层与运行环境"这一层**：三个 Node/Java 服务仍在用"构建工具链镜像"当运行环境，一个 `COPY --from=builder /app /app` 把 devDependencies 和源码一起搬进生产镜像。把这三处改掉，总交付体积可以减半，且不需要动任何业务代码。
