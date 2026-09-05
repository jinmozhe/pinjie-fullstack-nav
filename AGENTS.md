# pinjie-fullstack-base 项目规则

## 作用范围

- 本文件适用于整个仓库。
- 所有任务开始前必须读取 `PROJECT_INDEX.md`，再按索引和任务范围读取相关规则、计划和文档。
- 修改 `apps/backend/**`、`apps/admin/**`、`apps/web/**` 前，必须同时遵守对应目录的 `AGENTS.md`；已处于活动指令中时不重复读取。
- 冲突优先级依次为：平台安全规则和用户当前明确要求、距离目标文件最近的 `AGENTS.md`、本文件、个人全局规则。

## 任务读取与计划路由

- 实现类任务必须继续读取 `plans/README.md`。存在与任务匹配的活动计划时，必须读取并维护同一份计划。
- 任务触发计划创建条件但尚无计划时，先创建计划、登记 `plans/INDEX.md`、把活动计划同步到 `PROJECT_INDEX.md` 并取得用户确认，再开始实施。
- `plans/` 面向整个全栈 Monorepo。跨 Backend、Admin、Web 或共享契约的能力使用同一份全栈计划，不按应用拆成互不关联的计划目录。
- 只读检查、解释和验证无需新增计划，但仍需通过 `PROJECT_INDEX.md` 确认项目身份、当前阶段、活动计划和权威入口，再以实际文件确认详细实现状态。
- 文档、规则、目录职责和权威来源发生变化时，按职责同步对应索引；项目身份、当前阶段和活动计划进入 `PROJECT_INDEX.md`，全部计划的状态与结果进入 `plans/INDEX.md`。

## 项目定位

- 本仓库是通用全栈 Monorepo 母版，技术栈为 FastAPI、Next.js、React、pnpm 和 Turborepo，可派生为 CMS、管理平台、电商等业务仓库。
- 母版只保留跨业务可复用能力。具体业务领域进入 `docs/blueprints/` 或派生仓库，禁止把单一项目的业务假设写成母版硬约束。
- `apps/backend`、`apps/admin`、`apps/web` 是独立应用，禁止相互直接引用。共享代码和配置只能通过 `packages/` 中的明确公共包提供。
- Backend 采用模块化单体，领域与前端 Feature 只能通过公开入口协作。完整边界以 `docs/architecture/module-boundaries.md` 为准，可机械判断的违规必须由仓库门禁拒绝。

## 产品需求基线

- `docs/PROJECT_REQUIREMENTS.md` 是母版目标用户、适用场景、目标能力、非目标、派生规则和验收边界的权威来源。
- 新增、修改或取消产品能力前必须读取产品需求基线，并在全栈计划中列出关联的 `BASE-*` 需求编号。
- 项目身份、当前阶段、活动计划和权威入口以 `PROJECT_INDEX.md` 为准；详细实现状态以实际源码、配置、迁移、生成契约和对应架构文档为准；已交付变化以 `CHANGELOG.md` 为准。禁止把 PRD 中的目标能力或根索引中的阶段摘要表述为已经完成的实现证据。
- 技术选型和架构理由进入 ADR 或架构文档，不在 PRD 中重复维护长篇实现论证。
- 产品范围或验收边界变化时，必须在同一任务中同步产品需求基线、相关文档和计划记录；只有项目身份、当前阶段、活动计划或权威入口变化时才同步 `PROJECT_INDEX.md`。

## 沟通与判断

- 默认使用中文回复并称呼用户为"大仙"，表达直接，先给结论和可执行方案。
- 分析优先从目标、约束和事实出发。低置信度结论必须明确标注。
- 遇到时效性信息、陌生概念或可能变化的工具行为时，先查官方文档；无法确认时说明依据和不确定性。
- 开始修改前先读取相关实现、配置和文档。用户只要求讨论、诊断或评审时，不修改文件。

## 讨论结论与知识沉淀

