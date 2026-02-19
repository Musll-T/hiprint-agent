[根目录](../CLAUDE.md) > **hiprint-agent**

# hiprint-agent

## 模块职责

基于 Node.js 20 的无头（Headless）打印服务，作为 electron-hiprint 的 Linux 服务器端替代方案。去除所有 Electron/GUI 依赖，使用 Playwright Chromium 进行 HTML 渲染，通过 CUPS 命令行（`lp`/`lpstat`/`lpadmin`/`cupsenable`/`cupsdisable`/`cancel`）与打印机交互。提供 Socket.IO Gateway（端口 17521）兼容 vue-plugin-hiprint 的完整连接协议，支持作为 Socket.IO 客户端连接 node-hiprint-transit 中转服务实现跨网段远程打印，以及 Admin Web（端口 17522）提供管理面板和 REST API，含登录认证、打印机 CRUD 管理、维护诊断工具。支持多 Agent 部署场景（通过 `agentId` 唯一标识）。

## 入口与启动

- **主入口**：`src/index.js` -- 应用主启动函数，按顺序初始化配置、日志、数据库、浏览器池、打印适配器、打印机管理服务、Job Manager、维护服务、Socket Gateway、中转客户端（可选）、Admin Web
- **npm 启动命令**：`npm run start` -- 等价于 `node src/index.js`
- **配置文件**：`config.json` -- JSON 格式运行时配置

### 启动流程

1. `loadConfig()` 加载并校验 `config.json`
2. `initLogger(config)` 初始化 pino 日志系统
3. `initDB(config.dbPath)` 初始化 SQLite 数据库（WAL 模式）
4. `createBrowserPool()` 启动 Playwright Chromium 浏览器池
5. `createPrinterAdapter()` 初始化 CUPS 打印适配器
5.5. `createPrinterAdmin()` 初始化打印机管理服务（CRUD 操作）
6. `createJobManager()` 初始化任务调度器（渲染队列 + 打印队列）
6.5. `createMaintenanceService()` 初始化维护服务（诊断/队列清空/CUPS 重启）
7. `createGateway()` 启动 Socket.IO Gateway（:17521），采集系统信息（含 `agentId`）
7.5. `createTransitClient()` 启动中转客户端（可选，需配置 `connectTransit: true`）
8. `createAdminWeb()` 启动 Admin Web 服务（:17522），含登录认证中间件
9. 启动定时清理过期任务（每 6 小时，保留天数可配置），同步清理预览文件
10. 注册 SIGINT/SIGTERM 优雅关闭处理

### 优雅关闭

收到 SIGINT/SIGTERM 信号后，按逆序关闭：Admin Web -> Transit Client -> Socket Gateway -> Job Manager -> Browser Pool -> DB。

## 对外接口

### Socket.IO Gateway（端口 17521）

完全兼容 electron-hiprint 的 Socket.IO 协议。详细协议规范见 `docs/protocol.md`。

**服务端 -> 客户端事件：**

| 事件名 | 说明 |
|--------|------|
| `printerList` | 推送 CUPS 打印机列表（兼容 electron-hiprint 格式，含 agentId/agentHost/agentIp 来源标识） |
| `clientInfo` | 推送 Agent 系统信息（hostname/version/ip/mac/machineId/agentId 等） |
| `success` | 打印任务成功 |
| `successs` | 兼容旧版 vue-plugin-hiprint 拼写错误，与 `success` 同时触发 |
| `error` | 打印任务失败 |
| `render-jpeg-success` / `render-jpeg-error` | JPEG 渲染结果 |
| `render-pdf-success` / `render-pdf-error` | PDF 渲染结果 |
| `render-print-error` | 渲染后打印失败 |

**客户端 -> 服务端事件：**

| 事件名 | 说明 |
|--------|------|
| `news` | 提交 HTML/PDF 打印任务 |
| `printByFragments` | 分片传输大型内容 |
| `render-print` | 渲染后直接打印 |
| `render-jpeg` | 渲染为 JPEG 截图 |
| `render-pdf` | 渲染为 PDF |
| `getClientInfo` | 请求系统信息 |
| `refreshPrinterList` | 请求刷新打印机列表 |
| `ippPrint` / `ippRequest` | Phase 2 预留，当前返回未实现错误 |

### 打印机列表增强（多 Agent 部署）

在多 Agent 部署场景下，通过 `enrichPrinterList()` 函数（`src/gateway/events.js`）为每台打印机注入来源标识：

