# Pinjie Fullstack Nav

> 独立导航站全栈项目 | FastAPI + Next.js + React + pnpm + Turborepo | 派生自 Pinjie Fullstack Base

`pinjie-fullstack-nav` 继承母版的认证、用户、管理、系统、契约生成和部署能力，用于继续开发独立导航站业务。具体业务范围由本项目产品需求基线和后续全栈计划确认。

## 技术栈

- **后端**：FastAPI + SQLAlchemy 2.0 async + PostgreSQL + Redis
- **管理端**：Ant Design Pro v6（Umi Max + React 19 + TypeScript + Ant Design 6 + ProComponents 3 + TanStack Query）
- **用户端**：Next.js App Router + React 19 + Tailwind CSS + TanStack Query + Zustand + Lucide
- **共享包**：OpenAPI 自动生成 TypeScript 类型安全请求客户端（`api-client`）、共享 ESLint 配置（`eslint-config`）、共享 TypeScript 配置（`typescript-config`）
- **部署**：Docker + 1Panel OpenResty + GitHub Actions CI/CD

## 快速开始

阅读 [本地开发环境手册](docs/operations/local-dev-environment.md)了解完整环境搭建方式；环境变量分层、VS Code 工作区和 Backend 启动顺序见[环境变量分层与 Backend 本地运行手册](docs/operations/environment-variables-and-backend-local-run.md)。

本项目的继承基线、当前需求边界、非目标和验收标准见 [产品需求基线](docs/PROJECT_REQUIREMENTS.md)。

## 项目结构

```text
apps/
  backend/              FastAPI 标准后端（领域驱动架构）
  web/                  C 端用户前端（Next.js）
  admin/                B 端管理前端（Ant Design Pro v6 / Umi Max）

packages/
  api-client/           自动生成的 TypeScript SDK（禁止手改）
  eslint-config/        共享 ESLint 配置
  typescript-config/    共享 TypeScript 配置

.agents/                Antigravity 规则桥接
docs/                   项目知识库（索引见 docs/README.md）
plans/                  全栈实施计划、计划规则和永久登记

PROJECT_INDEX.md        项目身份、当前阶段、活动计划和权威入口
openapi.json            后端导出的 OpenAPI 规范（根目录，前端 SDK 唯一来源）
compose.yml             本地开发用（仅 Redis 容器）
compose.prod.yml        生产部署用（三端应用、可选日志消费者和 1Panel 共享基础设施网络）
CHANGELOG.md            已交付能力和版本变化
SECURITY.md             漏洞报告和安全响应规则
```

## 项目索引

- 项目身份、当前阶段、活动计划和权威入口见 [PROJECT_INDEX.md](PROJECT_INDEX.md)。
- 全部实施计划的永久登记见 [plans/INDEX.md](plans/INDEX.md)。
- Nav 项目做什么、继承什么和如何验收见 [docs/PROJECT_REQUIREMENTS.md](docs/PROJECT_REQUIREMENTS.md)。
- `docs/` 下的完整文档清单见 [docs/README.md](docs/README.md)。
- 全栈计划格式和生命周期规则见 [plans/README.md](plans/README.md)。
- 已交付变化见 [CHANGELOG.md](CHANGELOG.md)。

## 开发规范

- 所有任务先读取 `PROJECT_INDEX.md`，确认项目身份、当前阶段、活动计划和权威入口，再以实际文件确认详细实现状态
- 新增功能或模块前，在 `plans/` 创建面向整个 Monorepo 的全栈实施计划，并同步登记到 `plans/INDEX.md`
- 同一能力涉及 Backend、Admin 和 Web 时，在同一份计划中描述完整链路和联合验证
- 本项目一次性派生计划清理已经结束；此后新增计划永久保留，AI 不得删除、移动或重命名计划
- 新建、移动或修改专题项目文档后，同步更新 `docs/README.md` 中对应的登记；计划与根索引按各自规则单独同步
- 新建或修改 Markdown 后，运行 `pnpm lint:md` 检查全仓库文档格式
- 后端接口变更后，运行 `pnpm generate-api` 更新前端 SDK
- 提交前运行 `pnpm check:governance`，验证文本、文档索引、计划登记、三态完整性、模块边界和门禁正反例

## 工程治理基线

- 应用状态分为 `empty`、`partial` 和 `ready`。`partial` 必须失败，`empty` 只表示治理检查通过。
- Backend 领域和 Frontend Feature 只通过公开入口协作，禁止跨模块导入内部实现。
- 错误处理采用 Fail Closed，禁止吞错、假成功、弱默认值和静默降级。
- 临时兼容只允许用于有负责人、删除日期、观测和删除测试的受控迁移窗口。
- CI、镜像发布和生产部署相互分离。生产只接受完整镜像 digest，不使用可变标签。

架构边界见 [模块与依赖边界](docs/architecture/module-boundaries.md)，发布和回滚步骤见 [发布与回滚手册](docs/operations/release-and-rollback.md)。

## 继承基线与业务边界

本仓库继承母版通用能力，导航站业务在当前仓库中通过已确认计划扩展：

| 应用 | 继承的通用能力 | Nav 后续扩展 |
| --- | --- | --- |
| `backend/domains/` | auth、users、admin、assets、settings、system | 导航站领域模型与接口，具体范围待计划确认 |
| `web/features/` | auth、account、site、system、user | 导航站用户页面与交互，具体范围待计划确认 |
| `admin/features/` | auth、users、admins、roles、assets、security、settings、system、account、welcome | 导航站运营与管理能力，具体范围待计划确认 |

`docs/blueprints/` 是继承的参考资料，不构成本项目已确认需求。

母版发布 Tag、对应完整 Commit SHA、实际派生源码快照、当前阶段和业务范围记录在 `PROJECT_INDEX.md`。母版继承计划已由用户在派生初始化阶段人工清理，`plans/INDEX.md` 已按当前文件重建；后续新增计划恢复永久保护，完整边界见 `plans/README.md` 和 ADR 0015。
