# `/x` JSON 数据维护

## 1. 路径与生效方式

`/x` 每次收到请求时读取 JSON，更新后重新打开或刷新页面生效，不需要重新构建镜像或重启服务。已经打开的页面不自动更新。当前页面没有登录校验，只保留无首页入口和 `noindex, nofollow`，不得把这两项当作访问控制。

| 用途 | 路径或变量 |
| --- | --- |
| 仓库初始化模板 | `data/x-sites.example.json` |
| 服务器运行文件 | `/home/ubuntu/projects/pinjie-fullstack-nav/data/x-sites.json` |
| Compose 宿主机目录变量 | `X_DATA_DIR=/home/ubuntu/projects/pinjie-fullstack-nav/data` |
| Web 容器文件变量 | `X_SITES_FILE=/app/runtime-data/x-sites.json` |
| 容器校验工具 | `/app/apps/web/scripts/check-x-sites.mjs` |

JSON 顶层为数组，页面按数组顺序显示，三个字段均为字符串，名称不能为空，网址必须为合法 HTTP/HTTPS 且不重复，简介可以为空。网址按 URL 标准化结果去重，例如主机名大小写和默认端口差异不能作为不同站点。字段值原样展示；空数组 `[]` 表示暂无站点。

```json
[
  {
    "name": "示例站点",
    "url": "https://example.com/",
    "description": "站点简介"
  }
]
```

文件使用 UTF-8 无 BOM，并保留末尾换行。只提交初始化模板；正式 JSON、临时文件和备份由 Git 忽略，整个根 `data` 目录排除在 Docker 构建上下文之外。容器只读取挂载文件，不在启动时复制模板或初始化数据。

## 2. 本地开发

从仓库根目录执行一次初始化，存在时保留原文件：

```powershell
if (-not (Test-Path -LiteralPath data/x-sites.json)) {
  [System.IO.File]::Copy(
    (Join-Path (Get-Location) 'data/x-sites.example.json'),
    (Join-Path (Get-Location) 'data/x-sites.json'),
    $false
  )
}
```

在 `apps/web/.env.local` 中设置本机绝对路径，不使用 `NEXT_PUBLIC_` 前缀，例如：

```dotenv
X_SITES_FILE=E:/fastapi/pinjie-fullstack-nav/data/x-sites.json
```

使用项目要求的 Node.js 24 及以上版本，运行只读校验命令：

```powershell
pnpm --filter @pinjie/web check:x-sites E:/fastapi/pinjie-fullstack-nav/data/x-sites.json
```

该命令复用页面的校验规则，只输出站点数量或错误类别及字段位置，不执行网站访问或修改数据。首次配置环境变量后启动或重启开发服务；后续仅修改 JSON 时刷新页面即可。Web 其他启动步骤见[Web README](../../apps/web/README.md)。

## 3. 首次生产启用

首次启用需要包含本功能的新版 Web 镜像；镜像发布和部署仍分别授权，沿用[人工发布手册](github-cnb-tcr-1panel-release-runbook.md)的固定 digest 流程。服务器不需要安装 Node、pnpm 或其他开发工具链。

1. 将仓库模板单独上传到服务器项目的 `data/x-sites.example.json`。模板不在镜像里，不能从旧容器假定获得。
2. 以维护者 `ubuntu` 执行以下初始化。目录与文件属主为维护者，组 `10001` 仅供当前 Web 容器读取；已有正式文件不覆盖。实际维护者不同则调整属主。

   ```bash
   set -euo pipefail
   cd /home/ubuntu/projects/pinjie-fullstack-nav
   X_DATA_DIR=/home/ubuntu/projects/pinjie-fullstack-nav/data
   sudo install -d -o ubuntu -g 10001 -m 0750 "$X_DATA_DIR"
   if [ ! -e "$X_DATA_DIR/x-sites.json" ]; then
     (umask 0027; set -C; cat "$X_DATA_DIR/x-sites.example.json" > "$X_DATA_DIR/x-sites.json")
   fi
   sudo chgrp 10001 "$X_DATA_DIR/x-sites.json"
   chmod 0640 "$X_DATA_DIR/x-sites.json"
   ```

3. 在服务器根 `.env` 和 1Panel 编排环境变量中同时设置 `X_DATA_DIR`，值为上表中的宿主机绝对目录。其他既有变量继续保留。
4. 同步新版 Compose，Web 使用目录绑定挂载、`read_only: true` 和 `create_host_path: false`；容器内路径由 Compose 固定设置。宿主机目录不存在时启动明确失败。
5. 按已有发布流程部署一次新版 Web。用下列命令核对容器读取权限和文件结构，再通过真实域名打开 `/x` 检查。首页健康检查不能证明 `/x` 数据可读。

```bash
docker compose --env-file .env -f compose.prod.yml exec -T web \
  node /app/apps/web/scripts/check-x-sites.mjs /app/runtime-data/x-sites.json
```