- 会影响后续开发并且已经由用户确认或有可核验证据支持的结论，不得只保留在对话中；应在当前任务结束前更新到对应权威文档。
- 用户只要求讨论、诊断或评审时，先说明结论应写入的位置，取得明确修改授权后再更新文件，不得以知识沉淀为由扩大操作范围。
- 产品目标、用户、能力和验收边界进入 `docs/PROJECT_REQUIREMENTS.md`；重大技术取舍及备选方案进入 `docs/adr/`；当前架构和系统机制进入 `docs/architecture/`；可执行开发、部署和运维步骤进入 `docs/operations/`；派生业务设计进入 `docs/blueprints/`。
- 单次任务的范围、确认、实施和验证进入原 `plans/*.md`；全部计划的永久登记进入 `plans/INDEX.md`；长期强制约束进入对应 `AGENTS.md`；项目身份、当前阶段和活动计划进入 `PROJECT_INDEX.md`；已交付事实进入 `CHANGELOG.md`。
- 同一主题已有权威文档时优先就地更新，其他文件只保留必要入口或链接，禁止复制完整事实形成多份来源。
- 未决事项只保留在相关活动计划中并标明状态。临时推测、普通问答、完整聊天记录和没有长期参考价值的已否决方案不进入项目文档。
- 只有独立调研周期较长、证据需要被多个计划复用且尚未达到正式决策条件时，才评估创建 `docs/research/`；不得提前创建空目录或占位文档。

## 工程治理基线

- 错误和依赖失败必须明确传播，禁止吞错、假成功、弱默认值和静默降级。允许的超时、有限重试、熔断、背压和只读状态必须具有契约、观测、恢复条件和测试，完整模型见 `docs/architecture/error-model.md`。
- 禁止永久兼容、隐式兼容、自动猜测版本和无期限双轨。滚动升级需要临时兼容时，必须遵守 `docs/adr/0007-受控迁移兼容策略决策.md`，登记负责人、删除日期、观测和删除测试。
- 认证、授权和审计按 `docs/architecture/authentication-authorization.md` 分层。客户端隐藏不能代替服务端授权，浏览器 Token 不得进入 `localStorage`、Zustand 或其他客户端可读持久化存储。
- 后续源码实现必须按 `docs/architecture/testing-strategy.md` 建立与风险匹配的测试。Mock、SQLite、假数据、浏览器冒烟和跳过步骤不得替代明确要求的真实验证。
- 仓库门禁采用 Fail Closed。应用只允许明确的 `empty` 或完整 `ready` 状态；`partial`、关键检查跳过、生成漂移和占位步骤必须失败。`empty` 只能表述为治理检查通过，不能表述为应用质量检查通过。
- 安全开发以 `SECURITY.md`、`.github/CODEOWNERS` 和 Pull Request 模板为治理入口。生产工作流、权限模型、公开契约、数据库删除和安全配置属于高风险变更，必须具备专项计划、评审、验证和回滚边界。

## 项目文档来源

- `docs/` 是本仓库 PRD、ADR、架构、蓝图和运维等专题项目文档的唯一存储和发布来源，完整清单由 `docs/README.md` 维护。根 `AGENTS.md`、`PROJECT_INDEX.md`、`plans/`、`README.md`、`SECURITY.md` 和 `CHANGELOG.md` 按各自治理职责保留在稳定路径，不属于 `docs/` 的文档副本。
- GitHub Wiki 必须保持关闭。AI 不得初始化、重新启用、维护或同步本仓库 Wiki，也不得创建 Wiki 文档副本或自动同步工作流。
- 即使历史 Wiki Git 远程仍可访问，`git-sync` 及其他交付流程也必须跳过 Wiki 检查和同步。
- 只有用户未来明确改变本项决策时，才能重新评估 Wiki；普通提交、推送或文档同步授权不包含启用 Wiki。

## Markdown 格式

- 仓库 Markdown 语法以 GitHub Flavored Markdown 为基线，格式检查以根目录 `.markdownlint.json` 为准。
- AI 新建或修改 Markdown 后必须运行根目录 `pnpm lint:md`，处理本次变更引入的全部告警，不得通过行内禁用注释绕过规则。
- 标题使用 ATX `#` 语法；无序列表使用 `-`；有序列表按 `1. 2. 3.` 连续编号；嵌套列表使用 2 个空格缩进。
- 分隔线使用 `---`；代码块使用三个反引号围栏并填写准确语言标识；强调和加粗分别使用 `*文本*` 与 `**文本**`。
- 表格保留首尾管道并使用 `compact` 风格，不为中文视觉宽度补齐纵向空格。
- 链接和图片统一使用行内语法 `[文本](https://example.com)` 与 `![替代文本](https://example.com/image.png)`；禁止引用式、折叠式、快捷式、尖括号自动链接及以 URL 自身作为链接文本的写法。
- 中文段落不强制按固定字符数硬换行，不同章节允许出现同名子标题；其他 markdownlint 默认规则继续生效。
- 项目级 `markdownlint-cli2` 必须在根 `package.json` 中固定具体版本并通过根 `pnpm-lock.yaml` 锁定；版本升级需同步验证 VS Code 插件使用的 markdownlint 规则兼容性。
- Markdown 已纳入仓库治理 CI。修改 Markdown 后仍必须在本地运行 `pnpm lint:md`，CI 不能替代本地复读和文本卫生检查。

