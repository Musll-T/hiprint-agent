# HiPrint Agent 运维手册

## 1. 安装部署

### 系统要求

| 要求 | 最低配置 | 推荐配置 |
|------|----------|----------|
| 操作系统 | Ubuntu 20.04+ / Debian 11+ / CentOS 8+ | Ubuntu 22.04 LTS |
| Node.js | >= 20.0.0 | 20 LTS |
| 内存 | 1GB | 2GB+ |
| 磁盘 | 2GB（含 Chromium） | 5GB+ |
| CUPS | 已安装 `cups-client` | cups + cups-client |

### Docker 部署（推荐）

Docker 部署是最简单的方式，镜像基于 Playwright 官方镜像，已包含 Chromium 浏览器和 CJK 字体。

**1. 准备配置文件**

在部署目录创建 `config.json`：

```bash
mkdir -p /opt/hiprint-agent && cd /opt/hiprint-agent

cat > config.json << 'EOF'
{
  "port": 17521,
  "adminPort": 17522,
  "token": "your-secret-token",
  "ipWhitelist": [],
  "renderConcurrency": 4,
  "printConcurrency": 2,
  "maxQueueSize": 1000,
  "renderTimeout": 30000,
  "printTimeout": 10000,
  "logLevel": "info",
  "logDir": "./logs",
  "dbPath": "./data/hiprint.db",
  "pdfDir": "./data/pdf",
  "defaultPrinter": "",
  "browserPoolSize": 4,
  "pageReuseLimit": 50,
  "jobRetentionDays": 30,
  "allowEIO3": true,
  "cors": {
    "origin": "*",
    "methods": ["GET", "POST"]
  }
}
EOF
```

**2. 使用 Docker Compose 启动**

将项目中的 `deploy/docker-compose.yml` 复制到部署目录，或直接使用以下命令：

```bash
# 构建并启动
docker-compose -f deploy/docker-compose.yml up -d

# 查看运行状态
docker-compose -f deploy/docker-compose.yml ps

# 查看日志
docker-compose -f deploy/docker-compose.yml logs -f
```

**3. 访问宿主机 CUPS 打印服务**

默认情况下，Docker 容器无法访问宿主机的 CUPS 服务。有两种方式解决：

方式一：挂载 CUPS socket（推荐）

```yaml
# 在 docker-compose.yml 的 volumes 中取消注释：
volumes:
  - /var/run/cups:/var/run/cups
```

方式二：使用 host 网络模式

```yaml
# 注释 ports 配置，改为：
network_mode: host
```

**4. 验证部署**

```bash
# 健康检查
curl http://localhost:17522/health

# 预期输出：
# {"status":"ok","uptime":12.345,"version":"1.0.0","timestamp":"2026-02-19T..."}

# 查看打印机列表
curl http://localhost:17522/api/printers
```

### systemd 部署

适用于直接在 Linux 服务器上部署（无 Docker）。

**1. 创建服务用户**

```bash
sudo useradd -r -s /sbin/nologin -d /opt/hiprint-agent hiprint
```

**2. 安装项目**

```bash
# 创建目录
sudo mkdir -p /opt/hiprint-agent
sudo chown hiprint:hiprint /opt/hiprint-agent

# 复制项目文件
sudo cp -r . /opt/hiprint-agent/
cd /opt/hiprint-agent

# 安装依赖
sudo -u hiprint npm install --production

# 安装 Playwright Chromium
sudo -u hiprint npx playwright install chromium
sudo npx playwright install-deps chromium
```

**3. 准备配置**

```bash
# 编辑配置文件
sudo -u hiprint vi /opt/hiprint-agent/config.json

# 创建日志目录
sudo mkdir -p /var/log/hiprint-agent
sudo chown hiprint:hiprint /var/log/hiprint-agent

# 创建数据目录
sudo -u hiprint mkdir -p /opt/hiprint-agent/data
```

**4. 安装 systemd 服务**

```bash
# 复制服务文件
sudo cp deploy/hiprint-agent.service /etc/systemd/system/

# 重新加载 systemd
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable hiprint-agent

# 启动服务
sudo systemctl start hiprint-agent

# 查看状态
sudo systemctl status hiprint-agent
```

**5. 查看服务日志**