| 增强字段 | 来源 | 说明 |
|----------|------|------|
| `agentId` | `config.agentId` 或 `machineId` | Agent 唯一标识 |
| `agentHost` | `systemInfo.hostname` | Agent 主机名 |
| `agentIp` | `systemInfo.ip` | Agent IP 地址 |

Web 端可据此在多个 Agent 之间正确路由打印任务。

### Admin Web REST API（端口 17522）

#### 公开端点（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查（返回 status/uptime/version/timestamp） |
| GET | `/metrics` | Prometheus 指标 |
| GET | `/login` | 登录页面（仅认证启用时） |
| POST | `/api/login` | 登录接口（username + password -> session） |

#### 受保护端点（需登录认证，认证未启用时开放访问）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/logout` | 登出（销毁 session） |
| GET | `/api/status` | 系统状态概览（CPU/内存/队列/连接数/中转状态） |
| GET | `/api/printers` | 获取打印机列表 |
| POST | `/api/printers` | 添加打印机（name, deviceUri 必填） |
| PUT | `/api/printers/:name` | 修改打印机配置（description/location/deviceUri） |
| DELETE | `/api/printers/:name` | 删除打印机 |
| POST | `/api/printers/:name/default` | 设为默认打印机 |
| POST | `/api/printers/:name/enable` | 启用打印机 |
| POST | `/api/printers/:name/disable` | 停用打印机 |
| GET | `/api/jobs` | 分页查询任务（支持 `?status=&limit=&offset=` 参数） |
| GET | `/api/jobs/:id` | 获取任务详情 |
| GET | `/api/jobs/:id/preview` | 获取任务 HTML 预览内容 |
| POST | `/api/jobs/:id/cancel` | 取消任务（仅 received/rendering 状态） |
| POST | `/api/jobs/:id/retry` | 重试失败任务（仅 failed_render/failed_print 状态） |
| POST | `/api/maintenance/queues/clear` | 清空所有队列（CUPS + 内部） |
| POST | `/api/maintenance/cups/restart` | 重启 CUPS 服务（systemctl/service 双策略） |
| GET | `/api/maintenance/printers/connectivity` | 检测所有打印机连通性 |
| GET | `/api/maintenance/cups/logs` | 获取 CUPS 错误日志（`?lines=100`，最大 1000） |
| POST | `/api/maintenance/diagnostics` | 一键诊断（CUPS 状态 + 打印机 + 磁盘空间 + 队列） |
| GET | `/api/maintenance/cups/status` | 获取 CUPS 服务状态 |

### Admin WebSocket

Admin Web 在同一端口挂载 WebSocket，推送 `job:update` / `printer:update` / `sys:stats` 实时事件。

### 认证机制

- **Admin Web 登录认证**（可选）：配置 `config.admin` 对象启用
  - 基于 `express-session`，密码使用 `bcryptjs` 哈希存储
  - Session 有效期 24 小时，`httpOnly` cookie
  - `admin.sessionSecret` 未配置时每次重启 session 失效（控制台警告）
  - 认证未配置时以开放模式运行（所有接口无需登录）
- **Socket.IO Token 认证**：`socket.handshake.auth.token` 与 `config.token` 匹配
  - Token 为空时跳过认证（开放模式）
- **IP 白名单**：`config.ipWhitelist` 数组，空数组不限制，支持 IPv4/IPv6

## 关键依赖与配置

### 核心依赖

| 依赖 | 用途 |
|------|------|
| `socket.io@^4.7.0` | Socket.IO 服务端 |
| `socket.io-client@^4.7.0` | Socket.IO 客户端（连接中转服务） |
| `express@^4.18.0` | Admin Web HTTP 框架 |
| `express-session@^1.19.0` | Admin Web 会话管理 |
| `bcryptjs@^3.0.3` | 密码哈希与验证 |
| `better-sqlite3@^11.0.0` | SQLite 数据库（同步 API，WAL 模式） |
| `playwright@^1.49.0` | Headless Chromium 渲染引擎 |
| `pino@^9.0.0` + `pino-pretty@^11.0.0` | 结构化日志 |
| `p-queue@^8.0.0` | 并发控制队列 |
| `conf@^13.0.0` | 配置管理 |
| `address@^2.0.0` | 网络地址获取 |
| `uuid@^11.0.0` | UUID v7 生成 |
| `dayjs@^1.11.0` | 日期处理 |
| `node-machine-id@^1.1.12` | 机器唯一标识（跨平台） |

