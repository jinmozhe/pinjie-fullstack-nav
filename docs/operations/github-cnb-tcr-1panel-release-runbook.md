# GitHub 到 1Panel 端到端人工发布手册

## 1. 适用范围

本文面向实际执行发布的操作人员，按界面和命令顺序完成以下现行生产链路：

```text
GitHub Actions
-> CNB 云构建
-> 腾讯云 TCR 个人版
-> 1Panel 纯拉取镜像并更新编排
```

这条链路只在 CNB 构建生产镜像。GitHub 负责验证和源码交接，TCR 保存镜像，1Panel 只拉取已经发布的固定镜像 digest 并运行容器。当前 GitHub `Deploy Production` 工作流仍面向旧 GHCR 路径，必须保持禁用，不参与本文流程。

当前采用单维护者、1Panel 人工部署流程：CNB 发布成功后，人工核对受影响端的发布清单、源码 SHA、扫描证据与 TCR digest，记录当前和回滚版本，再同步服务器根 `.env` 与 1Panel 编排环境变量，保存编排并完成上线检查。部署沿用核验的固定 digest，不重新构建镜像。

当前流程不使用 `Validate Candidate Images`，无需创建 `candidate-image-validation` Environment、配置其只读 Secrets、生成请求 JSON 或运行部署组合预检。源码交接的 `strict` / `fast` 含义保持不变；停止使用该操作不代表最终 TCR 镜像已通过独立 E2E。

工作流内部机制见[GitHub Actions 工作流说明](github-actions-workflows.md)，账号和权限见[腾讯云 CAM 子账号与 TCR 个人版最小权限操作手册](tencent-tcr-personal-cam-accounts.md)，生产基础设施细节见[1Panel 单机生产运行手册](1panel-production-runbook.md)，异常回退规则见[发布与回滚手册](release-and-rollback.md)。

## 2. 发布前准备

Nav 目前保留继承的 CNB/TCR 配置模板，本文中的母版仓库与镜像地址不能直接作为 Nav 生产目标。首次启用发布前，必须在专项计划中确认 Nav 独立的 CNB 仓库、TCR 命名空间、来源校验及凭据引用；本次母版更新未执行这些环境配置或远端动作。

先判断是否需要发布：仅文档、计划或 AI 规则变化且不影响构建输入与运行配置时，完成 Git 交付即可，无需 Full Validation、源码交接、CNB 构建或更新容器。生产允许继续使用较早的已验证镜像，不要求镜像 SHA 随每次文档提交推进。源码、依赖、Dockerfile、共享契约、迁移或生产运行配置变化时，按实际影响确定构建、部署和验证范围；服务器配置变更可能只需更新配置并重建对应容器。

Git Commit SHA 用于追溯源码，TCR `sha-<Commit SHA>` 标签用于查找镜像；1Panel 的镜像变量必须填写完整的 `仓库@sha256:<digest>`。不能直接用源码 SHA、候选标签或 `latest` 代替镜像 digest。

开始前准备以下信息：

| 项目 | 要求 |
| --- | --- |
| 目标 Commit | GitHub `main` 上完整的 40 位小写 Commit SHA |
| 影响范围 | 明确 Backend、Web、Admin 中哪些端需要构建和部署 |
| 当前生产版本 | 三个运行端当前的完整镜像引用和 digest |
| 回滚版本 | 三个端上一次验证通过的完整镜像引用和 digest |
| 数据库 | 共享 PostgreSQL 中当前项目的独立数据库和角色 |
| Redis | 当前项目预留的 Redis 隔离方式和逻辑库编号 |
| TCR | 生产服务器已经使用只读账号登录 `ccr.ccs.tencentyun.com` |
| 1Panel | 已存在项目编排、外部 `1panel-network` 和 OpenResty 网站 |

当前项目生产目录是：

```text
/home/ubuntu/projects/pinjie-fullstack-base/
├── compose.prod.yml
├── .env
└── apps/
    └── backend/
        └── .env
```

