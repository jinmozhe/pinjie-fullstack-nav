# pinjie-fullstack-nav 项目索引

本文件是项目身份、当前阶段、活动计划和权威入口。全部实施计划的永久登记见 [plans/INDEX.md](plans/INDEX.md)。

## 项目身份

| 字段 | 当前值 |
| --- | --- |
| 项目角色 | 独立导航站全栈项目 |
| 派生类型 | Nav |
| 母版发布基线 | `pinjie-fullstack-base` `v1.0.0`，Commit `7f5f4ad28b73ffabe3c0fa9cc99b39875482ba18` |
| 派生源码快照 | `00b409ae866b260854b75bef74c16cd4b9692c79`，即 `v1.0.0-1-g00b409a` |
| 最近母版吸收 | 选择性迁移至 `90644f57177df7e404900516dedcb4a107e3bbdc` 的适用累计变化，轻量验证通过；排除项及逐项追溯见[同步记录](plans/2026-09-06_母版90644f5累计更新计划.md)，不代表完整同步 |
| 当前阶段 | 导航管理、管理员 Web 只读查阅、分类登录可见控制、内置图标及站点回收站永久删除已完成本地源码与轻量验证；首版已由用户初始化，新增分类迁移、永久删除权限同步及完整业务验收未执行 |
| 业务范围 | 导航站业务；具体目标用户、功能范围、运营流程和验收标准以当前项目 PRD 及后续计划为准 |

## 权威入口

| 事项 | 唯一来源 | 用途 |
| --- | --- | --- |
| 全仓库长期规则 | [AGENTS.md](AGENTS.md) 与三个应用级 `AGENTS.md` | 任务读取、工程边界、验证和交付规则 |
| 项目身份与阶段导航 | [PROJECT_INDEX.md](PROJECT_INDEX.md) | 项目身份、当前阶段、活动计划和权威入口 |
| 详细实现状态 | 实际源码、配置、迁移、生成契约与对应架构文档 | 判断具体能力、接口和运行机制是否已经实现 |
| 产品需求基线 | [docs/PROJECT_REQUIREMENTS.md](docs/PROJECT_REQUIREMENTS.md) | Nav 项目身份、继承基线、当前需求边界和后续需求追踪规则 |
| 计划规则 | [plans/README.md](plans/README.md) | 计划创建、格式、状态、完成和保护规则 |
| 计划永久登记 | [plans/INDEX.md](plans/INDEX.md) | 全部实施计划的路径、状态、结果、范围和用途 |
| 项目文档清单 | [docs/README.md](docs/README.md) | `docs/` 下全部项目文档导航 |
| 架构决策 | [docs/adr/](docs/adr/) | 长期技术取舍及其理由 |
| 架构机制 | [docs/architecture/](docs/architecture/) | 当前系统边界、认证、错误、测试和可靠性机制 |
| 开发与运维步骤 | [docs/operations/](docs/operations/) | 本地开发、发布、部署、恢复和故障处理 |
| 已交付变化 | [CHANGELOG.md](CHANGELOG.md) | 已交付能力和版本变化 |
| 安全治理 | [SECURITY.md](SECURITY.md) | 漏洞报告、安全响应和安全开发要求 |
| OpenAPI 契约 | [openapi.json](openapi.json) | 后端导出的唯一机器契约，禁止手工修改 |

## 活动计划

当前无活动计划，已结束计划见 [plans/INDEX.md](plans/INDEX.md)。