### 配置项（`config.json`）

| 字段 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `port` | number | 17521 | 1024-65535 | Socket.IO Gateway 端口 |
| `adminPort` | number | 17522 | 1024-65535 | Admin Web 端口 |
| `token` | string | "" | - | Socket.IO 认证 Token，空则跳过认证 |
| `ipWhitelist` | string[] | [] | - | IP 白名单，空则不限制 |
| `agentId` | string | "" | - | Agent 唯一标识。用于多 Agent 部署场景，空时回退到 machineId。中转客户端连接时通过 query.clientId 传递给中转服务 |
| `renderConcurrency` | number | 4 | 1-20 | Playwright 渲染并发数 |
| `printConcurrency` | number | 2 | 1-20 | CUPS 打印并发数 |
| `maxQueueSize` | number | 1000 | 1-10000 | 最大任务队列 |
| `renderTimeout` | number | 30000 | - | 渲染超时（ms） |
| `printTimeout` | number | 10000 | - | 打印超时（ms） |
| `logLevel` | string | "info" | trace-fatal | 日志级别 |
| `logDir` | string | "./logs" | - | 日志目录 |
| `dbPath` | string | "./data/hiprint.db" | - | SQLite 数据库路径 |
| `pdfDir` | string | "./data/pdf" | - | PDF 临时文件目录 |
| `previewDir` | string | "./data/preview" | - | 任务预览 HTML 存放目录 |
| `defaultPrinter` | string | "" | - | 默认打印机 |
| `browserPoolSize` | number | 4 | 1-20 | Chromium 页面池大小 |
| `pageReuseLimit` | number | 50 | - | 页面最大复用次数 |
| `jobRetentionDays` | number | 30 | - | 历史任务保留天数 |
| `allowEIO3` | boolean | true | - | 兼容 EIO3 协议 |
| `cors` | object | {"origin":"*"} | - | CORS 配置 |
| `connectTransit` | boolean | false | - | 是否启用中转客户端 |
| `transitUrl` | string | "" | - | 中转服务地址（如 `http://transit.example.com:17521`） |
| `transitToken` | string | "" | - | 中转服务认证 Token |
| `admin` | object | (无) | - | Admin Web 认证配置（不配置则开放模式） |
| `admin.username` | string | - | - | 管理员用户名 |
| `admin.password` | string | - | - | 管理员密码（bcrypt 哈希） |
| `admin.sessionSecret` | string | (随机) | - | Session 签名密钥（建议固定值） |

## 数据模型

### SQLite 数据库（`src/jobs/store.js`）

数据库路径：`config.dbPath`（默认 `./data/hiprint.db`），启用 WAL 模式。

**表 `jobs`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID v7 |
| status | TEXT | 任务状态（received/rendering/printing/done/failed_render/failed_print/canceled/timeout） |
| printer | TEXT | 目标打印机 |
| template_id | TEXT | 模板 ID |
| type | TEXT | 任务类型（html/pdf/url_pdf/blob_pdf/render_jpeg/render_pdf/render_print） |
| client_id | TEXT | 来源 socketId |
| tenant_id | TEXT | 租户 Token |
| created_at | TEXT | 创建时间（ISO 8601） |
| updated_at | TEXT | 更新时间（ISO 8601） |
| render_duration | INTEGER | 渲染耗时（ms） |
| print_duration | INTEGER | 打印耗时（ms） |
| error_msg | TEXT | 错误信息 |
| html_hash | TEXT | HTML 内容哈希 |
| retry_count | INTEGER | 重试次数（默认 0） |
| page_num | INTEGER | 页数 |

**表 `audit_log`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| job_id | TEXT | 关联任务 ID |
| action | TEXT | 操作类型（create/status_change/cancel/retry/printer_add/printer_remove/printer_update/printer_default/printer_enable/printer_disable/api_clear_queues/api_restart_cups/api_diagnostics/maintenance_*） |
| detail | TEXT | 操作详情 |
| created_at | TEXT | 记录时间 |

**索引**：`idx_jobs_status`、`idx_jobs_created_at`、`idx_jobs_template_id`、`idx_audit_log_job_id`

### 任务状态流转

```
received -> rendering -> printing -> done
    |           |           |
    |           |           +-> failed_print (最多重试 3 次，指数退避 1s/2s/4s)
    |           +-> failed_render
    |           +-> timeout
    +-> canceled
```

