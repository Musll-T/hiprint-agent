[根目录](../CLAUDE.md) > **hiprint-agent**

# hiprint-agent

## 模块职责

基于 Node.js 20 的无头（Headless）打印服务，作为 electron-hiprint 的 Linux 服务器端替代方案。去除所有 Electron/GUI 依赖，使用 Playwright Chromium 进行 HTML 渲染，通过 CUPS 命令行（`lp`/`lpstat`/`cancel`）与打印机交互。提供 Socket.IO Gateway（端口 17521）兼容 vue-plugin-hiprint 的完整连接协议，以及 Admin Web（端口 17522）提供管理面板和 REST API。

## 入口与启动

- **主入口**：`src/index.js` -- 应用主启动函数，按顺序初始化配置、日志、数据库、浏览器池、打印适配器、Job Manager、Socket Gateway、Admin Web
- **npm 启动命令**：`npm run start` -- 等价于 `node src/index.js`
- **配置文件**：`config.json` -- JSON 格式运行时配置

### 启动流程

1. `loadConfig()` 加载并校验 `config.json`
2. `initLogger(config)` 初始化 pino 日志系统
3. `initDB(config.dbPath)` 初始化 SQLite 数据库（WAL 模式）
4. `createBrowserPool()` 启动 Playwright Chromium 浏览器池
5. `createPrinterAdapter()` 初始化 CUPS 打印适配器
6. `createJobManager()` 初始化任务调度器（渲染队列 + 打印队列）
7. `createGateway()` 启动 Socket.IO Gateway（:17521）
8. `createAdminWeb()` 启动 Admin Web 服务（:17522）
9. 启动定时清理过期任务（每 6 小时，保留天数可配置）
10. 注册 SIGINT/SIGTERM 优雅关闭处理

### 优雅关闭

收到 SIGINT/SIGTERM 信号后，按逆序关闭：Admin Web -> Socket Gateway -> Job Manager -> Browser Pool -> DB。

## 对外接口

### Socket.IO Gateway（端口 17521）

完全兼容 electron-hiprint 的 Socket.IO 协议，详见 `docs/protocol.md`。

**服务端 -> 客户端事件：**

| 事件名 | 说明 |
|--------|------|
| `printerList` | 推送 CUPS 打印机列表（兼容 electron-hiprint 格式） |
| `clientInfo` | 推送 Agent 系统信息（hostname/version/ip/mac 等） |
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

### Admin Web REST API（端口 17522）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/status` | 系统状态概览（CPU/内存/队列/连接数） |
| GET | `/api/printers` | 获取打印机列表 |
| GET | `/api/jobs` | 分页查询任务（支持 `?status=&limit=&offset=` 参数） |
| GET | `/api/jobs/:id` | 获取任务详情 |
| POST | `/api/jobs/:id/cancel` | 取消任务（仅 received/rendering 状态） |
| POST | `/api/jobs/:id/retry` | 重试失败任务（仅 failed_render/failed_print 状态） |
| GET | `/metrics` | Prometheus 指标 |

### Admin WebSocket

Admin Web 在同一端口挂载 WebSocket，推送 `job:update` / `printer:update` / `sys:stats` 实时事件。

### 认证机制

- Token 认证：`socket.handshake.auth.token` 与 `config.token` 匹配
- Token 为空时跳过认证（开放模式）
- IP 白名单：`config.ipWhitelist` 数组，空数组不限制，支持 IPv4/IPv6

## 关键依赖与配置

### 核心依赖

| 依赖 | 用途 |
|------|------|
| `socket.io@^4.7.0` | Socket.IO 服务端 |
| `express@^4.18.0` | Admin Web HTTP 框架 |
| `better-sqlite3@^11.0.0` | SQLite 数据库（同步 API，WAL 模式） |
| `playwright@^1.49.0` | Headless Chromium 渲染引擎 |
| `pino@^9.0.0` + `pino-pretty@^11.0.0` | 结构化日志 |
| `p-queue@^8.0.0` | 并发控制队列 |
| `conf@^13.0.0` | 配置管理 |
| `address@^2.0.0` | 网络地址获取 |
| `uuid@^11.0.0` | UUID v7 生成 |
| `dayjs@^1.11.0` | 日期处理 |

### 配置项（`config.json`）

