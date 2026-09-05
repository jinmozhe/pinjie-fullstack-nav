# docs/ 文档索引

> **文档来源**：`docs/` 是本仓库 PRD、ADR、架构、蓝图和运维等专题项目文档的唯一存储和发布来源。根规则、项目索引、计划、README、安全策略和 Changelog 按各自职责保留在稳定路径。GitHub Wiki 已停用，禁止将本目录同步或复制到 Wiki。
> **维护规则**：每次在 `docs/` 目录下新建或修改文档，必须同步更新本文件中对应的记录。
> 索引只写"路径 + 一句话说明"，不写长正文。

---

## 产品需求基线

| 文件                                               | 说明                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| [PROJECT_REQUIREMENTS.md](PROJECT_REQUIREMENTS.md) | 母版目标用户、适用场景、目标能力、非目标、派生规则和完成验收标准 |

---

## adr/ - 架构决策记录

> 记录重大技术选型和架构决策。只追加，不修改。如果推翻旧决策，新建一条 ADR 说明。

| 文件                                                                                         | 说明                                                                            |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [0001-全栈Monorepo架构决策.md](adr/0001-全栈Monorepo架构决策.md)                             | 为什么选择 pnpm workspace Monorepo、通用母版边界、共享规则                      |
| [0002-Codex与Antigravity指令兼容决策.md](adr/0002-Codex与Antigravity指令兼容决策.md)         | 统一 AGENTS.md 规则正文、指令容量门禁，并通过 Antigravity Workspace Rules 桥接加载 |
| [0003-本地开发环境架构决策.md](adr/0003-本地开发环境架构决策.md)                             | 选择纯 uv、pnpm、本机 PostgreSQL 与 Docker Desktop Redis 的本地开发组合         |
| [0004-全项目索引与计划生命周期决策.md](adr/0004-全项目索引与计划生命周期决策.md)             | 建立全项目索引、全栈计划生命周期和永久计划登记；派生初始化部分由 ADR 0015 修订 |
| [0005-GitHub Wiki停用与文档单一来源决策.md](adr/0005-GitHub%20Wiki停用与文档单一来源决策.md) | 停用 GitHub Wiki，以仓库 `docs/` 作为专题项目文档唯一发布来源                   |
| [0006-模块化单体与领域依赖边界决策.md](adr/0006-模块化单体与领域依赖边界决策.md)             | 采用模块化单体，明确领域所有权、公开协作端口和禁止的跨领域内部依赖              |
| [0007-受控迁移兼容策略决策.md](adr/0007-受控迁移兼容策略决策.md)                             | 禁止永久和隐式兼容，仅允许有期限、可观测、可删除的迁移窗口                      |
| [0008-不可变发布与生产追溯决策.md](adr/0008-不可变发布与生产追溯决策.md)                     | 分离 CI、镜像发布和生产部署，以 Commit SHA、镜像 digest 和部署记录建立追溯链    |
| [0009-Python运行时基线决策.md](adr/0009-Python运行时基线决策.md)                             | 统一标准 CPython 3.14、本地 uv、CI、容器补丁固定和标准库 UUID v7 边界           |
| [0010-浏览器认证会话RBAC与审计决策.md](adr/0010-浏览器认证会话RBAC与审计决策.md)             | 确定 Browser Cookie Profile、C/B 会话隔离、Refresh 权威、规范化 RBAC 与审计边界 |
| [0011-Admin采用AntDesignProV6与UmiMax决策.md](adr/0011-Admin采用AntDesignProV6与UmiMax决策.md) | Admin 全面采用官方 Ant Design Pro v6/Umi Max，保留项目安全、契约和质量边界 |
| [0012-统一文件资产采用可补偿本地存储决策.md](adr/0012-统一文件资产采用可补偿本地存储决策.md) | 统一文件资产采用存储端口、同文件系统原子提交、同主体去重和可恢复删除补偿 |
| [0013-全局系统设置与配置媒体决策.md](adr/0013-全局系统设置与配置媒体决策.md) | 全局设置采用单表分组 JSONB、固定强类型接口和独立可补偿配置媒体槽位 |
| [0014-共享PostgreSQL与Redis生产基础设施决策.md](adr/0014-共享PostgreSQL与Redis生产基础设施决策.md) | 生产共享 1Panel PostgreSQL 与 Redis，并按项目隔离数据库、角色、ACL、Key 和恢复范围 |
| [0015-派生项目计划基线重建决策.md](adr/0015-派生项目计划基线重建决策.md) | 母版永久保留计划，独立派生仓库可在初始化阶段由用户人工清理继承计划并重建计划基线 |

---

## architecture/ - 架构设计说明

> 描述仓库和应用的结构设计，面向开发者，说明"是什么、为什么这样设计"。