## 测试与质量

- **自动化测试**：无。项目未配置测试框架或测试目录。
- **手动测试**：通过 `npm start` 启动后使用 vue-plugin-hiprint 连接 :17521 进行功能验证。
- **Admin API 测试**：通过 `curl http://localhost:17522/health` 验证健康状态。
- **维护诊断**：通过 Admin Web 维护面板运行一键诊断，或 `POST /api/maintenance/diagnostics`。
- **Prometheus 监控**：`GET /metrics` 端点输出标准 Prometheus 格式指标。
- **协议文档**：`docs/protocol.md` 包含完整的 Socket.IO 协议规范、事件定义和通信示例。
- **运维手册**：`docs/ops.md` 包含安装部署、CUPS 配置、故障排查、日志分析、监控、备份恢复、升级指南。
- **代码风格**：ES Module（`"type": "module"`），无 lint 配置。
- **Node.js 版本要求**：>= 20.0.0

## 常见问题 (FAQ)

1. **CUPS 未安装**
   CUPS 命令不存在时，打印机列表返回空数组，打印任务会失败并记录警告日志 `命令不存在，可能未安装 CUPS`。打印机管理操作（添加/删除等）会抛出错误。

2. **Chromium 启动失败**
   需先执行 `npx playwright install chromium` 和 `npx playwright install-deps chromium` 安装浏览器及系统依赖。Docker 镜像已内置。

3. **中文/CJK 字体缺失**
   Linux 服务器需安装 `fonts-noto-cjk`。Docker 镜像和 `install.sh` 脚本已包含。

4. **`successs` 事件拼写**
   与 electron-hiprint 保持一致的兼容行为，请勿修改。

5. **内存管理**
   每个 Chromium 页面约 80-150MB。通过 `browserPoolSize` 和 `pageReuseLimit` 控制。页面超过复用上限后自动销毁重建。Job Manager 内部有孤儿上下文清理机制（每分钟检查一次）。

6. **IPP 打印**
   Phase 2 预留，当前调用会返回 `IPP 打印功能将在 Phase 2 中实现` 错误。

7. **中转客户端连接失败**
   若 `transitToken` 配置错误，中转客户端会在鉴权失败后立即断开并停止重连（记录 fatal 日志）。检查 `config.json` 中的 `transitUrl` 和 `transitToken` 配置。

8. **中转模式与 Server 模式共存**
   启用 `connectTransit` 不影响本地 Socket.IO Gateway(:17521) 的正常运行。两种模式通过 `clientId` 前缀 `transit:` 区分任务来源，回调互不干扰。

9. **Admin 登录密码生成**
   密码使用 bcrypt 哈希存储。可通过 `node -e "import('bcryptjs').then(b=>b.hash('your_password',10).then(console.log))"` 生成哈希值，填入 `config.admin.password`。

10. **Session 失效**
    若未配置 `admin.sessionSecret`，每次服务重启所有已登录用户需重新登录。建议在 `config.json` 中设置固定的 `admin.sessionSecret` 值。

11. **Docker 环境下的机器 ID**
    Docker 容器内不信任系统 `/etc/machine-id`（镜像层共享），自动回退为 `data/machine-id` 持久化 UUID。通过 volume 挂载 `data/` 目录保证唯一性和持久性。

12. **多 Agent 部署的 agentId**
    `config.agentId` 用于在多个 hiprint-agent 实例通过同一中转服务连接时唯一标识每个 Agent。为空时回退到系统 `machineId`。中转客户端连接时通过 `query.clientId` 传递该标识，打印机列表中注入 `agentId`/`agentHost`/`agentIp` 字段供 Web 端路由。

## 相关文件清单