| 字段 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `port` | number | 17521 | 1024-65535 | Socket.IO Gateway 端口 |
| `adminPort` | number | 17522 | 1024-65535 | Admin Web 端口 |
| `token` | string | "" | - | 认证 Token，空则跳过认证 |
| `ipWhitelist` | string[] | [] | - | IP 白名单，空则不限制 |
| `renderConcurrency` | number | 4 | 1-20 | Playwright 渲染并发数 |
| `printConcurrency` | number | 2 | 1-20 | CUPS 打印并发数 |
| `maxQueueSize` | number | 1000 | 1-10000 | 最大任务队列 |
| `renderTimeout` | number | 30000 | - | 渲染超时（ms） |
| `printTimeout` | number | 10000 | - | 打印超时（ms） |
| `logLevel` | string | "info" | trace-fatal | 日志级别 |
| `logDir` | string | "./logs" | - | 日志目录 |
| `dbPath` | string | "./data/hiprint.db" | - | SQLite 数据库路径 |
| `pdfDir` | string | "./data/pdf" | - | PDF 临时文件目录 |
| `defaultPrinter` | string | "" | - | 默认打印机 |
| `browserPoolSize` | number | 4 | 1-20 | Chromium 页面池大小 |
| `pageReuseLimit` | number | 50 | - | 页面最大复用次数 |
| `jobRetentionDays` | number | 30 | - | 历史任务保留天数 |
| `allowEIO3` | boolean | true | - | 兼容 EIO3 协议 |
| `cors` | object | {"origin":"*"} | - | CORS 配置 |

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
| action | TEXT | 操作类型（create/status_change/cancel/retry） |
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
- **Prometheus 监控**：`GET /metrics` 端点输出标准 Prometheus 格式指标。
- **代码风格**：ES Module（`"type": "module"`），无 lint 配置。
- **Node.js 版本要求**：>= 20.0.0

## 常见问题 (FAQ)

1. **CUPS 未安装**
   CUPS 命令不存在时，打印机列表返回空数组，打印任务会失败并记录警告日志 `命令不存在，可能未安装 CUPS`。

2. **Chromium 启动失败**
   需先执行 `npx playwright install chromium` 和 `npx playwright install-deps chromium` 安装浏览器及系统依赖。Docker 镜像已内置。

3. **中文/CJK 字体缺失**
   Linux 服务器需安装 `fonts-noto-cjk`。Docker 镜像已包含。

4. **`successs` 事件拼写**
   与 electron-hiprint 保持一致的兼容行为，请勿修改。

5. **内存管理**
   每个 Chromium 页面约 80-150MB。通过 `browserPoolSize` 和 `pageReuseLimit` 控制。页面超过复用上限后自动销毁重建。Job Manager 内部有孤儿上下文清理机制（每分钟检查一次）。

6. **IPP 打印**
   Phase 2 预留，当前调用会返回 `IPP 打印功能将在 Phase 2 中实现` 错误。

## 相关文件清单

```
hiprint-agent/
  package.json                       # 项目配置（Node.js 20, ES Module）
  config.json                        # 运行时配置
  src/
    index.js                         # 主入口：按顺序启动所有子系统
    config.js                        # 配置管理：加载/校验/更新/Proxy 只读导出
    logger.js                        # pino 日志：开发环境 pretty，生产环境 JSON
    gateway/
      server.js                      # Socket.IO Gateway 创建与配置
      auth.js                        # Token 认证 + IP 白名单中间件
      events.js                      # 事件注册（对齐 electron-hiprint 命名）
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
      cups.js                        # CUPS 命令封装（lpstat/lp/cancel）
      options.js                     # 打印选项映射（copies/duplex/paper）
    web/
      server.js                      # Express Admin Web 服务
      socket.js                      # Admin WebSocket 推送
      routes/
        health.js                    # GET /health
        status.js                    # GET /api/status
        printers.js                  # GET /api/printers
        jobs.js                      # GET/POST /api/jobs
        metrics.js                   # GET /metrics (Prometheus)
    utils/
      network.js                     # 网络地址获取
      system.js                      # 系统信息采集
      fragments.js                   # 分片任务管理
    public/                          # Admin Web 前端静态资源
      js/app.js                      # Vue 3 前端应用
  deploy/
    docker-compose.yml               # Docker Compose 编排
  docs/
    protocol.md                      # Socket.IO 事件协议文档
    ops.md                           # 运维手册（安装/CUPS/配置/故障排查/监控/备份）
```

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-02-19T11:01:45+08:00 | 初始创建 | 首次扫描生成 hiprint-agent 模块文档 |
