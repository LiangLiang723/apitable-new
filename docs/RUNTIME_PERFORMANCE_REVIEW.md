# APITable 运行时性能审查：启动耗时 / 内存 / 流畅度

审查日期：2026-10-26
数据来源：`apitable-20261026151835.log`（真实容器冷启动，1048 行）、`packaging/all-in-one/**`、`gateway/conf.d/**`、`docker-compose.yaml`、`packages/datasheet/{pages,next.config.js}`、实测前端产物
配套文档：`docs/BUILD_OPTIMIZATION_REVIEW.md`（构建与镜像体积）

---

## 0. 结论摘要

**冷启动 81 秒里，只有 30 秒是"真正必须的启动"**，其余 51 秒是"每次启动都重做的数据初始化"：

| 阶段 | 耗时 | 占比 | 是否每次启动都发生 |
|---|---|---|---|
| 基础设施（mysql/redis/rabbitmq/minio） | ≈ 6 s | 7% | 是（必要） |
| Liquibase `clearChecksums` + `update` | ≈ 12 s | 15% | **是（可跳过）** |
| `init-appdata`：`init-user` JVM | ≈ 6 s | 7% | **是（可合并）** |
| `init-appdata`：`load` JVM（全量导入模板/资源） | ≈ 24 s | 30% | **是（可跳过）** |
| backend Spring Boot 启动 | ≈ 28 s | 35% | 是（可缩短 30%） |
| 网关就绪探测 | ≈ 5 s | 6% | 是 |

**结论：启动优化不需要改业务代码，改的是"启动编排"。** 加上 stamp 门控后，稳态启动目标 **25–30 秒**（−63%）。

内存方面，当前所有服务都**没有显式上限**：JVM 按宿主内存的 25% 自动扩张、Node 走默认 old-space、MySQL buffer pool 是保守的 128 MB、Redis 无 `maxmemory`。在无 cgroup 限制的 `docker run` 场景下，常驻内存**不可预测**（可能 6–8 GB）。显式收敛后可以稳定在 2.5–3 GB，并顺带提升查询与首屏。

流畅度方面最大的问题不在业务逻辑，而在**网关把 Next 的静态资源全部透传给了单进程 Node**：`/_next/static/*` 没有 `proxy_cache`，而 `/web_build`（Next 在 standalone 模式下根本不暴露的路径）却配了 7 天缓存。此外 CSS 单文件 3.5 MB（gzip 后 323 KB）阻塞首屏，`posthog-js` / `@sentry/nextjs` 在自托管构建里也照常打进主包。

| 优先级 | 优化项 | 收益 | 风险 |
|---|---|---|---|
| S-1 | `init-appdata load` 加版本 stamp 门控 | 启动 **−24 s** | 低（需确认 load 幂等语义） |
| S-2 | Liquibase 取消每次 `clearChecksums` | 启动 **−4~6 s** + 减少 DB 写 | 中（checksum 兜底逻辑） |
| S-3 | 两个 JVM 合并为一次 | 启动 **−5 s** | 低 |
| M-1 | JVM 显式内存参数 | 内存可预测，峰值 −30% | 低 |
| M-2 | room-server Node 堆显式化 | 内存可预测 | 低 |
| F-1 | `/_next/static` 长缓存 + 网关代理缓存 | 首屏与重复访问显著改善 | 低 |
| F-2 | 首屏瘦身（posthog/sentry 剥离、CSS 拆分） | 首屏 gzip ≈ −200 KB | 中 |
| M-3 | MySQL buffer pool / Redis maxmemory | 查询变快、内存可控 | 低 |
| S-4 | Spring Boot AppCDS | 启动 **−5~8 s** | 低 |
| F-3 | room-server 多实例 / pm2 cluster（AIO） | 并发流畅度 | 中 |

---

## 1. 启动耗时分解（逐秒复盘日志）

