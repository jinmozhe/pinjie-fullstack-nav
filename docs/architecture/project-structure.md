# 仓库文件结构说明

> 文档归属：`docs/architecture/project-structure.md`
> 适用仓库：`pinjie-fullstack-base`
> 最后更新：2026-08-29

---

## 一、当前文件结构概览

以下清单用于说明主要目录和稳定入口。`plans/` 下的实施计划不在此逐项复制，完整登记以 `plans/INDEX.md` 为准。`.git`、`.venv`、`node_modules`、缓存、构建产物、真实 `.env`、日志、上传和运行数据不属于项目结构清单。Admin 当前结构为 Umi Max 工程，入口是 `src/app.tsx`，配置位于 `config/`，启动包装器位于 `scripts/run-umi.mjs`。

```text
. :: .dockerignore, .editorconfig, .env.example, .gitattributes, .gitignore, .markdownlint.json, AGENTS.md, CHANGELOG.md, compose.prod.yml, compose.yml, openapi.json, package.json, playwright.config.ts, pnpm-lock.yaml, pnpm-workspace.yaml, PROJECT_INDEX.md, README.md, SECURITY.md, turbo.json
.agents/rules :: .markdownlint.json, 00-repository.md, 10-backend.md, 20-admin.md, 30-web.md
.github :: CODEOWNERS, pull_request_template.md
.github/workflows :: ci-backend.yml, ci-e2e.yml, ci-frontend.yml, ci-governance.yml, deploy-production.yml, publish-images.yml, security.yml
.vscode :: extensions.json
apps/admin :: .env.example, AGENTS.md, Dockerfile, eslint.config.mjs, nginx.conf, package.json, README.md, tsconfig.json, vitest.config.ts
apps/admin/config :: config.ts, defaultSettings.ts, html-accessibility.ts, proxy.ts, routes.ts
apps/admin/scripts :: run-umi.mjs
apps/admin/src :: access.test.ts, access.ts, app.test.tsx, app.tsx, env.d.ts, global.d.ts, styles.css, umi-shims.d.ts
apps/admin/src/components :: PageFrame.tsx
apps/admin/src/features :: StageC.test.tsx
apps/admin/src/features/admins :: AdminsPage.tsx
apps/admin/src/features/auth :: auth-context.ts, ConfirmActionModal.tsx, index.ts, LoginPage.tsx
apps/admin/src/features/roles :: RolesPage.tsx
apps/admin/src/features/security :: SecurityPage.tsx
apps/admin/src/features/system :: api.ts, SystemStatusPage.test.tsx, SystemStatusPage.tsx
apps/admin/src/features/users :: UsersPage.tsx
apps/admin/src/lib :: navigation.ts
apps/admin/src/lib/api :: admin.ts, http.test.ts, http.ts
apps/admin/src/test :: server.ts, setup.ts
apps/backend :: .env.example, .importlinter, .python-version, AGENTS.md, alembic.ini, Dockerfile, pyproject.toml, README.md, uv.lock
apps/backend/alembic :: env.py, script.py.mako
apps/backend/alembic/versions :: 20260815_01_stage_c_identity.py, 20260820_01_request_logs_add_body.py, README.md
apps/backend/app :: __init__.py, api_router.py, main.py
apps/backend/app/api :: __init__.py, dependencies.py
apps/backend/app/core :: __init__.py, cache_keys.py, client_identity.py, config.py, context.py, cookies.py, csrf.py, error_codes.py, exceptions.py, health.py, identifiers.py, logging.py, middleware.py, openapi.py, pagination.py, password_policy.py, payload_sanitizer.py, privacy.py, rate_limit.py, redis.py, request_metadata.py, resources.py, response.py, security.py
apps/backend/app/db :: __init__.py, session.py, transaction.py
apps/backend/app/db/models :: __init__.py, base.py, identity.py
apps/backend/app/db/repositories :: __init__.py, identity.py
apps/backend/app/domains :: __init__.py
apps/backend/app/domains/admin :: __init__.py, auth_router.py, management_router.py, permissions.py, presenters.py, schemas.py
apps/backend/app/domains/auth :: __init__.py, router.py, schemas.py
apps/backend/app/domains/system :: __init__.py, router.py, schemas.py
apps/backend/app/domains/users :: __init__.py, router.py, schemas.py
apps/backend/app/services :: __init__.py, accounts.py, admin_management.py, authentication.py, security_events.py
apps/backend/scripts :: __init__.py, _database_target.py, backfill_session_device_names.py, cleanup_security_logs.py, consume_request_logs.py, create_initial_admin.py, export_openapi.py, sync_permissions.py, verify_local_database_recovery.py
apps/backend/tests :: __init__.py, conftest.py, test_api.py, test_client_identity.py, test_config.py, test_core_coverage.py, test_database_recovery_script.py, test_identifiers.py, test_openapi_export.py, test_openapi_localization.py, test_password_policy.py, test_payload_sanitizer.py, test_postgres_integration.py, test_stage_b_coverage.py, test_stage_c_auth_api.py, test_stage_c_cookies.py, test_stage_c_integrations.py, test_stage_c_request_metadata.py, test_stage_c_security.py, test_transaction.py
apps/web :: .env.example, AGENTS.md, Dockerfile, eslint.config.mjs, next.config.ts, package.json, README.md, tsconfig.json, vitest.config.ts
apps/web/scripts :: prepare-standalone.mjs
apps/web/src/app :: error.tsx, globals.css, icon.tsx, layout.tsx, loading.tsx, not-found.tsx, page.tsx, providers.tsx
apps/web/src/app/account :: page.tsx
apps/web/src/app/api/v1/[...path] :: route.test.ts, route.ts
apps/web/src/app/api/v1/system/status :: route.ts
apps/web/src/app/login :: page.tsx
apps/web/src/app/register :: page.tsx
apps/web/src/features :: StageC.test.tsx
apps/web/src/features/account :: AccountCenter.tsx, AccountSessionRecovery.tsx
apps/web/src/features/auth :: api.ts, AuthForm.tsx, index.ts
apps/web/src/features/system :: SystemStatusCard.test.tsx, SystemStatusCard.tsx
apps/web/src/lib/api :: client.ts, http.ts, server.test.ts, server.ts
apps/web/src/test :: server.ts, setup.ts
docs :: PROJECT_REQUIREMENTS.md, README.md
docs/adr :: 0001-全栈Monorepo架构决策.md, 0002-Codex与Antigravity指令兼容决策.md, 0003-本地开发环境架构决策.md, 0004-全项目索引与计划生命周期决策.md, 0005-GitHub Wiki停用与文档单一来源决策.md, 0006-模块化单体与领域依赖边界决策.md, 0007-受控迁移兼容策略决策.md, 0008-不可变发布与生产追溯决策.md, 0009-Python运行时基线决策.md, 0010-浏览器认证会话RBAC与审计决策.md, 0011-Admin采用AntDesignProV6与UmiMax决策.md, 0012-统一文件资产采用可补偿本地存储决策.md, 0013-全局系统设置与配置媒体决策.md, 0014-共享PostgreSQL与Redis生产基础设施决策.md, 0015-派生项目计划基线重建决策.md
docs/architecture :: 全栈Monorepo架构规划原始方案.md, admin-engineering-standard.md, authentication-authorization.md, backend-engineering-standard.md, error-model.md, file-asset-storage.md, module-boundaries.md, observability-reliability.md, project-structure.md, system-settings.md, testing-strategy.md
docs/blueprints/commerce :: README.md
docs/operations :: 1panel-production-runbook.md, admin-local-development-and-validation-troubleshooting.md, ai-assisted-development-workflow.md, codex-windows-config-acl-governance.md, container-build-and-run.md, database-backup-restore.md, docker-desktop-redis使用指南.md, environment-variables-and-backend-local-run.md, github-actions-workflows.md, incident-response.md, local-dev-environment.md, pnpm使用指南.md, release-and-rollback.md, uv使用指南.md
e2e :: helpers.ts, stage-c.spec.ts, system-status.spec.ts
packages/api-client :: package.json
packages/api-client/src :: client.gen.ts, index.ts, sdk.gen.ts, types.gen.ts
packages/api-client/src/client :: client.gen.ts, index.ts, types.gen.ts, utils.gen.ts
packages/api-client/src/core :: auth.gen.ts, bodySerializer.gen.ts, params.gen.ts, pathSerializer.gen.ts, queryKeySerializer.gen.ts, serverSentEvents.gen.ts, types.gen.ts, utils.gen.ts
packages/eslint-config :: index.js, package.json
packages/typescript-config :: base.json, nextjs.json, package.json, vite.json
plans :: INDEX.md, README.md, YYYY-MM-DD_*计划.md
scripts/ci :: check-document-governance.ps1, check-module-boundaries.ps1, check-production-compose.ps1, check-text-files.ps1, check-typescript-boundaries.mjs, check-workspace-state.ps1, test-document-governance-guard.ps1, test-governance-guards.ps1, test-production-compose-guard.ps1, test-typescript-boundary-guard.mjs
scripts/e2e :: run-e2e.mjs
scripts/operations :: test-postgres-backup-restore.ps1
```

