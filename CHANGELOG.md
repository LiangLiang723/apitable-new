# APITable CHANGELOG

## [v1.17.5](https://github.com/apitable/apitable/releases/tag/v1.17.5) (2026-10-27)

修正 all-in-one 镜像里的 node 运行时版本。

### 构建

* build: all-in-one 里实际运行的 node 是 **16.15.1**（自 v1.16.0 起），而 `dataenv-pm2` 的 Dockerfile 一直写的是
  22.22.2 —— 该层被构建缓存/镜像复用判定为"未变更"，从未真正重建。现在解包后立即断言
  `node -v == ${NODE_VERSION}`，版本不符直接构建失败；同时把 `dataenv-pm2` 纳入 `dataenv-liquibase-pm2`
  的变更指纹（上一版已做），保证基础层变更能传导到 all-in-one。
* build: 由此 all-in-one 内的 pm2 / room-server / web-server 全部运行在 node 22.22.2 上，与各组件镜像的
  构建运行时一致。

## [v1.17.4](https://github.com/apitable/apitable/releases/tag/v1.17.4) (2026-10-27)

修复 v1.17.3 的运行时缺包问题。**v1.17.3 的 room-server 无法启动，请直接使用 v1.17.4。**

### 修复

* fix: **room-server 缺 lodash 无法启动**。`@golevelup/nestjs-rabbitmq` 在代码里 `require('lodash')` 但没有声明该依赖，
  只能靠根 `node_modules` 的提升解析；`lodash` 原本在根 devDependencies，生产依赖安装后根目录没有它，
  启动即 `Cannot find module 'lodash'` 并无限重启。已把 `lodash` 提升为根 dependencies，并在 room-server 镜像
  构建期加 `require('lodash') && require('@golevelup/nestjs-rabbitmq')` 自检，同类问题不会再流出。
* fix: **all-in-one 里的 node 实际是 16.15.1**（应为 22.22.2）。`dataenv-liquibase-pm2` 的变更指纹没有包含它的
  基础层 `dataenv-pm2`，导致该镜像被判定"未变更"而复用了旧版本。已把它纳入指纹，重建后 AIO 使用 node 22。
* test: 冒烟脚本的 pm2 检查改为"启动后稳定 30 秒再判定"，避免把正在重启的应用误判为 online。

## [v1.17.3](https://github.com/apitable/apitable/releases/tag/v1.17.3) (2026-10-27)

修复 v1.17.1 / v1.17.2 的启动缺陷。**v1.17.1 与 v1.17.2 的 room-server 无法启动，请跳过这两个版本。**

### 修复

* fix: **room-server 崩溃重启循环**。`NODE_OPTIONS` 里带了 `--max-semi-space-size=64`，Node 不允许该参数出现在
  `NODE_OPTIONS` 中，进程一启动就退出（`node: --max-semi-space-size= is not allowed in NODE_OPTIONS`），
  pm2 无限重启。all-in-one 与 compose 两处都已移除；需要限制 semi-space 时只能作为命令行参数传。
* fix: **重启后 MySQL 起不来**。`docker restart` 会保留 `/var/run` 下上一次运行的 socket 与 socket 锁文件，
  mysqld 认为仍有实例在跑（`Another process with pid xxx is using unix socket file`）而退出。
  `init-dataenv.sh` 现在在启动前清理这些残留文件。
* fix: **上次迁移被中断后永久启动失败**。迁移过程中容器被 kill 会在 `DATABASECHANGELOGLOCK` 留下 `LOCKED=1`，
  之后每次启动都报 `Could not acquire change log lock`，backend 永远起不来。`init-appdata.sh` 现在识别该错误并
  执行 `liquibase releaseLocks` 后重试。
* test: 冒烟新增 pm2 全应用在线检查（此前只校验 backend 健康检查，room-server 崩溃不会被发现）。

## [v1.17.2](https://github.com/apitable/apitable/releases/tag/v1.17.2) (2026-10-27)

交付流水线与镜像体积的进一步压缩，不改变功能。

### 构建

* build: 离线包改用 `pigz -9`（gzip 的并行实现，输出仍是 `.tar.gz`，解包方式不变），拿不到时自动退回 `gzip -9`；13 个镜像改为 4 路并发拉取
* build: room-server 生产依赖树删除 `*.d.ts`、`*.map` 与 test/`__tests__`/docs/examples 目录（保留 `*.md`/LICENSE）
* build: web-server standalone 产物删除 sourcemap

### 镜像

* build: dataenv 不再执行整机 `microdnf -y update`（它把基础系统从 8.9 升到 8.10，升级前的文件仍留在基础层，属于纯浪费；`microdnf install` 本身会拉起所需的依赖版本）

## [v1.17.1](https://github.com/apitable/apitable/releases/tag/v1.17.1) (2026-10-27)

构建效率与可复现性收尾，不改变功能。

### 构建

* build: backend 镜像改为 Spring Boot 分层（`layertools`），运行镜像按 dependencies / spring-boot-loader / snapshot-dependencies / application 分四层拷贝，代码变更只推最后一层（≈5 MB，而不是 183 MB 的整包）
* build: web-server 把 webpack 文件缓存放到 `distDir` 之外（`NEXT_WEBPACK_CACHE_DIR` + BuildKit cache mount），避免被 `rm -rf web_build` 清掉
* build: dataenv 的 rabbitmq-server / erlang / mysql-community-server-minimal / openresty / redis 钉到具体版本，镜像内输出 `/sbom/rpms.txt`
* build: pnpm 版本统一为 8.13.1（`packageManager`、三个 CI 工作流、两个基础镜像原本就是 8.13.1）
* build: 移除根依赖里未被任何源码引用的 `apitable@latest`
* test: 修复 `MemberServiceImplTest` 的时区依赖 —— 邀请记录不写 `created_at` 时取数据库
  `CURRENT_TIMESTAMP`（容器时区），与 JVM 时区差一天，导致每天 UTC 16:00 之后该用例必然失败

### 说明

* 首屏分析结论：自托管构建的客户端包里**不含** `posthog-js` / `@sentry`（已被 tree-shake），`exceljs`(1.1MB) / `recharts`(373KB) / `xgplayer`(311KB) / `konva`(97KB) 已全部是异步 chunk。剩余首屏体积集中在单个 3.5 MB 的全局 CSS，需要按页面拆分并做视觉回归，单列为后续任务，本次不动

## [v1.17.0](https://github.com/apitable/apitable/releases/tag/v1.17.0) (2026-10-26)

构建、运行时与交付体积优化，不改变业务功能。

### 镜像与构建

* build: room-server 拆为 deps / prod-deps / builder / runner 四阶段，运行镜像改用 `node:22-bookworm-slim`，只保留生产依赖与构建产物（≈1.6G → ≈450M）
* build: web-server 运行镜像改用 `node:22-alpine`，去掉运行期无用的锁文件（643M → ≈250M）
* build: backend-server 运行镜像改用 `amazoncorretto:17-al2023-headless`，Gradle 依赖与编译缓存改为挂载复用
* build: init-db 与 gateway 基础镜像改用 alpine 变体
* build: `.dockerignore` 补齐 `docs`、`**/build`、`**/.gradle`、`**/dist`、根 `.env` 等，构建上下文 ≈800M → ≈170M
* build: 拆分构建基础镜像与运行基础镜像，修复 `buildx bake --load` 与多平台清单冲突
* build: CI 缓存按组件分档（backend 保留 `mode=max`，其余 `mode=min`），避免 GHA 缓存被 node_modules 挤出
* build: 组件指纹纳入基础镜像 Dockerfile 与 `docker-bake.hcl`

### 启动与内存

* perf: `init-appdata` 以内置版本号作戳，同版本重启不再全量导入模板/组件数据（冷启动 81s → ~45s）
* perf: liquibase 的 `clearChecksums` 改为 `update` 失败后的补偿路径，不再每次启动重算全部校验和
* fix: 修正 `-Dtable.prefix` 缺少右引号导致 `-DDB_ENGINE` 从未传给 liquibase
* perf: backend/room-server/web-server 显式设置堆上限，基础设施进程降低调度优先级
* perf: MySQL 提高 buffer pool 与 redo log 容量，Redis 设置 `maxmemory` 与 `noeviction`
* perf: compose 各服务内存上限可用 `.env` 覆盖（`*_MEM_LIMIT`）

### 前端与网关

* perf: 网关为 `/_next/static` 增加代理缓存与 `immutable` 长缓存，其余 `/_next` 路径显式 `no-store`
* perf: 生产构建剔除 `console.*`，`gzip_types` 补齐 svg/xml/wasm

### 修复

* fix: **容器重启后 MySQL 拒绝启动**。集群一直以 `--lower_case_table_names=2` 启动 mysqld，
  而 MySQL 8 在大小写敏感的 Linux 文件系统上初始化时会强制回落为 0（首次启动日志里能看到
  `Now setting lower_case_table_names to 0`），重启时参数与数据字典不一致，mysqld 直接退出
  （`Different lower_case_table_names settings for server ('2') and data dictionary ('0')`），
  表现为容器重启后 backend 一直等 MySQL、健康检查永远不通过。现统一为初始化与启动都用 0
* fix: `node-fetch` 被 automation webhook / slack 等运行时模块引用，但声明在 devDependencies，生产依赖安装后会缺失；已移动到 dependencies

## [v1.10.0-beta.3](https://github.com/apitable/apitable/releases/tag/v1.10.0-beta.3) (2024-05-06)


### What's more