## 修改原则

- 保留用户已有修改，禁止回退、覆盖或顺手整理任务范围外的内容。
- 修改或新增源码、配置、依赖、数据库迁移、部署流程前，先明确影响范围和验证方式。较大改动应先形成实施计划。
- 保留既有功能、配置选项、业务逻辑和 UI 细节。未经明确授权，不得精简、替换或弱化。
- 优先沿用仓库现有技术栈、目录边界和工具，不为轻微重复提前增加抽象。
- 规则文档只描述当前项目可执行规则和操作步骤，不记录临时过程。

## 计划文档保护

- `plans/` 中已经存在的计划文档属于永久项目资产，AI 永远不得删除、移动、重命名或替换。
- 计划变化时，只允许更新原文件的内容和状态。已完成、已取消和已替代的计划继续保留原文。
- `plans/` 中每份 `YYYY-MM-DD_*计划.md` 必须在 `plans/INDEX.md` 中保留唯一登记，计划结束后不得删除登记。`plans/README.md` 和 `plans/INDEX.md` 是计划治理文件，不属于实施计划。
- 删除、移动和重命名计划文档只能由用户人工处理。AI 只能提供整理建议，不得执行相关文件操作。
- 用户人工调整计划文件后，AI 才能按照当前文件事实同步索引路径和状态。

### 派生项目初始化例外

- 当前母版不适用例外并永久保留全部计划。独立业务仓库仅在派生初始化阶段允许用户人工一次性删除母版继承计划；AI 不得执行删除、移动或重命名，只能在人工清理后重建索引。必须保留 `plans/README.md`、`plans/INDEX.md` 和派生项目计划。
- 派生项目必须同时记录母版不可变 Tag 和完整 40 位 Commit SHA；初始化结束后恢复全部计划的永久保护。完整步骤见 `plans/README.md` 和 ADR 0015。

## 文件与安全

- 源码、配置和文本文件统一保存为 UTF-8 无 BOM，保留末尾换行。批量替换后必须复读具体修改行，检查缩进、括号、导入和字符串转义。
- `.env.example` 只允许公开模板值。真实 `.env`、密钥、令牌、数据库密码和生产数据严禁入库或输出到日志。
- Windows 本地命令默认使用 PowerShell。路径含空格时使用可靠的引号和 `-LiteralPath`。
- 仓库外的参考项目默认只读。禁止建立指向本机绝对路径的运行时依赖，也不得从参考项目复制 `.git`、`.env`、数据库、缓存或构建产物。
- 删除数据、覆盖文件、数据库迁移、Git 历史变更和生产操作必须先核对目标及回滚方式。

## 本地检查点与高风险编辑

- 完成一个可独立验证的功能单元并通过受影响范围的轻量门禁后，AI 必须主动询问是否创建本地检查点提交。用户已经明确授权当前任务分阶段本地提交时，应在该功能单元验证完成后立即精确暂存当前任务文件并提交；实现授权本身不包含 Git 提交授权。
- 本地检查点只允许包含当前任务中已经复读和验证的文件，禁止混入用户修改或其他任务内容。提交、推送、Pull Request、发布和部署继续分别授权，本地检查点提交不授权任何远端动作。
- 目标文件含有未提交修改且尚无可恢复基线时，禁止通过脚本批量覆盖、整文件重写或跨文件机械写入。应改用逐文件 `apply_patch`；确需批量写入时，必须先取得本地检查点提交授权并建立恢复基线。
- 批量机械写入必须启用严格错误处理，先在内存或临时文件中计算全部结果，校验预期非空、长度和关键内容后再替换目标。PowerShell 必须使用 `Set-StrictMode -Version Latest` 和 `$ErrorActionPreference = "Stop"`，禁止在发生非终止错误后继续调用写入方法。
- 每个目标文件写入后必须立即复读，检查编码、末尾换行、长度、关键签名和具体修改行；任一文件校验失败时立即停止后续写入，优先从最近检查点恢复并报告影响范围。检查点提交不能替代安全写入、差异复核和验证门禁。