| 文件                                                                            | 说明                                                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [project-structure.md](architecture/project-structure.md)                       | 完整目录树 + 工程文件设计说明（全项目索引、全栈计划、AI 规则桥接、环境变量和锁文件等）     |
| [backend-engineering-standard.md](architecture/backend-engineering-standard.md) | Backend 配置、Router、事务、数据、外部调用、日志、探针、测试和质量门禁的具体实施标准       |
| [admin-engineering-standard.md](architecture/admin-engineering-standard.md)     | Admin Umi/Pro 框架边界、Feature、请求、状态、UI 组件和依赖准入的具体实施标准               |
| [module-boundaries.md](architecture/module-boundaries.md)                       | Backend 领域、Frontend Feature、共享包和机械依赖门禁的边界                                 |
| [error-model.md](architecture/error-model.md)                                   | 错误分类、HTTP 契约、分层处理和禁止吞错、假成功、静默降级的规则                            |
| [authentication-authorization.md](architecture/authentication-authorization.md) | Browser Cookie Profile、JWT、Session、CSRF、RBAC、管理操作保护和审计运行机制             |
| [testing-strategy.md](architecture/testing-strategy.md)                         | 单元、Service、Repository、API、standalone E2E、架构、迁移和契约测试策略                   |
| [observability-reliability.md](architecture/observability-reliability.md)       | 部署等级、健康探针、安全事件、同事务审计、请求元数据 Stream、SLO、容量和恢复演练基线       |
| [file-asset-storage.md](architecture/file-asset-storage.md)                     | 统一文件资产的存储端口、上传安全、双域鉴权、去重、删除补偿和生产卷边界                   |
| [system-settings.md](architecture/system-settings.md)                           | 系统设置的数据模型、强类型接口、注册 Fail Closed、配置媒体恢复及三端消费边界             |
| [全栈Monorepo架构规划原始方案.md](architecture/全栈Monorepo架构规划原始方案.md) | 从 pinjie-standard 迁移的完整原始规划方案，包含技术选型对比、电商领域设计、1Panel 部署规范 |

---

## blueprints/ - 业务扩展蓝图

> 母版只含通用能力（auth/users/admin/system）。业务领域扩展的设计思路、数据模型、实施步骤记录在这里，供派生仓库参考。

| 文件                                                           | 说明                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [blueprints/commerce/README.md](blueprints/commerce/README.md) | 电商业务蓝图：领域划分（商品/库存/购物车/订单/支付/促销/评价）与派生仓库建议 |

待补充目录（有需要时创建）：

- `blueprints/cms/` - 内容管理系统蓝图
- `blueprints/blog/` - 博客系统蓝图
- `blueprints/corporate-site/` - 企业官网蓝图

---

## operations/ - 运维操作手册

> 可执行的操作步骤文档，面向部署和日常运维，不讲理论只讲操作。

| 文件 | 说明 |
| --- | --- |
| [local-dev-environment.md](operations/local-dev-environment.md) | Windows 本地开发手册：纯 uv、pnpm、本机 PostgreSQL、Docker Desktop Redis、Codex 默认联网沙箱基线与生产环境边界 |
| [environment-variables-and-backend-local-run.md](operations/environment-variables-and-backend-local-run.md) | 三端环境变量、认证 Secret、Backend 初始化、权限同步、管理员创建、日志 Worker 和本地检查步骤 |
| [admin-local-development-and-validation-troubleshooting.md](operations/admin-local-development-and-validation-troubleshooting.md) | Admin Umi 本地启动、测试、浏览器验证、跨栈前置条件和迁移故障排查 |
| [ai-assisted-development-workflow.md](operations/ai-assisted-development-workflow.md) | AI 助手规则读取、任务路由、计划交付、本地检查点、高风险编辑、验证和独立授权指南 |
| [codex-windows-config-acl-governance.md](operations/codex-windows-config-acl-governance.md) | Codex Windows `config.toml`、默认联网、Schannel、GitHub CLI Keyring、`elevated + Custom`、ACL 诊断、验证、最小修复和回滚标准 |
| [uv使用指南.md](operations/uv使用指南.md) | uv 原理、纯 uv 环境方案、常用命令和 conda 对比 |
| [pnpm使用指南.md](operations/pnpm使用指南.md) | pnpm 存储机制、workspace 共享包、Markdown 检查等常用命令和 npm 对比 |
| [github-cnb-tcr-1panel-release-runbook.md](operations/github-cnb-tcr-1panel-release-runbook.md) | 操作人员从 GitHub Actions 经 CNB、TCR 到 1Panel 完成首次部署、日常更新、验证和回滚的端到端手册 |
| [github-actions-workflows.md](operations/github-actions-workflows.md) | GitHub Actions 自动 CI、安全扫描、人工镜像发布和生产部署的逐工作流说明与排障入口 |
| [release-and-rollback.md](operations/release-and-rollback.md) | CI、镜像发布、生产部署和按固定 digest 回滚的操作边界 |
| [container-build-and-run.md](operations/container-build-and-run.md) | 三个应用镜像构建、迁移与权限初始化、请求日志 Profile、生产 Compose 和健康验证 |
| [tencent-tcr-personal-cam-accounts.md](operations/tencent-tcr-personal-cam-accounts.md) | 腾讯云 TCR 个人版发布与生产拉取身份隔离、CAM 三仓最小权限、凭证初始化、服务器登录、验证、轮换和排障步骤 |
| [1panel-production-runbook.md](operations/1panel-production-runbook.md) | 1Panel 单机生产配置、迁移、OpenResty、日志、备份、恢复和回滚步骤 |
| [database-backup-restore.md](operations/database-backup-restore.md) | 备份参数、本地恢复演练、生产恢复和数据库迁移保护步骤 |
| [incident-response.md](operations/incident-response.md) | 事故分级、角色、止损、恢复验证、状态沟通和复盘步骤 |
| [docker-desktop-redis使用指南.md](operations/docker-desktop-redis使用指南.md) | Docker Desktop Redis 架构选型、日常启停、会话限流关键依赖、多项目数据隔离与生产建议 |

---

## 索引维护说明

新增文档时，在对应目录区块的表格中追加一行：

```text
| `文件名.md`（链接到对应相对路径） | 一句话说明文档用途 |
```

修改文档时，如果文档用途或范围发生变化，更新对应行的说明文字。

删除文档时，同步删除对应行，并在行末注明删除原因（可选）。
