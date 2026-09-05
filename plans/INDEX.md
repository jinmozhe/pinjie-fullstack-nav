# 全栈实施计划索引

本文件是所有实施计划的唯一永久登记入口。计划规则和生命周期见 [README.md](README.md)，当前项目阶段和活动计划见 [../PROJECT_INDEX.md](../PROJECT_INDEX.md)。

`README.md` 和 `INDEX.md` 是计划治理文件，不属于实施计划，不进入下表。`plans/` 下每份 `YYYY-MM-DD_*计划.md` 都必须唯一登记；计划结束后只更新状态和结果，不删除登记。

## 维护规则

1. 新建实施计划时，在同一次修改中加入本索引。
2. 计划状态或结果变化时，同步计划原文和本索引；只有活动计划发生变化时才同步根目录 `PROJECT_INDEX.md`。
3. 已完成、已取消和已替代计划永久保留原文件及登记记录。
4. 删除、移动和重命名计划文件只能由用户人工处理。
5. 本索引只保存路径、状态、结果、影响范围和一句话用途，不复制计划正文。
6. 待确认、待实施和实施中的计划结果填写 `不适用`；已结束计划结果必须以 `已完成`、`已取消` 或 `已替代` 开头。

## 计划永久登记

| 路径 | 状态 | 结果 | 影响范围 | 用途 |
| --- | --- | --- | --- | --- |
| `plans/2026-09-05_派生项目计划基线重建规则计划.md` | 已结束 | 已完成；母版与派生项目计划保护边界、人工初始化例外和 Tag 与完整 SHA 追溯要求已同步并通过治理门禁 | Documentation、Developer Workflow | 允许独立派生业务仓库在初始化阶段由用户人工清理母版继承计划并重建计划基线 |
| `plans/2026-09-05_GitHub到1Panel端到端人工发布手册计划.md` | 已结束 | 已完成；现有发布专题文档已同步真实流程，新增从 GitHub Actions 经 CNB、TCR 到 1Panel 的人工端到端操作手册 | Deployment、Documentation | 同步真实发布状态并建立从 GitHub Actions 经 CNB、TCR 到 1Panel 的人工端到端操作手册 |
| `plans/2026-09-04_GitHub源码交接双验证模式计划.md` | 已结束 | 已完成；双验证模式已进入 main，严格模式已完成真实 Full Validation Artifact 校验和 CNB 源码交接，快速模式未执行真实发布验证 | Deployment、Documentation | 为 GitHub 到 CNB 源码交接增加默认严格、可显式快速的 Full Validation 双模式和审计记录 |
| `plans/2026-09-04_CNB三端独立镜像构建与发布证据改造计划.md` | 已结束 | 已完成；三端独立 CNB Pipeline 已完成真实 TCR 发布并通过 1Panel 固定 digest 更新和三端健康复验 | Deployment、Documentation | 将 CNB 三镜像统一发布拆为按真实构建输入触发的三端独立构建、单镜像证据和 TCR 不可变发布 |
| `plans/2026-09-03_1Panel生产编排镜像变量兼容修复计划.md` | 已结束 | 已完成；Compose 镜像变量兼容修复、生产门禁、负向夹具和运维说明均通过轻量验证，修复后的编排已同步到线上并通过 1Panel 更新及三端健康复验 | Deployment、Documentation | 修复 1Panel 预拉取无法解析 Compose 镜像必填变量表达式的问题，并保持不可变 digest 门禁 |
| `plans/2026-09-02_Admin镜像漏洞门禁与CNB失败证据修复计划.md` | 已结束 | 已完成；Admin 镜像漏洞阻断、CNB 失败证据、三镜像扫描、SBOM、provenance、TCR 不可变标签和发布附件均通过真实验证，生产部署未触发 | Admin、Deployment、Documentation | 修复 Admin 运行镜像漏洞阻断，并为 CNB 扫描失败增加精简日志和可下载原始证据 |
| `plans/2026-09-02_共享PostgreSQL与Redis生产编排改造计划.md` | 已结束 | 已完成；生产应用编排已切换为 1Panel 共享 PostgreSQL 与 Redis，外部网络、服务隔离、配置门禁、部署保护和运维边界已同步，生产迁移未执行 | Backend、Database、Deployment、Documentation | 将生产应用编排切换为 1Panel 共享 PostgreSQL 与 Redis，并建立网络、隔离、门禁、迁移和回滚边界 |
| `plans/2026-09-01_CAM子账号与TCR个人版最小权限操作手册计划.md` | 已结束 | 已完成；独立 CAM 与 TCR 个人版操作手册、完整控制台与密码管理权限、三仓只读 JSON、账号创建、服务器登录、权限验收、轮换和排障步骤已交付 | Deployment、Documentation | 建立 TCR 个人版发布与生产拉取账号职责分离、三仓最小权限和完整 CAM 操作手册 |
| `plans/2026-08-31_TCR个人版双仓镜像发布与腾讯云内网部署计划.md` | 已结束 | 已完成；GitHub 固定 SHA 验证与交接、CNB 三镜像构建扫描、TCR 不可变发布、结构化证据和跨 Commit Registry 缓存复用均通过真实验证，生产部署未触发 | Deployment、Documentation | 建立 GitHub 验证、CNB 构建和 TCR 单仓发布链路，并验证固定构建时间戳后的跨 Commit Registry 缓存 |
| `plans/2026-08-30_Backend基础镜像漏洞阻断修复与v0.1.1发布计划.md` | 已结束 | 已完成；三端候选镜像 Trivy 阻断已修复，完整验证、三镜像 GHCR 不可变发布、v0.1.1 Tag 和 Release 均成功，生产部署未触发 | Backend、Admin、Web、Deployment、Documentation | 修复三端生产运行镜像漏洞阻断并完成 v0.1.1 不可变发布与三镜像 GHCR 发布 |
| `plans/2026-08-30_依赖复现与发布验证闭环整改计划.md` | 已结束 | 已完成；uv 工具链、完整验证 Artifact、镜像发布同 SHA 门禁和 Origin 修复已落地，同 SHA 轻量 Push 工作流、完整远端验证与 Artifact 核验全部通过 | Backend、Admin、Web、Deployment、Documentation | 固定 uv 依赖复现工具链并建立同 Commit SHA 的完整验证证据与镜像发布门禁 |
| `plans/2026-08-29_全栈失败门禁修复计划.md` | 已结束 | 已完成；Admin、Backend、Web、API Client、数据库迁移和四项目 Playwright 失败均已修复，授权的重型验证与治理门禁全部通过 | Backend、Admin、Web、API Client、Database、Documentation | 修复全栈重型验证和数据库一致性失败，恢复质量门禁后继续 Git 交付闭环 |
| `plans/2026-08-29_会话设备名称识别计划.md` | 已结束 | 已完成；Web 与 Admin 新会话已统一生成浏览器与操作系统展示名称，旧会话显式回填工具、测试源码、依赖锁定和项目文档已同步，全部轻量门禁通过 | Backend、Documentation | 从已清理 User-Agent 生成会话浏览器与操作系统展示名称，并提供旧会话显式回填边界 |
| `plans/2026-08-29_文档权威边界与索引一致性门禁整改计划.md` | 已结束 | 已完成；权威来源、索引术语、专题文档载体和计划结果已收敛，自动一致性门禁与 9 类负向夹具通过 | Documentation、Developer Workflow | 收敛权威来源、索引术语和文档载体边界，并建立自动一致性门禁 |
| `plans/2026-08-29_全项目索引与计划登记职责拆分计划.md` | 已结束 | 已完成；根索引已精简，全部计划永久登记已迁移并通过治理验证 | Documentation、Developer Workflow | 精简根项目索引并建立独立计划永久登记入口 |
| `plans/2026-08-29_全项目索引根目录迁移计划.md` | 已结束 | 已完成；唯一索引已迁移到根目录，84 个关联文档引用已同步，治理门禁和链接检查通过 | Documentation、Developer Workflow | 将唯一全项目索引迁移到根目录并全量更新项目文档引用 |
| `plans/2026-08-28_系统设置与站点配置媒体计划.md` | 已结束 | 已完成；单表分组 JSONB、固定强类型接口、注册 Fail Closed、配置媒体补偿、Admin 双 Tab 和 Web 品牌消费已落地，轻量门禁通过，重型验证与真实迁移按授权边界未执行 | Backend、Admin、Web、API Client、Database、Deployment、Documentation | 建立站点资料、公开注册开关和独立站点 LOGO 配置媒体的完整跨栈实施边界 |
| `plans/2026-08-28_Admin表格异常纵向滚动条修复计划.md` | 已结束 | 已完成；重复滚动层已移除，Admin typecheck、lint 与 Markdown lint 通过，重型验证按项目策略未执行 | Admin、Documentation | 修复普通表格右侧异常滚动条并保留真实宽表受控滚动 |
| `plans/2026-08-28_Admin忘记密码悬浮提示替代弹窗计划.md` | 已结束 | 已完成；浅灰色 Tooltip 已替换点击弹窗，Admin typecheck、lint 与 Markdown lint 通过，浏览器验证按用户要求未执行 | Admin、Documentation | 降低忘记密码入口视觉重量并取消点击弹窗 |
| `plans/2026-08-28_Admin登录表单轻量控件视觉优化计划.md` | 已结束 | 已完成；输入内容、placeholder 和按钮文字统一为 `14px / 400`，typecheck、lint 与 Markdown lint 通过，浏览器验证按用户要求未执行 | Admin、Documentation | 降低登录表单控件的边界、字重和按钮色彩重量 |
| `plans/2026-08-28_Admin登录输入框Filled半透明视觉计划.md` | 已结束 | 已完成；Filled 变体、透明默认边框和半透明状态背景已落地，Admin typecheck、lint、Markdown lint 与文本卫生检查通过，重型验证按项目策略未执行 | Admin、Documentation | 将登录输入框升级为视觉无边框的 Filled 半透明控件 |
| `plans/2026-08-28_Admin忘记密码弹窗安全图标优化计划.md` | 已结束 | 已完成；双色安全徽章和居中布局已落地，typecheck、lint 与 Markdown lint 通过，浏览器验证按用户要求未执行 | Admin、Documentation | 增强忘记密码弹窗的安全感和人性化表达 |
| `plans/2026-08-28_Admin登录页能力文案优化计划.md` | 已结束 | 已完成；20 字能力描述已替换，typecheck、lint 与 Markdown lint 通过，浏览器验证按用户要求未执行 | Admin、Documentation | 用具体项目能力替换抽象登录页描述 |
| `plans/2026-08-28_Admin登录页背景透明度与Logo比例微调计划.md` | 已结束 | 已完成；背景透明度降低约三分之一，Logo 放大至 `54px`，typecheck、lint 与 Markdown lint 通过，浏览器验证按用户要求未执行 | Admin、Documentation | 降低背景色彩重量并放大登录页品牌标志 |
| `plans/2026-08-28_Admin登录页多色背景层次优化计划.md` | 已结束 | 已完成；静态蓝青红宽幅渐变已落地，typecheck、lint 与 Markdown lint 通过，浏览器验证按用户要求未执行 | Admin、Documentation | 增强 Admin 登录页背景的静态色彩层次 |
| `plans/2026-08-28_Admin登录页品牌Logo统一计划.md` | 已结束 | 已完成；登录页使用 `36px`、`#D32029` 单色 SVG Mask，typecheck、lint 与 Markdown lint 通过，浏览器验证按用户要求未执行 | Admin、Documentation | 统一 Admin 登录页与浏览器图标的品牌标识 |
| `plans/2026-08-28_Admin登录页截图对齐与真实交互计划.md` | 已结束 | 已完成；Admin 登录页按参考页面完成无卡片居中构图、安全 Cookie 会话说明和忘记密码信息弹窗，typecheck、lint 与 Markdown lint 通过，浏览器验证按用户要求未执行 | Admin、Documentation | 参考截图重构 Admin 登录页并使会话与忘记密码提示符合项目真实能力 |
| `plans/2026-08-28_Admin-login-screenshot-alignment-plan.md` | 已结束 | 已替代；由同主题中文路径计划继续实施并完成 | Documentation | 永久保留补丁工具失败期间产生的重复计划记录 |
| `plans/2026-08-28_Admin登录页面高质感重新设计计划.md` | 已结束 | 已完成；Admin `/login` 页面重构升级为 Ant Design 6 极简微质感规范，Admin typecheck、lint 及 Markdown lint 全量通过 | Admin、Documentation | 将 Admin 登录页面重构升级为 Ant Design 6 官方标准极简微质感体系 |
| `plans/2026-08-28_超级管理员授予独立端点与权限收紧计划.md` | 已结束 | 已完成；独立身份端点、不可分配系统权限和超级管理员目标保护已落地，普通管理员的资料、状态、角色、密码及会话操作全部受限，轻量门禁通过，本地权限目录零漂移；重型验证按授权边界未执行 | Backend、Admin、API Client、Documentation | 建立仅超级管理员可执行的独立身份授予端点并封闭普通角色提权路径 |
| `plans/2026-08-28_Admin三类列表状态列直接切换计划.md` | 已结束 | 已完成；三类状态列直切、权限与生命周期只读保护、行级加载和轻量门禁通过；重型验证按授权边界未执行 | Admin、Documentation | 为管理员、用户和角色列表增加状态列直接切换能力 |
| `plans/2026-08-28_Admin角色权限Tree直接展示与批量选择计划.md` | 已结束 | 已完成；Admin typecheck、lint 与 Markdown lint 通过，重型验证按授权边界未执行 | Admin、Documentation | 将角色权限配置改为直接展示的 Tree，并增加搜索、全选、反选和展开控制 |
| `plans/2026-08-28_Admin角色权限TreeSelect树选择计划.md` | 已结束 | 已完成；Admin typecheck 与 lint 通过，重型验证按授权边界未执行 | Admin、Documentation | 将角色权限配置升级为可搜索、可分组的 Ant Design TreeSelect 树选择 |
| `plans/2026-08-28_全量测试构建与E2E回归修复计划.md` | 已结束 | 已完成；Backend 183 项 pytest、Admin 62 项 Vitest、Web 50 项 Vitest、两端 production build 和四项目 Playwright E2E 均达标 | Backend、Admin、Web、API Client、Database、Documentation | 修复全量 pytest、Vitest、生产构建和浏览器 E2E 暴露的回归并完成提交推送 |
| `plans/2026-08-27_Web用户头像上传与资料同步计划.md` | 已结束 | 已完成；用户头像资料、资产引用保护和契约已同步，Web BFF 头像 PUT 白名单及全部 13 个浏览器代理接口回归覆盖已补齐；轻量门禁通过，重型验证与真实迁移按授权边界未执行 | Backend、Web、API Client、Database、Documentation | 支持用户上传、绑定、移除和持久化头像，并保护在用资产 |
| `plans/2026-08-27_Admin创建用户与公开注册开关联动计划.md` | 已结束 | 已完成；轻量门禁通过，重型测试按规则未执行，目标环境权限同步仍需独立授权 | Backend、Admin、Web、API Client、Documentation | 支持关闭公开注册的派生项目由 Admin 创建可登录用户 |
| `plans/2026-08-27_Admin系统状态页面全景监控升级计划.md` | 已结束 | 已完成；缓存、权限、健康语义、公开配置、统计口径、运行时版本和旧数据提示已修正，轻量门禁通过；重型测试和目标环境权限同步未执行 | Backend、Admin、API Client、Documentation | 建立管理端单接口全景监控、基础设施实时探针、Redis 缓存遥测与美观多卡片看板 |
| `plans/2026-08-27_Admin管理员头像统一回退样式计划.md` | 已结束 | 已完成；空头像和失效图片统一显示浅色首字符回退，Admin typecheck 与 lint 通过，重型验证按策略未执行 | Admin、Documentation | 统一管理员列表与顶部账户头像的浅色首字符回退 |
| `plans/2026-08-27_Admin文件资产上传主体标识精简计划.md` | 已结束 | 已完成；UUID 文本已隐藏，主体类型后保留复制图标，Admin typecheck 与 lint 通过，重型验证按策略未执行 | Admin、Documentation | 隐藏上传主体 UUID 文本，在主体类型后保留图标复制能力 |
| `plans/2026-08-27_Admin文件资产图片当前页预览计划.md` | 已结束 | 已完成；图片“打开”使用 Ant Design 当前页预览，非图片保留新窗口，Admin typecheck 与 lint 通过，重型验证按策略未执行 | Admin、Documentation | 图片资产点击“打开”时使用 Ant Design 当前页预览，非图片继续新窗口打开 |
| `plans/2026-08-27_Admin用户永久回收站恢复策略调整计划.md` | 已结束 | 已完成；统一 SoftDeleteMixin、移除匿名化、用户自助注销走可恢复软删除及删除原因可选方案；轻量门禁通过，重型验证和真实迁移按授权边界未执行 | Backend、Admin、Web、API Client、Database、Documentation | 实施统一 SoftDeleteMixin，移除恢复截止和匿名化，用户自助注销统一进入可恢复软删除回收站 |
| `plans/2026-08-27_本地检查点提交与高风险编辑治理计划.md` | 已结束 | 已完成；功能单元完成后请求本地检查点授权、分阶段授权后立即精确提交，高风险整文件写入具备恢复基线和严格校验，治理轻量门禁通过 | Documentation、Developer Workflow | 建立本地检查点授权、高风险文件编辑和可恢复验证规则 |
| `plans/2026-08-27_Admin用户回收站与恢复能力计划.md` | 已结束 | 已完成；回收站、恢复后保持停用、默认 30 天到期匿名化、迁移、契约、Admin 页面和文档已同步，轻量门禁通过，重型验证按策略未执行 | Database、Backend、Admin、API Client、Documentation | 为软删除用户增加可恢复生命周期和受控数据最小化机制 |
| `plans/2026-08-27_Admin列表批量操作与删除能力计划.md` | 已结束 | 已完成；批量治理已落地，旧版管理员确认端点限时兼容至 2026-09-26；轻量门禁通过，重型验证按策略未执行 | Backend、Admin、API Client、Documentation | 为现有非日志类 Admin 列表补齐批量能力，并登记管理员确认端点受控迁移窗口 |
| `plans/2026-08-26_三端本地与GitHubActions轻量验证规则计划.md` | 已结束 | 已完成；四级规则、权威文档与两条自动 CI 已同步，轻量门禁和契约幂等检查通过，重型验证按策略未执行 | Backend、Admin、Web、API Client、Deployment、Documentation | 三端本地、GitSync 与 GitHub Actions 已收敛为轻量静态检查，重型验证只在用户明确授权后执行 |
| `plans/2026-08-26_开发迭代与GitSync分层验证规则计划.md` | 已结束 | 已完成；三级项目规则、测试策略、计划与索引已同步，通用 Skill 未修改 | Documentation、Developer Workflow | 建立开发定向测试与 GitSync 全量验证的分层规则 |
| `plans/2026-08-25_Admin管理员资料编辑与安全操作整合计划.md` | 已结束 | 已完成；代码、契约和轻量门禁通过，Vitest、pytest、build 与浏览器验证按策略未执行 | Backend、Admin、API Client、Documentation | 已完成管理员资料编辑、身份切换、独立密码重置、批量状态管理和紧凑不换行操作列 |
| `plans/2026-08-25_统一文件与多媒体资产上传服务计划.md` | 已结束 | 已完成；统一资产服务、双端组件、头像持久化、契约、容器与真实跨栈验收全部通过 | Backend、Admin、Web、API Client、Database、Deployment、Documentation | 实施统一文件与多媒体资产上传服务、按日期单层分桶落盘、存储驱动解耦与前端组件封装 |
| `plans/2026-08-25_Admin官方布局宽度比例对齐计划.md` | 已结束 | 已完成；`256px` 侧栏、流式工作区、Admin 全量门禁与三视口验证通过 | Admin、Documentation | 按官方 Ant Design Pro 比例调整桌面侧栏与流式工作区宽度 |
| `plans/2026-08-25_admin-layout-width-ratio-plan.md` | 已结束 | 已替代；活动实施统一维护在中文路径计划 | Documentation | 保留补丁工具异常产生的重复计划审计记录 |
| `plans/2026-08-24_Admin左侧Logo移除与欢迎页面落地计划.md` | 已结束 | 已完成；已移除侧栏 Logo，新增官方风格 WelcomePage 及单元测试，36 项测试与门禁全量通过 | Admin、Documentation | 移除侧栏 Logo 并在菜单首位增加欢迎页面作为登录默认主页 |
| `plans/2026-08-24_Admin官方标准浅色高质感视觉体系对齐计划.md` | 已结束 | 已完成；浅色侧栏、通透 Header、ProTable 原生工具条与轻量操作列已升级，33 项测试全量通过 | Admin、Documentation | 将管理端重构为官方 Ant Design Pro v6 标准浅色高质感视觉体系，恢复 ProTable 原生工具条与 Header 操作生态 |
| `plans/2026-08-24_GitSync自动PR合并与Actions去重计划.md` | 已结束 | 已完成；远端合并设置、Skill、本地门禁和 PR #10 首轮 13 项检查均通过 | Deployment、Documentation | 自动化 Ruleset 保护下的日常 Git 交付闭环，并去除功能分支 Push 重复检查 |
| `plans/2026-08-24_VSCodeRuff工作区隔离配置计划.md` | 已结束 | 已完成；工作区设置、uv 使用边界说明与治理验证 | Backend、Documentation | 隔离 VS Code 扩展内置 Ruff 与 Backend 虚拟环境 Ruff，避免 Windows 文件占用阻断 uv 同步 |
| `plans/2026-08-24_Admin全量AntDesign6与ArtDesignPro高质感视觉升级计划.md` | 已结束 | 已完成；深色侧栏、浅色工作区、PageContainer、受控 ProTable、五视口与 axe 验收 | Admin、Documentation | 官方 Ant Design 6、ProComponents 与 Umi Max ProLayout 全页面视觉交互升级 |
| `plans/2026-08-24_Ruleset与Vite高危漏洞整改计划.md` | 已结束 | 已完成；PR #7 rebase 合并，Rule Suite 与合并后四个工作流通过，Dependabot 为 0 Open | Admin、Deployment、Documentation | 收紧 `main` Ruleset 并消除 Umi 依赖链中的 Vite 4 高危漏洞 |
| `plans/2026-08-24_ruleset-vite-security-remediation-plan.md` | 已结束 | 已替代；活动实施统一维护在中文路径计划 | Documentation | 保留补丁工具异常后产生的重复计划审计记录 |
| `plans/2026-08-24_CodexWindowsGhKeyring宿主执行治理计划.md` | 已结束 | 已完成；根规则、权威运维文档、审批示例、安全边界和索引已同步，文档与治理门禁通过 | Documentation、Windows 本地开发治理 | 统一 GitHub CLI 与 Windows Keyring 的宿主执行和审批边界 |
| `plans/2026-08-23_CodexWindows网络与Schannel边界治理计划.md` | 已结束 | 已完成；默认联网、Schannel 对照诊断、准确宿主升级兜底、禁止规避措施和升级复验删除条件已同步，全部治理门禁通过 | Documentation、Windows 本地开发治理 | 统一 Codex Windows 网络和系统 HTTPS 客户端边界 |
| `plans/2026-08-22_母版不可变基线冻结整改计划.md` | 已结束 | 已完成；P1-01 至 P1-09 与同步处理项已完成；当前工作区满足冻结候选条件，尚未提交或创建不可变 Tag | Backend、Admin、Web、API Client、Database、Deployment、Documentation | 完成母版不可变基线冻结前的安全、兼容、一致性、交付和文档整改 |
| `plans/2026-08-22_immutable-baseline-remediation-plan.md` | 已结束 | 已替代；活动实施统一维护在中文路径计划 | Backend、Admin、Web、API Client、Database、Deployment、Documentation | 保留补丁工具错误报告后产生的重复计划审计记录 |
| `plans/2026-08-22_CodexWindows配置与ACL标准文档计划.md` | 已结束 | 已完成；独立标准文档、既有入口去重、文档索引、全项目索引和 Changelog 已同步，全部文档与治理门禁通过 | Documentation、Windows 本地开发治理 | 建立 `config.toml`、`elevated + Custom`、初始化、迁移、验证、诊断、修复和回滚的完整标准 |
| `plans/2026-08-22_CodexWindowsACL长期治理计划.md` | 已结束 | 已完成；采用 `elevated + Custom`、精确 uv Cache 根和代理环境过滤，Owner、uv、Node 子进程、工作区外写入和网络正反例均通过，未执行无实际故障的 Owner 归一 | Documentation、Windows 本地开发治理 | 解决 Codex 持续维护中的 Owner 混杂、ACL 误判、缓存越界和 Git 重复审批 |
| `plans/2026-08-22_Admin框架边界与开发范式治理计划.md` | 已结束 | 已完成；Admin 宪法、工程标准、ADR、导航、索引和治理门禁均已同步通过 | Admin、Documentation | 固化 Umi/Pro 框架边界、项目安全请求管道、依赖准入和组件选择规则，修正文档与实现漂移 |
| `plans/2026-08-22_Dependabot中低危依赖治理计划.md` | 已结束 | 已完成；四项传递依赖修复、三项限时风险接受、完整回归、Dependabot 重扫和四个线上自动工作流均通过 | Admin、Web、Deployment、Documentation | 修复四项可安全升级的传递依赖，对三项暂无安全升级路径的上游风险建立限时接受和复核闭环 |
| `plans/2026-08-22_GitHubActionsNode24原生运行时升级计划.md` | 已结束 | 已完成；十个 Action 原生 Node.js 24 升级、完整 SHA Pinning、本地门禁和线上四个自动工作流均通过，annotations 为 0 | Deployment、Documentation | 将七个工作流中的十个 Action 升级到原生 Node.js 24 的固定 SHA |
| `plans/2026-08-21_验收缺口修复与远端治理计划.md` | 已结束 | 已完成；文件日志、线上 E2E、远端治理、favicon、历史记录和最终门禁均通过 | Backend、Web、Deployment、Documentation | 修复文件日志关联字段，补齐线上 Browser E2E、GitHub 远端治理、favicon 和历史记录一致性 |
| `plans/2026-08-21_母版开发总结与一致性收尾计划.md` | 已结束 | 已完成；生产边界、OpenAPI 中文字段说明、依赖图、数据库恢复、三端质量、容器、文件日志和 Browser E2E 均通过验收 | Backend、Admin、Web、API Client、Database、Deployment、Documentation | 修复生产阻断、契约说明和文档漂移，补齐迁移、恢复、边界与跨栈验收 |
| `plans/2026-08-21_BrowserE2E人工触发与发布解耦计划.md` | 已结束 | 已完成 | Deployment、Documentation | 将 Browser E2E 改为人工触发，并取消镜像发布对 E2E 成功记录的依赖 |
| `plans/2026-08-21_BrowserE2E就绪探测修复计划.md` | 已结束 | 已完成 | Admin、Deployment、Documentation | 修复 Umi 首次编译期间 2xx HTML 回退页导致 Browser E2E 过早启动的问题 |
| `plans/2026-08-20_Admin技术栈文档一致性审计计划.md` | 已结束 | 已完成；当前性文档、历史边界和项目结构索引已同步 | Admin、Deployment、Documentation | 全量核对 Admin 技术栈、入口、命令、端口和验证文档与实现一致 |
| `plans/2026-08-20_CI失败修复计划.md` | 已结束 | 已完成；本机复验；Linux CI 兼容性仍待线上复验 | Backend、Web、依赖安全、CI、Documentation | 修复线上 CI 暴露的格式、类型和依赖漏洞门禁问题 |
| `plans/2026-08-20_GitHub CI线上失败修复计划.md` | 已结束 | 已完成；本地修复与 Admin 验证完成；遗留的线上就绪失败由后续专门计划承接 | Backend、Admin、Database、CI、Documentation | 修复 Alembic 漂移、Admin 代理校验、E2E 登录方式、启动时序和 HTML 可访问性问题 |
| `plans/2026-08-20_Admin本地运行与故障排查文档治理计划.md` | 已结束 | 已完成；Admin 本地运行、测试、浏览器和跨栈验证排障手册及长期规则已同步 | Admin、Documentation、Windows 本地开发治理 | 沉淀 Admin 本地运行、测试和 Windows 系统故障的规则分层结果 |
| `plans/2026-08-12_全项目索引与计划治理计划.md` | 已结束 | 已完成 | 全栈治理、文档 | 建立总索引、计划治理和派生项目继承基线 |
| `plans/2026-08-12_产品需求基线建设计划.md` | 已结束 | 已完成 | 全栈产品基线、文档 | 建立母版目标用户、能力范围、非目标和验收基线 |
| `plans/2026-08-12_讨论结论知识沉淀规则计划.md` | 已结束 | 已完成 | 全栈治理、文档 | 建立讨论结论向现有权威文档收敛的规则 |
| `plans/2026-08-12_项目基线入库与Wiki初始化计划.md` | 已结束 | 已完成；Wiki 后续停用 | 全仓库、GitHub Wiki 历史 | 修复环境模板、提交完整项目基线并记录当时的 Wiki 初始化过程 |
| `plans/2026-08-12_GitHub Wiki停用与文档单一来源计划.md` | 已结束 | 已完成 | 全仓库文档治理、GitHub Wiki | 清空并关闭 Wiki，建立 `docs/` 单一来源规则 |
| `plans/2026-08-12_Markdown格式规范统一计划.md` | 已结束 | 已完成 | 全仓库 Markdown、文档治理 | 统一 GFM 语法基线、markdownlint 格式规则和项目级检查命令 |
| `plans/2026-08-12_Git提交追溯规则计划.md` | 已结束 | 已完成 | 全仓库 Git、文档治理 | 明确普通提交和跨系统场景的 Commit SHA 记录边界 |
| `plans/2026-08-13_工程治理与安全可靠性基线计划.md` | 已结束 | 已完成 | 全栈治理、架构规则、质量门禁、安全供应链、发布与运维边界 | 建立业务开发前的模块化、失败关闭、受控兼容、不可变发布和全链路追溯基线 |
| `plans/2026-08-13_Backend工程标准与规则分层计划.md` | 已结束 | 已完成 | Backend 规则、工程标准、文档治理 | 建立 Backend 宪法级规则入口、详细工程标准和专题文档读取路由 |
| `plans/2026-08-13_AI助手开发与文档读取指南计划.md` | 已结束 | 已完成 | 全栈 AI 开发、文档治理 | 说明规则自动发现、按需读取、常见任务和完整开发交付链路 |
| `plans/2026-08-13_阶段B应用运行与测试基础设施计划.md` | 已结束 | 已完成 | Backend、Admin、Web、API Client、Database、Deployment、Documentation | 完成三个应用运行、测试、契约和容器基础设施，不包含认证与具体业务领域 |
| `plans/2026-08-14_阶段C通用业务核心能力计划.md` | 已结束 | 已完成 | Backend、Admin、Web、API Client、Database、Deployment、Documentation | 对照两个参考项目完成认证、会话、用户、RBAC、审计、日志和真实跨栈验收 |
| `plans/2026-08-15_Dependabot自动分支停用与Git分支收敛计划.md` | 已结束 | 已完成 | 全栈治理、GitHub、Documentation | 已停用自动依赖分支、关闭相关 PR，并将本地和远程分支收敛为 `main` |
| `plans/2026-08-16_CI跨平台与CodeQL权限修复计划.md` | 已结束 | 已完成 | 全栈治理、GitHub Actions、Backend、Admin、Documentation | 修复 Governance Linux 兼容，以 Semgrep CE 替换私有仓库不可用的 CodeQL，并完成供应链门禁与线上五工作流验收 |
| `plans/2026-08-17_密码规则与API中文化计划.md` | 已结束 | 已完成 | Backend、Admin、Web、API Client、Documentation | 统一密码规则、API 顶层消息和 OpenAPI 中文描述并完成跨栈验证 |
| `plans/2026-08-17_初始管理员默认用户名计划.md` | 已结束 | 已取消 | Backend、Deployment、Documentation | 用户决定继续通过必填 `--username` 显式创建初始管理员，未实施默认用户名变更 |
| `plans/2026-08-17_Web首页登录态操作按钮计划.md` | 已结束 | 已完成 | Web、Documentation | Web 首页根据服务端真实登录态隐藏登录和创建账户按钮，并补充登录前后浏览器验证 |
| `plans/2026-08-19_Admin升级AntDesign6计划.md` | 已结束 | 已完成；Admin Umi Max/Ant Design 6 迁移、运行时修复、质量门禁和浏览器冒烟已完成；完整跨栈/容器验证受本机环境限制 | Admin、API Client 消费验证、Deployment、Documentation | 全面迁移官方 Ant Design Pro v6/Umi Max，同时保留项目安全、契约和质量边界 |
| `plans/2026-08-20_请求日志错误入参捕获与脱敏管道计划.md` | 已结束 | 已完成；105 项 Backend pytest 和真实 PostgreSQL/Redis 集成验证已通过 | Backend、Admin、API Client、Database、Documentation | 落地错误请求入参捕获、敏感字段脱敏与 4KB 截断兜底的最佳实践管道 |
| `plans/2026-08-20_后端文件日志与环境变量配置化计划.md` | 已结束 | 已完成；后续修复为 UTF-8 JSON Lines，六个请求关联字段和 106 项真实依赖 pytest 已通过 | Backend、Deployment、Documentation | Loguru 异步文件落盘、环境变量受控配置化与自动清理轮转策略 |