根 `.env` 保存 Compose 使用的三张镜像引用和 Web 公开 Origin。`apps/backend/.env` 保存 Backend 运行配置。真实密码、Token 和完整连接串不得进入 Git、GitHub 日志、CNB 日志或操作记录。

## 3. 确认目标 Commit SHA

在 GitHub 仓库中执行：

1. 打开仓库首页。
2. 确认当前分支为 `main`。
3. 点击最新提交，或打开 `Commits` 列表选择本次批准的提交。
4. 复制完整 40 位 Commit SHA，不能只使用页面显示的 7 位短 SHA。
5. 确认该 SHA 对应的 `CI - Governance`、`CI - Backend`、`CI - Frontend` 和 `Security` 四个 Push Run 全部成功。

后续 GitHub、CNB 和发布记录必须使用同一个完整 Commit SHA。三端可以在生产中分别运行来自不同 Commit 的已验证镜像，但同一项跨端变更要求所有受影响端使用同一个 Commit 构建并共同验证。

## 4. 选择 strict 或 fast

| 模式 | Full Validation | 使用条件 |
| --- | --- | --- |
| `strict` | 必须先成功运行 | 数据库、迁移、认证授权、权限、公开 API、共享包、依赖、Dockerfile、发布脚本、跨端功能和正式版本 |
| `fast` | 跳过 Full Validation Artifact | 已人工确认影响很小，并接受 pytest、Vitest、production build 和 Playwright 未验证的风险 |

不确定影响范围时使用 `strict`。`fast` 仍然要求同一 SHA 的四个轻量 Push Run 全部成功，也不会跳过 CNB 的镜像构建、Trivy、SBOM、provenance 和 digest 复核。

## 5. strict 模式运行 Full Validation

选择 `fast` 时跳到下一节。选择 `strict` 时在 GitHub 执行：

1. 打开仓库的 `Actions` 页面。
2. 在左侧选择 `CI - Full Validation`。
3. 点击 `Run workflow`。
4. 分支选择 `main`。
5. `commit_sha` 填写第 3 节取得的完整 40 位 SHA。
6. 点击确认运行。
7. 打开新 Run，等待并行的 Backend pytest、Admin/Web 验证构建和最终 `Production browser E2E and aggregate evidence` 全部完成。

成功结果应满足：

- Run 顶部结论为成功。
- Backend pytest、Admin/Web Vitest、两端 production build 和 Chromium Playwright 均成功。
- Artifact 中存在 `full-validation-<完整 SHA>`，保留期为 30 天。
- 清单 schema 为 `pinjie-full-validation-v2`，Admin 验证运行 Nginx dist，Web 验证运行 standalone，旧 v1 不能替代。

任一步失败时停止发布。修复代码后会产生新的 Commit SHA，必须从第 3 节重新开始，不能继续使用旧 SHA 的 Artifact。

## 6. GitHub 交接源码到 CNB

在 GitHub 执行：

1. 打开 `Actions`。
2. 在左侧选择 `Handoff Source to CNB`。
3. 点击 `Run workflow`。
4. 分支选择 `main`。
5. `commit_sha` 填写完整 40 位 SHA。
6. `validation_mode` 选择 `strict` 或 `fast`。
7. `fast` 模式必须填写 `fast_mode_reason`，使用不超过 200 个字符的单行说明，不能包含密码、Token 或个人敏感信息。
8. `strict` 模式保持 `fast_mode_reason` 为空。
9. 点击确认运行。

GitHub Run 中应依次看到：

1. `Validate immutable input` 成功，表示 SHA、四个 Push Run、验证模式、应用状态和模块边界满足要求。
2. `strict` 模式成功核对同一 SHA 的 Full Validation Artifact；`fast` 模式在 Summary 中记录跳过事实和原因。
3. `Fast-forward CNB main` 成功，表示批准的 SHA 已通过非强制快进方式写入 CNB `main`。

GitHub Handoff 成功只代表 CNB 收到源码。此时镜像可能仍在构建，不能开始生产更新。

## 7. 在 CNB 核对三端构建