```bash
# 通过 systemd journal
journalctl -u hiprint-agent -f

# 通过日志文件
tail -f /var/log/hiprint-agent/stdout.log
```

### 手动部署（开发/测试）

```bash
cd /path/to/hiprint-agent

# 安装依赖
npm install

# 安装浏览器
npx playwright install chromium

# 启动服务
node src/index.js
```

---

## 2. CUPS 打印系统配置

HiPrint Agent 通过 CUPS（Common UNIX Printing System）与打印机交互。服务内部调用 `lpstat`、`lp`、`cancel` 等 CUPS 客户端命令。

### 安装 CUPS

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y cups cups-client

# CentOS / RHEL / Fedora
sudo dnf install -y cups

# 启动并设置开机自启
sudo systemctl enable cups
sudo systemctl start cups
```

### 查看已有打印机

```bash
# 列出所有打印机及其状态
lpstat -p -d

# 仅列出打印机名称
lpstat -e

# 列出可用的打印机设备（用于添加新打印机）
lpinfo -v
```

### 添加网络打印机（IPP 协议）

```bash
# 语法: lpadmin -p <名称> -E -v <URI> -m <驱动>
# -p: 打印机名称（自定义，不含空格）
# -E: 立即启用
# -v: 打印机 URI
# -m: 驱动模型（everywhere = 无驱动打印/IPP Everywhere）

# IPP 打印机
lpadmin -p MyPrinter -E -v ipp://192.168.1.100/ipp/print -m everywhere

# IPPS（加密）打印机
lpadmin -p SecurePrinter -E -v ipps://192.168.1.100/ipp/print -m everywhere

# Socket/JetDirect 协议（HP 打印机常用）
lpadmin -p HP_Printer -E -v socket://192.168.1.100:9100 -m everywhere

# LPD 协议
lpadmin -p LPD_Printer -E -v lpd://192.168.1.100/queue -m everywhere
```

### 添加 USB 打印机

```bash
# 1. 列出已连接的 USB 设备
lpinfo -v | grep usb

# 输出类似：
# direct usb://Brother/HL-L2350DW?serial=U12345

# 2. 添加打印机
lpadmin -p Brother_HL -E -v "usb://Brother/HL-L2350DW?serial=U12345" -m everywhere

# 如果 everywhere 驱动不兼容，查找可用驱动：
lpinfo --make-and-model "Brother" -m
# 然后用具体驱动替换 everywhere
```

### 设置默认打印机

```bash
# 设置系统默认打印机
lpoptions -d MyPrinter

# 验证
lpstat -d
# 输出: system default destination: MyPrinter
```

### 测试打印

```bash
# 打印文本
echo "HiPrint Agent 测试页" | lp -d MyPrinter

# 打印文件
lp -d MyPrinter /path/to/test.pdf

# 打印带选项
lp -d MyPrinter -o media=A4 -o landscape /path/to/test.pdf
```

### 管理打印队列

```bash
# 查看所有打印队列中的任务
lpstat -o

# 查看指定打印机的队列
lpstat -o MyPrinter

# 取消指定任务
cancel MyPrinter-42

# 取消某打印机上的所有任务
cancel -a MyPrinter

# 暂停打印机
cupsdisable MyPrinter

# 恢复打印机
cupsenable MyPrinter
```

### 删除打印机

```bash
# 删除指定打印机
lpadmin -x MyPrinter
```

### Docker 环境中使用 CUPS

在 Docker 容器内，需要连接到宿主机或远程 CUPS 服务：

```bash
# 方式一：通过 CUPS socket（docker-compose.yml 中挂载 /var/run/cups）
# 容器内自动识别宿主机的打印机