```
07:14:58.0  pm2 同时拉起 10 个进程
07:14:58.9  mysql InnoDB 初始化完成
07:14:59.0  mysql ready for connections
07:14:59.4  redis ready（AOF 载入 1.15 s）
07:15:00.3  databus-server 起（actix 4 workers）
07:15:02.0  liquibase 启动（backend 的 script 在 mysql ping 通后触发）
07:15:04.1  clearChecksums 完成                        ← 2 s，每次启动都做
07:15:14.2  update 完成（18 new / 328 previously run）  ← 10 s，扫描 346 个 changeset
07:15:15.6  init-user JVM 启动
07:15:19.5  AppDataApplication started (4.6 s)
07:15:21.4  load JVM 启动
07:15:24.8  开始执行 load（asset/feature/wizard/widget/automation）
07:15:47.9  加载 asset 完成                            ← 23 s 全量导入
07:15:49.1  加载 template center 完成，Hikari 关闭
07:15:51.9  backend JVM 打印 "Starting Application"
07:16:19.2  Tomcat started on 8081                     ← Spring Boot 自身 28 s
07:16:19.8  Started Application in 29.454 seconds      ← 全部就绪
```

### 关键观察

1. **`load` 是最大单项（≈24 s）**，而且在每次容器启动时都会执行。它做的事情是"把模板中心、组件中心、自动化、向导配置等内置数据 upsert 进数据库"——本质上是**数据初始化**，不是启动的必要步骤。
2. **`clearChecksums` + `update` 每次都跑（≈12 s）**。`clearChecksums` 会清空 `apitable_db_changelog` 的校验和，再由 `update` 重算 346 条记录的 checksum。这对"仓库改了历史 changeset 导致 checksum 冲突"是兜底手段，但对正常升级是纯浪费，还带来一次全表写入。
3. **`init-user` 与 `load` 是两个独立 JVM**，各付一次 Spring Boot 冷启动成本（4.6 s × 2），而它们完全可以跑在同一个进程里。
4. **backend 的 28 s 大部分是类加载与 Bean 初始化**，属于 Spring Boot 的固有成本，可用 AppCDS 压缩 20–30%。
5. **13 个进程同时启动会互相抢 CPU/IO**：mysql 初始化、rabbitmq Erlang 启动、node 起进程、JVM 类加载同时发生。日志里 room-server 在 07:15:13 就已完成路由注册，而 backend JVM 等到 07:15:51 才真正开跑——不是被依赖阻塞，是被调度挤占。

---

## 2. 启动优化（按收益排序）

### S-1 给 `load` 加版本 stamp（−24 s，最高优先）

**现状**：`packaging/all-in-one/all-in-one/script/init-appdata.sh` 无条件执行：

```bash
for action in init-user load; do
    java -jar /app/init-appdata/init-appdata.jar "${action}"
done
```

**改法**：用镜像内的 `SEMVER_FULL`（all-in-one Dockerfile 已经通过 `ENV SEMVER_FULL` 注入）作为数据版本戳：

```bash
STAMP=/apitable/.appdata-stamp
if [[ -f "${STAMP}" && "$(cat "${STAMP}")" == "${SEMVER_FULL}" ]]; then
    echo "appdata already loaded for ${SEMVER_FULL}, skip"
else
    for action in init-user load; do
        java -jar /app/init-appdata/init-appdata.jar "${action}"
    done
    echo "${SEMVER_FULL}" > "${STAMP}"
fi
```

**为什么安全**：`load` 只在"升级到新版本"（数据脚本可能变）时需要重跑；同一版本重启容器不需要。若担心运维手动改过内置数据，可提供 `FORCE_APPDATA_RELOAD=true` 环境变量作为逃生口。

**风险**：中低。需要确认 `load` 的定位确实是"内置数据 upsert"而非"每次启动都必须的一致性修复"——从日志看它只做 insert/update 内置资产，不清理用户数据。建议先在测试环境用 `SEMVER_FULL` 不变的方式重启一次，对比前后 `apitable_` 库的表行数是否一致。

**顺带收益**：`load` 期间会持续写 MySQL，与 backend 的启动争抢 IO；跳过它也间接缩短 backend 的启动时间。

### S-2 Liquibase 从"每次清校验和"改为"失败重试"（−4~6 s）

**现状**：`init-appdata.sh` 先跑 `clearChecksums` 再跑 `update`。同一份脚本在 `init-db` 镜像的 `CMD` 里也是同样套路。

**改法**：把 `clearChecksums` 从"前置步骤"改成"`update` 失败后的补偿步骤"：