## 生成文件与契约

- 根目录 `openapi.json` 是后端导出的唯一 OpenAPI 契约，禁止手工修改。
- `packages/api-client/src/` 由根契约生成，禁止手工修改。契约变化后按"后端实现、导出 `openapi.json`、运行 `pnpm generate-api`、前端适配"的顺序同步。
- Backend 进入 `ready` 后，CI 必须重新导出 OpenAPI、重新生成客户端并检查无 Git 差异。Breaking Change 必须在同一全栈计划中完成消费者迁移或建立受控迁移窗口。
- 全仓库只维护根目录 `pnpm-lock.yaml`。Python 锁文件归 `apps/backend/uv.lock`，两套依赖不得混用。
- 依赖安装脚本采用显式白名单。新增需要构建脚本的依赖前必须评审来源与必要性，并更新根 `pnpm-workspace.yaml` 的 `allowBuilds`；禁止无范围放行全部安装脚本。

## Git 提交与追溯

- Git 历史是普通提交 Commit SHA、父提交、文件快照和逐行差异的权威来源；使用 `git log`、`git show`、`git diff` 和 `git blame` 查询。
- 普通提交的 Commit SHA 不重复写入 `CHANGELOG.md`、`plans/*.md`、`plans/INDEX.md` 或 `PROJECT_INDEX.md`。这些文档分别记录已交付变化、实施背景与验证、计划永久登记、项目身份与阶段导航。
- 用户显式调用 `$git-sync` 时，该次调用授权完成当前任务的完整 Git 交付闭环：创建或使用功能分支、精确暂存、提交、推送、创建或更新目标为 `main` 的 Pull Request、设置 rebase 自动合并、等待必需检查、合并后删除功能分支并同步本地 `main`。检查失败、缺失或无法合并时必须停止，保留 PR 和分支并报告原因，禁止绕过 Ruleset。
- 普通“提交”“推送”“创建 PR”或“合并”请求只授权文字明确包含的动作，不自动扩展为 `$git-sync` 完整闭环。`$git-sync` 不授权 Tag、Release、GHCR、`workflow_dispatch`、部署、回滚、生产变更或 Ruleset 修改，这些动作继续分别取得用户明确授权。
- `git-sync` 完成后只在交付回复中报告提交 SHA、PR、合并、分支清理和同步结果，不得为了回写刚产生的 SHA 再创建后续提交。
- 正式发布、生产部署、派生项目基线、安全审计、故障回滚和阶段性交接属于跨系统追溯场景，必须在对应记录中保存完整 40 位 Commit SHA 或受保护的不可变 Git Tag；部署、审计和回滚记录优先使用完整 SHA。
- 创建或推送 Tag、发布 Release、部署和回滚仍需分别取得用户明确授权。
- 镜像发布和生产部署遵守 `docs/adr/0008-不可变发布与生产追溯决策.md`。生产只允许固定镜像 digest，禁止 `latest`、分支标签和缺失版本回退；CI、镜像发布、部署和回滚必须保持职责与授权分离。

## 本地环境