```
hiprint-agent/
  package.json                       # 项目配置（Node.js 20, ES Module）
  config.json                        # 运行时配置（含 admin 认证块、agentId）
  CLAUDE.md                          # 本模块文档
  src/
    index.js                         # 主入口：按顺序启动所有子系统
    config.js                        # 配置管理：加载/校验/更新/Proxy 只读导出
    logger.js                        # pino 日志：开发环境 pretty，生产环境 JSON
    gateway/
      server.js                      # Socket.IO Gateway 创建与配置（含 agentId 采集）
      auth.js                        # Socket.IO Token 认证 + IP 白名单中间件
      events.js                      # 事件注册 + enrichPrinterList()（多 Agent 标识注入）
      transit-client.js              # 中转客户端：连接 node-hiprint-transit 实现远程打印
    jobs/
      manager.js                     # Job Manager：渲染队列 + 打印队列 + 状态机
      store.js                       # better-sqlite3 持久化（jobs + audit_log）
      types.js                       # JobStatus / JobType 枚举 + JSDoc 类型
    renderer/
      pool.js                        # Playwright 浏览器池（页面复用 + 信号量）
      html-to-pdf.js                 # HTML -> PDF 渲染
      html-to-jpeg.js                # HTML -> JPEG 截图
      resources.js                   # 字体/条码/二维码资源注入
    printer/
      adapter.js                     # 打印适配器（面向 Job Manager 的高级接口）
      admin.js                       # 打印机管理服务（CRUD + 输入校验 + 审计日志）
      cups.js                        # CUPS 命令封装（lpstat/lp/lpadmin/cupsenable/cupsdisable/cancel）
      options.js                     # 打印选项映射（copies/duplex/paper）
    maintenance/
      service.js                     # 维护服务（队列清空/CUPS 重启/连通性检测/日志/诊断）
    web/
      server.js                      # Express Admin Web 服务（含 session + bcrypt 登录认证）
      socket.js                      # Admin WebSocket 推送
      middleware/
        auth.js                      # 认证中间件（白名单路径 + session 检查）
      routes/
        health.js                    # GET /health
        status.js                    # GET /api/status（含中转状态）
        printers.js                  # CRUD /api/printers（列表/添加/修改/删除/默认/启停）
        jobs.js                      # GET/POST /api/jobs（含预览端点）
        metrics.js                   # GET /metrics (Prometheus)
        maintenance.js               # POST/GET /api/maintenance/*（维护与诊断）
    utils/
      network.js                     # 网络地址获取
      system.js                      # 系统信息采集（含 machineId + Docker 检测）
      fragments.js                   # 分片任务管理
    public/                          # Admin Web 前端静态资源
      index.html                     # Vue 3 管理面板（暗色主题 + 响应式布局）
      login.html                     # 登录页面
      css/
        custom.css                   # 管理面板主样式（企业级暗色主题 + 移动端适配）
        login.css                    # 登录页样式
      js/
        app.js                       # Vue 3 前端应用（仪表盘/打印机管理/任务/维护/日志）
        login.js                     # 登录页前端逻辑
      vendor/
        .gitkeep                     # 第三方库占位
  deploy/
    Dockerfile                       # 多阶段构建（Playwright 基础镜像 + CUPS + CJK 字体）
    docker-compose.yml               # Docker Compose 编排（volume 持久化 + 健康检查）
    hiprint-agent.service            # systemd 服务单元（安全加固 + 资源限制）
    install.sh                       # Linux 一键安装脚本（Ubuntu/Debian/CentOS/RHEL）
  docs/
    protocol.md                      # Socket.IO 协议文档（事件/认证/Payload/示例/兼容性）
    ops.md                           # 运维手册（部署/CUPS/配置/排障/日志/监控/备份/升级）
```

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-02-19T20:46:42+08:00 | 增量更新 | 新增 agentId 配置项文档（多 Agent 部署唯一标识，config.json + config.js 校验 + server.js/transit-client.js/events.js 使用）；新增 enrichPrinterList 函数说明（打印机列表来源标识注入）；补充 docs/ 目录引用（protocol.md 协议文档 + ops.md 运维手册）；新增 FAQ 第 12 条（多 Agent 部署说明） |
| 2026-02-19T17:56:37+08:00 | 增量更新 | 新增 Admin 登录认证系统（express-session + bcryptjs）；新增打印机 CRUD 管理（admin.js + cups.js 扩展 + printers 路由扩展）；新增维护诊断系统（maintenance/service.js + 路由）；新增 Dockerfile 多阶段构建和 install.sh 一键安装脚本；Admin Web 前端大幅改版为企业级暗色响应式主题；新增任务预览功能；新增 previewDir 和 admin 配置项；依赖新增 bcryptjs/express-session/node-machine-id |
| 2026-02-19T11:58:59+08:00 | 功能新增 | 新增中转客户端模块（transit-client.js）：支持连接 node-hiprint-transit 实现跨网段远程打印；更新配置校验、启动流程、Admin 状态接口 |
| 2026-02-19T11:01:45+08:00 | 初始创建 | 首次扫描生成 hiprint-agent 模块文档 |