```bash
if ! liquibase ... update; then
    echo "update failed, retry after clearChecksums" >&2
    liquibase ... clearChecksums
    liquibase ... update
fi
```

**收益**：−2 s（clearChecksums 本身）+ 减少一次全表 checksum 重写；`update` 在无新 changeset 时仍会扫描 346 个文件（约 8–10 s），这部分只能靠"用 `db.changelog-master.xml` 的 include 精简"或"数据库已有版本号则直接跳过"来优化，后者风险较高，不建议一开始就做。

**风险**：中。原逻辑是为了兜住"上游改过历史 changeset"的场景；改成失败重试后行为等价，但如果 `update` 在 checksum 不匹配时的失败信息不够明确，排障成本会上升。建议同时在日志里打印 `liquibase status` 的输出。

### S-3 合并 `init-user` / `load` 两个 JVM（−5 s）

**现状**：两次 `java -jar`，每次都要付 Spring Boot 冷启动。

**改法**（任选其一）：
- 让 init-appdata 支持 `java -jar init-appdata.jar init-user,load`（逗号分隔，单进程顺序执行）——需要 init-appdata 侧改动（该镜像源码不在本仓库）；
- 或在脚本层判断：若 `load` 已含 `init-user` 的前置逻辑，直接去掉 `init-user` 步骤（需确认）。

**收益**：−5 s（一个完整 JVM 冷启动 + 一次 Spring 上下文初始化）。

### S-4 Spring Boot AppCDS（−5~8 s）

**改法**：生成类数据共享归档，启动时直接加载：

```dockerfile
# 需要 mysql/redis/rabbitmq 可达，否则 Spring 上下文刷新会失败
RUN java -XX:ArchiveClassesAtExit=/app/app.jsa \
         -Dspring.context.exit=onRefresh \
         -jar /app/app.jar || true
ENTRYPOINT ["java","-XX:SharedArchiveFile=/app/app.jsa", ... ,"-jar","/app/app.jar"]
```

**重要约束**：归档必须在**依赖服务可达**的环境里生成（Spring 上下文刷新会连库），所以只有两条可行路径：
- **CI 生成**：在 workflow 里起 mysql/redis/rabbitmq service containers，构建阶段连上去跑一次，把 `.jsa` 打进镜像（推荐，产物可复用）；
- **首次启动生成**：容器启动时检测 `/apitable/app.jsa` 不存在则先生成（耗时与正常启动相当），存在则直接加载。只对"长期运行 + 频繁重启"的场景有意义。

如果两条都不想引入，退而求其次只保留 JDK 自带的 base archive（`-Xshare:auto`，Java 17 默认已开），收益约 3–5%，聊胜于无。

注意：`-XX:TieredStopAtLevel=1` 能进一步加快启动，但会牺牲 JIT 峰值性能，对长驻服务不建议默认开启（可作为 `FAST_START=true` 的可选项）。

**收益**：类加载时间减少 20–30%，即 28 s → 20–22 s。
**风险**：低。归档文件与 JDK 版本绑定，升级 JDK 时需重新生成（跟随镜像构建即可）。

### S-5 启动编排：降低互相抢调度（−3~5 s）

**现状**：`ecosystem.config.js` 里 10 个 app 同时 `pm2 start`，靠每个脚本内部的 `while ! mysqladmin ping` / `while ! rabbitmq-diagnostics` 自旋等待。

**改法**：
1. 给基础设施进程降优先级：pm2 不支持 `nice`，但可以在 `script` 前加 `nice -n 10`（mysql/redis/rabbitmq/minio），让 backend/room-server 的 JVM/Node 更早拿到 CPU。
2. 把 `init-dataenv.sh` 里的 mysql 初始化（首次才走）与 `pm2-runtime` 解耦：现在 `CMD` 是 `init-dataenv.sh && add-host.sh && pm2-runtime start`，首次启动时 mysql `--initialize` 会串行阻塞所有进程拉起。可以改为先起 pm2，再用一个 oneshot 任务等 mysql 就绪。
3. `gateway` 的就绪探测目前用 `curl -fsI http://web-server:3000/favicon.ico`，改为 `/api/v1/actuator/health` 更准确，减少无意义的 404 请求。