Web 镜像只携带校验程序及同源纯校验模块，不携带运行数据。文件系统操作依赖 Node.js 运行时；不适用于无持久挂载的静态托管平台。当前按同一宿主机目录部署，多主机实例需要另行设计共享数据源。

## 4. 更新与恢复

维护操作串行执行。推荐在同一数据目录创建临时文件，编辑后通过容器内同一校验规则检查，再用 `mv` 原子替换。不要直接截断写入正式文件，不删除或重命名整个挂载目录。

以下命令在同一 Bash 会话内执行；`nano` 可换成维护者使用的文本编辑器。临时文件名随机生成，避免覆盖已有草稿；校验失败时命令停止，正式文件不变，草稿保留供修复。

```bash
set -euo pipefail
cd /home/ubuntu/projects/pinjie-fullstack-nav
X_DATA_DIR=/home/ubuntu/projects/pinjie-fullstack-nav/data
candidate=$(mktemp "$X_DATA_DIR/x-sites.next.XXXXXXXX.json")
cp -- "$X_DATA_DIR/x-sites.json" "$candidate"
nano "$candidate"
sudo chgrp 10001 "$candidate"
chmod 0640 "$candidate"
docker compose --env-file .env -f compose.prod.yml exec -T web \
  node /app/apps/web/scripts/check-x-sites.mjs "/app/runtime-data/$(basename "$candidate")"
backup=$(mktemp "$X_DATA_DIR/x-sites.backup.XXXXXXXX.json")
cp -- "$X_DATA_DIR/x-sites.json" "$backup"
mv -T -- "$candidate" "$X_DATA_DIR/x-sites.json"
```

替换成功后刷新 `/x`，核对数量、顺序、名称、简介和外链。普通文件更新无需执行 Compose 更新或容器重启。备份保持维护者私有读取权限，按项目备份保留周期管理，服务器备份必须包含该数据目录。

恢复时明确选择一份备份，复制到同目录临时文件，校验后原子替换；以下 `backup` 必须替换为实际备份路径：

```bash
set -euo pipefail
cd /home/ubuntu/projects/pinjie-fullstack-nav
X_DATA_DIR=/home/ubuntu/projects/pinjie-fullstack-nav/data
backup="$X_DATA_DIR/x-sites.backup.REPLACE_ME.json"
restore=$(mktemp "$X_DATA_DIR/x-sites.restore.XXXXXXXX.json")
cp -- "$backup" "$restore"
sudo chgrp 10001 "$restore"
chmod 0640 "$restore"
docker compose --env-file .env -f compose.prod.yml exec -T web \
  node /app/apps/web/scripts/check-x-sites.mjs "/app/runtime-data/$(basename "$restore")"
mv -T -- "$restore" "$X_DATA_DIR/x-sites.json"
```

代码、镜像和运行数据独立管理，更新源码或重建容器时保留该目录，不重复覆盖初始化文件。镜像回滚按原发布手册执行，JSON 内容恢复使用本节步骤。

## 5. 故障与缓存检查

| 现象 | 核对与恢复 |
| --- | --- |
| Compose 提示缺少目录或变量 | 核对 `X_DATA_DIR` 的绝对目录、根 `.env` 和 1Panel 编排环境变量 |
| `CONFIG` | `X_SITES_FILE` 必须为绝对文件路径；校验命令必须传入唯一绝对文件路径参数 |
| `READ` | 核对文件存在、目录挂载及 UID/GID `10001` 读取权限；不修改系统级权限 |
| `JSON` | 修复 UTF-8 无 BOM 编码和 JSON 语法 |
| `SCHEMA` | 按 `$[条目索引].字段` 修复字段类型、名称、URL 或重复项，索引从 0 开始 |
| 校验通过但页面仍显示旧内容 | 完整刷新页面，检查 OpenResty/CDN 缓存规则以及当前请求是否落到正确实例 |

失败时 `/x` 显示中文错误与“重新加载”按钮，不回退模板、旧列表或空数组。修复文件后点击重新加载即可重新请求。服务端只记录错误类别和字段位置；不要把文件原文或完整异常输出到日志。

Next.js 动态页面发送禁止缓存的响应，OpenResty/CDN 必须尊重该响应，不对 `/x` 设置强制页面缓存；HTML 和带查询参数的 RSC 请求均适用。如已有强制缓存，应移除相应规则并清理该路径旧缓存。其他页面缓存策略不变。

生产验收至少覆盖文件更新后刷新、空数组、损坏后恢复、容器重建后数据保留及实际域名缓存。未执行的场景不能表述为验收通过。运行机制见[导航架构](../architecture/navigation.md)，源码与本地检查记录见[X 页面实施计划](../../plans/2026-09-14_X页面运行时JSON数据计划.md)。
