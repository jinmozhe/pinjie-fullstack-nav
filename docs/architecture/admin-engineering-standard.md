# Admin 工程实施标准

## 目标与权威关系

本文定义 `apps/admin` 在 Ant Design Pro v6/Umi Max 体系内的具体实施方式，适用于页面、Feature、请求、状态、组件和依赖变更。长期强制红线以 `apps/admin/AGENTS.md` 为准，采用 Umi Max 的技术取舍以 [ADR 0011](../adr/0011-Admin采用AntDesignProV6与UmiMax决策.md) 为准；认证授权、模块边界和测试语义继续分别以 [认证授权架构](authentication-authorization.md)、[模块边界](module-boundaries.md)和[测试策略](testing-strategy.md)为准。

本标准不固定 Umi 内部依赖的精确版本，也不要求所有页面使用同一种 ProComponents 高阶组件。

## 框架与项目边界

| 能力 | 权威所有者 | 实施要求 |
| --- | --- | --- |
| 路由、布局、运行时生命周期 | Umi Max | 使用 `config/routes.ts`、`src/app.tsx` 和 `@umijs/max` 公共入口 |
| 客户端 Access | Umi Max + 项目权限映射 | 用于路由、菜单和控件显隐，不代替服务端授权 |
| UI 与主题 | Ant Design、ProComponents | 优先使用兼容组件，按交互和性能选择抽象层级 |
| OpenAPI 类型 | `@pinjie/api-client` | 由根契约生成，禁止复制 DTO 或生成第二套契约 |
| HTTP 传输 | `src/lib/api/http.ts` | 唯一处理 Cookie、CSRF、Refresh 和错误的传输层 |
| 领域 API | `src/lib/api/admin.ts` 或 Feature 公开适配层 | 封装端点和领域语义，不在页面拼接底层请求 |
| 服务端状态 | TanStack Query | 管理请求生命周期、缓存、失效和刷新 |
| 最终授权与审计 | Backend | 客户端隐藏、禁用和确认不能替代服务端判定 |

Umi 管理的 React Router、Bundler、Babel、esbuild 和运行时内部依赖不得由应用直接接管。需要扩展时先使用 Umi 配置或插件公共契约；需要升级时采用 Umi 官方支持的兼容组合，不能把某个内部主版本写成永久项目规则。

## 目录与 Feature

- `config/routes.ts` 是路由和菜单结构入口，路由组件指向对应 Feature 的页面导出。
- `src/app.tsx` 负责 Query Provider、`getInitialState`、Layout 和运行时级错误边界等全局装配。
- `src/access.ts` 从 initialState 派生客户端访问能力，不发明服务端没有的权限。
- `src/features/<feature>/` 内聚路由页面、局部组件、Hook、测试和领域适配；当前路由页面命名为 `*Page.tsx`。
- `src/components/` 只放跨页面复用的管理端组件，`src/lib/` 只放无业务页面所有权的基础设施。
- Feature 之间只通过公开入口或共享基础设施协作，禁止导入其他 Feature 内部实现。

新增页面时，先登记配置式路由和所需 Access，再在对应 Feature 内完成页面编排。不得另建独立 React Router、第二套 Layout 或绕过 `app.tsx` 的应用入口。

## Access 与服务端授权

`src/access.ts` 的职责是改善管理端体验：控制菜单、路由和按钮是否可见或可操作。它不能证明请求有权执行，也不能阻止绕过浏览器直接调用 API。

所有受保护操作必须由 Backend RBAC 最终判定，并继续使用 CSRF、资源状态校验、事务和服务端审计。Admin 不提供管理操作的密码二次确认 Token；客户端标准警告弹窗只负责在物理硬删除前明确用户意图。权限加载失败时不得猜测或放宽权限，应进入明确失败、无权限或重新登录状态。

## 数据、请求与状态

请求链保持单向：

```text
Page / Feature -> domain API -> http.ts -> Backend
                         |           |
                         |           +-- Cookie、CSRF、单飞 Refresh、错误解包
                         +-- @pinjie/api-client 生成 DTO
```