**收益**：−3~5 s，主要体现在 4 核以下的小机器上。

---

## 3. 运行时内存

### 3.1 现状：没有任何显式上限

| 进程 | 现状 | 问题 |
|---|---|---|
| backend (JVM) | all-in-one 启动命令无 `-Xmx`/`MaxRAMPercentage`；compose 也没有 `JAVA_OPTS` | 无 cgroup 限制时按**宿主内存的 25%** 取堆，32 GB 机器上可用堆达 8 GB，G1 还会预留额外内存 |
| room-server (Node) | all-in-one 直接 `node ./dist/main.js`，无 `--max-old-space-size`；compose 有 `2048` | AIO 场景不可控；单进程承载全部 room+socket 角色 |
| room-server (pm2) | `ecosystem.config.js` 默认 `instances: 4`、`max_memory_restart: 1452M` | AIO 不走 pm2 托管 room-server，这组参数**实际未生效** |
| compose room-server | `INSTANCE_MAX_MEMORY=4096M` × 4 实例 | 理论峰值 16 GB，对自托管偏高 |
| MySQL | `my.cnf` 未设 `innodb_buffer_pool_size`，默认 128 MB | 内存省了但**查询慢**，大表明显卡顿 |
| Redis | 无 `maxmemory` | 6.2 默认 unlimited；日志里 60 秒 10000 次变更 + RDB 落盘，数据增长不可控 |
| RabbitMQ | 无 `vm_memory_high_watermark` | 4.x 默认 0.6 × 可用内存，cgroup 感知正常，暂可不改 |

### 3.2 建议配置

**M-1 JVM（backend）**：

```bash
java \
  -XX:MaxRAMPercentage=50 -XX:InitialRAMPercentage=20 \
  -XX:MaxMetaspaceSize=256m -XX:ReservedCodeCacheSize=128m \
  -Xss512k -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError \
  -Djava.security.egd=file:/dev/./urandom \
  -jar app.jar
```

- `MaxRAMPercentage=50`：容器 4 GB → 堆 2 GB，为 metaspace/线程栈/直接内存留出余量。
- `-Xss512k`：默认 1 MB × Tomcat 200 线程 = 200 MB 栈空间，降到 512 KB 省一半。
- `ExitOnOutOfMemoryError`：OOM 时快速失败由编排重启，避免半死状态。

**M-2 Node（room-server）**：

```
NODE_OPTIONS=--max-old-space-size=1536 --max-semi-space-size=64 --max-http-header-size=80000
```

AIO 单实例建议 1536 MB；compose 多实例场景每个 2048 MB、实例数按 CPU 核数（`INSTANCE_COUNT`）而非固定 4。

**M-3 MySQL**：`innodb_buffer_pool_size = 512M`（AIO 4 GB 内存机器），`innodb_flush_method = O_DIRECT`，`innodb_redo_log_capacity = 512M`（MySQL 8.0.30+ 用 `innodb_redo_log_capacity` 取代已废弃的 `innodb_log_file_size`；日志显示当前运行的是 8.0.37）。这是**同时改善内存可预测性与查询延迟**的少数项之一。

**M-4 Redis**：`maxmemory 384mb` + `maxmemory-policy noeviction`。**不要用 `allkeys-lru`**——APITable 的 Redis 同时承载 bull 队列与 socket 适配器，淘汰键会丢任务。`noeviction` 下写满会报错但不丢数据，配合监控告警更安全。

**M-5 cgroup 与 compose**：给 `docker-compose.yaml` 的每个服务加 `deploy.resources.limits.memory`（或 `mem_limit`），让 JVM 的 `MaxRAMPercentage` 有准确的参考值。否则 JVM 读的是宿主内存，限流逻辑全部失效。

**M-6 修正 pm2 参数错位**：AIO 里 room-server 不受 pm2 管理，`max_memory_restart` 形同虚设。要么改用 `pm2-runtime` 托管 room-server（顺便获得崩溃重启与内存阈值重启），要么把该参数删掉避免误导。

**预期**：AIO 常驻内存从"不可预测（峰值 6–8 GB）"收敛到 **2.5–3 GB**，且 backend 堆有明确上限，不会因为一次大导出把整机 OOM。

---

## 4. 流畅度

### 4.1 首屏（前端资源）