# 方式二：配置远程 CUPS 服务器
# 在容器内创建 /etc/cups/client.conf
echo "ServerName cups-server.example.com" > /etc/cups/client.conf
```

---

## 3. 配置说明

配置文件位于项目根目录 `config.json`，以下是所有配置项的详细说明：

### 配置字段

| 字段 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `port` | number | `17521` | 1024-65535 | Socket.IO Gateway 监听端口 |
| `adminPort` | number | `17522` | 1024-65535 | Admin Web 管理面板端口 |
| `token` | string | `""` | - | 认证 Token，为空时跳过认证 |
| `ipWhitelist` | string[] | `[]` | - | IP 白名单，为空时不限制 |
| `renderConcurrency` | number | `4` | 1-20 | Playwright 渲染并发数 |
| `printConcurrency` | number | `2` | 1-20 | CUPS 打印并发数 |
| `maxQueueSize` | number | `1000` | 1-10000 | 最大任务队列大小 |
| `renderTimeout` | number | `30000` | - | 渲染超时时间（毫秒） |
| `printTimeout` | number | `10000` | - | 打印超时时间（毫秒） |
| `logLevel` | string | `"info"` | trace/debug/info/warn/error/fatal | 日志级别 |
| `logDir` | string | `"./logs"` | - | 日志文件目录 |
| `dbPath` | string | `"./data/hiprint.db"` | - | SQLite 数据库文件路径 |
| `pdfDir` | string | `"./data/pdf"` | - | PDF 临时文件目录 |
| `defaultPrinter` | string | `""` | - | 默认打印机名称，为空时使用系统默认 |
| `browserPoolSize` | number | `4` | 1-20 | Chromium 浏览器实例池大小 |
| `pageReuseLimit` | number | `50` | - | 单个浏览器页面最大复用次数 |
| `jobRetentionDays` | number | `30` | - | 历史任务保留天数 |
| `allowEIO3` | boolean | `true` | - | 是否兼容 EIO3 协议（socket.io v2 客户端） |
| `cors` | object | `{"origin":"*","methods":["GET","POST"]}` | - | CORS 跨域配置 |

### 配置调优建议

**低配服务器（1-2 核 CPU，1GB 内存）：**

```json
{
  "renderConcurrency": 1,
  "printConcurrency": 1,
  "browserPoolSize": 1,
  "maxQueueSize": 100,
  "renderTimeout": 60000
}
```

**标准服务器（4 核 CPU，4GB 内存）：**

```json
{
  "renderConcurrency": 4,
  "printConcurrency": 2,
  "browserPoolSize": 4,
  "maxQueueSize": 1000,
  "renderTimeout": 30000
}
```

**高负载服务器（8+ 核 CPU，8GB+ 内存）：**

```json
{
  "renderConcurrency": 8,
  "printConcurrency": 4,
  "browserPoolSize": 8,
  "maxQueueSize": 5000,
  "renderTimeout": 20000
}
```

**关键参数关系：**

- `browserPoolSize` 建议等于或略大于 `renderConcurrency`，避免渲染队列等待浏览器实例
- `printConcurrency` 一般设为 `renderConcurrency` 的 1/2 到 1/1，因打印通常比渲染快
- `pageReuseLimit` 过大可能导致内存泄漏，过小会频繁创建页面影响性能
- `maxQueueSize` 应根据服务器可用内存设置，每个队列中的任务占用少量内存

### 生产环境安全配置

```json
{
  "token": "a-strong-random-token-here",
  "ipWhitelist": ["192.168.1.0/24", "10.0.0.1"],
  "cors": {
    "origin": "https://your-app.example.com",
    "methods": ["GET", "POST"]
  },
  "logLevel": "warn"
}
```

---

## 4. 故障排查

### 4.1 打印机相关问题

#### 打印机离线 / 未找到

**症状：** `error` 事件返回 "未指定打印机且未找到系统默认打印机"

**排查步骤：**

```bash
# 1. 检查 CUPS 服务是否运行
systemctl status cups

# 2. 列出所有打印机
lpstat -p -d

# 3. 检查打印机是否启用
lpstat -p MyPrinter
# 如果输出包含 "disabled"，启用它：
cupsenable MyPrinter

# 4. 检查 CUPS 是否能发现网络打印机
lpinfo -v

# 5. 查看 CUPS 错误日志
tail -f /var/log/cups/error_log
```

#### 打印任务卡在队列中

**症状：** 任务提交成功但不出纸

```bash
# 1. 查看打印队列
lpstat -o

# 2. 查看指定打印机的详细状态
lpstat -p MyPrinter -l

# 3. 如果队列堵塞，清空所有任务
cancel -a MyPrinter

# 4. 重启打印机
cupsdisable MyPrinter && cupsenable MyPrinter

# 5. 直接用 lp 命令测试
echo "test" | lp -d MyPrinter
```

#### 缺纸 / 卡纸

**症状：** 打印机状态显示为 `stopped`（status = 2）

```bash
# 1. 查看打印机状态消息
lpstat -p MyPrinter
# 输出类似: "printer MyPrinter disabled since ... - media-empty"

