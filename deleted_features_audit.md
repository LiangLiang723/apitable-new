# 删除功能与模块审计报告

## 审计范围

- 起始提交：d112100dde24c44c7288fd0a6e4339ad1cb273b3
- 结束提交：478878c401fc2bbf2e2711343909644e04d61ed7
- 总提交数：964
- 审计方法：使用 `git rev-list --reverse --all` 生成完整提交序列，并对 964 个提交逐一执行 `git show --stat <sha>`、`git show --name-status <sha>`、`git show --find-renames --find-copies <sha>`、`git show --unified=80 <sha>`。执行失败数为 0。删除项先按 rename/copy 视图排除纯重命名，再按路径、diff 删除行、当前 HEAD 是否存在、同提交新增替代文件和后续演化链路归并。
- 重要说明：本报告只把从 diff 中能确认的删除记录为删除项。SAML、LDAP、备份恢复等能力在当前仓库中存在私有 enterprise 引用或缺失实现线索，但未发现可由本仓库历史直接恢复的对应删除文件，因此在详细项中标为“需要人工复核”，不强行推断。

## 汇总表

| 序号 | 删除功能/模块 | 所属提交 SHA | 提交说明 | 删除类型 | 原路径 | 当前状态 | 是否可完全恢复 | 恢复难度 | 恢复方法摘要 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | 企业/商业授权与 CLA 文档 | 9365b9b2ab2a, b4702b64e0bb | chore: LICENSE; docs: clean the readme | 文档删除 | licenses/LICENSE-ENTERPRISE, licenses/LICENSE-TERMS, licenses/LICENSE-CLA.md | 缺失 | 是 | 简单 | 从删除提交父提交恢复文档文件即可 |
| 2 | 自部署企业冒烟脚本 `.sh` 副本 | cd9479975f6d | fix：删除不可执行的 sh 冒烟脚本副本 | 脚本删除 | scripts/self_hosted_enterprise_smoke_check.sh | 无扩展名脚本仍存在 | 是，但不需要 | 简单 | 如需兼容 `.sh` 路径，从父提交恢复并 `chmod +x`；推荐保持删除 |
| 3 | 任务到期提醒邮件模板 | a4d751e04eeb | chroe: Remove task due remind template | 邮件模板删除 | backend-server/application/src/main/resources/templates/notification/task-due-remind-*.btl | 缺失；当前代码仍有 task reminder 映射线索 | 部分，需要人工复核 | 简单 | 恢复模板后确认当前 `NotifyMailFactory` 的模板名映射是否需改为 `task-reminder-*` |
| 4 | 旧图标组件与静态图标资源 | 0a8bced53651, a1658a96c78b, f67cfb6b3bf9, bdd1535aa9cc | feat: design icons; sync hosted cloud; static icons migration | UI 资源删除 | packages/icons/src/components/*, packages/datasheet/public/static/icon/* | 大多被新图标/静态资源体系替代 | 是 | 简单 | 只在历史 UI 仍引用旧图标时恢复对应资源；一般不建议整体回滚 |
| 5 | Mail/OSS starter 的 Spring Boot 2 `spring.factories` 元数据 | 0c7e2535f174 | sync: hosted cloud (#1503) | 自动配置元数据删除 | backend-server/shared/starters/mail/src/main/resources/META-INF/spring.factories, backend-server/shared/starters/oss/src/main/resources/META-INF/spring.factories | 已迁移到 `AutoConfiguration.imports` | 是，但不需要 | 简单 | Spring Boot 3 保持当前写法；仅兼容 Boot 2 时恢复 |
| 6 | 自动化运行历史独立 Controller/RO | 86f147fc74d0 | sync: hosted cloud (#1319) | 后端 API 入口删除/合并 | backend-server/application/src/main/java/com/apitable/automation/controller/AutomationRunHistoryController.java, AutomationRunHistoryRo.java | 运行历史接口已合并到 AutomationRobotController | 是，但不需要 | 简单 | 当前无需恢复；如恢复旧路由需代理到现有 service |
| 7 | 后端 databusclient 生成 Java 客户端原路径 | 0110ea594cbf | sync: hosted cloud (#1528) | 生成客户端删除/迁移 | backend-server/application/src/main/java/com/apitable/databusclient/** | 已迁移到 backend-server/shared/starters/databus | 是，但不需要 | 简单 | 保持新 starter；不要把旧包名和新包名同时引入 |
| 8 | 旧构建/单测 Compose 文件 | 5d35de680e20, 3c89939cd33f | add all-in-one dockerfile; upgrade liquibase | 部署/测试配置删除 | docker-compose.build.yaml, docker-compose.ut-backend.yaml | 已由现有 Compose、Makefile、docker-bake/all-in-one 流程替代 | 部分 | 中等 | 可按需恢复单文件，但需同步 Makefile、镜像名、Liquibase 版本 |
| 9 | 原 GitHub CI/安全工作流 | d9a3bb47d06d | feat: 添加 self-hosted enterprise 订阅信息、支持与交付工作流 | CI/部署工作流删除 | .github/workflows/build.yaml, lint.yml, codeql.yml, dependency-review.yml, ai_code_reviewer.yml | 当前仅保留 dockerhub-all-in-one.yml | 是 | 中等 | 从 develop 或删除提交父提交恢复工作流，并补齐 secrets/vars 与分支触发条件 |
| 10 | 前端 production 环境开关与 Hosted 配置 | 91aac1431078 | fix: delete env file | 前端配置删除 | packages/datasheet/.env.production | 缺失；部分变量在 packages/datasheet/.env 中以自部署默认值存在 | 部分 | 中等 | 只迁移需要的开关；Hosted URL、社交登录、计费、帮助中心、外部表单配置需替换为自部署值 |
| 11 | 目录全局搜索组件 | 19e52bed2696 | sync: hosted cloud (#551) | 前端入口删除 | packages/datasheet/src/pc/components/catalog/search/** | 缺失；移动/权限弹窗内搜索仍存在 | 是 | 中等 | 恢复搜索组件并重新接入 catalog 入口、快捷键和 `Api.findNode` |
| 12 | 公开分享旧二维码下载/旧 public link 组件 | 50aaa517ffb0 | sync: hosted cloud (#881) | 前端入口删除/替代 | packages/datasheet/src/pc/components/catalog/share_node/public_link/download_qr_code.tsx, public_link.tsx | 当前有 generate_qr_code 和 public_share_invite_link | 部分 | 中等 | 优先适配现有组件；仅恢复旧下载按钮时需检查分享 URL、二维码和权限逻辑 |
| 13 | 字段权限 Workbench Controller API | 089c0b334a9d | sync: hosted cloud (#1427) | 后端 API 删除 | backend-server/application/src/main/java/com/apitable/workspace/controller/FieldRoleController.java | service、mapper、内部权限读取仍存在；外部 Controller 缺失 | 是 | 中等 | 恢复 Controller，按当前 Jakarta/Spring/OpenAPI 依赖调整 imports，验证启停字段权限 |
| 14 | 第三方权限扩展门面 | a1658a96c78b | sync: hosted cloud (#470) | 后端扩展点删除 | backend-server/application/src/main/java/com/apitable/control/config/ControlThirdContextConfig.java, control/facede/* | 缺失；默认实现只是透传内部权限 | 是 | 中等 | 可恢复默认 Bean 和接口；真正第三方权限仍需私有实现 |
| 15 | Sensors/视图类型埋点集成 | bdd1535aa9cc | sync: hosted cloud (#589) | 前端集成删除 | packages/datasheet/public/file/js/sensors.js, use_view_type_track.ts, tracker.ts | 缺失 | 部分 | 中等 | 需要商业埋点服务配置；自部署建议保持禁用或接入本地 analytics |
| 16 | 表单预填面板开源实现 | a1f76e8555db | sync: hosted cloud (#1276) | 前端功能删除/移入 enterprise | packages/datasheet/src/pc/components/form_container/pre_fill_panel/** | 当前 FormContainer 导入 `enterprise/pre_fill_panel/pre_fill_panel`，仓库无 enterprise 源码 | 是，但需改接入 | 中等 | 从父提交恢复面板，并把 import 从 enterprise 改回本地或提供 enterprise stub |
| 17 | 模板中心远程配置请求对象 | 509105bf8ba | sync: hosted cloud (#1645) | 后端接口模型删除 | backend-server/application/src/main/java/com/apitable/template/ro/TemplateCenterConfigRo.java | 缺失；未找到当前 Controller 调用 | 不能可靠完全恢复 | 中等 | 仅恢复 RO 不够，需人工确认历史配置端点和模板中心数据源 |
| 18 | 旧通用 Filter Modal / 日历拖拽 Modal / 活动面板 index 等 UI 入口 | 6789f3a3da1d, c41468219e47, 26328500fc10, 6f408b2fb0a | sync: hosted cloud | 前端组件删除/拆分 | common/modal/filter_modal, calendar_view/drag_drop_modal, calendar_view/utils.ts, expand_record/activity_pane/index.ts | 多数已拆分或内联 | 部分 | 中等 | 逐个恢复引用点，不建议按目录整体回滚 |
| 19 | 独立 socket-server 服务与网关入口 | 43a425bc0966, c3b0a102f0ed | sync hosted cloud; merge forwarding about socket server | 后端服务/部署入口删除 | packages/socket-server/**, packaging/Dockerfile.socket-server, gateway/conf.d/server/socket-server.conf, gateway/conf.d/upstream/ups-socket-server.conf | 已合并到 room-server；当前 env 指向 room-server socket/grpc | 部分 | 困难 | 若恢复独立服务，需恢复包、Dockerfile、Compose、gateway upstream、Makefile 和 room/backend 连接配置 |
| 20 | 旧视图行缓存、widget 数据订阅与 iframe message 通道 | 88be10e37f02, a1658a96c78b | refactor: view derivation calculated data; sync hosted cloud | 前端/SDK 架构删除 | packages/core/src/cache_manager/rows_cache.ts, datasheet/store_subscribe/*, widget-sdk/src/iframe_message/** | 已被 view_derivate、widget block/context 等实现替代 | 部分 | 困难 | 不建议恢复；若恢复旧 widget 协议需回滚大量 core/datasheet/widget-sdk 状态结构 |
| 21 | 旧 multi_grid 单体入口、滚动条、selection wrapper、导航 item | 50aaa517ffb0 | sync: hosted cloud (#881) | 前端组件删除/拆分 | packages/datasheet/src/pc/components/multi_grid/*, scroll_bar/*, selection_wrapper/*, navigation_item/* | 当前 multi_grid 目录仍存在但结构已重构 | 部分 | 困难 | 只能针对具体缺失 UI 恢复；整体回滚会破坏当前网格实现 |
| 22 | 机器人创建向导与旧自动化头部 UI | e82967e0855f | sync: hosted cloud (#1301) | 前端入口删除/替代 | packages/datasheet/src/pc/components/robot/robot_create_guide/**, robot_panel/robot_*_head.tsx | 当前机器人/自动化编辑器仍存在，旧四步向导缺失 | 是 | 困难 | 恢复向导后需接入当前 automation API、机器人详情、run history 和权限模型 |
| 23 | 自动化 service/type 管理与后端服务实现 | 492ab31b1bda, 0c7e2535f174, 0110ea594cbf | sync hosted cloud | 后端/room-server 自动化管理能力删除/迁移 | packages/room-server/src/automation/controller/service.controller.ts, backend-server/application/src/main/java/com/apitable/automation/service/IAutomationService.java, AutomationServiceImpl.java, *CreateRO/*EditRO | 当前 automation robot/action/trigger 仍存在，service/type 管理链路不完整 | 部分 | 困难 | 需确认 trigger/action type 数据源、mapper、Databus API 和前端管理入口后再恢复 |
| 24 | room-server 自动化队列、触发器与 worker | 9c48d7c2e996 | sync: hosted cloud (#989) | 后端执行能力删除 | packages/room-server/src/automation/queues/**, triggers/**, workers/** | 缺失；当前 events/listeners 后续已恢复，队列/worker 未恢复 | 部分 | 困难 | 需要 Redis/Bull 或替代队列配置，确认 Databus/room-server 执行边界 |
| 25 | 旧 `packages/databus` npm 包 | 6791d4b74713 | sync: hosted cloud (#1164) | 包/构建脚本删除 | packages/databus/** | 已由 databus-wasm、databus-wasm-nodejs、databus-client 替代 | 部分 | 困难 | 不建议恢复旧包；需要旧 TS API 时建立兼容层指向当前 wasm/client |
| 26 | AI 会话投票数据库 changelog | 9eef5181913d | sync: hosted cloud (#1248) | 数据库 migration 删除 | init-db/src/main/resources/db/changelog/0.99/20230811_changeset.xml | 缺失；未发现当前 ai_conversation_vote 表迁移 | 不能可靠完全恢复 | 困难 | 需确认 AI 后端/表访问代码存在后再恢复 migration |
| 27 | 旧 Rust/native room-native-api 数据服务 | 7ee17c4a540c, f6b64583823d, ce3f64dd46fd | Revert migrate getRecordsById to rust; sync hosted cloud | 后端原生模块删除 | packages/room-native-api/** | 缺失；当前使用 databus-wasm/databus-client/room-server | 部分 | 极难 | 需要 Rust/NAPI 构建链、数据库访问、权限服务、Node 绑定和调用方全部恢复 |
| 28 | CE API client 生成时移除的 Billing/Checkout/Stripe SDK | 4abd3e614c2b | feat: gen ce api client module (#1445) | API client 删除 | packages/api-client/Billing*Api.*, CheckoutControllerApi.*, StripeWebhookControllerApi.*, 相关 models | SDK 中缺失；后端仅有默认/自部署订阅模型，不含支付闭环 | 不能可靠完全恢复 | 极难 | 只有恢复后端计费/支付实现和外部密钥后才可重新生成 SDK |
| 29 | CE API client 生成时移除的 SSO/社交/企业集成 SDK | 4abd3e614c2b | feat: gen ce api client module (#1445) | API client 删除 | Auth0ControllerApi, IDaaS*, DingTalk*, Lark/Feishu*, WeCom*, WeChat*, TencentQQ*, HuaweiOneAccess*, Woa* | SDK 缺失；前端仍有 enterprise 动态导入但源码不在仓库 | 不能可靠完全恢复 | 极难 | 依赖私有 enterprise 源码和第三方平台密钥，建议隐藏或 unsupported |
| 30 | CE API client 生成时移除的 AI/AirAgent/AppStore/Product/GM/Office/VCode/Store SDK | 4abd3e614c2b | feat: gen ce api client module (#1445) | API client 删除 | AIApi, AirAgent*, AppStore*, Product*, GMWidget, OfficeOperation, VCode*, StoreApi 等 | SDK 缺失；部分前端入口依赖 enterprise 私有模块 | 不能可靠完全恢复 | 极难 | 需要 Hosted Cloud 或私有服务端实现；不要只恢复生成文件 |
| 31 | CE API client 生成时移除的审计/Widget 审核/Workbench FieldRole SDK | 4abd3e614c2b | feat: gen ce api client module (#1445) | API client 删除 | SpaceAuditApiApi, WidgetSDKWidgetAuditApiApi, WorkbenchFieldRoleAPIApi, 相关 models | SDK 缺失；部分后端 service 仍在，公开 Controller/API 不完整 | 部分 | 极难 | 先恢复后端 API，再重新生成 SDK；不可直接复制旧生成物上线 |
| 32 | 企业 init-db Makefile 目标与腾讯云邮件模板 ID 表 | 362aa8a44b92 | init-db-apitable initializer & multiple edition cloud mail template | 企业初始化/邮件配置删除 | Makefile `db-apply-ee`, TencentMailTemplate.java | 缺失；`db-apply-ee` 依赖 ../enterprise/init-db 私有目录 | 不能可靠完全恢复 | 不建议恢复 | 保持隐藏；如需企业初始化，提供公开 migration 或明确 unsupported |
| 33 | 七牛云临时 OSS 回调与 deprecated API | 7c6f7a1e6499 | remove oss temporary auto configuration class and deprecated api | 附件存储旧实现删除 | QiniuTemporaryAutoConfiguration.java, QiniuTemporaryClientTemplate.java, /asset/qiniu/uploadCallback | 缺失；上传回调已统一为 S3/OSS 风格 | 不建议 | 不建议恢复 | 使用当前 OSS/S3/MinIO 路径；七牛临时接口应保持 unsupported |

## 详细分析

### 1. 企业/商业授权与 CLA 文档

- 所属提交 SHA：9365b9b2ab2a6db12b07a8bda7f1eb3470a7b68c, b4702b64e0bb934780f56794c3c0c28e335216df
- 提交时间：2022-09-07, 2022-12-27
- 提交说明：chore: LICENSE; docs: clean the readme (#52)
- 删除类型：文档删除
- 原始路径：licenses/LICENSE-ENTERPRISE, licenses/LICENSE-TERMS, licenses/LICENSE-CLA.md
- 相关文件：licenses/*
- 删除内容摘要：商业授权条款、企业授权条款、CLA 文档。
- 功能作用：不是运行时代码，但影响企业授权说明、合规与交付材料。
- 是否可完全恢复：是。
- 恢复难度：简单。
- 依赖项：无运行时依赖。
- 风险：恢复旧商业条款可能与当前授权策略不一致。
- 推荐处理方式：需要合规材料时恢复；否则保持当前 LICENSE/LICENSING 文档。
- 具体恢复方法：
  1. 从 9365b9b2ab2a^ 恢复 licenses/LICENSE-ENTERPRISE 和 licenses/LICENSE-TERMS，从 b4702b64e0bb^ 恢复 licenses/LICENSE-CLA.md。
  2. 不需要合并业务代码。
  3. 不需要数据库 migration。
  4. 不需要环境变量。
  5. 不需要隐藏入口或 unsupported。
  6. 验证 `git diff -- licenses`，并由人工确认法律文本是否仍可使用。

### 2. 自部署企业冒烟脚本 `.sh` 副本

- 所属提交 SHA：cd9479975f6de7f797132f579a96296d3610e953
- 提交时间：2026-05-24
- 提交说明：fix：删除不可执行的 sh 冒烟脚本副本
- 删除类型：脚本删除
- 原始路径：scripts/self_hosted_enterprise_smoke_check.sh
- 相关文件：scripts/self_hosted_enterprise_smoke_check
- 删除内容摘要：删除了与无扩展名脚本内容相同的 `.sh` 副本。
- 功能作用：检查 SELF_HOSTED_ENTERPRISE、API_MAX_MODIFY_RECORD_COUNTS，并输出人工冒烟清单。
- 是否可完全恢复：是，但当前无扩展名脚本仍可用。
- 恢复难度：简单。
- 依赖项：bash。
- 风险：恢复副本会造成维护重复。
- 推荐处理方式：保持删除；如外部自动化硬编码 `.sh` 路径，再恢复为 wrapper。
- 具体恢复方法：
  1. 从 cd9479975f6d^ 恢复 scripts/self_hosted_enterprise_smoke_check.sh。
  2. 或创建 wrapper 调用 scripts/self_hosted_enterprise_smoke_check。
  3. 不需要数据库 migration。
  4. 需要 SELF_HOSTED_ENTERPRISE=true 才能运行验证。
  5. 不需要 unsupported。
  6. 执行 `SELF_HOSTED_ENTERPRISE=true scripts/self_hosted_enterprise_smoke_check`。

### 3. 任务到期提醒邮件模板

- 所属提交 SHA：a4d751e04eeb6a23dad557803ec7ecae1a0b483b
- 提交时间：2023-02-27
- 提交说明：chroe: Remove task due remind template
- 删除类型：邮件模板删除
- 原始路径：backend-server/application/src/main/resources/templates/notification/task-due-remind-html.btl, task-due-remind-text.btl
- 相关文件：NotifyMailFactory.java, MailPropConstants.java, notification templates
- 删除内容摘要：删除 task due remind 的 HTML/text Beetl 模板。
- 功能作用：任务到期提醒邮件。
- 是否可完全恢复：部分，需要人工复核模板名。
- 恢复难度：简单。
- 依赖项：邮件发送配置、通知触发事件、模板名映射。
- 风险：当前 NotifyMailFactory 映射的是 `task-reminder-html.btl` / `task-reminder-text.btl`，直接恢复旧文件名可能仍不会被加载。
- 推荐处理方式：若恢复任务提醒，优先补齐当前映射期望的模板名；无法确认触发链路时保持 unsupported。
- 具体恢复方法：
  1. 从 a4d751e04eeb^ 恢复两个 task-due-remind 模板。
  2. 决定是重命名为 task-reminder-*，还是修改 NotifyMailFactory 映射。
  3. 不需要数据库 migration。
  4. 需要 MAIL_ENABLED、SMTP 配置。
  5. 若没有任务提醒触发器，保留模板但隐藏入口。
  6. 触发任务提醒通知，检查邮件正文、主题和日志。

### 4. 旧图标组件与静态图标资源

- 所属提交 SHA：0a8bced53651c8c63eadbd5d515474a53f179165, a1658a96c78bcca416cff0a1159bdb2876bcc131, f67cfb6b3bf9817a3d8b89951e6375e20957b5cc, bdd1535aa9cc9d94b8c4ec2e7c16a1ab2235327e
- 提交时间：2023-02-22, 2023-02-27, 2023-02-28, 2023-03-20
- 提交说明：design icons / hosted sync / static icons migration
- 删除类型：UI 资产删除
- 原始路径：packages/icons/src/components/*, packages/datasheet/public/static/icon/*
- 相关文件：icons package, datasheet static icon references
- 删除内容摘要：account、attachment、audit、enterprise、email、menu、widget、workbench、export、Feishu/WeCom 等旧图标。
- 功能作用：旧界面图标展示。
- 是否可完全恢复：是。
- 恢复难度：简单。
- 依赖项：当前图标命名和引用点。
- 风险：旧图标与当前设计系统不一致，恢复过多会增加包体和重复导出。
- 推荐处理方式：仅对编译缺失或 UI 明确需要的图标逐个恢复。
- 具体恢复方法：
  1. 从对应删除提交父提交恢复单个图标文件。
  2. 在 packages/icons 的导出索引中确认是否需要补导出。
  3. 不需要数据库 migration。
  4. 不需要环境变量。
  5. 对不可用旧入口保持隐藏。
  6. 执行 icons/components/datasheet 构建并打开引用页面。

### 5. Mail/OSS starter 的 Spring Boot 2 `spring.factories` 元数据

- 所属提交 SHA：0c7e2535f174f900b8fbf12f784e967feb2458c7
- 提交时间：2023-12-04
- 提交说明：sync: hosted cloud (#1503)
- 删除类型：后端自动配置元数据删除
- 原始路径：backend-server/shared/starters/mail/src/main/resources/META-INF/spring.factories, backend-server/shared/starters/oss/src/main/resources/META-INF/spring.factories
- 相关文件：backend-server/shared/starters/*/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
- 删除内容摘要：删除 Boot 2 风格自动配置声明。
- 功能作用：Spring Boot 自动发现 starter 配置。
- 是否可完全恢复：是，但当前不需要。
- 恢复难度：简单。
- 依赖项：Spring Boot 版本。
- 风险：Boot 3 项目中恢复旧 factories 可能重复加载。
- 推荐处理方式：保持当前 AutoConfiguration.imports；只有 Boot 2 回退分支才恢复。
- 具体恢复方法：
  1. 从 0c7e2535f174^ 恢复 spring.factories。
  2. 检查是否与 AutoConfiguration.imports 重复。
  3. 不需要数据库 migration。
  4. 不需要环境变量。
  5. 不需要 unsupported。
  6. 启动 backend-server，检查 mail/oss bean 是否只加载一次。