实测（`packages/datasheet/web_build/static`）：

| 资源 | 原始 | gzip |
|---|---|---|
| `css/6a06db04d364b288.css`（单文件） | **3.5 MB** | 323 KB |
| `chunks/b24c0a83…js`（最大 chunk） | **1.1 MB** | 256 KB |
| 全部 JS+CSS 合计 | 26 MB | 4.5 MB |

问题与改法：

1. **单个 3.5 MB CSS 阻塞首屏**。`next.config.js` 用了 `next-with-less`，`_app` 一次性引入全部 less/antd 样式。建议按路由拆分：把工作台/编辑器/模板中心等重页面样式改为页面级 import，或对 antd 使用 `babel-plugin-import` 的 `style: 'css'`（当前是 `style: true`，即引入 less 源文件，体积最大）。
2. **`posthog-js` 与 `@sentry/nextjs` 无条件进入主包**。`_app.tsx` 顶部 `import posthog from 'posthog-js'`，虽然 `posthog.init` 被 `NEXT_PUBLIC_POSTHOG_KEY` 门控，但**代码仍被打包**（自托管不需要）。建议：
   - 用 webpack `NormalModuleReplacementPlugin` 在 `IS_SELFHOST`/无 key 时把它替换为空模块；
   - 或改为命中条件后 `await import('posthog-js')`。
   预计主包 gzip −60~80 KB（posthog）+ −80 KB（sentry 相关）。
3. **生产构建未剥离 console**。`next.config.js` 加（`compiler.removeConsole` 自 Next 12.1 起支持，当前 12.3.4 可用；12.x 只支持布尔值，`{ exclude: [...] }` 是更高版本的写法）：

   ```js
   compiler: { removeConsole: process.env.NODE_ENV === 'production' }
   ```

   减少日志字符串与序列化开销。
4. **`moment` 在依赖里但源码 0 处引用**（`dayjs` 已在用），确认无用后从 `package.json` 删除，避免版本漂移与误引入。
5. 用 `ANALYZE=true pnpm build:dst` 生成 bundle 报告，定位 1.1 MB chunk 的构成（怀疑是 antd + rjsf + tiptap 的组合），再决定拆包策略。

### 4.2 网关（最大的低风险收益点）

**现状**（`gateway/conf.d/server/web-server.conf`）：

```nginx
location /_next {
    proxy_pass http://web-server;      # 没有任何缓存配置
    ...
}

location /web_build {                  # Next standalone 模式下这个路径并不存在
    proxy_cache cache_one;
    expires 7d;
}
```

问题：Next 的静态资源实际路径是 `/_next/static/<buildId>/...`（哈希命名，可安全 immutable 缓存），而这里**既没有 `proxy_cache` 也没有 `Cache-Control`**——每个用户每次请求都打到**单进程 Node**；反而给一个不存在的 `/web_build` 配了 7 天缓存。

**改法**：

```nginx
# 带哈希的构建产物：一年 immutable，并让 nginx 直接缓存，避免冲击 Node
location ~* ^/_next/static/ {
    proxy_pass http://web-server;
    proxy_cache cache_one;
    proxy_cache_valid 200 365d;
    proxy_cache_key "$scheme$host$request_uri";
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header X-Cache-Status $upstream_cache_status;
    access_log off;
}

# 不能长缓存的 Next 路径：HMR / data / image
location ~* ^/_next/(?!static/) {
    proxy_pass http://web-server;
    add_header Cache-Control "no-store";
}
```

同时：
- `gzip_types` 补 `image/svg+xml application/xml font/woff2`；
- 若 openresty 镜像带 brotli 模块，开 `brotli on; brotli_comp_level 5;`（CSS/JS 再降 15–20%）；
- 清理 `/web_build`、`/widget-stage` 两条无效 location，避免误以为是缓存生效点。

**收益**：首屏静态资源从"每次回源 Node"变为"nginx 内存/磁盘命中"；多用户并发时 Node 的 CPU 占用显著下降——这是"卡顿"最常见的来源。

### 4.3 交互与实时协同