- 页面和组件不直接调用原始 `fetch`，不自行刷新 Token，不重复解析统一响应结构。
- `@pinjie/api-client` 当前提供生成 DTO；领域 API 通过项目 HTTP 管道调用端点。未来若启用生成 SDK，必须证明不会形成第二套传输、安全或 DTO 来源，并纳入全栈计划。
- TanStack Query 保存服务端数据和请求状态。Mutation 成功后按领域键精确失效或更新缓存，失败必须显示可操作错误。
- 组件本地状态用于弹窗、表单、选择和短期草稿。只有真正跨页面且不属于服务端事实的状态才评估 Store。
- Token、Cookie 内容、Refresh 状态和其他敏感凭据不得进入 `localStorage`、Store 或客户端可读持久化存储。

## UI 组件选择

| 场景 | 优先选择 | 允许调整的条件 |
| --- | --- | --- |
| 标准查询、分页、排序和列配置 CRUD | `ProTable` | 特殊虚拟化、复杂单元格交互或性能证据可改用 Ant Design Table |
| 标准新增或编辑表单 | `ModalForm` 或 `DrawerForm` | 多阶段流程、跨步骤草稿、复杂焦点或独立路由可使用 Form 与页面编排 |
| 简单详情和键值信息 | ProDescriptions 或 Ant Design Descriptions | 大量自定义布局时使用语义化组合组件 |
| 基础反馈、导航和输入 | Ant Design 组件 | 仅在现有组件无法满足明确契约时增加项目组件 |

ProComponents 是提高标准管理场景效率的首选，不是形式上的强制。选择较低层组件时必须保持统一的加载、空数据、失败、无权限、成功反馈、分页和可访问性行为，不能借此复制基础控件或破坏设计一致性。

标准列表使用 `ProTable` 时，空数据展示以 `ProTable` 内建空态为唯一来源。页面外层 `QueryState` 只负责加载、失败和重试，不传 `empty`，也不额外渲染 Ant Design `Empty`，避免同一请求产生两个“暂无数据”。未使用 `ProTable` 的列表、抽屉和面板继续由 `QueryState empty` 或 Ant Design `Empty` 提供空态。

管理端保持紧凑、可扫描和适合重复操作。所有 Ant Design `Table` 或 `ProTable` 表格的表头和单元格统一设置 `white-space: nowrap`，优先通过 `onHeaderCell`、`onCell` 或 Admin 公共表格样式实现，避免空数据或列宽自适应时出现换行；长文本通过列宽、Tooltip 或明确的溢出处理解决。存在操作列时沿用现有 `width: "1%"` 和按钮布局，并保持表头、单元格及按钮容器单行。标准桌面列表保持弹性宽度，不在全局 `.ant-table-container` 上覆盖 `overflow`；真实宽表和窄屏横向溢出由具体 `Table` 或 `ProTable` 的 `scroll.x` 管理，避免重复滚动容器和异常纵向滚动条。危险操作必须有清晰文案、Loading 和失败恢复；二次确认只用于下节规定的物理硬删除。图标按钮使用 Ant Design Icons，并为不熟悉的图标提供 Tooltip。

桌面展开态由 Umi Max ProLayout 统一使用 `256px` 侧栏，PageContainer 保持流式内容区，不设置固定最大宽度。`1440px` 及以上视口使用 `40px` 页面水平内边距，较窄桌面回落为 `24px`，移动端回落为 `16px`；标题区与正文使用同一水平边界。移动端侧栏折叠和抽屉继续使用 ProLayout 官方响应式行为，页面不得产生 document 级横向溢出。

## 列表分类与批量操作

新增列表或调整列表操作能力时先按数据语义分类；局部样式、文案和缺陷修复保留既有能力，不自动扩大为批量功能建设：

| 列表类型 | 选择与批量操作 | 删除语义 | 当前示例 |
| --- | --- | --- | --- |
| 普通数据列表 | 按写权限显示受控选择列，并提供至少一种有效批量操作 | 复用实体既有软删除或硬删除；没有删除生命周期时提供启停等合法操作 | 用户、管理员、角色、文件资产 |
| 只读日志列表 | 不显示选择列，不提供人工删除或批量写操作 | 只允许服务端保留策略和受控清理流程 | 登录安全事件、审计事件、请求元数据 |