- Windows 本地开发采用纯 uv、pnpm、本机 PostgreSQL 和 Docker Desktop Redis，具体步骤以 `docs/operations/local-dev-environment.md` 为准。
- Windows 原生 Codex 使用 `elevated + Custom (config.toml)`、`workspace-write` 和默认联网；网络开启不扩大文件权限，也不授权提交、推送、发布、部署或其他外部副作用。完整边界以 `docs/operations/codex-windows-config-acl-governance.md` 为准。
- 沙箱内 Windows `curl.exe` 或 PowerShell HTTPS 返回 `SEC_E_NO_CREDENTIALS` 时，必须先与 Node/Python HTTPS 对照分类。确认属于 Schannel 兼容边界后，只能按任务需要升级准确宿主命令；禁止直接修改沙箱账户、Profile、注册表 Hive、证书、凭据或 TLS 校验。
- 当前 Windows 原生 Codex 环境中，沙箱身份无法读取宿主用户通过 Windows Keyring 保存的有效 GitHub CLI 凭据。所有依赖当前 `gh` 登录态或 Windows Keyring 的命令，包括 `gh auth status`、认证型 `gh api`、私有仓库和 GitHub Actions 查询，禁止先在沙箱内验证，必须通过 Codex 审批机制直接以宿主用户 PowerShell 身份执行准确的单条命令。
- `gh` 宿主升级只解决凭据读取边界，不构成远端副作用授权。`gh auth login/logout`、提交、推送、工作流触发、发布、部署、删除和权限修改仍需分别取得用户明确授权；禁止把全部 `gh` 或宽泛 `gh api` 配置为长期自动放行。
- 禁止通过 `GH_TOKEN`、仓库文件、`config.toml`、命令参数或日志明文保存 GitHub Token 来绕过 Windows Keyring 隔离。
- 后端统一在 `apps/backend` 中使用 `uv sync`、`uv add` 和 `uv run`。项目流程不要求 `conda activate`。
- 前端依赖统一从仓库根目录用 pnpm workspace 管理，不在子应用中生成独立锁文件。
- 本地数据与生产数据隔离，数据库结构只通过 Alembic 迁移同步。

## 验证与交付

- 按实际影响范围运行最小充分验证。跨应用契约变化必须同时验证后端契约、生成客户端和受影响前端。
- 日常开发、普通提交、`$git-sync`、Push 和 Pull Request 只自动执行轻量门禁：Admin 与 Web 各自运行 typecheck 和 lint，Backend 运行 Ruff、格式、Mypy、导入边界、编译、应用导入和契约检查。公开 API 变化继续导出 OpenAPI、生成 API Client 并检查漂移。
- 未经用户在当前任务中明确点名，禁止在本地或 GitHub Actions 自动执行 Admin/Web production build、任何 Vitest、任何 pytest、Playwright、浏览器自动化、测试数据库迁移或其他全量测试。普通“提交”“推送”和 `$git-sync` 均不包含这些重型验证的隐式授权，也不得通过定时任务或其他 Workflow 间接触发。
- 用户明确授权重型验证时，只执行被点名的应用、命令和范围；授权不延续到后续任务。用户自行进行本地人工验收不受此限制，未提供可核验证据时只记录为“用户自行验收，自动验证未执行”。
- 按策略未执行的重型验证记录为“未执行”，不再记录为“待 `$git-sync` 执行”，也不得表述为测试通过、完整跨栈验收完成或生产可用。
- 只运行仓库已配置的命令。尚未配置的检查项应明确写为缺口，禁止伪装成通过。
- 治理和架构变更必须运行 `pnpm check:workspace` 与 `pnpm check:boundaries`。安全、依赖、文本、工作区、模块边界、OpenAPI Breaking Change 和生成契约漂移继续按实际影响执行，但不得隐式启动上述重型验证。
- 交付前复读修改文件，检查 `git diff` 或等价差异，并清理本次验证产生的缓存和临时产物。
- 最终回复说明修改内容、验证结果、未执行项和剩余风险。
- 提交、推送、发布 GHCR、部署和生产变更是独立动作，分别需要用户明确授权；禁止因完成本地修改而自动执行。

## Admin 本地运行与验证补充

- Admin 日常启动使用 `pnpm --filter @pinjie/admin dev`；直接调用 Umi 时工作目录必须是 `apps/admin`，端口通过项目包装器设置的 `PORT=3001` 管理，不使用 `max dev --port` 作为端口契约。
- Umi 修改路由、插件或配置后，遇到生成缓存导致的异常时必须清理 `apps/admin/src/.umi` 和 `apps/admin/src/.umi-production`，并确认这些目录未被提交。
- Admin 默认只自动运行 typecheck 与 lint。Vitest、production build、浏览器冒烟和真实跨栈 E2E 仅在用户明确授权后执行并分项记录；Docker Desktop、Backend、PostgreSQL 或 Redis 未就绪时，不得把局部冒烟或 MSW 测试表述为完整跨栈通过。
- Windows 验证结束后只清理本次启动且已核对 PID、命令行和端口归属的服务、进程与浏览器标签，禁止误杀 Codex 或浏览器运行时。