---

## 二、工程文件设计说明

### 为什么同时存在 `AGENTS.md` 和 `.agents/rules/`

四份 `AGENTS.md` 是项目规则的唯一正文来源：根文件定义全局规则，三个应用文件只补充各自技术栈和目录边界。

`.agents/rules/` 只负责让 Antigravity 按 Workspace Rules 机制加载这些正文。`00-repository.md` 无 frontmatter，作为无条件规则；三个应用桥接文件使用 `trigger: glob` 和对应目录模式。桥接文件通过相对路径 `@` 引用 `AGENTS.md`，不复制规则内容。

本仓库不创建项目级 `GEMINI.md` 或 `.agents/AGENTS.md`，防止出现多份规则正文。完整决策见 `docs/adr/0002-Codex与Antigravity指令兼容决策.md`。

### 为什么建立 `PROJECT_INDEX.md`

`PROJECT_INDEX.md` 是全项目任务导航和高频阶段入口，只记录项目身份、当前阶段、活动计划和权威入口。详细实现状态继续由实际源码、配置、迁移、生成契约和对应架构文档证明。历史计划不会进入根索引，避免计划持续增长扩大每次任务的必读上下文。

该文件固定放在仓库根目录，与 `AGENTS.md`、`CHANGELOG.md` 同层，便于人和 AI 直接发现并在标准工作区权限内持续维护。`.agents/` 只承担 Antigravity 规则桥接职责，不保存需要频繁更新的项目索引。