打开 CNB 仓库 `pjwl/pinjie-fullstack-base` 的构建记录。`main` 收到 GitHub 交接后，根据实际变更路径自动触发：

| Pipeline | 产物 |
| --- | --- |
| `backend-image` | `pinjie-fullstack-backend` |
| `web-image` | `pinjie-fullstack-web` |
| `admin-image` | `pinjie-fullstack-admin` |

每个实际触发的 Pipeline 必须依次成功：

1. `Validate immutable release context`
2. `Build and push run-unique candidate`
3. `Scan candidate and generate SBOM`
4. `Enforce structured vulnerability gate`
5. `Publish immutable SHA tag`
6. `Generate and validate image release evidence`
7. `Save image release evidence`
8. `Remove temporary registry credentials`

CNB 普通 `main` Push 的 `ifModify` 比较本次推送前后的提交差异。一次 Handoff 可以交接多次 GitHub 提交，必须检查 CNB 原有 SHA 到目标 SHA 的累计变化，不能只检查目标提交相对其父提交的变化。`strict` / `fast` 决定源码交接的验证证据，实际构建哪些应用由 [.cnb.yml](../../.cnb.yml) 的路径规则决定。平台比较方式见 [CNB ifModify 官方说明](https://docs.cnb.cool/en/build/grammar.html#pipeline-ifmodify)。

从 Handoff 的 `Fast-forward CNB main` 日志确认推送前后 SHA，再在具有这两个提交的本地仓库中检查差异；以下占位值需替换为实际完整 SHA：

```powershell
git diff --name-only <CNB推送前SHA> <本次目标SHA>
```

累计变化仅命中单端构建路径时，允许只出现该端 Pipeline。根依赖、共享包、发布脚本或多端代码发生变化时，按各端路径规则触发对应 Pipeline；其中 `.cnb.yml` 或共用扫描脚本变化会命中三端。先根据累计变更范围确认预期触发集合，再判断是否完整。三端均有新镜像不代表服务器必须同时替换三端，部署范围还需按第 12 节核对实际生产版本。

以下情况需要在 CNB `main` 分支详情页点击“三端全量镜像构建”：

- CNB 首次运行，无法计算上一提交。
- 一次变更超过 300 个文件。
- Git 历史无法比较。
- 实际影响范围无法可靠判断。
- 预期 Pipeline 没有触发。

该按钮固定为当前 CNB `main` 构建 Backend、Web 和 Admin，不接收任意 Commit。点击前再次确认 CNB `main` 等于批准的 GitHub Commit SHA。

任一预期端失败时停止部署。查看该端第一条失败 Stage 和 `image-failure-evidence.tar.gz`，修复后生成新 Commit 并重新走完整流程。不能把成功的另外两端与失败端的旧镜像拼成一次未经评估的跨端发布。

## 8. 取得 TCR 完整镜像 digest

每个成功 Pipeline 会提供 `image-release-evidence.tar.gz`。下载并解压后读取对应文件：

```text
backend-release-manifest.json
web-release-manifest.json
admin-release-manifest.json
```

在清单中核对：

- `schema` 等于 `pinjie-cnb-tcr-image-v1`。
- `image_key` 对应当前端。
- `source.commit_sha` 等于批准的完整 Commit SHA。
- `cnb.pipeline` 和 `cnb.build_id` 对应当前成功 Build。
- `image.trivy`、`image.sbom` 和 `image.provenance` 已通过。
- `image.reference` 是包含完整 `@sha256:` 的 TCR 镜像引用。

生产部署复制 `image.reference`，格式如下：

```text
ccr.ccs.tencentyun.com/pinjie-fullstack-base/pinjie-fullstack-backend@sha256:<64位摘要>
ccr.ccs.tencentyun.com/pinjie-fullstack-base/pinjie-fullstack-web@sha256:<64位摘要>
ccr.ccs.tencentyun.com/pinjie-fullstack-base/pinjie-fullstack-admin@sha256:<64位摘要>
```

### 8.1 TCR 三类标签和时间

每个应用仓库都使用以下标签。同一次成功发布通常可见两个应用镜像标签和一份构建缓存，不能按列表行数认定应用构建了三个版本。

| 标签 | 作用 | 生产使用方式 |
| --- | --- | --- |
| `sha-<完整 Commit SHA>` | 发布门禁通过后创建的正式源码版本标签 | 用于查找镜像，部署使用清单中的完整 `仓库@sha256:<digest>` |
| `candidate-<CNB Build ID>` | 本次构建先推送的候选镜像，供扫描和来源核验 | 不使用该标签部署，失败候选不得上线 |
| `buildcache-main` | 供后续构建读取和更新的 Registry 缓存 | 不属于生产应用镜像，不用于部署 |

发布顺序是“构建并推送候选镜像，同时更新缓存 → 扫描和证据门禁 → 创建正式 SHA 标签”。正式标签引用通过核验的同一候选 digest，不重新构建应用；发布脚本会再次核对正式标签的完整 digest。因此同次成功发布的 `candidate-*` 与 `sha-*` 应指向相同镜像内容，缓存拥有独立用途和摘要。控制台截断显示的摘要前缀不能代替完整 digest 核对。

候选标签较早推送，正式标签在门禁通过后创建，时间通常更晚；`buildcache-main` 会被后续构建更新，其创建时间可以早于本次发布，修改时间反映后续写入。TCR 列表时间、镜像内 OCI 创建时间和服务器容器启动时间属于不同记录，不能仅凭“最新修改时间”判断线上版本。

CNB 的 `candidate-*` 标签属于现有单镜像构建发布步骤，继续承担候选推送、扫描和正式标签发布前核验。它与本次未迁入 Nav 的 GitHub 候选镜像组合验收工具分别承担不同职责。

## 9. 在 1Panel 纯拉取镜像

在 1Panel 中执行：

1. 打开“容器 > 镜像”。
2. 点击“拉取镜像”。
3. 对每个受影响端粘贴第 8 节取得的完整 TCR `image.reference`。
4. 等待拉取完成。
5. 不要人工添加 `latest` 或额外本地 RepoTag。

如果 1Panel 已经保存了同一 digest，会显示使用存量镜像。编排更新也能自行拉取缺失镜像；提前在镜像页拉取的价值是单独验证 TCR 登录、网络和只读权限，便于把拉取故障与 Compose 故障分开。

## 10. 核对生产环境变量

根 `.env` 至少包含：

```dotenv
BACKEND_IMAGE=ccr.ccs.tencentyun.com/pinjie-fullstack-base/pinjie-fullstack-backend@sha256:<64位摘要>
WEB_IMAGE=ccr.ccs.tencentyun.com/pinjie-fullstack-base/pinjie-fullstack-web@sha256:<64位摘要>
ADMIN_IMAGE=ccr.ccs.tencentyun.com/pinjie-fullstack-base/pinjie-fullstack-admin@sha256:<64位摘要>
WEB_PUBLIC_ORIGIN=https://<Web正式域名>
```

只更新本次受影响端，保留其他端当前已经验证的 digest。通过 1Panel 编辑既有编排时，还要把这四项同步到编排的“环境变量”页面；1Panel 更新编排时使用该页面的变量完成镜像预拉取和 Compose 插值。根 `.env` 继续作为服务器命令行操作的变量来源，两处必须保持一致。

`apps/backend/.env` 使用共享基础设施。当前生产方案的关键格式是：

```dotenv
DATABASE_URL=postgresql+asyncpg://<项目角色>:<URL编码后的密码>@postgresql:5432/<项目数据库>
REDIS_MODE=required
REDIS_URL=redis://default:<URL编码后的密码>@redis:6379/1
```

当前项目使用 Redis `default` 用户和独立逻辑库 `/1`。逻辑库编号用于避免正常业务 Key 混在一起，不提供访问权限隔离，也不能阻止其他客户端执行跨库管理命令。服务器上每个项目必须预留不同编号，禁止执行 `FLUSHALL`；安全边界要求更高时应改用独立 ACL 用户或独立 Redis 实例。

## 11. 首次全新部署

仅首次部署新数据库时执行本节。日常镜像更新跳到下一节。

### 11.1 前置检查

- 1Panel 共享容器名或网络别名能够通过 `postgresql:5432` 和 `redis:6379` 访问。
- PostgreSQL 已创建项目数据库、项目登录角色和强密码，项目角色拥有目标数据库及 `public` Schema 创建权限。
- Redis 已启用密码，逻辑库 `/1` 已明确分配给当前项目。
- `postgresql` 和 `redis` 已加入外部网络 `1panel-network`。
- `compose.prod.yml`、根 `.env` 和 `apps/backend/.env` 已准备完成。

### 11.2 初始化数据库和权限

通过 1Panel 终端或 SSH 进入项目目录：

```bash
cd /home/ubuntu/projects/pinjie-fullstack-base
sudo docker compose --env-file .env -f compose.prod.yml config --quiet
sudo docker compose --env-file .env -f compose.prod.yml run --rm backend alembic upgrade head
sudo docker compose --env-file .env -f compose.prod.yml run --rm backend python -m scripts.sync_permissions --apply --confirm-database <项目数据库名>
sudo docker compose --env-file .env -f compose.prod.yml run --rm backend python -m scripts.sync_permissions --check --confirm-database <项目数据库名>
```

预期结果：Alembic 升级到 `head`，权限同步最终显示 `missing=0 changed=0 obsolete=0`。任何一步失败都停止后续启动。

### 11.3 创建初始超级管理员

```bash
sudo docker compose --env-file .env -f compose.prod.yml run --rm backend python -m scripts.create_initial_admin --username <管理员用户名> --confirm-database <项目数据库名>
```

按提示输入并确认密码。脚本只在数据库中没有同名管理员时创建；已有同名账号会拒绝覆盖。重置已有初始管理员必须另行确认并使用 `--reset-existing --confirm-reset`，会撤销其现有会话。

### 11.4 保存编排

在 1Panel 执行：

1. 打开“容器 > 编排”。
2. 选择 `pinjie-fullstack-base`。
3. 确认 Compose 内容与服务器当前 `compose.prod.yml` 一致。
4. 确认编排环境变量与根 `.env` 一致。
5. 点击“保存”或“更新编排”。
6. 等待 Backend 健康后，Web 和 Admin 再启动。

## 12. 日常版本更新

日常更新不需要删除旧编排、项目默认网络或 `backend_uploads` 存储卷。

部署范围以每个应用当前实际运行的 digest 及其对应源码 SHA 为基线，分别比较到本次目标版本，并检查依赖、构建配置、公开契约和数据库兼容性。CNB 上一次接收源码的版本不一定等于服务器当前版本，TCR 已生成新镜像也不代表服务器已更新。

例如，目标相对上一源码提交仅修改 Admin 的 `nginx.conf` 时，只有确认 Backend/Web 当前运行版本已包含此前所需修改，且无新的跨端影响，才能只更新 Admin。若服务器仍使用更早版本，累计变化还包含 Backend/Web 修复，要交付这些修复就需更新对应应用；不能依据最后一次提交判断它们无需部署。无法追溯某端的生产 SHA 时，先从原发布清单、部署记录或镜像 OCI revision 补齐基线。

1. 记录三个端当前运行的完整 digest，作为回滚基线。
2. 在 1Panel 镜像页拉取本次受影响端的新 digest。
3. 修改根 `.env` 中对应端的镜像变量。
4. 同步修改 1Panel 编排的环境变量页面。
5. Backend 包含 Alembic 迁移时，先备份项目数据库，再执行 `alembic upgrade head`。
6. 权限目录变化时执行 `sync_permissions --apply`，随后执行 `--check`。
7. 在“容器 > 编排”打开 `pinjie-fullstack-base`，点击“保存”或“更新编排”。
8. 等待日志显示更新成功和服务达到 `healthy`。

只需严格重建单个服务时，可在服务器执行：

```bash
sudo docker compose --env-file .env -f compose.prod.yml up -d --no-deps --wait <backend|web|admin>
```

1Panel 保存整个编排时会重新计算全部服务。配置和镜像引用没有变化的服务通常保持运行，镜像 digest 变化的服务会创建新容器并替换旧容器。容器名称继续使用 `pinjie-fullstack-base-<service>-1`，名称不随镜像 digest 改变。

## 13. 部署后验证

进入项目目录执行：

```bash
sudo docker compose --env-file .env -f compose.prod.yml ps
curl -fsS http://127.0.0.1:8000/health/live
echo
curl -fsS http://127.0.0.1:8000/health/ready
echo
curl -fsS -o /dev/null -w 'web=%{http_code}\n' http://127.0.0.1:3000/
curl -fsS http://127.0.0.1:3001/healthz
echo
```

预期结果：

```text
Backend、Web、Admin 均为 Up 和 healthy
{"status":"alive"}
{"status":"ready",...}
web=200
ok
```

继续检查：

- `fullstack.jinmozhe.com` 能通过 OpenResty 访问 Web。
- `fullstack-admin.jinmozhe.com` 能通过 OpenResty 访问 Admin。
- 登录、退出和一个关键只读业务流程正常。
- Backend 就绪结果中的 database、settings_media 和 redis 均为 `ok`。
- 三个运行容器的实际镜像 digest 与本次批准值一致。
- `backend_uploads` 中已有文件在容器替换后仍存在。
- 日志没有持续数据库、Redis、权限或代理错误。

编排日志显示成功只能证明 Compose 操作完成。以上容器、探针、域名和关键业务检查全部完成后，才记录生产更新成功。

## 14. 回滚

应用镜像回滚使用上一组已经验证的完整 digest，不重新构建旧代码。

1. 暂停新的发布和高风险写操作。
2. 核对当前数据库 Revision 是否仍兼容旧 Backend。
3. 把受影响端的镜像变量恢复为记录中的旧完整 digest。
4. 同步 1Panel 编排环境变量。
5. 保存或更新编排。
6. 重复第 13 节全部验证。
7. 记录回滚原因、当前版本、恢复版本、执行时间和结果。

如果数据库已经执行不兼容的向前迁移，停止应用回滚并按[数据库备份与恢复手册](database-backup-restore.md)单独评估。数据库降级、覆盖恢复、删除容器、删除存储卷或删除备份都需要独立授权。

## 15. 必须停止的情况

出现以下任一情况时停止上线：

- Commit SHA 不完整，或不属于 GitHub `main`。
- 同一 SHA 的四个轻量 Push Run 缺失或失败。
- `strict` 模式没有有效 Full Validation Artifact。
- GitHub Handoff 失败或 CNB `main` 不等于批准 SHA。
- 预期 CNB Pipeline 缺失、失败或证据中的 SHA 不一致。
- 只能取得 Tag，无法取得完整 TCR digest。
- TCR 拉取失败或生产服务器使用了具有写权限的发布账号。
- Compose 展开失败、共享 PostgreSQL/Redis 不健康或外部网络缺失。
- 数据库迁移、权限同步、Backend Readiness 或域名检查失败。
- 实际运行 digest 与批准值不一致。

禁止通过改用 `latest`、覆盖既有 SHA Tag、跳过扫描、删除健康检查、清理共享数据库容器或执行 `docker compose down -v` 继续上线。

## 16. 发布记录模板

每次生产更新至少保存：

```text
发布时间：
执行人：
GitHub Commit SHA：
验证模式：strict / fast
Full Validation Run：成功 Run ID / fast 未执行
Backend：Commit、CNB Build ID、完整 digest、是否部署
Web：Commit、CNB Build ID、完整 digest、是否部署
Admin：Commit、CNB Build ID、完整 digest、是否部署
迁移前后 Alembic Revision：
权限同步结果：
1Panel 编排结果：
健康检查结果：
域名与关键业务检查：
回滚 digest：
异常和后续事项：
```

记录中只保存标识和结果，不保存密码、Token、Cookie、完整数据库连接串或 TCR 登录凭据。