# 2. 处理完物理问题后，恢复打印机
cupsenable MyPrinter

# 3. 如果有积压任务需要重新打印
# 通过 Admin API 重试失败的任务
curl -X POST http://localhost:17522/api/jobs/<jobId>/retry
```

#### 中文/CJK 字体缺失

**症状：** 打印内容中中文显示为方块或空白

```bash
# 安装 CJK 字体
sudo apt install -y fonts-noto-cjk fonts-noto-cjk-extra

# 刷新字体缓存
fc-cache -fv

# 验证字体已安装
fc-list :lang=zh
```

> Docker 镜像中已包含 `fonts-noto-cjk` 和 `fonts-noto-cjk-extra`，无需额外安装。

### 4.2 服务相关问题

#### 端口被占用

**症状：** 启动时报错 `EADDRINUSE`

```bash
# 1. 查找占用端口的进程
lsof -i :17521
lsof -i :17522

# 或
ss -tlnp | grep -E '17521|17522'

# 2. 终止占用进程
kill -9 <PID>

# 3. 或修改 config.json 中的端口
```

#### Chromium 启动失败

**症状：** 渲染任务全部失败，日志中出现 "Failed to launch chromium"

```bash
# 1. 检查 Chromium 是否已安装
npx playwright install chromium

# 2. 安装系统依赖
npx playwright install-deps chromium

# 3. 手动测试 Chromium 是否可启动
node -e "
  const { chromium } = require('playwright');
  (async () => {
    const browser = await chromium.launch();
    console.log('Chromium 启动成功，版本:', browser.version());
    await browser.close();
  })().catch(console.error);
"

# 4. Docker 环境下检查 /dev/shm 大小
df -h /dev/shm
# 如果太小（默认 64MB），在 docker-compose.yml 中添加：
# shm_size: '2gb'
```

#### 内存不足（OOM）

**症状：** 进程被系统 kill，`dmesg` 中出现 OOM 记录

```bash
# 1. 检查当前内存使用
free -h

# 2. 查看 OOM 日志
dmesg | grep -i "out of memory"
dmesg | grep -i "oom"

# 3. 调整配置降低内存使用
# 减少浏览器实例数和并发数
```

降低内存使用的配置建议：

```json
{
  "browserPoolSize": 1,
  "renderConcurrency": 1,
  "pageReuseLimit": 20,
  "maxQueueSize": 100
}
```

如果使用 systemd，可在服务文件中限制内存：

```ini
# /etc/systemd/system/hiprint-agent.service
[Service]
MemoryMax=2G
```

#### 数据库锁定

**症状：** 日志出现 "SQLITE_BUSY" 错误

```bash
# 1. 检查是否有其他进程打开了数据库
fuser /opt/hiprint-agent/data/hiprint.db

# 2. 检查数据库完整性
sqlite3 /opt/hiprint-agent/data/hiprint.db "PRAGMA integrity_check;"

# 3. 检查 WAL 文件状态
ls -la /opt/hiprint-agent/data/hiprint.db*
# 正常应有: hiprint.db, hiprint.db-wal, hiprint.db-shm

# 4. 如果 WAL 文件过大，强制 checkpoint
sqlite3 /opt/hiprint-agent/data/hiprint.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

#### 进程异常退出

**症状：** 服务自动重启，日志中有 `uncaughtException` 或 `unhandledRejection`

```bash
# 1. 查看错误日志
journalctl -u hiprint-agent --since "1 hour ago" | grep -i error

# 或
grep -i "fatal\|error" /var/log/hiprint-agent/stderr.log

# 2. 检查 Node.js 版本
node --version
# 必须 >= 20.0.0

# 3. 重启服务
sudo systemctl restart hiprint-agent
```

---

## 5. 日志查看与分析

### 日志框架