普通数据列表使用 Backend 专用批量端点传递当前页明确选中的 ID，不跨页隐式全选，也不循环调用单条写接口。每次查询、筛选、重置或翻页时清空选择；请求成功后提示实际完成数量、清空选择并刷新数据，请求失败时保留选择并展示统一错误。没有相应批量写权限时隐藏选择列和批量操作区。

启停、身份等高频布尔操作可以使用受写权限控制的列内 Tag 按钮，以减少重复操作路径。列内按钮必须提供明确的 Tooltip 和 ARIA 名称，只锁定正在提交的目标行，并在成功后刷新对应查询、失败时显示统一错误；无写权限、当前主体保护或特殊生命周期状态下只显示只读 Tag。客户端交互限制只负责表达可用性，Backend 继续执行最终授权、资源状态校验、事务和审计。

软删除实体的单条和批量删除沿用状态失效、凭据版本提升、会话撤销和长期可恢复生命周期并直接提交。用户软删除进入回收站，回收站只提供受 `users:restore` 权限控制的单条与批量恢复；不可恢复记录禁用选择与恢复入口，恢复后显示为停用账户。物理硬删除实体必须在单条和批量入口显示不可恢复风险，并统一使用 `src/components/StandardConfirmModal.tsx`；该通用组件只接收标题、说明、加载状态和执行回调，按钮固定为“确定”和“取消”，业务页面不得重复创建确认弹窗。启停、恢复、密码重置、会话撤销、身份调整、角色分配、权限修改及其他非物理删除操作直接提交，不显示二次确认弹窗。新增列表如果确需归入只读日志例外，必须先在产品需求中登记其不可变历史属性和保留策略，普通业务记录不能仅因暂时缺少批量 API 而归入例外。

## 依赖治理

| 依赖层级 | 示例 | 准入与升级规则 |
| --- | --- | --- |
| Umi 内部核心 | React Router、Bundler、Babel、esbuild | 不直接声明或接管；随 Umi 官方兼容组合和锁文件解析 |
| 官方兼容栈 | `@umijs/max`、React、Ant Design、ProComponents、官方插件 | 按兼容矩阵升级，形成计划并完成 Admin 与适用跨栈回归 |
| 业务中立外围能力 | 查询、验证、可访问性或通用工具 | 有明确跨业务复用需求、无现有能力重复且通过供应链评审后引入 |
| 具体业务依赖 | 图表、富文本、Excel、地图、支付或行业 SDK | 默认由真实业务计划或派生仓库引入，不进入通用母版基线 |

所有新解析继续受根 `pnpm-lock.yaml`、七天冷却、安装脚本白名单和供应链门禁约束。范围化安全 override 必须记录依赖链、受影响范围、兼容依据和回归结果；无兼容修复版本的 Medium 或 Low 风险按 `SECURITY.md` 建立限时风险接受。不得通过强制升级框架内部主版本、关闭审计或永久 override 换取表面无告警。

当前 Umi `4.7.5` 的 Vite bundler 固定依赖存在 High 漏洞的 Vite 4，而 Admin 实际使用默认 Webpack。根 `.pnpmfile.cjs` 精确移除未使用的 Vite bundler，`patchedDependencies` 同时关闭 Vite 入口并修复 Webpack server 忽略 host 的监听行为，`scripts/ci/check-umi-vite-security.mjs` 拒绝版本漂移和补丁缺失。补丁负责人为仓库维护者，复核日期为 2026-09-21；上游稳定版提供安全组合后必须通过新计划删除临时补丁。

## 验证要求

变更按风险运行最小充分检查。Admin 源码或依赖变化默认只执行：

```powershell
pnpm --filter @pinjie/admin typecheck
pnpm --filter @pinjie/admin lint
```

Vitest、production build、浏览器冒烟和真实跨栈 E2E 只有在用户对当前任务明确授权后才执行，并分别记录结果。路由、插件、认证、请求或依赖变化不能自行扩大授权范围。规则和架构变化执行：

```powershell
pnpm lint:md
pnpm check:workspace
pnpm check:boundaries
pnpm check:governance
```

Mock、局部组件测试和浏览器冒烟不得表述为真实跨栈验证。Umi 启动、缓存和 Windows 进程排障见 [Admin 本地运行与验证排障手册](../operations/admin-local-development-and-validation-troubleshooting.md)。