* sync: hosted cloud ([#1734](https://github.com/apitable/apitable/pull/1734)) @zoe-icu 
* refactor: add changelog ([#1721](https://github.com/apitable/apitable/pull/1721)) @zoe-icu 
* chore: upgrade mysql2 ([#11084](https://github.com/apitable/apitable/pull/1734/commits/d299e369b8047f577e915adfe3b627317af3028c)) @zoe-icu 
## [v1.10.0-beta.2](https://github.com/apitable/apitable/releases/tag/v1.10.0-beta.2) (2024-04-17)


### Bug fixes

* fix: delete automation trigger ([#1657](https://github.com/apitable/apitable/pull/1657)) @zoe-icu 

### What's more

* sync: hosted cloud ([#1720](https://github.com/apitable/apitable/pull/1720)) @zoe-icu 
## [v1.10.0-beta](https://github.com/apitable/apitable/releases/tag/v1.10.0-beta) (2024-03-11)


### What's more

* sync: hosted cloud ([#1652](https://github.com/apitable/apitable/pull/1652)) @ChambersChan 
## [v1.9.0-beta](https://github.com/apitable/apitable/releases/tag/v1.9.0-beta) (2024-01-29)


### Bug fixes

* fix: usage warn func ([#1573](https://github.com/apitable/apitable/pull/1573)) @wangkailang 

### What's more

* sync: hosted cloud ([#1571](https://github.com/apitable/apitable/pull/1571)) @chalme 
* chore: changelog update ([#1574](https://github.com/apitable/apitable/pull/1574)) @chalme 
* Sync/hosted ([#1581](https://github.com/apitable/apitable/pull/1581)) @jeremyyin2012 
* chore: changelog update ([#1583](https://github.com/apitable/apitable/pull/1583)) @jeremyyin2012 
* sync: hosted cloud ([#1592](https://github.com/apitable/apitable/pull/1592)) @JoverZhang 
## [v1.8.0-beta.3](https://github.com/apitable/apitable/releases/tag/v1.8.0-beta.3) (2024-01-23)


### What's more

* Sync/hosted ([#1581](https://github.com/apitable/apitable/pull/1581)) @jeremyyin2012 
## [v1.8.0-beta.2](https://github.com/apitable/apitable/releases/tag/v1.8.0-beta.2) (2024-01-15)


### Bug fixes

* fix: usage warn func ([#1573](https://github.com/apitable/apitable/pull/1573)) @wangkailang 

### What's more

* sync: hosted cloud ([#1571](https://github.com/apitable/apitable/pull/1571)) @chalme 
## [v1.8.0-beta.1](https://github.com/apitable/apitable/releases/tag/v1.8.0-beta.1) (2024-01-08)


### What's more

* sync: hosted cloud ([#1561](https://github.com/apitable/apitable/pull/1561)) @robot518 
## [v1.8.0-beta](https://github.com/apitable/apitable/releases/tag/v1.8.0-beta) (2024-01-02)

### Bug fixes

- fix: func undefined check ([#1542](https://github.com/apitable/apitable/pull/1542)) @wangkailang
- fix: usage warn func check ([#1555](https://github.com/apitable/apitable/pull/1555)) @wangkailang

### What's more

- refactor: use_responsive hook ([#1419](https://github.com/apitable/apitable/pull/1419)) @liaoliao666
- sync: hosted cloud ([#1540](https://github.com/apitable/apitable/pull/1540)) @ChambersChan
- docs: changelog for v1.7.0 ([#1544](https://github.com/apitable/apitable/pull/1544)) @ChambersChan
- sync: hosted cloud ([#1553](https://github.com/apitable/apitable/pull/1553)) @zoe-icu

## [v1.7.0-beta.1](https://github.com/apitable/apitable/releases/tag/v1.7.0-beta.1) (2023-12-25)

### Bug fixes

- fix: func undefined check ([#1542](https://github.com/apitable/apitable/pull/1542)) @wangkailang

### What's more

- refactor: use_responsive hook ([#1419](https://github.com/apitable/apitable/pull/1419)) @liaoliao666
- sync: hosted cloud ([#1540](https://github.com/apitable/apitable/pull/1540)) @ChambersChan

## [v1.7.0-beta](https://github.com/apitable/apitable/releases/tag/v1.7.0-beta) (2023-12-18)

### What's more

- docs: update readme.md ([#1523](https://github.com/apitable/apitable/pull/1523)) @ChambersChan
- sync: hosted cloud ([#1528](https://github.com/apitable/apitable/pull/1528)) @jeremyyin2012

## [v1.6.0-beta.1](https://github.com/apitable/apitable/releases/tag/v1.6.0-beta.1) (2023-12-11)

### Bug fixes

- fix: env IS_SELFHOST default true ([#1515](https://github.com/apitable/apitable/pull/1515)) @wangkailang

### What's more

- chore: tune gitpod dockerfile ([#1509](https://github.com/apitable/apitable/pull/1509)) @ChambersChan
- sync: hosted cloud ([#1519](https://github.com/apitable/apitable/pull/1519)) @JoverZhang

## [v1.6.0-beta](https://github.com/apitable/apitable/releases/tag/v1.6.0-beta) (2023-12-04)

### Bug fixes

- fix: room-server start error ([#1505](https://github.com/apitable/apitable/pull/1505)) @chalme
- fix: csrf filter ([#1506](https://github.com/apitable/apitable/pull/1506)) @ChambersChan

### What's more

- sync: hosted cloud ([#1503](https://github.com/apitable/apitable/pull/1503)) @chalme

## [v1.5.0-beta.1](https://github.com/apitable/apitable/releases/tag/v1.5.0-beta.1) (2023-11-27)

### What's more

- sync: hosted cloud ([#1481](https://github.com/apitable/apitable/pull/1481)) @shawndenggh

## [v1.5.0-beta](https://github.com/apitable/apitable/releases/tag/v1.5.0-beta) (2023-11-20)

### What's more

- sync: hosted cloud ([#1469](https://github.com/apitable/apitable/pull/1469)) @robot518

## [v1.4.0-beta.3](https://github.com/apitable/apitable/releases/tag/v1.4.0-beta.3) (2023-11-13)

### Features and enhancements

- feat: gen ce api client module ([#1445](https://github.com/apitable/apitable/pull/1445)) @ranglang
- feat: change contactus url ([#1454](https://github.com/apitable/apitable/pull/1454)) @yo-ooiii

### Bug fixes

- fix: workdoc with env ([#1463](https://github.com/apitable/apitable/pull/1463)) @wangkailang

### What's more

- sync: hosted cloud ([#1460](https://github.com/apitable/apitable/pull/1460)) @ziqiangai

## [v1.4.0-beta.2](https://github.com/apitable/apitable/releases/tag/v1.4.0-beta.2) (2023-11-06)

### What's more

- chore: fix all-in-one pnpm canvas path ([#1431](https://github.com/apitable/apitable/pull/1431)) @networkhermit
- merge Release/1.4.0 fix back develop ([#1437](https://github.com/apitable/apitable/pull/1437)) @jeremyyin2012
- sync: hosted cloud ([#1440](https://github.com/apitable/apitable/pull/1440)) @chalme

## [v1.4.0-beta.1](https://github.com/apitable/apitable/releases/tag/v1.4.0-beta.1) (2023-10-31)

### What's more

- fix: ai components build by ([#1430](https://github.com/apitable/apitable/pull/1430)) @jeremyyin2012

## [v1.4.0-beta](https://github.com/apitable/apitable/releases/tag/v1.4.0-beta) (2023-10-30)

### Bug fixes

- fix: welcome crash ([#1429](https://github.com/apitable/apitable/pull/1429)) @wangkailang

### What's more

- docs: add one-click-deploy link @jbgh
- add Dome one-click badge @jbgh
- docs: add one-click-deploy link ([#1378](https://github.com/apitable/apitable/pull/1378)) @paylm
- sync: hosted cloud ([#1407](https://github.com/apitable/apitable/pull/1407)) @shawndenggh
- sync: hosted cloud ([#1427](https://github.com/apitable/apitable/pull/1427)) @jeremyyin2012

## [v1.3.0-beta.1](https://github.com/apitable/apitable/releases/tag/v1.3.0-beta.1) (2023-10-17)

### Bug fixes

- fix: Update CHANGELOG.md ([#1374](https://github.com/apitable/apitable/pull/1374)) @robot518
- fix: room-server use pnpm command ([#1384](https://github.com/apitable/apitable/pull/1384)) @cloud0072
- fix: record_archive db changelog ([#1388](https://github.com/apitable/apitable/pull/1388)) @chalme
- fix: change update ([#1389](https://github.com/apitable/apitable/pull/1389)) @chalme
- fix: archived crash @laboonly
- fix: Tooltip components import path @laboonly
- fix: archived crash ([#1392](https://github.com/apitable/apitable/pull/1392)) @laboonly

### What's more

- sync: hosted cloud ([#1385](https://github.com/apitable/apitable/pull/1385)) @JoverZhang
- chore: make web server arm64 build as experimental ([#1390](https://github.com/apitable/apitable/pull/1390)) @networkhermit

## [v1.3.0-beta](https://github.com/apitable/apitable/releases/tag/v1.3.0-beta) (2023-10-09)

### Bug fixes

- fix: widget-sdk pkg with js files ([#1362](https://github.com/apitable/apitable/pull/1362)) @Kilian
- fix: project startup error @JaneSu
- fix: project startup error ([#1370](https://github.com/apitable/apitable/pull/1370)) @Aria

### What's more

- ci: test ci @JaneSu
- ci: test ci @JaneSu
- ci: test ci @JaneSu
- ci: test ci @JaneSu
- ci: test ci @JaneSu
- ci: test ci ([#1366](https://github.com/apitable/apitable/pull/1366)) @Aria
- sync: hosted cloud ([#1367](https://github.com/apitable/apitable/pull/1367)) @Robot Ye Chen

## [v1.2.0-beta](https://github.com/apitable/apitable/releases/tag/v1.2.0-beta) (2023-09-25)

### What's more

- sync: hosted cloud ([#1336](https://github.com/apitable/apitable/pull/1336)) @functionChenGuoFeng
- chore: gitpod automatic pnpm ([#1337](https://github.com/apitable/apitable/pull/1337)) @functionChenGuoFeng

## [v1.1.0-beta](https://github.com/apitable/apitable/releases/tag/v1.1.0-beta) (2023-09-18)

### What's more

- sync: hosted cloud ([#1319](https://github.com/apitable/apitable/pull/1319)) @ChambersChan

## [v1.0.0-beta.1](https://github.com/apitable/apitable/releases/tag/v1.0.0-beta.1) (2023-09-11)

### Features and enhancements

- feat: changelog update @chalme

### What's more

- chore: changelog for v1.0.0-beta ([#1278](https://github.com/apitable/apitable/pull/1278)) @chalme
- sync: hosted cloud ([#1301](https://github.com/apitable/apitable/pull/1301)) @shawndenggh

## [v1.0.0-beta](https://github.com/apitable/apitable/releases/tag/v1.0.0-beta) (2023-09-05)

### Bug fixes

- fix: fusion path proxy ([#1261](https://github.com/apitable/apitable/pull/1261)) @ChambersChan

### What's more

- chore: changelog for v0.99.1-beta.1 ([#1254](https://github.com/apitable/apitable/pull/1254)) @robot518
- Update README.md @mr-kelly
- chore: update readme.md ([#1274](https://github.com/apitable/apitable/pull/1274)) @shawndenggh
- sync: hosted cloud ([#1276](https://github.com/apitable/apitable/pull/1276)) @chalme

## [v0.99.1-beta.1](https://github.com/apitable/apitable/releases/tag/v0.99.1-beta.1) (2023-08-28)

### Bug fixes

- fix: delete link field crash ([#1253](https://github.com/apitable/apitable/pull/1253)) @wangkailang

### What's more

- chore: changelog for v0.99.1-beta ([#1243](https://github.com/apitable/apitable/pull/1243)) @BinsonZoom
- sync: hosted cloud ([#1248](https://github.com/apitable/apitable/pull/1248)) @robot518

## [v0.99.1-beta](https://github.com/apitable/apitable/releases/tag/v0.99.1-beta) (2023-08-22)

### What's more

- sync: hosted cloud ([#1207](https://github.com/apitable/apitable/pull/1207)) @zoe-icu
- sync: hosted cloud ([#1237](https://github.com/apitable/apitable/pull/1237)) @BinsonZoom

## [v0.99.0-beta](https://github.com/apitable/apitable/releases/tag/v0.99.0-beta) (2023-08-07)

### Bug fixes

- fix: fix code issues @ranglang
- fix:press Enter to login ([#1147](https://github.com/apitable/apitable/pull/1147)) @yo-ooiii
- fix: typo ([#1170](https://github.com/apitable/apitable/pull/1170)) @okisdev
- fix: fix code issues @ranglang
- fix: fix code issues @ranglang
- fix: remove the deprecated vscode extension ([#1178](https://github.com/apitable/apitable/pull/1178)) @okisdev

### What's more

- Press Enter to submit the form @yo-ooiii
- chore: 0.99.0 release ([#1167](https://github.com/apitable/apitable/pull/1167)) @dage233
- Merge branch 'develop' into fix/password-enter-login @yo-ooiii
- Feature/robot rich test ([#1175](https://github.com/apitable/apitable/pull/1175)) @JaneSu
- sync: hosted cloud ([#1183](https://github.com/apitable/apitable/pull/1183)) @Exclamation-mark

## [v0.99.0-alpha](https://github.com/apitable/apitable/releases/tag/v0.99.0-alpha) (2023-08-01)

### Features and enhancements

- feat: add deploy to digitalocean ([#951](https://github.com/apitable/apitable/pull/951)) @networkhermit
- feat:register user default language ([#1007](https://github.com/apitable/apitable/pull/1007)) @Exclamation-mark
- feat: enable delete space ([#1079](https://github.com/apitable/apitable/pull/1079)) @wmEvie
- feat: enable experimental multi-arch build for linux/amd64 and linux/arm64 ([#1103](https://github.com/apitable/apitable/pull/1103)) @networkhermit
- feat: auto use browser language ([#1152](https://github.com/apitable/apitable/pull/1152)) @qiuqfang

### Bug fixes

- fix: add missing alt attribute to Upgrade Succeed image ([#941](https://github.com/apitable/apitable/pull/941)) @shunyue1320
- fix: allow unit_id to be empty string @zoe-icu
- fix: allow unit_id to be empty string ([#953](https://github.com/apitable/apitable/pull/953)) @zoe-icu
- fix: fix scrollbar's bg style ([#5138](https://github.com/apitable/apitable/pull/5138)) @ranglang
- fix: fix scrollbar's bg style ([#5138](https://github.com/apitable/apitable/pull/5138)) (#988) @JaneSu
- fix: fix checkbox emoj for cell value @ranglang
- fix: fix checkbox emoj for cell value ([#999](https://github.com/apitable/apitable/pull/999)) @ranglang
- fix: zh-CN.strings error ([#1006](https://github.com/apitable/apitable/pull/1006)) @Exclamation-mark
- fix: fusion api select new option error ([#1014](https://github.com/apitable/apitable/pull/1014)) @arucil
- fix: quote template sub node sync failure ([#1018](https://github.com/apitable/apitable/pull/1018)) @ChambersChan
- fix: get error language code und ([#1022](https://github.com/apitable/apitable/pull/1022)) @Exclamation-mark
- fix: changelog version error @Exclamation-mark
- fix: fix dashboard connected for widget [#5133](https://github.com/apitable/apitable/pull/5133) (#1059) @ranglang
- fix: Improved security by replacing the custom secret CR_PAT with the built-in GITHUB_TOKEN in the GitHub Actions workflow file ai_code_reviewer.yml. ([#1075](https://github.com/apitable/apitable/pull/1075)) @mr-kelly
- fix: sign up password match issue ([#1052](https://github.com/apitable/apitable/pull/1052)) (#1074) @llkevin13579
- fix: fix i18n tips ([#1078](https://github.com/apitable/apitable/pull/1078)) @ranglang
- fix: disable USE_NATIVE_MODULE by default ([#1086](https://github.com/apitable/apitable/pull/1086)) @maltoze
- fix: update error message ([#1097](https://github.com/apitable/apitable/pull/1097)) @llkevin13579
- fix: duplicate bucket path ([#1146](https://github.com/apitable/apitable/pull/1146)) @ChambersChan

### What's more

- chore: add config for specifying rust version ([#947](https://github.com/apitable/apitable/pull/947)) @arucil
- chore: changelog for 0.22.0-alpha ([#948](https://github.com/apitable/apitable/pull/948)) @shawndenggh
- sync: hosted cloud ([#967](https://github.com/apitable/apitable/pull/967)) @ChambersChan
- sync: hosted cloud ([#969](https://github.com/apitable/apitable/pull/969)) @ChambersChan
- chore: changelog for v0.22.0-beta ([#970](https://github.com/apitable/apitable/pull/970)) @ChambersChan
- sync: hosted cloud ([#989](https://github.com/apitable/apitable/pull/989)) @Exclamation-mark
- chore: changelog for v0.22.0-beta.1 @Exclamation-mark
- Merge branch 'develop' into feature/fix-checkbox-emoj @JaneSu
- sync: hosted ([#1013](https://github.com/apitable/apitable/pull/1013)) @arucil
- sync: hosted cloud ([#1056](https://github.com/apitable/apitable/pull/1056)) @Exclamation-mark
- chore: changelog for v0.23.0-release @Exclamation-mark
- chore(deps-dev): bump stylelint from 13.9.0 to 15.10.1 ([#1046](https://github.com/apitable/apitable/pull/1046)) @dependabot[bot]
- chore(deps): bump semver from 7.3.8 to 7.5.2 ([#983](https://github.com/apitable/apitable/pull/983)) @dependabot[bot]
- chore(deps): bump posthog-js from 1.51.1 to 1.57.2 ([#843](https://github.com/apitable/apitable/pull/843)) @dependabot[bot]
- chore(deps): bump @grpc/grpc-js from 1.7.1 to 1.8.8 ([#1031](https://github.com/apitable/apitable/pull/1031)) @dependabot[bot]
- chore(deps): bump socket.io-parser from 3.3.0 to 3.3.3 ([#863](https://github.com/apitable/apitable/pull/863)) @dependabot[bot]
- chore: Added GitHub Actions workflow file for AI code review. ([#1071](https://github.com/apitable/apitable/pull/1071)) @mr-kelly
- sync: hosted cloud ([#1094](https://github.com/apitable/apitable/pull/1094)) @ChambersChan
- chore: changelog for v0.23.0-beta.2 ([#1099](https://github.com/apitable/apitable/pull/1099)) @ChambersChan
- chore: trigger multi-arch build only on tag as it is extreme slow ([#1106](https://github.com/apitable/apitable/pull/1106)) @networkhermit
- chore(deps): bump word-wrap from 1.2.3 to 1.2.4 ([#1104](https://github.com/apitable/apitable/pull/1104)) @dependabot[bot]
- sync/hosted into develop ([#1123](https://github.com/apitable/apitable/pull/1123)) @functionChenGuoFeng
- chore: update v0.24.0-alpha changelog ([#1131](https://github.com/apitable/apitable/pull/1131)) @functionChenGuoFeng
- Update ja-JP/README.md ([#1030](https://github.com/apitable/apitable/pull/1030)) @eltociear
- Make mail STARTTLS settings configurable ([#1072](https://github.com/apitable/apitable/pull/1072)) @spantaleev
- docs: remove duplicate contribution introduction in readme ([#1156](https://github.com/apitable/apitable/pull/1156)) @ChambersChan
- Revert "feat: auto use browser language" ([#1166](https://github.com/apitable/apitable/pull/1166)) @wangkailang
- sync: hosted cloud ([#1164](https://github.com/apitable/apitable/pull/1164)) @dage233

## [v0.24.0-alpha](https://github.com/apitable/apitable/releases/tag/v0.24.0-alpha) (2023-07-25)

### Features and enhancements

- feat: enable experimental multi-arch build for linux/amd64 and linux/arm64 ([#1103](https://github.com/apitable/apitable/pull/1103)) @networkhermit

### Bug fixes

- fix: update error message ([#1097](https://github.com/apitable/apitable/pull/1097)) @llkevin13579

### What's more

- chore: changelog for v0.23.0-beta.2 ([#1099](https://github.com/apitable/apitable/pull/1099)) @ChambersChan
- chore: trigger multi-arch build only on tag as it is extreme slow ([#1106](https://github.com/apitable/apitable/pull/1106)) @networkhermit
- chore(deps): bump word-wrap from 1.2.3 to 1.2.4 ([#1104](https://github.com/apitable/apitable/pull/1104)) @dependabot[bot]
- sync/hosted into develop ([#1123](https://github.com/apitable/apitable/pull/1123)) @functionChenGuoFeng

## [v0.23.0-beta.2](https://github.com/apitable/apitable/releases/tag/v0.23.0-beta.2) (2023-07-18)

### Features and enhancements

- feat: enable delete space ([#1079](https://github.com/apitable/apitable/pull/1079)) @wmEvie

### Bug fixes

- fix: fix dashboard connected for widget [#5133](https://github.com/apitable/apitable/pull/5133) (#1059) @ranglang
- fix: Improved security by replacing the custom secret CR_PAT with the built-in GITHUB_TOKEN in the GitHub Actions workflow file ai_code_reviewer.yml. ([#1075](https://github.com/apitable/apitable/pull/1075)) @mr-kelly
- fix: sign up password match issue ([#1052](https://github.com/apitable/apitable/pull/1052)) (#1074) @llkevin13579
- fix: fix i18n tips ([#1078](https://github.com/apitable/apitable/pull/1078)) @ranglang
- fix: disable USE_NATIVE_MODULE by default ([#1086](https://github.com/apitable/apitable/pull/1086)) @maltoze

### What's more

- chore(deps-dev): bump stylelint from 13.9.0 to 15.10.1 ([#1046](https://github.com/apitable/apitable/pull/1046)) @dependabot[bot]
- chore(deps): bump semver from 7.3.8 to 7.5.2 ([#983](https://github.com/apitable/apitable/pull/983)) @dependabot[bot]
- chore(deps): bump posthog-js from 1.51.1 to 1.57.2 ([#843](https://github.com/apitable/apitable/pull/843)) @dependabot[bot]
- chore(deps): bump @grpc/grpc-js from 1.7.1 to 1.8.8 ([#1031](https://github.com/apitable/apitable/pull/1031)) @dependabot[bot]
- chore(deps): bump socket.io-parser from 3.3.0 to 3.3.3 ([#863](https://github.com/apitable/apitable/pull/863)) @dependabot[bot]
- chore: Added GitHub Actions workflow file for AI code review. ([#1071](https://github.com/apitable/apitable/pull/1071)) @mr-kelly
- sync: hosted cloud ([#1094](https://github.com/apitable/apitable/pull/1094)) @ChambersChan

## [v0.23.0-beta.1](https://github.com/apitable/apitable/releases/tag/v0.23.0-beta.1) (2023-07-10)

### Bug fixes

- fix: quote template sub node sync failure ([#1018](https://github.com/apitable/apitable/pull/1018)) @ChambersChan
- fix: get error language code und ([#1022](https://github.com/apitable/apitable/pull/1022)) @Exclamation-mark

### What's more

- sync: hosted cloud ([#1056](https://github.com/apitable/apitable/pull/1056)) @Exclamation-mark

## [v0.23.0-alpha](https://github.com/apitable/apitable/releases/tag/v0.23.0-alpha) (2023-07-03)

### Features and enhancements

- feat:register user default language ([#1007](https://github.com/apitable/apitable/pull/1007)) @Exclamation-mark

### Bug fixes

- fix: fix scrollbar's bg style ([#5138](https://github.com/apitable/apitable/pull/5138)) (#988) @JaneSu
- fix: fix checkbox emoj for cell value ([#999](https://github.com/apitable/apitable/pull/999)) @ranglang
- fix: zh-CN.strings error ([#1006](https://github.com/apitable/apitable/pull/1006)) @Exclamation-mark
- fix: fusion api select new option error ([#1014](https://github.com/apitable/apitable/pull/1014)) @arucil
- fix: quote template sub node sync failure ([#1018](https://github.com/apitable/apitable/pull/1018)) @ChambersChan
- fix: get error language code und ([#1022](https://github.com/apitable/apitable/pull/1022)) @Exclamation-mark

### What's more

- chore: changelog for v0.22.0-beta.1 @Exclamation-mark
- Merge branch 'develop' into feature/fix-checkbox-emoj @JaneSu
- sync: hosted ([#1013](https://github.com/apitable/apitable/pull/1013)) @arucil
- sync: hosted cloud ([#1056](https://github.com/apitable/apitable/pull/1056)) @Exclamation-mark

## [v0.22.0-beta.1](https://github.com/apitable/apitable/releases/tag/v0.22.0-beta.1) (2023-06-26)

### What's more

- chore: changelog for v0.22.0-beta ([#970](https://github.com/apitable/apitable/pull/970)) @ChambersChan
- sync: hosted cloud ([#989](https://github.com/apitable/apitable/pull/989)) @Exclamation-mark

## [v0.22.0-beta](https://github.com/apitable/apitable/releases/tag/v0.22.0-beta) (2023-06-19)

### Features and enhancements

- feat: add deploy to digitalocean ([#951](https://github.com/apitable/apitable/pull/951)) @networkhermit

### Bug fixes

- fix: add missing alt attribute to Upgrade Succeed image ([#941](https://github.com/apitable/apitable/pull/941)) @shunyue1320
- fix: allow unit_id to be empty string @zoe-icu
- fix: allow unit_id to be empty string ([#953](https://github.com/apitable/apitable/pull/953)) @zoe-icu

### What's more

- chore: add config for specifying rust version ([#947](https://github.com/apitable/apitable/pull/947)) @arucil
- chore: changelog for 0.22.0-alpha ([#948](https://github.com/apitable/apitable/pull/948)) @shawndenggh
- sync: hosted cloud ([#967](https://github.com/apitable/apitable/pull/967)) @ChambersChan
- sync: hosted cloud ([#969](https://github.com/apitable/apitable/pull/969)) @ChambersChan

## [v0.22.0-alpha](https://github.com/apitable/apitable/releases/tag/v0.22.0-alpha) (2023-06-12)

### What's more

- sync: hosted cloud ([#944](https://github.com/apitable/apitable/pull/944)) @shawndenggh
- chore: merge release/0.21.0 into develop ([#945](https://github.com/apitable/apitable/pull/945)) @shawndenggh

## [v0.21.0-rc.1](https://github.com/apitable/apitable/releases/tag/v0.21.0-rc.1) (2023-06-05)

### Features and enhancements

- feat: add gzip support in nginx gateway ([#901](https://github.com/apitable/apitable/pull/901)) @networkhermit

### Bug fixes

- fix: improve toolbar view @xieyhn
- fix: option search not case sensitive ([#892](https://github.com/apitable/apitable/pull/892)) @wangkailang
- fix: components unit test error ([#867](https://github.com/apitable/apitable/pull/867)) @GreenMashimaro
- fix/tooltip-flicker @wangkailang
- fix: improve toolbar view ([#869](https://github.com/apitable/apitable/pull/869)) @JaneSu

### What's more

- docs: remove databus guide ([#873](https://github.com/apitable/apitable/pull/873)) @arucil
- docs: publish cookbook and self-hosted doc replace original developer guide ([#886](https://github.com/apitable/apitable/pull/886)) @mr-kelly
- New Crowdin updates ([#796](https://github.com/apitable/apitable/pull/796)) @mr-kelly
- chore: clarify title of issue templates ([#899](https://github.com/apitable/apitable/pull/899)) @arucil
- sync: hosted cloud ([#916](https://github.com/apitable/apitable/pull/916)) @yort-feng

## [v0.21.0-rc](https://github.com/apitable/apitable/releases/tag/v0.21.0-rc) (2023-05-29)

### Features and enhancements

- feat:add language feed back link to datasheet env ([#842](https://github.com/apitable/apitable/pull/842)) @Exclamation-mark

### Bug fixes

- fix: API panel click more button redirects to a blank page ([#829](https://github.com/apitable/apitable/pull/829)) (#833) @luckyyyyy
- fix: field undefined crash ([#884](https://github.com/apitable/apitable/pull/884)) @wangkailang

### What's more

- chore: update translation feedback help url @wmEvie
- chore: update translation feedback help url ([#841](https://github.com/apitable/apitable/pull/841)) @wmEvie
- docs: delete duplicated sentences ([#808](https://github.com/apitable/apitable/pull/808)) @noahlam
- refactor: de-duplications npm packages ([#847](https://github.com/apitable/apitable/pull/847)) @mr-kelly
- sync: hosted cloud ([#881](https://github.com/apitable/apitable/pull/881)) @yort-feng

## [v0.21.0-beta](https://github.com/apitable/apitable/releases/tag/v0.21.0-beta) (2023-05-22)

### Features and enhancements

- feat: upgrade liquibase version ([#801](https://github.com/apitable/apitable/pull/801)) @shawndenggh
- feat: add new email templates @xukecheng
- feat: add new email templates ([#831](https://github.com/apitable/apitable/pull/831)) @xukecheng

### Bug fixes

- fix: remove pre-init-db since upgrade liquibase ([#824](https://github.com/apitable/apitable/pull/824)) @shawndenggh

### What's more

- docs: guide on setting up python and gcc ([#802](https://github.com/apitable/apitable/pull/802)) @arucil
- docs: add clearer description of language versions ([#827](https://github.com/apitable/apitable/pull/827)) @arucil
- sync: hosted cloud ([#840](https://github.com/apitable/apitable/pull/840)) @yort-feng
- chore: update translation feedback help url @wmEvie
- chore: update translation feedback help url ([#841](https://github.com/apitable/apitable/pull/841)) @wmEvie

## [v0.21.0-alpha](https://github.com/apitable/apitable/releases/tag/v0.21.0-alpha) (2023-05-15)

### Features and enhancements

- feat:support language de-DE,es-ES,it-IT,es-ES,it-IT,ja-JP,ko-KR,ru-RU @Exclamation-mark
- feat: update node-gyp to latest version ([#793](https://github.com/apitable/apitable/pull/793)) @arucil

### Bug fixes

- fix(room-server): missing dependencies in image ([#4926](https://github.com/apitable/apitable/pull/4926)) (#777) @arucil
- fix:add missing architecture-overview.png ([#782](https://github.com/apitable/apitable/pull/782)) @Exclamation-mark
- fix: login icon bug @laboonly
- fix: login icon bug ([#799](https://github.com/apitable/apitable/pull/799)) @laboonly

### What's more

- docs: README ([#769](https://github.com/apitable/apitable/pull/769)) @mr-kelly
- New Crowdin updates ([#749](https://github.com/apitable/apitable/pull/749)) @mr-kelly
- docs: create bug report in zh-CN ([#788](https://github.com/apitable/apitable/pull/788)) @mr-kelly
- docs: issue template of bug report cn ([#789](https://github.com/apitable/apitable/pull/789)) @mr-kelly
- sync: hosted cloud ([#794](https://github.com/apitable/apitable/pull/794)) @yort-feng
- chore: changelog for v0.20.0-rc.1 release ([#795](https://github.com/apitable/apitable/pull/795)) @yort-feng

## [v0.20.0-rc.1](https://github.com/apitable/apitable/releases/tag/v0.20.0-rc.1) (2023-05-08)

### Features and enhancements

- feat(l10n):support french && chinese traditional ([#741](https://github.com/apitable/apitable/pull/741)) @Exclamation-mark

### Bug fixes

- fix: avoid loading room-native-api if USE_NATIVE_MODULE is disabled ([#743](https://github.com/apitable/apitable/pull/743)) @arucil
- fix: disable forbid unknow values ([#750](https://github.com/apitable/apitable/pull/750)) @yort-feng
- fix: add multi language images ([#751](https://github.com/apitable/apitable/pull/751)) @luoyunyao

### What's more

- Crowdin add French strings([#684](https://github.com/apitable/apitable/pull/684)) @mr-kelly
- docs: design system ([#748](https://github.com/apitable/apitable/pull/748)) @mr-kelly
- docs: discord invite link update ([#726](https://github.com/apitable/apitable/pull/726)) @mr-kelly
- docs: update Crowdin translate link ([#760](https://github.com/apitable/apitable/pull/760)) @Exclamation-mark
- docs: submit a detail PRD issue ([#762](https://github.com/apitable/apitable/pull/762)) @mr-kelly
- chore: sorts of chores ([#763](https://github.com/apitable/apitable/pull/763)) @mr-kelly
- sync: hosted cloud ([#766](https://github.com/apitable/apitable/pull/766)) @yort-feng

## [v0.20.0-rc](https://github.com/apitable/apitable/releases/tag/v0.20.0-rc) (2023-04-25)

### Features and enhancements

- feat(l10n):Crowdin support translate strings.en-US.json ([#731](https://github.com/apitable/apitable/pull/731)) @Exclamation-mark

### Bug fixes

- fix: widget filter ([#714](https://github.com/apitable/apitable/pull/714)) @yort-feng
- fix: init the custom widget command error ([#719](https://github.com/apitable/apitable/pull/719)) @Sky-FE
- fix: folder favorite click crash ([#735](https://github.com/apitable/apitable/pull/735)) @wangkailang
- fix: strings default crash ([#740](https://github.com/apitable/apitable/pull/740)) @wangkailang

### What's more

- release: v0.20.0-alpha ([#698](https://github.com/apitable/apitable/pull/698)) @yort-feng
- docs: add Scripting Widget documentation link ([#711](https://github.com/apitable/apitable/pull/711)) @mr-kelly
- sync: hosted cloud ([#739](https://github.com/apitable/apitable/pull/739)) @yort-feng

## [v0.20.0-beta](https://github.com/apitable/apitable/releases/tag/v0.20.0-beta) (2023-04-17)

### Bug fixes

- fix: widget filter ([#714](https://github.com/apitable/apitable/pull/714)) @yort-feng

### What's more

- release: v0.20.0-alpha ([#698](https://github.com/apitable/apitable/pull/698)) @yort-feng
- docs: add Scripting Widget documentation link ([#711](https://github.com/apitable/apitable/pull/711)) @mr-kelly
- sync: hosted cloud ([#713](https://github.com/apitable/apitable/pull/713)) @yort-feng

## [v0.20.0-alpha](https://github.com/apitable/apitable/releases/tag/v0.20.0-alpha) (2023-04-10)

### Bug fixes

- fix: recommend widget icon display ([#681](https://github.com/apitable/apitable/pull/681)) @ChambersChan
- fix: recover deleted node failure issue ([#695](https://github.com/apitable/apitable/pull/695)) @ChambersChan
- fix: add cascader strings ([#696](https://github.com/apitable/apitable/pull/696)) @wangkailang

### What's more

- New Crowdin updates ([#653](https://github.com/apitable/apitable/pull/653)) @mr-kelly
- docs: databus guide ([#683](https://github.com/apitable/apitable/pull/683)) @arucil
- sync: hosted cloud ([#689](https://github.com/apitable/apitable/pull/689)) @yort-feng

## [v0.19.0-rc](https://github.com/apitable/apitable/releases/tag/v0.19.0-rc) (2023-04-03)

### Bug fixes

- fix: widget package submit error issue ([#671](https://github.com/apitable/apitable/pull/671)) @ChambersChan

### What's more

- docs: widget-sdk documentation ([#652](https://github.com/apitable/apitable/pull/652)) @mr-kelly
- docs: Improve translation of README and developer-guide in other languages ([#285](https://github.com/apitable/apitable/pull/285)) @mr-kelly
- docs: add brew install canvas ([#599](https://github.com/apitable/apitable/pull/599)) (#654) @Exclamation-mark
- docs: remove description of default username in readme ([#657](https://github.com/apitable/apitable/pull/657)) @ChambersChan
- docs: developer-guide add multilingual translation (l10n) workflow ([#661](https://github.com/apitable/apitable/pull/661)) @Exclamation-mark
- docs: add multi-language images ([#663](https://github.com/apitable/apitable/pull/663)) @luoyunyao
- sync: hosted cloud ([#670](https://github.com/apitable/apitable/pull/670)) @yort-feng

## [v0.19.0-beta](https://github.com/apitable/apitable/releases/tag/v0.19.0-beta) (2023-03-27)

### Bug fixes

- fix: sign up password placeholder string @laboonly
- fix: sign up password placeholder string ([#590](https://github.com/apitable/apitable/pull/590)) @laboonly
- fix: subscription key undefined check ([#629](https://github.com/apitable/apitable/pull/629)) @wangkailang
- fix: level card subscription check ([#648](https://github.com/apitable/apitable/pull/648)) @wangkailang

### What's more

- docs: update developer-guide.md ([#605](https://github.com/apitable/apitable/pull/605)) @mr-kelly
- doc: answer api document address ([#606](https://github.com/apitable/apitable/pull/606)) @shawndenggh
- docs: answer smtp configure & the limitation of widget quantity in da… ([#608](https://github.com/apitable/apitable/pull/608)) @ChambersChan
- docs: answer default port and upgrade @paylm
- docs: answer default port ([#613](https://github.com/apitable/apitable/pull/613)) @paylm
- sync: hosted cloud ([#611](https://github.com/apitable/apitable/pull/611)) @ChambersChan
- docs: developer guide questions ([#609](https://github.com/apitable/apitable/pull/609)) @yort-feng
- chore: contributing in readme ([#624](https://github.com/apitable/apitable/pull/624)) @mr-kelly
- chore: update async view config @wmEvie
- chore: update async view config ([#632](https://github.com/apitable/apitable/pull/632)) @wmEvie
- chore: heartbeat cron ([#641](https://github.com/apitable/apitable/pull/641)) @ChambersChan
- sync: hosted cloud ([#642](https://github.com/apitable/apitable/pull/642)) @yort-feng

## [v0.19.0-alpha](https://github.com/apitable/apitable/releases/tag/v0.19.0-alpha) (2023-03-20)

### Bug fixes

- fix: remove unused test file ([#565](https://github.com/apitable/apitable/pull/565)) @shawndenggh
- fix: disable awsc ignore verification ([#577](https://github.com/apitable/apitable/pull/577)) @wangkailang
- fix: sign up password placeholder string @laboonly
- fix: sign up password placeholder string ([#590](https://github.com/apitable/apitable/pull/590)) @laboonly

### What's more

- release: v0.18.0-rc.2 ([#556](https://github.com/apitable/apitable/pull/556)) @yort-feng
- sync: hosted cloud ([#589](https://github.com/apitable/apitable/pull/589)) @yort-feng

## [v0.18.0-rc.2](https://github.com/apitable/apitable/releases/tag/v0.18.0-rc.2) (2023-03-13)

### Features and enhancements

- feat: optimize patch records api ([#526](https://github.com/apitable/apitable/pull/526)) @yort-feng
- feat: optimize post records api ([#544](https://github.com/apitable/apitable/pull/544)) @yort-feng
- feat: add a snippet code of prodcut analytics ([#547](https://github.com/apitable/apitable/pull/547)) @Sky-FE
- feat: support huaweicloud OBS for Oss ([#537](https://github.com/apitable/apitable/pull/537)) @showlovetommy

### Bug fixes

- fix: correct env value about all-in-one dockerfile ([#528](https://github.com/apitable/apitable/pull/528)) @ChambersChan
- fix: init theme in widget runtime ([#542](https://github.com/apitable/apitable/pull/542)) @boris-w
- fix: query may be undefined ([#553](https://github.com/apitable/apitable/pull/553)) @boris-w

### What's more

- refactor: replace node cte sql ([#473](https://github.com/apitable/apitable/pull/473)) @ChambersChan
- sync: hosted cloud ([#551](https://github.com/apitable/apitable/pull/551)) @yort-feng

## [v0.18.0-rc.1](https://github.com/apitable/apitable/releases/tag/v0.18.0-rc.1) (2023-03-06)

### Features and enhancements

- feat: fix existing unidir link ([#3333](https://github.com/apitable/apitable/pull/3333)) @arucil
- feat: apitable support to reset password ([#3278](https://github.com/apitable/apitable/pull/3278)) @zoe-icu
- feat: timezone fe ([#3268](https://github.com/apitable/apitable/pull/3268)) @wangkailang
- feat: apitable change password ([#3369](https://github.com/apitable/apitable/pull/3369)) @laboonly
- feat: components color change ([#3386](https://github.com/apitable/apitable/pull/3386)) @laboonly
- feat: add apitable cloud reset password error message ([#3438](https://github.com/apitable/apitable/pull/3438)) @laboonly
- feat: auth0 email varify ([#3465](https://github.com/apitable/apitable/pull/3465)) @zoe-icu
- feat: apitable email verification page ([#3456](https://github.com/apitable/apitable/pull/3456)) @laboonly
- feat: node update/create api modify ([#3477](https://github.com/apitable/apitable/pull/3477)) @zoe-icu
- feat: infoflow share form permission ([#3469](https://github.com/apitable/apitable/pull/3469)) @zoe-icu
- feat: design icons ([#3442](https://github.com/apitable/apitable/pull/3442)) @Sky-FE
- feat: migrate getRecordsById to rust ([#3391](https://github.com/apitable/apitable/pull/3391)) @arucil
- feat: merge test/0.18.1 into develop ([#3515](https://github.com/apitable/apitable/pull/3515)) @arucil
- feat: set system default timezone ([#3517](https://github.com/apitable/apitable/pull/3517)) @LiuZijingBron
- feat: phone and email input add input rules ([#3523](https://github.com/apitable/apitable/pull/3523)) @laboonly
- feat: static icons migration ([#3531](https://github.com/apitable/apitable/pull/3531)) @Sky-FE
- feat: api modify view name support to define view name length ([#3592](https://github.com/apitable/apitable/pull/3592)) @zoe-icu
- feat: schedule task for reporting ([#3585](https://github.com/apitable/apitable/pull/3585)) @shawndenggh
- feat: embed support manual save ([#3619](https://github.com/apitable/apitable/pull/3619)) @JaneSu

### Bug fixes

- fix: core unit test errors ([#3355](https://github.com/apitable/apitable/pull/3355)) @arucil
- fix: dayjs plugin ts error ([#3365](https://github.com/apitable/apitable/pull/3365)) @wangkailang
- fix: link auth0 user provider should not be null ([#3377](https://github.com/apitable/apitable/pull/3377)) @zoe-icu
- fix: use sensors env ([#3404](https://github.com/apitable/apitable/pull/3404)) @wangkailang
- fix: avoid form commit no change jot ([#3437](https://github.com/apitable/apitable/pull/3437)) @wangkailang
- fix: only enterprise set symlinks false ([#3448](https://github.com/apitable/apitable/pull/3448)) @wangkailang
- fix: mobile style ([#3453](https://github.com/apitable/apitable/pull/3453)) @wangkailang
- fix: modify node info cannot be synchronized ([#3452](https://github.com/apitable/apitable/pull/3452)) @zoe-icu
- fix: share embed modal form hidden logo ([#3459](https://github.com/apitable/apitable/pull/3459)) @laboonly
- fix: mirror add record ([#3462](https://github.com/apitable/apitable/pull/3462)) @arucil
- fix: sensors not found ([#3464](https://github.com/apitable/apitable/pull/3464)) @wangkailang
- fix: widget menu render ([#3468](https://github.com/apitable/apitable/pull/3468)) @boris-w
- fix: collaborative add widget in the dashboard does not get the entity ([#3480](https://github.com/apitable/apitable/pull/3480)) @boris-w
- fix: mobile menu group style ([#3487](https://github.com/apitable/apitable/pull/3487)) @wangkailang
- fix: widget grid layout init in the dashborad ([#3488](https://github.com/apitable/apitable/pull/3488)) @boris-w
- fix: popup css error ([#3489](https://github.com/apitable/apitable/pull/3489)) @wangkailang
- fix: dashboard init layout ([#3509](https://github.com/apitable/apitable/pull/3509)) @boris-w
- fix: safari create team fail ([#3507](https://github.com/apitable/apitable/pull/3507)) @wangkailang
- fix: View name length handling error ([#3521](https://github.com/apitable/apitable/pull/3521)) @JaneSu
- fix: embed link expand record show comment pane ([#3547](https://github.com/apitable/apitable/pull/3547)) @laboonly
- fix: databus unit test type errors ([#3546](https://github.com/apitable/apitable/pull/3546)) @arucil
- fix: email and phone feild input add rules ([#3561](https://github.com/apitable/apitable/pull/3561)) @laboonly
- fix: unknown column issue ([#3562](https://github.com/apitable/apitable/pull/3562)) @yort-feng
- fix: env control nps disable ([#3578](https://github.com/apitable/apitable/pull/3578)) @wangkailang
- fix: reset password get verify code ([#3586](https://github.com/apitable/apitable/pull/3586)) @wangkailang
- fix: space manual view save not work on embed link ([#3581](https://github.com/apitable/apitable/pull/3581)) @zoe-icu
- fix: web ci fail ([#3593](https://github.com/apitable/apitable/pull/3593)) @wangkailang
- fix: icon style ([#3600](https://github.com/apitable/apitable/pull/3600)) @Sky-FE
- fix: multi timeZone serializer ([#3580](https://github.com/apitable/apitable/pull/3580)) @LiuZijingBron
- fix: apitable register bugfix @laboonly
- fix: clear console.log @laboonly
- fix: the logo on the create space page supports the dark theme ([#508](https://github.com/apitable/apitable/pull/508)) @boris-w
- fix: missing import @laboonly
- fix: apitable register bugfix ([#509](https://github.com/apitable/apitable/pull/509)) @laboonly

### What's more

- chore: upgrade email copy right @xukecheng
- Merge branch 'develop' into chore/upgrade_email_copy_right @xukecheng
- Fix/iteration14 bugfix ([#3351](https://github.com/apitable/apitable/pull/3351)) @laboonly
- Feat/iframe ([#3361](https://github.com/apitable/apitable/pull/3361)) @JaneSu
- test: add update user timezone unit test ([#3366](https://github.com/apitable/apitable/pull/3366)) @LiuZijingBron
- sync: APITable Merge commit 'e6f50e43c1595fd16906c1eabd400f7fdf442542' into develop @mr-kelly
- Feat/apitable change password ([#3371](https://github.com/apitable/apitable/pull/3371)) @laboonly
- sync: APITable Merge commit '15856531bd388cc9272c474b19930af398c23c07' into develop @mr-kelly
- Feat/apitable change password ([#3374](https://github.com/apitable/apitable/pull/3374)) @laboonly
- Fix cola ([#3381](https://github.com/apitable/apitable/pull/3381)) @JaneSu
- chore: classify enterprise dir ([#3372](https://github.com/apitable/apitable/pull/3372)) @shawndenggh
- Merge commit '4d600c938308566f6776d3dfadd8860fd5959fe0' into develop @mr-kelly
- Fix cola ([#3415](https://github.com/apitable/apitable/pull/3415)) @JaneSu
- refactor: integrate DataBus into frontend ([#3037](https://github.com/apitable/apitable/pull/3037)) @arucil
- Feat/embed dashboard ([#3440](https://github.com/apitable/apitable/pull/3440)) @JaneSu
- chore: merge release/0.18.0 to develop ([#3433](https://github.com/apitable/apitable/pull/3433)) @boris-w
- chore: apply edition db changeset depend on local differ edition development ([#3447](https://github.com/apitable/apitable/pull/3447)) @shawndenggh
- refactor: view derivation calculated data ([#2853](https://github.com/apitable/apitable/pull/2853)) @boris-w
- revert: restore init-appdata service in dataenv-up ([#3450](https://github.com/apitable/apitable/pull/3450)) @shawndenggh
- Feat/embed dashboard ([#3451](https://github.com/apitable/apitable/pull/3451)) @JaneSu
- sync: APITable Merge commit '8eb02d1f6fbd1ab43827fadc3e13cc7189c7d02d' into develop @mr-kelly
- chore: unified data services image version ([#3460](https://github.com/apitable/apitable/pull/3460)) @shawndenggh
- chore: apitable data services image version change ([#3461](https://github.com/apitable/apitable/pull/3461)) @shawndenggh
- chore: third-party scripts env ([#3457](https://github.com/apitable/apitable/pull/3457)) @wangkailang
- Feat/embed dashboard ([#3470](https://github.com/apitable/apitable/pull/3470)) @JaneSu
- chore: tune mail starter ([#3483](https://github.com/apitable/apitable/pull/3483)) @ChambersChan
- sync: APITable Merge commit '4135b4e190bca5828c6e19b253e3401575eb3108' into develop @mr-kelly
- sync: APITable Merge branch 'develop' of github.com:vikadata/vikadata into develop @mr-kelly
- Revert "feat: migrate getRecordsById to rust ([#3391](https://github.com/apitable/apitable/pull/3391))" (#3500) @arucil
- chore: tune afs starter & upload afs verify ([#3512](https://github.com/apitable/apitable/pull/3512)) @ChambersChan
- sync: APITable Merge commit '99f80b54f12d3f68dc5af318dee10696760b4aa6' into develop @mr-kelly
- refactor: resolve merge conflict ([#3533](https://github.com/apitable/apitable/pull/3533)) @zoe-icu
- sync: apitable to vikadata ([#3540](https://github.com/apitable/apitable/pull/3540)) @yort-feng
- chore: ci for cross compiling room-native-api to arm64 ([#3536](https://github.com/apitable/apitable/pull/3536)) @arucil
- sync: apitable ([#3564](https://github.com/apitable/apitable/pull/3564)) @Sky-FE
- Revert "sync: apitable" ([#3583](https://github.com/apitable/apitable/pull/3583)) @yort-feng
- Merge commit '1815a91b6f96361fefcd1de83b7463f0efeecb58' into develop @yort-feng
- chore: revert commit codes manully due to auto merge issue @yort-feng
- Merge branch 'develop' into sync/apitable-23022802 @yort-feng
- Feat/apitable ce register ([#3606](https://github.com/apitable/apitable/pull/3606)) @laboonly
- chore: merge conflict @Sky-FE
- Sync/hosted ([#487](https://github.com/apitable/apitable/pull/487)) @laboonly
- chore: sync env to all-in-one dockerfile ([#491](https://github.com/apitable/apitable/pull/491)) @ChambersChan
- docs: improve zh-CN translation ([#367](https://github.com/apitable/apitable/pull/367)) @xianjianlf2
- chore: upgrade email copy right ([#298](https://github.com/apitable/apitable/pull/298)) @xukecheng
- hpm log with api prefix ([#476](https://github.com/apitable/apitable/pull/476)) @buzuosheng
- Merge branch 'develop' into fix/register-bugfix @laboonly
- Merge branch 'develop' into fix/register-bugfix @laboonly
- Merge branch 'fix/register-bugfix' of github.com:apitable/apitable into fix/register-bugfix @laboonly
- sync: hosted cloud ([#511](https://github.com/apitable/apitable/pull/511)) @yort-feng

## [v0.18.0-rc](https://github.com/apitable/apitable/releases/tag/v0.18.0-rc) (2023-02-28)

### Features and enhancements

- feat: register api ([#440](https://github.com/apitable/apitable/pull/440)) @ChambersChan
- feat: replace controller's swagger2 annotation with openapi annotation @LiuZijingBron
- feat: modify lint.yml @LiuZijingBron
- feat: modify .jscpd.json @LiuZijingBron
- feat: Add email template: task-due-remind ([#438](https://github.com/apitable/apitable/pull/438)) @wmEvie

### Bug fixes

- fix: widget crash @JaneSu
- fix: widget crash ([#448](https://github.com/apitable/apitable/pull/448)) @JaneSu
- fix: parse date strings in the mobile calendar month picker according to standard format ([#449](https://github.com/apitable/apitable/pull/449)) @Sky-FE
- fix: trash error ([#455](https://github.com/apitable/apitable/pull/455)) @wangkailang
- fix: README spell ([#441](https://github.com/apitable/apitable/pull/441)) @0xflotus
- fix: robot error ([#458](https://github.com/apitable/apitable/pull/458)) @oolongTea007

### What's more

- release: v0.18.0-beta ([#432](https://github.com/apitable/apitable/pull/432)) @yort-feng
- docs: remove start socket server introduce ([#436](https://github.com/apitable/apitable/pull/436)) @ChambersChan
- Add email template: task-due-remind @wmEvie
- chore: replace swagger2 with springdoc-openapi @LiuZijingBron
- Update subject.properties @wmEvie
- Merge branch 'develop' into chore-knife4j-swagger @LiuZijingBron
- chore: replace swagger2 with springdoc-openapi ([#439](https://github.com/apitable/apitable/pull/439)) @LiuZijingBron
- chore: replace model swagger2 annotation with openapi annotation @LiuZijingBron
- Merge branch 'develop' into chore-openapi-model @LiuZijingBron
- chore: replace model swagger2 annotation with openapi annotation ([#460](https://github.com/apitable/apitable/pull/460)) @LiuZijingBron
- docs: fix L10N readme href ([#456](https://github.com/apitable/apitable/pull/456)) @Jealee3000
- chroe: Remove task due remind template @wmEvie
- chroe: Remove task due reminder template ([#466](https://github.com/apitable/apitable/pull/466)) @wmEvie
- test: add property based tests to DataBus ([#140](https://github.com/apitable/apitable/pull/140)) (#467) @Exclamation-mark
- refactor: replace dynamic sql in getUserInfo ([#453](https://github.com/apitable/apitable/pull/453)) @Jealee3000
- sync: hosted cloud ([#470](https://github.com/apitable/apitable/pull/470)) @yort-feng
- chore: compatible widget icons ([#471](https://github.com/apitable/apitable/pull/471)) @Sky-FE
- Revert "refactor: replace dynamic sql in getUserInfo" ([#475](https://github.com/apitable/apitable/pull/475)) @yort-feng

## [v0.18.0-beta](https://github.com/apitable/apitable/releases/tag/v0.18.0-beta) (2023-02-22)

### Features and enhancements

- feat: fix existing unidir link & APITable support to reset password & timezone adjust ([#382](https://github.com/apitable/apitable/pull/382)) @mr-kelly
- feat: APITable support to reset password ([#401](https://github.com/apitable/apitable/pull/401)) @mr-kelly

### Bug fixes

- fix: oss host env variable value ([#346](https://github.com/apitable/apitable/pull/346)) @ChambersChan
- fix: reset password page @laboonly
- fix: reset password page ([#385](https://github.com/apitable/apitable/pull/385)) @laboonly
- fix: disable cdn resource ([#384](https://github.com/apitable/apitable/pull/384)) @wangkailang
- fix: env control sensors.js ([#397](https://github.com/apitable/apitable/pull/397)) @wangkailang
- fix: use sensors env ([#402](https://github.com/apitable/apitable/pull/402)) @wangkailang
- fix: gitpod setup install error ([#404](https://github.com/apitable/apitable/pull/404)) @shawndenggh
- fix: the formula of IS_ERROR is incorrectly calculated ([#427](https://github.com/apitable/apitable/pull/427)) @Sky-FE
- fix: record menu subscription item displayed incorrectly ([#428](https://github.com/apitable/apitable/pull/428)) @Sky-FE
- fix: formula WORKDAY_DIFF calculation error ([#435](https://github.com/apitable/apitable/pull/435)) @Sky-FE

### What's more

- chore(deps): bump @sideway/formula from 3.0.0 to 3.0.1 @dependabot[bot]
- release: v0.18.0-alpha ([#345](https://github.com/apitable/apitable/pull/345)) @mr-kelly
- refactor: merge forwarding about sokcet server ([#349](https://github.com/apitable/apitable/pull/349)) @ChambersChan
- chore: add all-in-one dockerfile and image build ([#355](https://github.com/apitable/apitable/pull/355)) @networkhermit
- chore: integrate semver to image build ([#358](https://github.com/apitable/apitable/pull/358)) @networkhermit
- unit module unit test ([#335](https://github.com/apitable/apitable/pull/335)) @wuyitaoBoomboommm
- chore(deps): bump @sideway/formula from 3.0.0 to 3.0.1 ([#340](https://github.com/apitable/apitable/pull/340)) @JaneSu
- chore: make LOGGER_MAX_HISTORY_DAYS an env variable and 7 by default ([#370](https://github.com/apitable/apitable/pull/370)) @yort-feng
- sync: hosted cloud ([#373](https://github.com/apitable/apitable/pull/373)) @mr-kelly
- docs: add all-in-one installation method ([#374](https://github.com/apitable/apitable/pull/374)) @networkhermit
- chore: set room server log file keep days to 7 by default ([#375](https://github.com/apitable/apitable/pull/375)) @yort-feng
- chore: modify mail configuration ([#418](https://github.com/apitable/apitable/pull/418)) @ChambersChan
- chore: replace share node tree ([#420](https://github.com/apitable/apitable/pull/420)) @ChambersChan
- chore: keep the default settings the same with devenv ([#426](https://github.com/apitable/apitable/pull/426)) @yort-feng
- docs: improve zh-HK translation ([#395](https://github.com/apitable/apitable/pull/395)) @KelvinAhKe

## [v0.18.0-alpha](https://github.com/apitable/apitable/releases/tag/v0.18.0-alpha) (2023-02-09)

### Bug fixes

- fix: error logo in email templates @xukecheng
- fix: wrong left padding of views ([#278](https://github.com/apitable/apitable/pull/278)) @Sky-FE
- fix: correct space apply mail link ([#277](https://github.com/apitable/apitable/pull/277)) @ChambersChan
- fix: the gantt view is exported as a png image misplaced ([#281](https://github.com/apitable/apitable/pull/281)) @Sky-FE
- fix: error logo in email templates ([#276](https://github.com/apitable/apitable/pull/276)) @xukecheng
- fix: assets url ([#309](https://github.com/apitable/apitable/pull/309)) @Pengap
- fix: formula parser doesn't recognize single negation expresison ([#192](https://github.com/apitable/apitable/pull/192)) @arucil
- fix: space list sort issue ([#312](https://github.com/apitable/apitable/pull/312)) @ChambersChan
- fix: path get actions miss id and type id ([#317](https://github.com/apitable/apitable/pull/317)) @wuyitaoBoomboommm
- fix: active robot error validation ([#318](https://github.com/apitable/apitable/pull/318)) @wuyitaoBoomboommm
- fix: start web-server cause room-server compile error ([#324](https://github.com/apitable/apitable/pull/324)) @arucil
- fix: email contact us url ([#330](https://github.com/apitable/apitable/pull/330)) @xukecheng
- fix: missing .proto files ([#329](https://github.com/apitable/apitable/pull/329)) @yort-feng
- fix: there are wrong css for button in email @xukecheng
- fix: there are wrong css for button in email ([#333](https://github.com/apitable/apitable/pull/333)) @xukecheng

### What's more

- perf: help menu auto layout ([#260](https://github.com/apitable/apitable/pull/260)) @Sky-FE
- Fix: fix readme typo ([#262](https://github.com/apitable/apitable/pull/262)) @x1ah
- docs: improve zh-CN translations ([#265](https://github.com/apitable/apitable/pull/265)) @alexzhang1030
- chore: contributing in readme ([#284](https://github.com/apitable/apitable/pull/284)) @mr-kelly
- Update README.md ([#302](https://github.com/apitable/apitable/pull/302)) @garyli27
- style: upgrade jsx-ast-utils to support Optional Chaining ([#311](https://github.com/apitable/apitable/pull/311)) @yort-feng
- sync: hosted cloud ([#316](https://github.com/apitable/apitable/pull/316)) @mr-kelly
- chore: replace the sql statement with ORM api. ([#273](https://github.com/apitable/apitable/pull/273)) @wuyitaoBoomboommm
- chore: root README_ZH.md ([#287](https://github.com/apitable/apitable/pull/287)) @mr-kelly
- chore: replace contact url @xukecheng
- chore: upgrade email copy right @xukecheng
- docs: add better uptime badge and clarify installation requirement ([#328](https://github.com/apitable/apitable/pull/328)) @networkhermit
- chore: replace logo to png @xukecheng
- test: mirror service unit test ([#280](https://github.com/apitable/apitable/pull/280)) @yort-feng
- sync: hosted cloud ([#339](https://github.com/apitable/apitable/pull/339)) @Pengap
- docs: super link for architecture overview ([#341](https://github.com/apitable/apitable/pull/341)) @yort-feng
- docs: README for APITable.com cloud version ([#342](https://github.com/apitable/apitable/pull/342)) @mr-kelly

## [v0.17.0-rc](https://github.com/apitable/apitable/releases/tag/v0.17.0-rc) (2023-01-23)

### Bug fixes

- fix: make minor semver conflict @mr-kelly
- fix: replace wrong email logo @xukecheng
- fix: wrong variable @xukecheng
- fix: replace wrong email templates ([#190](https://github.com/apitable/apitable/pull/190)) @xukecheng
- fix: unable to operate members and teams ([#214](https://github.com/apitable/apitable/pull/214)) @MrWangQAQ
- fix: the default value of the percent field cannot be reset ([#215](https://github.com/apitable/apitable/pull/215)) @alolonghun
- fix: fusion api param validation decorators & qr code download failed & unable to operate members and teams ([#217](https://github.com/apitable/apitable/pull/217)) @mr-kelly
- fix: the page crashes when the option field configures the color ([#219](https://github.com/apitable/apitable/pull/219)) @alolonghun
- fix: expand record comment emoji reply ([#218](https://github.com/apitable/apitable/pull/218)) @MrWangQAQ
- fix: color match ([#220](https://github.com/apitable/apitable/pull/220)) @alolonghun
- fix: sync hosted version & fusion api param validation error & login page QR code cannot be displayed & wrong email folder name ([#223](https://github.com/apitable/apitable/pull/223)) @mr-kelly

### What's more

- Merge branch 'develop' into release/0.17.0 @mr-kelly
- chore: init changelog.md @mr-kelly
- Chore/merge new feature ([#203](https://github.com/apitable/apitable/pull/203)) @laboonly
- docs: change log @laboonly
- docs: change log ([#204](https://github.com/apitable/apitable/pull/204)) @laboonly
- Merge branch 'develop' into fix/wrong-email-logo @xukecheng
- chore: disable eslint validate of super linter ([#211](https://github.com/apitable/apitable/pull/211)) @yort-feng
- test: user module unit test ([#191](https://github.com/apitable/apitable/pull/191)) @yort-feng
- chore: README show latest release tag ([#209](https://github.com/apitable/apitable/pull/209)) @mr-kelly
- l10n: translation init ([#137](https://github.com/apitable/apitable/pull/137)) @mr-kelly

## [v0.17.0-beta](https://github.com/apitable/apitable/releases/tag/v0.17.0-beta) (2023-01-16)

### Features and enhancements

- feat: hosted version update, event manager refactor, mobile date-picker i18n, new env config ([#148](https://github.com/apitable/apitable/pull/148)) @mr-kelly
- feat: github issues templates of docs and question ([#175](https://github.com/apitable/apitable/pull/175)) @mr-kelly
- feat: clear a bad smell code ([#179](https://github.com/apitable/apitable/pull/179)) @zhou-yg
- feat: enable super-lint ([#194](https://github.com/apitable/apitable/pull/194)) @mr-kelly
- feat: timezone environment variables support ([#187](https://github.com/apitable/apitable/pull/187)) @shawndenggh

### Bug fixes

- fix: stop satackey/action-docker-layer-caching for building success ([#149](https://github.com/apitable/apitable/pull/149)) @mr-kelly
- fix: share crash @wangkailang
- fix: share crash ([#151](https://github.com/apitable/apitable/pull/151)) @JaneSu
- fix: web-server local start axios base url ([#155](https://github.com/apitable/apitable/pull/155)) @wangkailang
- fix: copy cell menu item is hidden in gallery and kanban view ([#158](https://github.com/apitable/apitable/pull/158)) @alolonghun
- fix: import-double-quotes-to-single-quotes ([#163](https://github.com/apitable/apitable/pull/163)) @wuyitaoBoomboommm
- fix: eslint error and ass scripts ([#164](https://github.com/apitable/apitable/pull/164)) @wangkailang
- fix: template usage crash @wangkailang
- fix: add pre-action releaseLocks before init-db run ([#165](https://github.com/apitable/apitable/pull/165)) @shawndenggh
- fix: template usage crash ([#166](https://github.com/apitable/apitable/pull/166)) @JaneSu
- fix: the content is missing after the mobile form is submitted ([#168](https://github.com/apitable/apitable/pull/168)) @alolonghun
- fix: add main widget message listener ([#169](https://github.com/apitable/apitable/pull/169)) @MrWangQAQ
- fix: avtar color is covered when edit user nickName @LiuZijingBron
- fix: avtar color is covered when edit user nickName ([#170](https://github.com/apitable/apitable/pull/170)) @LiuZijingBron
- fix: replace billing field ([#172](https://github.com/apitable/apitable/pull/172)) @shawndenggh
- fix: eslint error ([#182](https://github.com/apitable/apitable/pull/182)) @wangkailang
- fix: modify spring mail config ([#186](https://github.com/apitable/apitable/pull/186)) @LiuZijingBron
- fix: register user default avatar may be null @LiuZijingBron
- fix: register user default avatar may be null ([#189](https://github.com/apitable/apitable/pull/189)) @LiuZijingBron
- fix: eslint fix & super-linter ready ([#181](https://github.com/apitable/apitable/pull/181)) @mr-kelly
- fix: register user default avatar may be null & avatar renderer ([#193](https://github.com/apitable/apitable/pull/193)) @mr-kelly
- fix: super-linter jscpg ignore test files ([#202](https://github.com/apitable/apitable/pull/202)) @mr-kelly

### What's more

- release: v0.17.0-alpha ([#146](https://github.com/apitable/apitable/pull/146)) @mr-kelly
- chore: fix devenv & integrate appdata ([#154](https://github.com/apitable/apitable/pull/154)) @networkhermit
- refactor: split database module to submodules ([#152](https://github.com/apitable/apitable/pull/152)) @yort-feng
- chore: performance profiling tools ([#159](https://github.com/apitable/apitable/pull/159)) @arucil
- Merge branch 'develop' into fix/template-usage-crash @JaneSu
- Merge branch 'develop' into fix/template-usage-crash @wangkailang
- chore: hosted sync @mr-kelly
- chore: optimise email verify html ([#184](https://github.com/apitable/apitable/pull/184)) @xukecheng
- chore(deps): bump class-validator from 0.12.2 to 0.14.0 ([#183](https://github.com/apitable/apitable/pull/183)) @dependabot[bot]
- chore(deps): bump json5 from 1.0.1 to 1.0.2 ([#132](https://github.com/apitable/apitable/pull/132)) @dependabot[bot]
- test: developer module unit test ([#171](https://github.com/apitable/apitable/pull/171)) @yort-feng

## [v0.17.0-alpha](https://github.com/vikadata/vikadata/releases/tag/v0.17.0-alpha) (2023-01-05)

First release of APITable.