它不保存规则正文，也不替代 `docs/README.md` 或 `plans/README.md`：

- 各级 `AGENTS.md` 保存长期执行规则。
- `PROJECT_INDEX.md` 保存项目身份、当前阶段、活动计划和权威入口。
- `docs/PROJECT_REQUIREMENTS.md` 保存目标用户、目标能力、非目标和验收边界。
- `docs/README.md` 保存 `docs/` 的完整文档清单。
- `plans/INDEX.md` 保存全部实施计划的唯一永久登记。
- `plans/README.md` 保存计划格式和生命周期规则。
- `plans/*.md` 保存全栈实施方案和结果。
- `CHANGELOG.md` 保存已经交付的变化。

派生仓库继承根索引和计划治理机制，并更新项目角色、派生类型、母版不可变 Tag、完整 40 位 Commit SHA、当前阶段和业务范围。独立业务仓库可以在派生初始化阶段由用户人工一次性清理母版继承计划并重建计划索引；完整决策见 ADR 0004 和 ADR 0015。

### 为什么建立 `plans/INDEX.md`

`plans/INDEX.md` 集中保存所有实施计划的路径、状态、结果、影响范围和用途。新建计划或计划状态、结果变化时同步更新该文件；根 `PROJECT_INDEX.md` 只在计划进入或退出活动状态时更新。

这种拆分保留了完整历史追溯，同时把低频历史登记移出每次任务必读的根入口。`plans/README.md` 继续只定义计划创建、格式、状态、完成和保护规则，不保存计划登记正文。

### 为什么 `PROJECT_REQUIREMENTS.md` 直接放在 `docs/`

当前只有一份产品需求基线，直接使用 `docs/PROJECT_REQUIREMENTS.md` 可以保持入口短且稳定，不为单一文件提前创建 `docs/product/` 目录。

该文件定义母版服务谁、解决什么问题、目标能力、非目标、派生规则和验收条件。技术选型理由继续由 ADR 承担，详细实现状态由实际源码、配置、迁移、生成契约和对应架构文档证明，项目阶段和活动计划由 `PROJECT_INDEX.md` 导航，具体实施步骤由 `plans/` 承担。未来出现至少三份职责独立的产品文档时，再通过人工评审决定是否新增 `docs/product/`；不得为整理目录而自动移动现有 PRD。

### 为什么 `plans/` 保持扁平

`plans/` 属于整个全栈 Monorepo，计划以完整业务能力或工程目标为单位。涉及 Backend、Admin、Web、API Client 或 Database 的同一能力在同一份计划中描述完整链路、实施顺序、契约同步和联合验证。