1. **AIO 里 room-server 是单进程**：`ecosystem.config.js` 用 `node ./dist/main.js` 起一个进程，而镜像本身装了 pm2 且 `packages/room-server/ecosystem.config.js` 支持 `exec_mode: cluster` + `INSTANCE_COUNT`。多人编辑时单进程容易成为瓶颈。建议 AIO 也走 pm2 cluster（`INSTANCE_COUNT` 默认按 `nproc` 取，最小 2），socket.io 已有 redis adapter，扩容是安全的。
2. **每 5 秒一条 `Available IP Pools` 日志**：日志里可见稳定 5 s 一条，属于心跳打印。高频日志在 AIO 下会写 stdout，被 docker 日志驱动消费，长期运行会造成磁盘增长与少量 IO 抖动。建议降到 debug 级别或改为仅在状态变化时打印。
3. **`gateway` 的 `error_page 404 502 503 /404`** 会让所有后端 5xx 变成一次额外的内部请求，属可接受范围。
4. MySQL buffer pool 与 Hikari 池（见 M-3）直接决定大表格的响应速度，`spring.datasource.hikari.maximum-pool-size` 当前未显式配置（默认 10），并发导出/批量写入场景建议 20。

### 4.4 前端运行时

- `datasheet` 是 React 18 + Redux + immer 的重交互应用，日志与 bundle 层面看不出明显的长任务来源，建议用 Chrome Performance 面板录制"打开一个 1000 行表格 → 滚动 → 编辑单元格"的火焰图，再决定是否引入 `react-window` 虚拟化的进一步优化（当前已使用 `react-window`/`rc-virtual-list`）。
- `images.unoptimized: true` 意味着所有图片原图加载；若模板中心图片较大，建议在网关层配合 `proxy_cache` 与 `expires`（当前 `/` 与主要路由都是 `no-store`）。

---

## 5. 落地顺序与验收

### R-1（半天，收益最大）
- S-1 `load` stamp 门控
- M-1 / M-2 显式内存参数
- 验收：`docker run` 后从启动到 `/api/v1/actuator/health` 返回 200 的耗时 ≤ 45 s；`docker stats` 常驻 ≤ 3 GB

### R-2（1 天）
- S-2 Liquibase 失败重试化
- F-1 网关 `/_next/static` 缓存 + gzip 类型
- M-3 / M-4 MySQL 与 Redis 参数
- 验收：重复刷新首页，`X-Cache-Status` 命中 HIT；大表格首屏 TTFB 下降

### R-3（2–3 天）
- S-3 合并 JVM、S-4 AppCDS
- F-2 首屏瘦身（posthog/sentry 条件打包、removeConsole、CSS 拆分）
- 验收：Lighthouse 首屏 LCP 与总传输量对比；`NEXT_PUBLIC_POSTHOG_KEY` 为空时主包不含 posthog

### R-4（可选）
- F-3 AIO room-server 多实例
- S-5 启动编排与 nice
- 验收：10 并发 socket 压测下的消息延迟

### 度量命令

```bash
# 启动耗时（从容器启动到健康检查通过）
time (docker run -d --name apitable-test -p 8080:80 \
  -v "$PWD/.data:/apitable" benxianyu/apitable-new:latest >/dev/null && \
  until curl -fs http://localhost:8080/api/v1/actuator/health >/dev/null; do sleep 1; done)

# 常驻内存（每个进程）
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'

# JVM 堆实际使用
docker exec apitable-test jcmd 56 GC.heap_info

# 静态资源命中率
for i in 1 2 3; do curl -sI http://localhost/_next/static/chunks/framework-*.js | grep -i x-cache-status; done

# 首屏传输量
curl -s http://localhost/login | grep -o '/_next/static/[^"]*' | sort -u | \
  xargs -I{} curl -s -o /dev/null -w '%{size_download}\n' http://localhost{}
```

---

## 6. 与镜像优化的协同

- 镜像瘦身（`docs/BUILD_OPTIMIZATION_REVIEW.md` 的 P0 项）会减少容器启动时的 page cache 竞争，间接加快首次启动 1–2 秒；
- 反过来，本报告的 S-1/S-2 让"重启容器"变成低成本的常规操作，镜像更新与回滚的体验会明显变好；
- 两项合起来，`docker compose up` 从"泡杯咖啡"变成"等半分钟"，是自托管场景感知最强的一处改进。