### 6. 自动化运行历史独立 Controller/RO

- 所属提交 SHA：86f147fc74d0bce1bb0aff614439053f5f9dbe08
- 提交时间：2023-09-18
- 提交说明：sync: hosted cloud (#1319)
- 删除类型：后端 API 入口删除/合并
- 原始路径：AutomationRunHistoryController.java, AutomationRunHistoryRo.java
- 相关文件：AutomationRobotController.java, IAutomationRunHistoryService.java, AutomationRunHistoryServiceImpl.java
- 删除内容摘要：独立运行历史 Controller 删除，新增/保留 AutomationTaskSimpleVO，运行历史查询进入 AutomationRobotController。
- 功能作用：自动化运行历史列表与详情。
- 是否可完全恢复：是，但当前无需恢复。
- 恢复难度：简单。
- 依赖项：自动化 service、databus/starter client。
- 风险：恢复旧路由可能造成重复 API 或权限不一致。
- 推荐处理方式：保留当前合并实现；仅为兼容老客户端增加 alias。
- 具体恢复方法：
  1. 不建议直接恢复旧 Controller；如兼容旧路径，新建薄 Controller 转发到 AutomationRobotController/service。
  2. 合并当前 service 签名，避免恢复旧 RO。
  3. 不需要数据库 migration。
  4. 需要 databus server 和自动化表数据。
  5. 老路径可返回 unsupported 或 301/兼容响应。
  6. 创建自动化并触发失败/成功，检查 run history API。

### 7. 后端 databusclient 生成 Java 客户端原路径

- 所属提交 SHA：0110ea594cbfa3e99b7c4d8947ab39fb88fb11a3
- 提交时间：2023-12-18
- 提交说明：sync: hosted cloud (#1528)
- 删除类型：生成客户端删除/迁移
- 原始路径：backend-server/application/src/main/java/com/apitable/databusclient/**
- 相关文件：backend-server/shared/starters/databus/src/main/java/com/apitable/starter/databus/client/**
- 删除内容摘要：删除 application 内生成的 ApiClient、AutomationDaoApi、FusionApi、EnterpriseFusionApi 及大量 model/auth 文件。
- 功能作用：Java 后端调用 Databus 服务。
- 是否可完全恢复：是，但当前已迁移。
- 恢复难度：简单。
- 依赖项：当前 starter 包名。
- 风险：旧包名与新 starter 并存会造成类型混乱。
- 推荐处理方式：保持 shared starter；不要恢复旧路径。
- 具体恢复方法：
  1. 如必须兼容旧包名，建立 adapter 包，不复制整套生成物。
  2. 所有调用迁移到 com.apitable.starter.databus.client。
  3. 不需要数据库 migration。
  4. 需要 DATABUS_SERVER_BASE_URL。
  5. 不可用接口返回 unsupported。
  6. 调用 Fusion/DataDao/AutomationDao API 验证。

### 8. 旧构建/单测 Compose 文件

- 所属提交 SHA：5d35de680e2085cba1953197a357703dfda7f060, 3c89939cd33f7382c69bd20e019acdb543804f3b
- 提交时间：2023-02-11, 2023-05-16
- 提交说明：add all-in-one dockerfile and image build; upgrade liquibase version
- 删除类型：部署/测试配置删除
- 原始路径：docker-compose.build.yaml, docker-compose.ut-backend.yaml
- 相关文件：Makefile, docker-compose.unit-test.yaml, docker-bake.hcl, packaging/all-in-one/*
- 删除内容摘要：旧构建 compose 和 backend 单测 compose 被移除或并入其他测试/构建流程。
- 功能作用：镜像构建、backend 单测依赖环境。
- 是否可完全恢复：部分。
- 恢复难度：中等。
- 依赖项：镜像名、Liquibase 版本、Makefile target、CI job。
- 风险：恢复旧 Compose 可能与当前 MySQL/Liquibase/镜像名不兼容。
- 推荐处理方式：如果需要旧命令兼容，恢复为 wrapper 或文档，而不是替换当前流程。
- 具体恢复方法：
  1. 从删除提交父提交恢复对应 yaml。
  2. 合并当前镜像变量、网络名、Liquibase 版本。
  3. 不需要业务 migration，但测试 DB 初始化要跑通。
  4. 需要 .env 中 DB/镜像变量。
  5. 旧命令不可用时返回明确说明。
  6. 运行 backend 单测和 all-in-one 本地构建。

### 9. 原 GitHub CI/安全工作流

- 所属提交 SHA：d9a3bb47d06d7e1901f9746786e0a680b72fad28；重复历史：f07a15f1ec62b6f951c8ffa2ece185b98488bd97
- 提交时间：2026-05-24
- 提交说明：feat: 添加 self-hosted enterprise 订阅信息、支持与交付工作流
- 删除类型：CI/部署工作流删除
- 原始路径：.github/workflows/build.yaml, lint.yml, codeql.yml, dependency-review.yml, ai_code_reviewer.yml
- 相关文件：.github/workflows/dockerhub-all-in-one.yml
- 删除内容摘要：删除原多工作流 CI、安全扫描、依赖审查、AI review，新增 DockerHub all-in-one 交付工作流。
- 功能作用：构建、测试、lint、安全扫描、依赖审查、镜像发布。
- 是否可完全恢复：是。
- 恢复难度：中等。
- 依赖项：GitHub Actions secrets/vars、DockerHub、分支/标签触发条件。
- 风险：恢复旧工作流可能重新触发官方镜像推送或依赖私有 secret。
- 推荐处理方式：按自部署分支需求恢复 lint/codeql/dependency-review，发布工作流保留当前 DockerHub all-in-one。
- 具体恢复方法：
  1. 从 d9a3bb47d06d^ 或 develop 恢复需要的 workflow。
  2. 修改触发条件和镜像命名，避免推送官方 registry。
  3. 不需要数据库 migration。
  4. 需要 GitHub secrets/vars。
  5. 对不可用的官方发布 job 禁用或改为 unsupported。
  6. 在 PR 或 workflow_dispatch 上验证 lint/build/codeql。

### 10. 前端 production 环境开关与 Hosted 配置

- 所属提交 SHA：91aac1431078530c206a03a2eedabb4cc3373f64
- 提交时间：2023-01-16
- 提交说明：fix: delete env file
- 删除类型：前端配置删除
- 原始路径：packages/datasheet/.env.production
- 相关文件：packages/datasheet/.env, packages/datasheet/src/get_env.ts
- 删除内容摘要：删除大量 Hosted/Vika 生产开关，包括社交登录、空间角色、字段/文件权限、安全页、审计日志、集成页、模板/帮助/外部表单、Widget、Time Machine 等 URL 和可见性开关。
- 功能作用：控制前端入口显示、品牌资源、第三方/Hosted 服务 URL。
- 是否可完全恢复：部分。
- 恢复难度：中等。
- 依赖项：前端环境变量、enterprise 私有模块、外部 URL、第三方登录配置。
- 风险：直接恢复旧 Hosted URL 会把自部署流量指向外部商业服务。
- 推荐处理方式：只迁移自部署可用开关；外部 Hosted/商业服务保持隐藏或 unsupported。
- 具体恢复方法：
  1. 从 91aac1431078^ 取变量清单。
  2. 与当前 packages/datasheet/.env 合并，移除 Hosted 专用 URL。
  3. 不需要数据库 migration。
  4. 需要按部署环境设置 NEXT_PUBLIC/服务 URL/社交登录密钥。
  5. 对缺 enterprise 源码的入口保持隐藏。
  6. 构建 datasheet 并检查菜单、登录页、管理页、集成页。

### 11. 目录全局搜索组件

- 所属提交 SHA：19e52bed2696865ee387ea7803c8d9f9973e7c8a
- 提交时间：2023-03-13
- 提交说明：sync: hosted cloud (#551)
- 删除类型：前端入口删除
- 原始路径：packages/datasheet/src/pc/components/catalog/search/**
- 相关文件：catalog.tsx, Api.findNode, shortcut key SearchNode
- 删除内容摘要：删除目录节点搜索弹层、搜索结果分组和节点跳转 UI。
- 功能作用：在工作台目录中搜索节点并跳转。
- 是否可完全恢复：是。
- 恢复难度：中等。
- 依赖项：Api.findNode 仍存在，需接回 UI 入口和快捷键。
- 风险：当前 catalog 结构已变化，直接恢复可能样式错位。
- 推荐处理方式：优先作为局部功能恢复候选。
- 具体恢复方法：
  1. 从 19e52bed2696^ 恢复 search 目录。
  2. 在当前 catalog 组件中接入 Search 状态、按钮、快捷键。
  3. 不需要数据库 migration。
  4. 不需要额外环境变量。
  5. 搜索 API 不可用时显示空态或 unsupported。
  6. 搜索节点、键盘选择、打开新标签、移动端关闭弹层验证。

### 12. 公开分享旧二维码下载/旧 public link 组件

- 所属提交 SHA：50aaa517ffb0e31b4817e257edcd47fcbced848b
- 提交时间：2023-05-29
- 提交说明：sync: hosted cloud (#881)
- 删除类型：前端入口删除/替代
- 原始路径：public_link/download_qr_code.tsx, public_link/public_link.tsx
- 相关文件：public_share_invite_link.tsx, generate_qr_code.tsx, share_node/utils.ts
- 删除内容摘要：删除旧公开链接组件和二维码下载按钮。
- 功能作用：配置公开分享链接、展示/下载二维码。
- 是否可完全恢复：部分。
- 恢复难度：中等。
- 依赖项：当前分享权限、二维码生成、邀请链接逻辑。
- 风险：旧组件可能不符合当前公开链接权限模型。
- 推荐处理方式：只恢复下载二维码这一小功能，避免回滚整个 public link UI。
- 具体恢复方法：
  1. 从 50aaa517ffb0^ 恢复 download_qr_code.tsx 或提取逻辑。
  2. 合并到当前 generate_qr_code/public_share_invite_link。
  3. 不需要数据库 migration。
  4. 需要 SERVER_DOMAIN/PUBLIC_URL 正确。
  5. 权限不足时隐藏按钮或 unsupported。
  6. 创建公开分享，扫描/下载二维码，检查匿名访问。

### 13. 字段权限 Workbench Controller API

- 所属提交 SHA：089c0b334a9d2d865012853101ce6a9d9d558386
- 提交时间：2023-10-30
- 提交说明：sync: hosted cloud (#1427)
- 删除类型：后端 API 删除
- 原始路径：backend-server/application/src/main/java/com/apitable/workspace/controller/FieldRoleController.java
- 相关文件：IFieldRoleService, InternalFieldPermissionController, ControlTemplate, FieldRole*Ro/Vo
- 删除内容摘要：删除字段权限启用、禁用、成员分页、listRole、add/edit/delete/batch 等 Workbench API。
- 功能作用：字段级权限管理。
- 是否可完全恢复：是。
- 恢复难度：中等。
- 依赖项：field role service、control service、socket 广播事件、Jakarta validation。
- 风险：当前公开 API 可能被迁到内部接口；恢复需严查鉴权。
- 推荐处理方式：若前端字段权限入口启用，这是优先恢复项。
- 具体恢复方法：
  1. 从 089c0b334a9d^ 恢复 FieldRoleController.java。
  2. 调整 javax/jakarta、Swagger/OpenAPI imports，和当前 RO/VO/service 签名对齐。
  3. 不需要新 migration，除非字段权限表缺失。
  4. 需要 SPACE_ID/header、登录态、socket 配置。
  5. 未启用字段权限时隐藏入口或返回 unsupported。
  6. 创建表格，启用字段权限，添加成员，编辑/删除权限并检查实时同步。

### 14. 第三方权限扩展门面

- 所属提交 SHA：a1658a96c78bcca416cff0a1159bdb2876bcc131
- 提交时间：2023-02-27
- 提交说明：sync: hosted cloud (#470)
- 删除类型：后端扩展点删除
- 原始路径：ControlThirdContextConfig.java, ControlThirdPartServiceFacade.java, DefaultControlThirdPartServiceFacadeImpl.java
- 相关文件：control permission pipeline
- 删除内容摘要：删除可由第三方覆盖的权限门面，默认实现返回内部权限。
- 功能作用：允许第三方集成系统参与节点权限判定。
- 是否可完全恢复：是。
- 恢复难度：中等。
- 依赖项：真正的第三方/enterprise 实现不在仓库中。
- 风险：默认透传本身无风险，但误以为恢复了企业第三方权限会产生权限缺口。
- 推荐处理方式：可恢复扩展点；没有私有实现时明确标注 unsupported。
- 具体恢复方法：
  1. 从 a1658a96c78b^ 恢复三文件。
  2. 在权限判定链路中重新注入 facade。
  3. 不需要数据库 migration。
  4. 第三方实现需要外部配置。
  5. 无实现时返回 internalPermission 或 unsupported。
  6. 用普通权限和第三方 override 两组场景验证。

### 15. Sensors/视图类型埋点集成

- 所属提交 SHA：bdd1535aa9cc9d94b8c4ec2e7c16a1ab2235327e
- 提交时间：2023-03-20
- 提交说明：sync: hosted cloud (#589)
- 删除类型：前端集成删除
- 原始路径：packages/datasheet/public/file/js/sensors.js, packages/datasheet/src/pc/hooks/use_view_type_track.ts, packages/datasheet/src/pc/utils/tracker.ts
- 相关文件：view tracking hooks
- 删除内容摘要：删除神策/埋点脚本和视图类型追踪封装。
- 功能作用：用户行为统计和视图使用分析。
- 是否可完全恢复：部分。
- 恢复难度：中等。
- 依赖项：商业 analytics 服务、项目 token、隐私合规配置。
- 风险：自部署默认开启外部埋点有隐私风险。
- 推荐处理方式：保持禁用；如需统计，替换为自部署 analytics。
- 具体恢复方法：
  1. 从 bdd1535aa9cc^ 恢复 tracker/use_view_type_track。
  2. 把 sensors.js 替换为本地 analytics SDK 或配置化加载。
  3. 不需要数据库 migration。
  4. 需要 analytics endpoint/token。
  5. 未配置时 no-op，不报错。
  6. 切换视图并检查网络请求和隐私开关。

### 16. 表单预填面板开源实现

- 所属提交 SHA：a1f76e8555db0635ad7b8358a45a1d2c5d388fe0
- 提交时间：2023-09-04
- 提交说明：sync: hosted cloud (#1276)
- 删除类型：前端功能删除/移入 enterprise
- 原始路径：packages/datasheet/src/pc/components/form_container/pre_fill_panel/**
- 相关文件：form_container.tsx, form_container/util.ts, enterprise/pre_fill_panel/pre_fill_panel
- 删除内容摘要：删除本地 PreFillPanel，并把 FormContainer 改为从 enterprise 导入。
- 功能作用：表单链接预填参数配置和分享内容生成。
- 是否可完全恢复：是，但需改接入。
- 恢复难度：中等。
- 依赖项：当前仓库缺失 enterprise 目录；query2formData/string2Query 已迁到 util。
- 风险：直接恢复旧目录但不改 import 不会生效。
- 推荐处理方式：自部署需要表单预填时优先恢复本地实现。
- 具体恢复方法：
  1. 从 a1f76e8555db^ 恢复 pre_fill_panel 目录。
  2. 修改 FormContainer import，或在 modules/enterprise 下提供 PreFillPanel stub。
  3. 不需要数据库 migration。
  4. 不需要额外环境变量。
  5. 如果字段类型不支持预填，按钮隐藏或 unsupported。
  6. 创建表单，打开预填面板，生成链接并访问验证。

### 17. 模板中心远程配置请求对象

- 所属提交 SHA：509105bf8ba56032689ea78f87b920d71bf416d0
- 提交时间：2024-03-04
- 提交说明：sync: hosted cloud (#1645)
- 删除类型：后端接口模型删除
- 原始路径：backend-server/application/src/main/java/com/apitable/template/ro/TemplateCenterConfigRo.java
- 相关文件：TemplateController, TemplateServiceImpl
- 删除内容摘要：删除包含 host、token、recommend/category/album/template datasheet/view id 的模板中心配置 RO。
- 功能作用：疑似用于从远程数据表同步/配置模板中心。
- 是否可完全恢复：不能可靠完全恢复。
- 恢复难度：中等。
- 依赖项：历史 Controller 入口、远程模板数据源、token。
- 风险：只恢复 RO 没有行为；token 字段涉及敏感配置。
- 推荐处理方式：需要人工复核旧接口是否仍有调用方；否则保持隐藏。
- 具体恢复方法：
  1. 从 509105bf8ba^ 恢复 RO。
  2. 追溯旧 Controller/service 调用并合并当前模板复制逻辑。
  3. 可能不需要 DB migration，但模板源表要存在。
  4. 需要模板中心 host/token 环境配置。
  5. 未配置时返回 unsupported。
  6. 验证模板列表、模板引用、模板目录。

### 18. 旧通用 Filter Modal / 日历拖拽 Modal / 活动面板 index 等 UI 入口

- 所属提交 SHA：6789f3a3da1d0ac4e3fac6c9ee823db88fac4709, c41468219e472634c589ef299839f347c6726f0e, 26328500fc10e61813d378b82da9838e9717ee15, 6f408b2fb0a2d44a7c0c3a90b2375a77c66b52aa
- 提交时间：2023-06-12, 2023-10-16, 2024-12-30, 2024-01-23
- 提交说明：sync hosted cloud 系列
- 删除类型：前端组件删除/拆分
- 原始路径：common/modal/filter_modal/**, calendar_view/drag_drop_modal/**, calendar_view/utils.ts, expand_record/activity_pane/index.ts
- 相关文件：calendar_view, multi_grid/format/format_lookup/filter_modal, expand_record/activity_pane
- 删除内容摘要：删除旧筛选弹窗、日历拖拽弹窗和若干索引/工具文件。
- 功能作用：局部 UI 交互。
- 是否可完全恢复：部分。
- 恢复难度：中等。
- 依赖项：当前 UI 结构。
- 风险：这些多为重构拆分，整体恢复可能造成重复组件。
- 推荐处理方式：只在明确缺失具体交互时点状恢复。
- 具体恢复方法：
  1. 针对缺失组件从父提交提取代码。
  2. 改为调用当前 hooks/store/API。
  3. 不需要数据库 migration。
  4. 不需要环境变量。
  5. 不支持的视图类型隐藏入口。
  6. 验证对应视图弹窗、拖拽、筛选交互。

### 19. 独立 socket-server 服务与网关入口

- 所属提交 SHA：43a425bc09667b2a501109377826801dcc021619, c3b0a102f0ed328ea733b0fe3f0a6abf0b881c9e
- 提交时间：2023-02-09, 2023-02-10
- 提交说明：sync: hosted cloud (#339); refactor: merge forwarding about sokcet server (#349)
- 删除类型：后端模块、Dockerfile、gateway 配置删除
- 原始路径：packages/socket-server/**, packaging/Dockerfile.socket-server, gateway/conf.d/server/socket-server.conf, gateway/conf.d/upstream/ups-socket-server.conf
- 相关文件：packages/room-server, docker-compose*.yaml, Makefile, gateway/conf.d/server/room.conf
- 删除内容摘要：删除独立 socket-server 包及其 Docker 构建和 Nginx upstream，socket/grpc 配置指向 room-server。
- 功能作用：实时协作/socket 服务。
- 是否可完全恢复：部分。
- 恢复难度：困难。
- 依赖项：room-server 当前已承担 socket，环境变量 SOCKET_GRPC_URL/SOCKET_URL/SOCKET_DOMAIN 已迁移。
- 风险：恢复独立服务会引入双 socket 路由、端口和状态同步问题，影响登录、编辑数据、实时协作。
- 推荐处理方式：不建议恢复独立服务；只在需要旧部署拓扑时做兼容层。
- 具体恢复方法：
  1. 从 43a425bc0966^ 恢复 packages/socket-server 与 Dockerfile，从 c3b0a102f0ed^ 恢复 gateway conf。
  2. 合并 package.json、workspace、Makefile、Compose 和 room/backend 配置。
  3. 不需要业务 DB migration。
  4. 需要 SOCKET_GRPC_URL、SOCKET_URL、SOCKET_DOMAIN 指向独立服务。
  5. room-server 与 socket-server 冲突时保留一个入口，另一个 unsupported。
  6. 验证登录、打开表格、多人编辑、socket 重连、网关路由。

### 20. 旧视图行缓存、widget 数据订阅与 iframe message 通道

- 所属提交 SHA：88be10e37f024e2521ddbb050e629a44728df95c, a1658a96c78bcca416cff0a1159bdb2876bcc131
- 提交时间：2023-02-21, 2023-02-27
- 提交说明：refactor: view derivation calculated data (#2853); sync: hosted cloud (#470)
- 删除类型：前端/SDK 架构删除
- 原始路径：packages/core/src/cache_manager/rows_cache.ts, packages/datasheet/src/pc/common/store_subscribe/visible_rows_base.ts, widget_data.ts, packages/widget-sdk/src/iframe_message/**, widget-sdk/store/slice/*
- 相关文件：packages/core/src/compute_manager/view_derivate/**, widget context/hooks
- 删除内容摘要：删除旧行缓存、widget 数据订阅、iframe message 主通道和 widget-sdk 旧 Redux slice。
- 功能作用：视图派生数据、widget 与宿主通信。
- 是否可完全恢复：部分。
- 恢复难度：困难。
- 依赖项：core store shape、widget-sdk API、datasheet widget panel。
- 风险：回滚会破坏当前 view_derivate 计算、widget block 和数据同步。
- 推荐处理方式：不恢复旧架构；为旧 widget SDK 提供兼容 API 更安全。
- 具体恢复方法：
  1. 不建议直接恢复。若必须兼容旧 widget，提取 iframe message 协议做 adapter。
  2. 避免回滚 core compute_manager。
  3. 不需要 DB migration。
  4. 可能需要 CUSTOM_WIDGET_VISIBLE/WIDGET 配置。
  5. 对旧协议不支持方法返回 unsupported。
  6. 验证 widget 加载、权限、数据刷新、公式/筛选/排序。

### 21. 旧 multi_grid 单体入口、滚动条、selection wrapper、导航 item

- 所属提交 SHA：50aaa517ffb0e31b4817e257edcd47fcbced848b
- 提交时间：2023-05-29
- 提交说明：sync: hosted cloud (#881)
- 删除类型：前端组件删除/拆分
- 原始路径：packages/datasheet/src/pc/components/multi_grid/multi_grid.tsx, grid_views.tsx, header.tsx, scroll_bar/**, selection_wrapper/**, navigation_item/**
- 相关文件：当前 packages/datasheet/src/pc/components/multi_grid/**
- 删除内容摘要：删除旧多视图网格单体和配套滚动/选择组件。
- 功能作用：表格主视图渲染与交互。
- 是否可完全恢复：部分。
- 恢复难度：困难。
- 依赖项：当前 grid store、字段设置、选择态、虚拟滚动。
- 风险：直接恢复会影响创建表格、编辑数据、视图切换。
- 推荐处理方式：不整体恢复，只提取缺失的局部行为。
- 具体恢复方法：
  1. 从 50aaa517ffb0^ 提取单个组件或算法。
  2. 接入当前 multi_grid 目录结构。
  3. 不需要 DB migration。
  4. 不需要环境变量。
  5. 对旧入口保持隐藏。
  6. 创建表格、编辑单元格、滚动、选择区域、切视图验证。

### 22. 机器人创建向导与旧自动化头部 UI

- 所属提交 SHA：e82967e0855fbd77555a484646aec98a89188356
- 提交时间：2023-09-11
- 提交说明：sync: hosted cloud (#1301)
- 删除类型：前端入口删除/替代
- 原始路径：packages/datasheet/src/pc/components/robot/robot_create_guide/**, robot_panel/robot_detail_head.tsx, robot_head.tsx, robot_history_head.tsx, robot_detail/robot_base_info.tsx
- 相关文件：automation components, robot_detail, robot_run_history
- 删除内容摘要：删除四步机器人创建引导和旧头部组件，同时新增/修改新版 automation/robot detail 表单。
- 功能作用：自动化机器人创建引导、详情头部、运行历史头部。
- 是否可完全恢复：是，但需大量适配。
- 恢复难度：困难。
- 依赖项：当前 automation API、机器人权限、run history、trigger/action type。
- 风险：旧向导可能不支持当前自动化模型。
- 推荐处理方式：除非产品明确需要 onboarding，否则保留当前编辑器。
- 具体恢复方法：
  1. 从 e82967e0855f^ 恢复 robot_create_guide 和头部组件。
  2. 改接当前 robot API 和 automation controller。
  3. 不需要 DB migration。
  4. 需要自动化开关和默认机器人头像资源。
  5. trigger/action type 不可用时返回 unsupported。
  6. 创建机器人、配置触发器/动作、查看运行历史。

### 23. 自动化 service/type 管理与后端服务实现

- 所属提交 SHA：492ab31b1bda11233c8e7a80801422b8fec133c0, 0c7e2535f174f900b8fbf12f784e967feb2458c7, 0110ea594cbfa3e99b7c4d8947ab39fb88fb11a3
- 提交时间：2023-04-24, 2023-12-04, 2023-12-18
- 提交说明：sync hosted cloud 系列
- 删除类型：后端/room-server 自动化管理能力删除/迁移
- 原始路径：packages/room-server/src/automation/controller/service.controller.ts, automation/ros/service.*.ro.ts, automation/services/robot.service.service.ts, backend-server/application/src/main/java/com/apitable/automation/service/IAutomationService.java, AutomationServiceImpl.java, AutomationServiceCreateRO/EditRO, TriggerTypeCreateRO/EditRO
- 相关文件：AutomationRobotController, AutomationTriggerTypeService, Databus AutomationDaoApi
- 删除内容摘要：room-server 曾删除 service/type 管理 API；后端后来新增相关 service/type 实体和实现，又在 0110 删除 service 管理实现。
- 功能作用：自动化服务、触发器类型和动作类型的管理。
- 是否可完全恢复：部分。
- 恢复难度：困难。
- 依赖项：自动化数据库表、Databus API、前端管理入口、权限。
- 风险：恢复管理接口可能允许修改系统级 trigger/action type，影响自动化执行。
- 推荐处理方式：需要人工确认管理后台需求；普通自部署用户应隐藏。
- 具体恢复方法：
  1. 从 0c7e2535f174^/0110ea594cbf^ 取后端 service 实现，从 492ab31b1bda^ 取 room-server 管理接口。
  2. 对齐当前 mapper、entity、Databus starter 包名。
  3. 需要确认 automation service/type 表 migration 是否存在。
  4. 需要 DATABUS_SERVER_BASE_URL、Redis/queue 配置。
  5. 无管理后台时返回 unsupported。
  6. 创建/编辑 trigger type、action type，执行机器人验证。

### 24. room-server 自动化队列、触发器与 worker

- 所属提交 SHA：9c48d7c2e99601486b011957ffc7ecdbbcf0e60f
- 提交时间：2023-06-26
- 提交说明：sync: hosted cloud (#989)
- 删除类型：后端执行能力删除
- 原始路径：packages/room-server/src/automation/queues/**, triggers/**, workers/**
- 相关文件：packages/room-server/src/automation/events/**, robot.module.ts
- 删除内容摘要：删除 queue.event.name、redis.config、action/flow queue、trigger factory/helper、form submitted/record created/record updated/scheduled triggers、action/flow workers。
- 功能作用：自动化触发和异步执行。
- 是否可完全恢复：部分。
- 恢复难度：困难。
- 依赖项：Redis/Bull、自动化事件、Databus、当前 room-server 模块结构。
- 风险：错误恢复会导致重复执行或漏执行自动化，影响数据编辑。
- 推荐处理方式：需要先确认当前自动化执行链路；缺失时保持自动化入口隐藏。
- 具体恢复方法：
  1. 从 9c48d7c2e996^ 恢复 queues/triggers/workers。
  2. 对齐当前 events/listeners、robot.module 和依赖版本。
  3. 可能需要 automation 表 migration。
  4. 需要 Redis/queue 环境变量。
  5. 缺队列时返回 unsupported。
  6. 表单提交、记录创建/更新、条件匹配、定时触发和失败重试验证。

### 25. 旧 `packages/databus` npm 包

- 所属提交 SHA：6791d4b747133dcaf99fd52d0eb8f67c033a7379
- 提交时间：2023-08-01
- 提交说明：sync: hosted cloud (#1164)
- 删除类型：包/构建脚本删除
- 原始路径：packages/databus/**
- 相关文件：packages/databus-wasm, packages/databus-wasm-nodejs, packages/databus-client, packages/core/src/modules/database/api/wasm
- 删除内容摘要：删除旧 TS databus 包、build.js、package.json、tsconfig、测试等，同时引入/更新 wasm 相关入口。
- 功能作用：数据总线 API/计算逻辑。
- 是否可完全恢复：部分。
- 恢复难度：困难。
- 依赖项：当前 wasm 包、core API、room-server/databus-server。
- 风险：恢复旧包可能与当前 wasm 运行时重复或冲突。
- 推荐处理方式：不要恢复旧包；为旧 API 写兼容层。
- 具体恢复方法：
  1. 不建议恢复整个 packages/databus。
  2. 若历史插件依赖旧 API，建立 adapter 指向 databus-wasm/databus-client。
  3. 不需要 DB migration。
  4. 需要 databus-server/wasm 资源可用。
  5. 不支持旧 API 时返回 unsupported。
  6. 执行记录读写、公式计算、视图计算测试。

### 26. AI 会话投票数据库 changelog

- 所属提交 SHA：9eef5181913d90f92e8f56337a29bf7900259bd4
- 提交时间：2023-08-28
- 提交说明：sync: hosted cloud (#1248)
- 删除类型：数据库 migration 删除
- 原始路径：init-db/src/main/resources/db/changelog/0.99/20230811_changeset.xml
- 相关文件：db.changelog-master.xml, AI/AirAgent API client 删除项
- 删除内容摘要：删除创建 `${table.prefix}ai_conversation_vote` 表的 Liquibase changeset。
- 功能作用：AI 会话反馈点赞/点踩记录。
- 是否可完全恢复：不能可靠完全恢复。
- 恢复难度：困难。
- 依赖项：AI/AirAgent 后端实现、表访问代码、前端 AI 入口。
- 风险：单独建表无调用方，恢复 AI 入口会依赖 Hosted/私有服务。
- 推荐处理方式：若 AI 模块不可用，保持隐藏；需要 AI 时先恢复服务端实现再恢复 migration。
- 具体恢复方法：
  1. 从 9eef5181913d^ 恢复 changeset。
  2. 确认 db.changelog-master.xml 包含该版本 master。
  3. 需要执行 Liquibase migration。
  4. 需要 AI 服务、相关环境变量和模型/密钥。
  5. 无 AI 服务时返回 unsupported。
  6. 创建 AI 会话并提交 vote，检查表记录。

### 27. 旧 Rust/native room-native-api 数据服务

- 所属提交 SHA：7ee17c4a540c51be8293fb696bb12df6c43384da, f6b64583823db9097c2d4ff9eb2d1defd2861d68, ce3f64dd46fd1731c241d6880df075ab229005e7
- 提交时间：2023-02-23, 2023-04-17, 2023-07-10
- 提交说明：Revert migrate getRecordsById to rust; sync hosted cloud
- 删除类型：原生模块删除
- 原始路径：packages/room-native-api/**
- 相关文件：packages/databus-wasm*, packages/databus-client, room-server
- 删除内容摘要：多次删除 Rust/NAPI 数据服务，包括 record、record_comment、datasheet dependency analyzer、permission、share_setting、repository、SQL util 等。
- 功能作用：用 Rust/native 实现数据查询、权限和依赖分析。
- 是否可完全恢复：部分。
- 恢复难度：极难。
- 依赖项：Rust toolchain、NAPI/Node 绑定、数据库访问层、权限模型、调用方。
- 风险：恢复会影响核心数据读写、权限和性能路径，可能破坏创建表格和编辑数据。
- 推荐处理方式：不建议恢复；继续使用当前 databus-wasm/databus-server 架构。
- 具体恢复方法：
  1. 从 ce3f64dd46fd^ 恢复最终 room-native-api 形态，必要时比对 7ee/f6b 的早期形态。
  2. 恢复 package workspace、构建脚本、调用方。
  3. 可能不需要新 migration，但需 DB schema 完全兼容。
  4. 需要 Rust、Node、数据库连接配置。
  5. 无法兼容时保持 USE_NATIVE_MODULE=0 或 unsupported。
  6. 全量验证 getRecordsById、权限、关联字段、公式、评论、性能。

### 28. CE API client 生成时移除的 Billing/Checkout/Stripe SDK

- 所属提交 SHA：4abd3e614c2baf38b2a330f7af6cd0cb13004464
- 提交时间：2023-11-08
- 提交说明：feat: gen ce api client module (#1445)
- 删除类型：API client 删除
- 原始路径：packages/api-client/Billing*Api.*, packages/api-client/apis/Billing*Api.ts, CheckoutControllerApi.*, StripeWebhookControllerApi.*, 相关 models
- 相关文件：interfaces/billing, SelfHostedEnterpriseSubscriptionInfo
- 删除内容摘要：CE 规格生成 API client 时移除计费、订单、Checkout、Stripe webhook 相关 SDK 和模型。
- 功能作用：Hosted/商业计费、支付和订阅订单。
- 是否可完全恢复：不能可靠完全恢复。
- 恢复难度：极难。
- 依赖项：支付服务、Stripe 密钥、订单数据库表、后端 Controller。
- 风险：只恢复 SDK 会调用不存在的后端，影响订阅页和支付流程。
- 推荐处理方式：自部署企业使用本地订阅信息；支付入口隐藏或 unsupported。
- 具体恢复方法：
  1. 不要直接复制旧生成文件。
  2. 先恢复/实现后端 billing/checkout/stripe Controller。
  3. 需要订单/订阅 migration。
  4. 需要支付服务密钥和 webhook 配置。
  5. 自部署无支付服务时返回 unsupported。
  6. 验证订阅信息、支付回调、订单状态和用量限制。

### 29. CE API client 生成时移除的 SSO/社交/企业集成 SDK

- 所属提交 SHA：4abd3e614c2baf38b2a330f7af6cd0cb13004464
- 提交时间：2023-11-08
- 提交说明：feat: gen ce api client module (#1445)
- 删除类型：API client 删除
- 原始路径：Auth0ControllerApi, IDaaS*, DingTalk*, Lark/Feishu*, WeCom*, WeChat*, TencentQQ*, HuaweiOneAccess*, Woa*, K11LoginInterfaceApi
- 相关文件：packages/datasheet/pages/user/* social callback pages, enterprise/* imports
- 删除内容摘要：移除 Auth0、IDaaS、钉钉、飞书/Lark、企业微信、微信、QQ、Huawei OneAccess、WOA 等 SDK 和大量 models。
- 功能作用：SSO、企业通讯录、第三方平台登录/集成。
- 是否可完全恢复：不能可靠完全恢复。
- 恢复难度：极难。
- 依赖项：私有 enterprise 前端实现、对应后端 Controller、第三方平台密钥、回调域名、数据库表。
- 风险：错误恢复会破坏登录流程。
- 推荐处理方式：没有完整私有实现时隐藏入口或返回 unsupported。
- 具体恢复方法：
  1. 先确认私有 enterprise 源码和后端服务是否可用。
  2. 恢复后端接口后重新生成 api-client。
  3. 可能需要第三方账号/租户表 migration。
  4. 需要各平台 app id/secret、回调 URL。
  5. 未配置平台返回 unsupported。
  6. 分别验证登录、绑定、同步通讯录、解绑、错误回调。

### 30. CE API client 生成时移除的 AI/AirAgent/AppStore/Product/GM/Office/VCode/Store SDK

- 所属提交 SHA：4abd3e614c2baf38b2a330f7af6cd0cb13004464
- 提交时间：2023-11-08
- 提交说明：feat: gen ce api client module (#1445)
- 删除类型：API client 删除
- 原始路径：AIApi, AirAgent*, AppStore*, ApplicationMarket*, Product*, ProductOperation*, GMWidget, OfficeOperation, VCode*, StoreApi, MigrationResourcesAPIApi
- 相关文件：AI changelog 删除项、enterprise/chat、enterprise/Copilot、enterprise/marketing 等前端导入
- 删除内容摘要：移除 AI/AirAgent、应用市场、产品运营、GM、Office、VCode、迁移资源等 Hosted/Enterprise API SDK。
- 功能作用：AI、应用市场、运营后台、商品/模板运营、兑换码、迁移工具。
- 是否可完全恢复：不能可靠完全恢复。
- 恢复难度：极难。
- 依赖项：Hosted Cloud 或私有服务端、外部服务密钥、私有前端页面。
- 风险：恢复生成物但无服务端会造成前端死链和 API 404。
- 推荐处理方式：保持隐藏或 unsupported；只恢复开源可替代的局部能力。
- 具体恢复方法：
  1. 先确认每个服务端模块和数据库表是否存在。
  2. 恢复后端接口后重新生成 SDK。
  3. AI/运营/市场可能各自需要 migration。
  4. 需要模型、应用市场、运营系统等外部配置。
  5. 缺服务时返回 unsupported。
  6. 按模块验证 AI 会话、应用安装、运营模板、兑换码。

### 31. CE API client 生成时移除的审计/Widget 审核/Workbench FieldRole SDK

- 所属提交 SHA：4abd3e614c2baf38b2a330f7af6cd0cb13004464
- 提交时间：2023-11-08
- 提交说明：feat: gen ce api client module (#1445)
- 删除类型：API client 删除
- 原始路径：SpaceAuditApiApi, WidgetSDKWidgetAuditApiApi, WorkbenchFieldRoleAPIApi, 相关 models
- 相关文件：FieldRoleController 删除项、Widget SDK、audit DTO/strings
- 删除内容摘要：移除空间审计查询、Widget 审核和字段权限 Workbench SDK。
- 功能作用：审计日志查询、Widget 审核、字段权限前端 API。
- 是否可完全恢复：部分。
- 恢复难度：极难。
- 依赖项：后端公开 Controller、权限、Widget 审核工作流。
- 风险：SDK 与后端不匹配会让管理页/API 面板失败。
- 推荐处理方式：先恢复后端 API，再重新生成 SDK；不要复制旧生成物。
- 具体恢复方法：
  1. 恢复 FieldRoleController 或对应新接口。
  2. 确认审计/Widget 审核 Controller 是否在私有仓库。
  3. 可能需要 audit/widget 审核表 migration。
  4. 需要管理员权限配置。
  5. 未实现的接口返回 unsupported。
  6. 验证审计查询、Widget 提审/审核、字段权限 API。

### 32. 企业 init-db Makefile 目标与腾讯云邮件模板 ID 表

- 所属提交 SHA：362aa8a44b92a5e6d9a3af64243bd4109a89bbaf
- 提交时间：2023-01-29
- 提交说明：feat(backend-server): init-db-apitable initializer & multiple edition cloud mail template & update-api-deletescript & questionnaire and billing (#237)
- 删除类型：企业初始化/邮件配置删除
- 原始路径：Makefile `db-apply-ee`, TencentMailTemplate.java
- 相关文件：NotifyMailFactory, notification facade, mail starter
- 删除内容摘要：删除 `db-apply-ee` 目标，该目标复制 `../enterprise/init-db`；删除硬编码腾讯云模板 ID 枚举。
- 功能作用：企业版数据库结构初始化、腾讯云邮件模板发送。
- 是否可完全恢复：不能可靠完全恢复。
- 恢复难度：不建议恢复。
- 依赖项：私有 enterprise/init-db、腾讯云邮件模板 ID、商业邮件服务。
- 风险：恢复 Makefile 目标但没有私有目录必定失败；模板 ID 可能泄漏或过期。
- 推荐处理方式：保持删除；企业 migration 应以公开 changelog 或自部署文档提供。
- 具体恢复方法：
  1. 不建议恢复。
  2. 若确需企业 migration，提供本仓库内明确 changelog，而不是引用 ../enterprise。
  3. 需要数据库 migration，但来源必须人工确认。
  4. 邮件需 Tencent Cloud 配置。
  5. 无私有源码时返回 unsupported。
  6. 验证 init-db、邮件验证码、通知邮件。

### 33. 七牛云临时 OSS 回调与 deprecated API

- 所属提交 SHA：7c6f7a1e64996eca6076d7e0204f76be4d771f00
- 提交时间：2023-01-30
- 提交说明：chore: remove oss temporary auto configuration class and deprecated api (#250)
- 删除类型：附件存储旧实现删除
- 原始路径：QiniuTemporaryAutoConfiguration.java, QiniuTemporaryClientTemplate.java, /asset/qiniu/uploadCallback
- 相关文件：AssetCallbackController, OssProperties, AssetUploadCallbackBody
- 删除内容摘要：删除七牛临时客户端、自动配置和 deprecated qiniu 上传回调，保留统一上传完成回调和 widget callback。
- 功能作用：旧七牛云上传回调校验。
- 是否可完全恢复：不建议。
- 恢复难度：不建议恢复。
- 依赖项：七牛 SDK、callback URL/bodyType、OSS 配置。
- 风险：旧接口已 deprecated，恢复会增加攻击面和配置复杂度。
- 推荐处理方式：使用当前 OSS/S3/MinIO 上传路径；七牛旧回调返回 unsupported。
- 具体恢复方法：
  1. 不建议恢复。
  2. 如必须兼容旧客户端，从 7c6f7a1e6499^ 恢复类和 Controller 方法。
  3. 不需要 DB migration。
  4. 需要七牛 access/secret/callback 配置。
  5. 默认保持 /asset/qiniu/uploadCallback unsupported。
  6. 上传附件、回调签名校验、widget 上传回调验证。

## 不建议恢复的功能

- 独立 socket-server 服务：已合并到 room-server，恢复会增加部署和实时协作风险。
- 旧 Rust/native room-native-api：与当前 databus-wasm/databus-server 架构冲突，恢复成本极高。
- 旧 packages/databus 包：已由 wasm/client 包替代。
- 旧 widget iframe message/rows_cache/multi_grid 单体：属于架构重构，不应整体回滚。
- 七牛云临时 OSS 回调：deprecated 且增加附件上传攻击面。
- 企业 `db-apply-ee` Makefile 目标：依赖仓库外私有 `../enterprise/init-db`。
- 直接恢复 CE API client 删除的 Hosted/Enterprise SDK：没有后端和私有 enterprise 源码时只会产生 404 或编译失败。
- Hosted `.env.production` 整文件恢复：包含大量外部 Hosted URL 和商业服务入口，应按需迁移。
- Sensors 埋点：自部署默认不应发送数据到外部商业 analytics。
- AI 会话投票 migration：没有 AI 服务端时不应单独建表。

## 可优先恢复的功能

1. 字段权限 Workbench Controller API：service 层仍在，恢复路径相对清晰，能补齐字段权限管理入口。
2. 目录全局搜索组件：`Api.findNode` 仍存在，主要是前端接回入口和快捷键。
3. 表单预填面板：历史实现完整，当前缺 enterprise 源码时可恢复本地实现。
4. 原 CI/安全工作流：恢复 lint、CodeQL、dependency review 可提升交付质量，注意禁用官方发布 job。
5. 任务提醒邮件模板：文件级恢复简单，但需要先确认模板名映射。
6. 第三方权限扩展门面：可作为自部署企业二开扩展点恢复，默认实现应保持透传。

## 验证方法

- 构建：执行 `pnpm build:dst:pre`、`pnpm build:web`、`pnpm build:room-server`、后端 Gradle build；如恢复 Docker 能力，执行 `scripts/build-all-in-one-local.sh` 或对应 `docker buildx bake`。
- 启动：启动 mysql、redis、rabbitmq、minio、backend-server、room-server、web-server/databus-server，检查健康接口和网关路由。
- 登录：验证邮箱/密码登录、登出、会话刷新；若恢复 SSO/社交登录，逐平台验证回调失败和成功路径。
- 创建空间：新用户创建空间，检查订阅信息、空间角色、管理页入口。
- 创建表格：在空间中新建 datasheet/form/dashboard/mirror/automation 等可用节点，确认节点类型和默认名称。
- 编辑数据：新增/编辑/删除记录，验证公式、关联、权限、自动化触发和实时协作。
- 上传附件：使用当前 MinIO/S3/OSS 配置上传附件、预览、下载；确认旧七牛回调保持 disabled/unsupported。
- 调用 API：调用 Fusion API、字段权限 API、自动化 API、分享 API；对未恢复 Hosted/Enterprise API 检查返回 unsupported 而不是 500。
- 检查前端入口：检查目录搜索、字段权限、表单预填、公开分享二维码、管理页、Widget、自动化、模板中心入口是否显示正确。
- 检查后端接口：检查 Controller 路由注册、鉴权、OpenAPI 扫描、service 注入和 Databus client 包名。
- 检查日志错误：检查 backend-server、room-server、web-server、databus-server、gateway 日志，无 ClassNotFound、NoSuchBean、404 热点、前端 dynamic import 失败和 socket 重连异常。