计划文件直接放在 `plans/` 下，不创建 `active/`、`archive/` 或按应用拆分的子目录。稳定路径能够保证长期引用有效。母版和完成初始化后的派生项目永久保留本仓库计划及其在 `plans/INDEX.md` 中的登记，AI 不得删除、移动、重命名、替换或自动归档。独立派生仓库的一次性人工初始化例外见 ADR 0015。

### 为什么 `.env.example` 分四层

| 层级 | 文件位置 | 存放内容 | 使用者 |
| --- | --- | --- | --- |
| 部署层 | 根目录 `.env.example` | 三端 TCR 完整 digest 引用和 Web 公开 Origin | `compose.prod.yml`、生产部署工作流 |
| 后端层 | `apps/backend/.env.example` | 数据库、Redis、运行环境和 Web/Admin Origin | uvicorn 进程 |
| Web 层 | `apps/web/.env.example` | `BACKEND_INTERNAL_URL`、`WEB_PUBLIC_ORIGIN` | Next.js 服务端运行时 |
| Admin 层 | `apps/admin/.env.example` | 可选 `VITE_API_URL`，默认同域 `/api/v1` | Umi Max 开发代理或生产 Nginx |

各层只声明自己负责的变量。生产 Compose 从根 `.env` 读取镜像引用和 Web 公开 Origin，从 `apps/backend/.env` 向 Backend 容器注入共享 PostgreSQL、Redis 连接及运行配置；Web 使用 `BACKEND_INTERNAL_URL`，Admin 使用同域代理。根模板不保存 GitHub Environment 变量和 Secret，`DEPLOY_PATH`、部署开关与 SSH 凭据只在受保护的 `production` Environment 中配置。详细操作见[环境变量分层与 Backend 本地运行手册](../operations/environment-variables-and-backend-local-run.md)。分层原因：

- 后端和前端的环境变量格式不同（Python `os.environ` vs Next.js `NEXT_PUBLIC_` 前缀 vs Umi 可公开环境变量）
- 开发者进入某个应用目录工作时，能直接看到该应用需要哪些变量，不需要翻根目录的大文件
- 生产部署时，部署镜像选择与应用运行配置具有独立边界，只有 Compose 明确声明的变量才进入对应容器

---

### 为什么 `pnpm-lock.yaml` 放根目录

pnpm workspace 模式下，所有 workspace 成员（`apps/*` 和 `packages/*`）的依赖统一由根目录的 pnpm 管理。`pnpm install` 执行后只会在根目录生成一份 `pnpm-lock.yaml`，其中锁定了所有应用的所有依赖版本。

当前运行基线为 Node.js 24 及以上受支持版本，根 `packageManager` 固定 pnpm 11.17.0，CI 与本地开发必须保持一致。版本升级需要同时验证锁文件、生成工具和三个应用构建。

根 `pnpm-workspace.yaml` 通过 `allowBuilds` 显式批准 6 个当前依赖所需的安装构建脚本：`esbuild` 与 `sharp` 来自初始工程治理基线，`msw` 随阶段 B 测试基础设施引入，`core-js`、`core-js-pure` 与 `es5-ext` 随 Admin Umi Max 迁移引入。来源由对应 Git 历史和根锁文件证明；新增或删除条目仍需评审包来源、脚本行为、消费者和构建必要性，未登记的依赖安装脚本默认不执行。

好处：

- 一份锁文件，避免不同应用对同一库锁定不同版本
- CI 只需要 `pnpm install` 一条命令，无需进入各子目录分别安装
- `node_modules` 通过 symlink 共享，减少磁盘占用

后端的 `uv.lock` 在 `apps/backend/` 目录下，因为 Python 和 Node.js 是两个完全独立的生态，uv 只管 Python 依赖，pnpm 只管 JavaScript 依赖，两者不共享。

---

### 为什么 `eslint.config.mjs` 在各应用但规则在 `packages/`

`packages/eslint-config/index.js` 定义**共享规则**（TypeScript 严格性、命名规范等），两个前端应用共同遵守。

各应用的 `eslint.config.mjs` 在共享规则基础上追加**框架特定规则**：

```text
apps/web/eslint.config.mjs
  └── 引用 @pinjie/eslint-config（共享规则）
  └── 追加 next/core-web-vitals（Next.js 规则）

apps/admin/eslint.config.mjs
  └── 引用 @pinjie/eslint-config（共享规则）
  └── 补充浏览器与 Node.js 运行时全局变量
```

类比 `tsconfig.json` 的继承关系：`packages/typescript-config` 定义基础，各应用继承后按需扩展。

---

