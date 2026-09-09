# Admin 项目规则

## 作用范围与技术栈

- 本文件适用于 `apps/admin/**`，并继承仓库根 `AGENTS.md`。
- Admin 是 B 端管理工具，采用官方 Ant Design Pro v6 的 Umi Max、React、TypeScript、Ant Design 6、ProComponents、TanStack Query 技术体系。路由、布局、权限和运行时配置由 Umi Max 管理。
- 禁止为了统一 Web 端视觉而替换 Ant Design 或 ProComponents。界面应紧凑、稳定、工作导向，优先支持扫描、筛选、比较和重复操作。

## 目录与状态边界

- `config/routes.ts` 负责配置式路由；当前路由页面位于 `src/features/<feature>/*Page.tsx`，Feature 内聚页面、组件、Hook 和领域适配。`src/components/` 放跨页面组件，`src/lib/` 放 HTTP、导航等基础设施。
- 页面和 Feature 不得直接调用原始 `fetch`、拼接底层请求或重复处理响应结构。`src/lib/api/http.ts` 是唯一传输层，统一处理 Cookie 会话、CSRF、单飞 Refresh、响应解包、错误分类和登录失效；不得引入 Umi Request 或另一套客户端形成并行请求管道。
- 服务端数据、缓存和请求状态由 TanStack Query 管理。Zustand 只保存真正的客户端状态，禁止复制 Query 数据形成双份事实来源。
- 临时弹窗、表单和草稿优先使用组件本地状态。Zustand 不保存 Token、Cookie 内容和其他敏感凭据；浏览器认证边界遵守 `docs/architecture/authentication-authorization.md`。
- Web 与 Admin 禁止直接互相引用。共享类型和请求能力只能通过 `@pinjie/api-client` 等 `packages/` 公共包进入。
- Feature 只能通过明确公共入口协作，不得导入其他 Feature 的内部组件、Hook、Store 或请求实现。完整边界见 `docs/architecture/module-boundaries.md`。

## API 与类型

- `@pinjie/api-client` 是 OpenAPI 生成类型的唯一来源；当前领域端点由 `src/lib/api/admin.ts` 基于项目 HTTP 管道封装。页面层只消费生成类型和解包后的业务数据，禁止手工复制 OpenAPI 已提供的 DTO，禁止生成或维护第二套 SDK、DTO 或契约副本。
- API 契约变化时，先更新后端并导出根 `openapi.json`，再从根目录运行 `pnpm generate-api`，最后适配 Admin。
- 破坏性契约变化必须在同一全栈计划中完成消费者迁移或建立有删除期限的受控迁移窗口，禁止在页面长期维护新旧响应分支。
- `packages/api-client/src/` 是生成目录，禁止手工修改。
- 避免 `any`、非空断言和无依据的类型转换；外部输入必须在边界处校验或收窄。

### UI 与交互

- 优先使用 Ant Design 和 ProComponents 现有能力，避免自建基础控件；`ProTable`、`ModalForm`、`DrawerForm` 适用于标准场景，但不强制用于复杂工作流或性能敏感页。
- 操作按钮使用 Ant Design 图标并提供文本或 Tooltip；危险操作须清晰反馈并遵守删除确认约定。
- 页面状态覆盖加载、空态、失败、无权限和成功反馈；妥善处理窄屏、长文本和溢出。
- 标准列表复用 `PageFrame` 统一间距；筛选支持窄屏换行伸缩；布尔字段优先 Switch。细则见 [Admin 工程标准](../../docs/architecture/admin-engineering-standard.md)。
- 列表页须在表格上方设置工具栏：左侧标题右侧操作与刷新，空态与筛选后均保留。`ProTable` 用 `headerTitle`、`toolBarRender`、`options`，普通 Table 保持等价布局。
- 筛选搜索按需实现，保留既有能力；Table 表头与单元格统一 `white-space: nowrap`；操作列保持 `width: "1%"` 与单行布局。
- `ProTable` 统一呈现空态，外层 `QueryState` 只处理加载与重试；非 ProTable 列表通过 `QueryState empty` 或 `Empty` 展示。
- 数据列表须按权限提供批量操作，对接实体生命周期，禁止前端循环单条接口模拟批量。操作后清空选择并刷新，无权限时隐藏选择列与批量入口。
- 全局复用通用确认弹窗组件。立即持久化删除须二次确认，按 [ADR 0017](../../docs/adr/0017-Admin删除操作统一确认决策.md) 执行；草稿修改与常规启停沿用原交互。只读日志不提供批量操作。
- 不使用营销页巨型标题、装饰性卡片堆叠、夸张圆角或重阴影。

## 验证

- Admin 默认自动门禁为 `pnpm --filter @pinjie/admin typecheck` 与 `lint`。日常开发、普通提交、`$git-sync`、Push 和 PR 均遵守此范围。
- 采用 Vitest、RTL、jsdom、MSW 与 Playwright 测试栈。未经用户明确点名，禁止自动运行 production build、测试用例与浏览器自动化。
- 用户明确授权时仅执行指定范围并如实报告结果；未获授权记录为未执行。有入口无测试属于 `partial` 并拒绝通过。

## Umi 运行与依赖准入

- 路由、布局和 Access 仅通过 `@umijs/max` 公开入口使用，禁止越权操作底层构建链或强制升级未支持的主版本。Access 仅负责客户端体验，安全由 Backend 最终执行。
- 开发服务通过 `scripts/run-umi.mjs` 绑定 `127.0.0.1:3001`，保留底层 host 补丁；不得在浏览器代码使用 `import.meta.env`，不提交 `src/.umi*`。排障见对应手册。
- Umi、React、Ant Design、ProComponents 仅按官方组合升级，遵守锁文件、七天冷却期与安装脚本白名单。安全 override 须有依赖链证据。
- 仅允许 Umi 默认 Webpack 构建链，保留排除 Vite 4 的 Hook、补丁与自检门禁；母版仅接收跨业务通用能力。

详细目录、请求、组件选择和依赖分层见 `docs/architecture/admin-engineering-standard.md`。