HiPrint Agent 使用 [pino](https://github.com/pinojs/pino) 作为日志框架：

- 生产环境：输出 JSON 格式日志（高性能，便于日志采集）
- 开发环境：自动启用 `pino-pretty` 彩色美化输出
- 日志级别通过 `config.logLevel` 控制

### 日志级别

| 级别 | 说明 | 使用场景 |
|------|------|----------|
| `trace` | 最详细 | 极端调试场景 |
| `debug` | 调试信息 | 开发调试，含分片详情、CUPS 命令参数 |
| `info` | 常规信息 | 生产默认级别，含任务提交/完成/启动关闭 |
| `warn` | 警告 | Token 认证失败、CUPS 命令失败、IP 被拒绝 |
| `error` | 错误 | 渲染失败、打印失败、请求处理异常 |
| `fatal` | 致命 | 未捕获异常、未处理 Promise 拒绝 |

### 日志位置

| 部署方式 | 日志位置 |
|----------|----------|
| systemd | `/var/log/hiprint-agent/stdout.log`、`/var/log/hiprint-agent/stderr.log` |
| systemd journal | `journalctl -u hiprint-agent` |
| Docker | `docker logs hiprint-agent` 或挂载的 `/app/logs` 目录 |
| 手动运行 | 标准输出（终端） |

### 生产环境日志格式（JSON）

```json
{"level":30,"time":"2026-02-19T10:30:00.000Z","msg":"收到打印任务: news","socketId":"abc123","printer":"HP_LaserJet","templateId":"invoice-001"}
{"level":30,"time":"2026-02-19T10:30:01.500Z","msg":"渲染完成，PDF 已保存","jobId":"019436a2-...","pdfPath":"./data/pdf/019436a2-....pdf"}
{"level":30,"time":"2026-02-19T10:30:02.200Z","msg":"打印完成","jobId":"019436a2-...","printer":"HP_LaserJet","printDuration":700}
```

### 常见日志关键字

| 关键字 | 含义 | 日志级别 |
|--------|------|----------|
| `新客户端连接` | Socket.IO 客户端连接成功 | info |
| `客户端断开连接` | Socket.IO 客户端断开 | info |
| `客户端 Token 认证失败` | Token 校验失败 | warn |
| `客户端 IP 不在白名单中` | IP 被拒绝 | warn |
| `收到打印任务: news` | 收到常规打印请求 | info |
| `收到分片: printByFragments` | 收到分片数据 | debug |
| `分片合并完成，提交打印` | 所有分片到齐 | info |
| `任务已提交` | Job Manager 接受任务 | info |
| `渲染完成，PDF 已保存` | Playwright 渲染成功 | debug |
| `打印完成` | CUPS 打印成功 | info |
| `渲染失败` | Playwright 渲染出错 | error |
| `渲染超时` | 渲染超过 renderTimeout | warn |
| `打印失败，准备重试` | 打印失败，将自动重试 | warn |
| `打印失败，已达最大重试次数` | 打印彻底失败 | error |
| `队列已满` | 任务队列达到上限 | error |
| `命令不存在，可能未安装 CUPS` | CUPS 客户端未安装 | warn |

### 使用 jq 分析 JSON 日志

```bash
# 过滤 error 级别的日志（level >= 50）
cat stdout.log | jq 'select(.level >= 50)'

# 查看所有打印失败的任务
cat stdout.log | jq 'select(.msg | contains("打印失败"))'

# 统计每小时的任务提交数
cat stdout.log | jq -r 'select(.msg == "任务已提交") | .time' | \
  cut -d'T' -f2 | cut -d':' -f1 | sort | uniq -c

# 查看特定 jobId 的所有日志
cat stdout.log | jq 'select(.jobId == "019436a2-...")'
```

---

## 6. 监控

### 健康检查端点

**GET /health** （Admin Web 端口 17522）

```bash
curl http://localhost:17522/health
```

响应示例：

```json
{
  "status": "ok",
  "uptime": 86400.123,
  "version": "1.0.0",
  "timestamp": "2026-02-19T10:30:00.000Z"
}
```

适用场景：
- Docker 健康检查（已在 docker-compose.yml 中配置）
- Kubernetes livenessProbe
- 负载均衡器健康探测

### 状态概览端点

**GET /api/status** （Admin Web 端口 17522）

```bash
curl http://localhost:17522/api/status
```

响应示例：

```json
{
  "system": {
    "hostname": "print-server-01",
    "version": "1.0.0",
    "platform": "linux",
    "arch": "x64",
    "cpuModel": "Intel(R) Xeon(R) CPU E5-2680 v4",
    "cpuCount": 4,
    "totalMem": 8589934592,
    "freeMem": 4294967296,
    "uptime": 86400
  },
  "jobs": {
    "received": 5,
    "rendering": 2,
    "printing": 1,
    "done": 1500,
    "failed_render": 3,
    "failed_print": 2,
    "canceled": 0,
    "timeout": 1,
    "queueSize": 7,
    "renderPending": 4,
    "printPending": 1
  },
  "connections": 3,
  "uptime": 86400.123
}
```

### Prometheus 指标端点

**GET /metrics** （Admin Web 端口 17522）

```bash
curl http://localhost:17522/metrics
```

响应示例（Prometheus exposition format）：

```
# HELP hiprint_jobs_total Total number of jobs by status
# TYPE hiprint_jobs_total gauge
hiprint_jobs_total{status="received"} 5
hiprint_jobs_total{status="rendering"} 2
hiprint_jobs_total{status="printing"} 1
hiprint_jobs_total{status="done"} 1500
hiprint_jobs_total{status="failed_render"} 3
hiprint_jobs_total{status="failed_print"} 2
hiprint_jobs_total{status="canceled"} 0
hiprint_jobs_total{status="timeout"} 1
# HELP hiprint_queue_size Current queue size
# TYPE hiprint_queue_size gauge
hiprint_render_queue_size 4
hiprint_print_queue_size 1
# HELP hiprint_uptime_seconds Process uptime in seconds
# TYPE hiprint_uptime_seconds gauge
hiprint_uptime_seconds 86400
```

### Prometheus 抓取配置

在 `prometheus.yml` 中添加：

```yaml
scrape_configs:
  - job_name: 'hiprint-agent'
    scrape_interval: 15s
    static_configs:
      - targets: ['print-server-01:17522']
    metrics_path: '/metrics'
```

### Grafana Dashboard 建议

推荐创建以下面板：

| 面板 | 指标 | 类型 | 说明 |
|------|------|------|------|
| 任务成功率 | `hiprint_jobs_total{status="done"}` / 总量 | Gauge | 打印成功占比 |
| 队列深度 | `hiprint_render_queue_size` + `hiprint_print_queue_size` | 时序图 | 实时队列负载 |
| 失败任务数 | `hiprint_jobs_total{status=~"failed.*"}` | 时序图 | 渲染和打印失败趋势 |
| 超时任务数 | `hiprint_jobs_total{status="timeout"}` | 时序图 | 渲染超时趋势 |
| 服务在线时长 | `hiprint_uptime_seconds` | Stat | 服务连续运行时间 |

### 告警规则建议

```yaml
# Prometheus alerting rules
groups:
  - name: hiprint-agent
    rules:
      - alert: HiPrintAgentDown
        expr: up{job="hiprint-agent"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "HiPrint Agent 服务不可达"

      - alert: HiPrintQueueBacklog
        expr: hiprint_render_queue_size + hiprint_print_queue_size > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "打印队列积压超过 100"

      - alert: HiPrintHighFailureRate
        expr: rate(hiprint_jobs_total{status=~"failed.*"}[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "打印失败率过高"
```

---

## 7. 备份与恢复

### 需要备份的数据

| 文件/目录 | 说明 | 备份优先级 |
|-----------|------|-----------|
| `config.json` | 服务配置文件 | 高 |
| `data/hiprint.db` | SQLite 数据库（任务记录和审计日志） | 中 |
| `data/hiprint.db-wal` | WAL 日志文件（与主数据库一起备份） | 中 |

### 数据库备份

```bash
# 方式一：使用 SQLite 的 .backup 命令（在线安全备份）
sqlite3 /opt/hiprint-agent/data/hiprint.db ".backup /backup/hiprint-$(date +%Y%m%d).db"

# 方式二：直接复制文件（需确保没有写入操作）
# 先执行 checkpoint 确保 WAL 内容写入主数据库
sqlite3 /opt/hiprint-agent/data/hiprint.db "PRAGMA wal_checkpoint(TRUNCATE);"
cp /opt/hiprint-agent/data/hiprint.db /backup/hiprint-$(date +%Y%m%d).db
```

### 配置备份

```bash
cp /opt/hiprint-agent/config.json /backup/config-$(date +%Y%m%d).json
```

### 自动备份脚本

```bash
#!/bin/bash
# /opt/hiprint-agent/scripts/backup.sh

BACKUP_DIR="/backup/hiprint"
DB_PATH="/opt/hiprint-agent/data/hiprint.db"
CONFIG_PATH="/opt/hiprint-agent/config.json"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# 备份数据库
sqlite3 "$DB_PATH" ".backup ${BACKUP_DIR}/hiprint-${DATE}.db"

# 备份配置
cp "$CONFIG_PATH" "${BACKUP_DIR}/config-${DATE}.json"

# 清理过期备份
find "$BACKUP_DIR" -name "*.db" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "*.json" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] 备份完成: hiprint-${DATE}"
```

设置 crontab 定时执行：

```bash
# 每天凌晨 3 点执行备份
0 3 * * * /opt/hiprint-agent/scripts/backup.sh >> /var/log/hiprint-backup.log 2>&1
```

### 恢复

```bash
# 1. 停止服务
sudo systemctl stop hiprint-agent

# 2. 恢复数据库
cp /backup/hiprint-20260219.db /opt/hiprint-agent/data/hiprint.db

# 3. 恢复配置
cp /backup/config-20260219.json /opt/hiprint-agent/config.json

# 4. 修正文件权限
chown hiprint:hiprint /opt/hiprint-agent/data/hiprint.db
chown hiprint:hiprint /opt/hiprint-agent/config.json

# 5. 启动服务
sudo systemctl start hiprint-agent
```

---

## 8. 升级

### Docker 镜像升级

```bash
cd /opt/hiprint-agent

# 1. 备份当前数据
./scripts/backup.sh

# 2. 拉取新镜像 / 重新构建
docker-compose -f deploy/docker-compose.yml build --no-cache

# 3. 滚动更新（停旧启新）
docker-compose -f deploy/docker-compose.yml up -d

# 4. 验证
curl http://localhost:17522/health
docker-compose -f deploy/docker-compose.yml logs --tail=50
```

### systemd 服务升级

```bash
# 1. 备份
/opt/hiprint-agent/scripts/backup.sh

# 2. 停止服务
sudo systemctl stop hiprint-agent

# 3. 更新代码
cd /opt/hiprint-agent
sudo -u hiprint git pull origin main
# 或手动复制新版本文件

# 4. 更新依赖
sudo -u hiprint npm install --production

# 5. 更新 Playwright（如有新版本）
sudo -u hiprint npx playwright install chromium

# 6. 检查配置文件是否有新增字段
# 对比 config.json.example 与当前 config.json

# 7. 更新 systemd 服务文件（如有变更）
sudo cp deploy/hiprint-agent.service /etc/systemd/system/
sudo systemctl daemon-reload

# 8. 启动服务
sudo systemctl start hiprint-agent

# 9. 验证
sudo systemctl status hiprint-agent
curl http://localhost:17522/health
```

### 回滚

如果升级后出现问题：

```bash
# 1. 停止服务
sudo systemctl stop hiprint-agent

# 2. 恢复旧版代码和数据
# 参考"恢复"章节

# 3. 重启
sudo systemctl start hiprint-agent
```

---

## 9. Admin Web 管理 API

Admin Web 运行在 `config.adminPort`（默认 17522）端口，提供以下 REST API：

### API 端点一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/status` | 系统状态概览 |
| GET | `/api/printers` | 获取打印机列表 |
| GET | `/api/jobs` | 分页查询任务列表 |
| GET | `/api/jobs/:id` | 获取任务详情 |
| POST | `/api/jobs/:id/cancel` | 取消任务 |
| POST | `/api/jobs/:id/retry` | 重试失败任务 |
| GET | `/metrics` | Prometheus 指标 |

### 查询任务列表

```bash
# 查询最近 50 条任务
curl http://localhost:17522/api/jobs

# 按状态过滤
curl "http://localhost:17522/api/jobs?status=failed_print"

# 分页查询
curl "http://localhost:17522/api/jobs?limit=20&offset=40"
```

### 取消任务

```bash
# 仅可取消 received 或 rendering 状态的任务
curl -X POST http://localhost:17522/api/jobs/<jobId>/cancel
```

### 重试失败任务

```bash
# 仅可重试 failed_render 或 failed_print 状态的任务
curl -X POST http://localhost:17522/api/jobs/<jobId>/retry
```