### 为什么 `next.config.ts` 锁定 `output: "standalone"`

Next.js 有三种输出模式：

- 默认模式：需要 Node.js 服务器 + 完整的 `node_modules`，不适合容器化
- `export` 模式：纯静态 HTML，不支持 SSR 和 API Route，功能受限
- `standalone` 模式：只打包实际用到的文件，容器镜像体积最小，支持完整 SSR

生产部署走 Docker 容器，必须用 `standalone` 模式。在 `next.config.ts` 里写死，防止将来有人误改。

---

### 为什么 `openapi.json` 在根目录而不在 `docs/`

`openapi.json` 是后端脚本自动生成的**机器可读构建产物**，消费者是 `pnpm generate-api` 脚本（生成 `packages/api-client/src/`），不是给人阅读的文档。

放根目录原因：

- 路径最短，SDK 生成命令引用 `../../openapi.json` 而不是 `../../docs/openapi.json`
- 和 `package.json`、`pnpm-workspace.yaml` 同级，语义上是根目录级别的全局产物
- `docs/` 目录应只存放给人读的 Markdown 文档，不混入机器产物

---

## 三、关键边界规则

### 当前实现与后续扩展边界

| 应用范围 | 当前母版实现 | 派生仓库扩展 |
| --- | --- | --- |
| `apps/backend/app/domains/` | `system`、`auth`、`users`、`admin`，覆盖浏览器认证、账户、RBAC、安全事件和审计 | products、orders、payments 等具体业务领域 |
| `apps/web/src/features/` | `system`、`auth`、`account`，覆盖注册、登录、用户中心、会话和注销 | products、cart、checkout 等用户业务切片 |
| `apps/admin/src/features/` | `system`、`auth`、`users`、`admins`、`roles`、`security` | products、orders、promotions 等运营业务切片 |

阶段 C 已交付上述母版通用能力。短信、微信、邮箱登录、MFA、ABAC、多租户及具体业务领域继续由后续计划或派生仓库实现。

### 前端共享边界

- `apps/web` 和 `apps/admin` 禁止直接互相引用
- 共享只通过 `packages/` 下三个包进行：`@pinjie/api-client`、`@pinjie/eslint-config`、`@pinjie/typescript-config`

### openapi.json 生成链路

```text
后端代码 → 运行导出脚本 → 根目录 openapi.json（禁止手改）
                                    ↓
                   pnpm generate-api（@hey-api/openapi-ts）
                                    ↓
                   packages/api-client/src/（自动生成，禁止手改）
                                    ↓
                   apps/web 和 apps/admin 引用 @pinjie/api-client
```

---

## 四、文件命名规范

| 类型 | 规范 | 示例 |
| --- | --- | --- |
| ADR 文档 | 四位数字前缀 + 连字符 | `0001-全栈Monorepo架构决策.md` |
| 实施计划 | 日期前缀 + 全栈目标名 | `2026-08-12_CMS内容发布链路计划.md` |
| 架构文档 | 连字符命名 | `authentication-protocol.md` |
| 运维手册 | 中文主题名或连字符英文名 + 功能描述 | `uv使用指南.md`、`1panel-production-runbook.md` |
| 蓝图文档 | 蓝图目录下 README.md 为入口 | `blueprints/commerce/README.md` |

---

## 五、docs/ 目录规划说明

当前 `docs/` 只创建有实际内容的文档，以下是各目录的当前职责和扩展条件：

| 目录 | 当前内容 | 扩展条件 |
| --- | --- | --- |
| `docs/` | 产品需求基线和完整文档索引 | 产品文档达到至少三份且职责独立时再评估 `docs/product/` |
| `docs/adr/` | `0001` 至 `0015` 架构决策记录 | 出现新的重大且长期技术取舍时新增 ADR |
| `docs/architecture/` | 项目结构、Backend/Admin 工程标准、模块边界、错误、认证授权、测试、可靠性和原始规划 | 当前系统机制变化时就地更新对应文档 |
| `docs/blueprints/commerce/` | Commerce 派生蓝图入口 | 真实派生需求确认后增加领域模型和业务流程设计 |
| `docs/operations/` | AI 协作、本地环境、依赖、容器、发布回滚、备份恢复和事故响应手册 | 出现可执行的新运维流程时就地增加或更新手册 |

`docs/blueprints/cms/`、`docs/blueprints/blog/` 和 `docs/blueprints/corporate-site/` 当前均不存在。有实际需求时再创建对应文件，不提前维护空目录或占位文档。
