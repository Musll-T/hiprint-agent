# HiPrint Agent Socket.IO 协议文档

## 概述

HiPrint Agent 通过 Socket.IO 提供实时打印通信服务，完全兼容 [vue-plugin-hiprint](https://github.com/CcSimple/vue-plugin-hiprint) 的 `socket.io-client` 连接协议，可作为 electron-hiprint 的 Linux 无头替代方案。

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 端口 | 17521 | Socket.IO Gateway 监听端口 |
| Socket.IO 版本 | 4.x | 服务端使用 Socket.IO 4.7+ |
| EIO3 兼容 | 启用 | `allowEIO3: true`，兼容 socket.io v2.x 客户端 |
| 最大缓冲区 | 100MB | `maxHttpBufferSize: 100 * 1024 * 1024` |
| CORS | `origin: *` | 默认允许所有来源 |
| 认证方式 | Token | 通过 `handshake.auth.token` 携带静态 Token |

---

## 连接

### 连接参数

| 参数 | 位置 | 说明 |
|------|------|------|
| URL | 连接地址 | `http://<host>:17521` |
| auth.token | `handshake.auth` | 认证 Token，需与服务端 `config.token` 一致 |

### 连接示例

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:17521', {
  auth: { token: 'your-token' }
});

socket.on('connect', () => {
  console.log('已连接到 HiPrint Agent');
});

socket.on('connect_error', (err) => {
  console.error('连接失败:', err.message);
  // 可能的错误: 'Authentication error' | 'IP not allowed'
});
```

### 认证流程

1. 客户端在连接时通过 `auth.token` 传递 Token
2. 服务端中间件校验 Token 是否匹配 `config.token`
3. 若 `config.token` 为空字符串，则跳过认证（开放模式）
4. Token 不匹配时，连接被拒绝，客户端收到 `connect_error` 事件

### IP 白名单

- 通过 `config.ipWhitelist` 数组配置允许连接的 IP 地址
- 白名单为空数组 `[]` 时，不做 IP 限制
- 支持 IPv4 和 IPv6 地址，自动处理 `::ffff:` 前缀
- IP 不在白名单中时，连接被拒绝

---

## 服务端 -> 客户端事件

### printerList

推送系统中所有可用的打印机列表。

| 属性 | 说明 |
|------|------|
| 触发时机 | 连接建立后自动推送；客户端发送 `refreshPrinterList` 时响应 |
| 方向 | 服务端 -> 客户端 |

**Payload 结构：**

```json
[
  {
    "name": "HP_LaserJet_Pro",
    "displayName": "HP_LaserJet_Pro",
    "isDefault": true,
    "status": 0,
    "description": "is idle. enabled since ...",
    "options": {}
  },
  {
    "name": "Canon_iR2520",
    "displayName": "Canon_iR2520",
    "isDefault": false,
    "status": 1,
    "description": "now printing HP_LaserJet-42.",
    "options": {}
  }
]
```

**status 字段说明：**

| 值 | 含义 | CUPS 状态 |
|----|------|-----------|
| 0 | 就绪 | idle |
| 1 | 打印中 | printing |
| 2 | 已停止 | stopped / disabled |
| 3 | 未知 | 其他 |

### clientInfo

推送 Agent 服务器的系统信息。

| 属性 | 说明 |
|------|------|
| 触发时机 | 连接建立后自动推送；客户端发送 `getClientInfo` 时响应 |
| 方向 | 服务端 -> 客户端 |

**Payload 结构：**

```json
{
  "hostname": "print-server-01",
  "version": "1.0.0",
  "platform": "linux",
  "arch": "x64",
  "mac": "aa:bb:cc:dd:ee:ff",
  "ip": "192.168.1.100",
  "ipv6": "fe80::1",
  "clientUrl": "http://192.168.1.100:17521"
}
```

### success

打印任务成功完成。

| 属性 | 说明 |
|------|------|
| 触发时机 | 常规打印任务（`news` 事件提交）成功完成时 |
| 方向 | 服务端 -> 客户端 |

**Payload 结构：**

```json
{
  "templateId": "invoice-001",
  "printer": "HP_LaserJet_Pro",
  "jobId": "019436a2-7c8b-7000-8000-000000000001",
  "replyId": "reply-uuid-123"
}
```

### successs

与 `success` 事件完全相同，同时触发。

| 属性 | 说明 |
|------|------|
| 触发时机 | 与 `success` 同时触发 |
| 方向 | 服务端 -> 客户端 |
| Payload | 与 `success` 完全相同 |

> **注意：** `successs`（三个 s）是为了向后兼容 vue-plugin-hiprint 0.0.56 之前版本中的拼写错误。请勿将其视为 bug，不要移除此事件。新版客户端应监听 `success`。

### error

打印任务失败。

| 属性 | 说明 |
|------|------|
| 触发时机 | 常规打印任务失败（渲染失败 / 打印失败 / 超时） |
| 方向 | 服务端 -> 客户端 |

**Payload 结构：**

```json
{
  "msg": "打印任务提交失败: printer not found",
  "jobId": "019436a2-7c8b-7000-8000-000000000001",
  "replyId": "reply-uuid-123"
}
```

**可能的错误信息：**

| msg 示例 | 场景 |
|----------|------|
| `队列已满（当前 1000/1000），请稍后重试` | 任务队列达到 `maxQueueSize` 上限 |
| `渲染超时（30000ms）` | 渲染耗时超过 `renderTimeout` |
| `打印任务提交失败: ...` | CUPS `lp` 命令执行失败 |
| `未指定打印机且未找到系统默认打印机` | 未设置目标打印机 |
| `PDF 文件路径缺失，无法执行打印` | 内部渲染流程异常 |
| `IPP 打印功能将在 Phase 2 中实现` | 调用了尚未实现的 IPP 事件 |

### render-jpeg-success

模板渲染为 JPEG 截图成功。

| 属性 | 说明 |
|------|------|
| 触发时机 | `render-jpeg` 事件提交的渲染任务成功完成时 |
| 方向 | 服务端 -> 客户端 |

**Payload 结构：**

```json
{
  "templateId": "invoice-001",
  "jobId": "019436a2-7c8b-7000-8000-000000000001",
  "replyId": "reply-uuid-123",
  "buffer": "<Buffer ...>"
}
```

> `buffer` 字段为 JPEG 图片的二进制 Buffer，Socket.IO 自动处理二进制序列化。

### render-jpeg-error

模板渲染为 JPEG 截图失败。

| 属性 | 说明 |
|------|------|
| 触发时机 | `render-jpeg` 事件提交的渲染任务失败时 |
| 方向 | 服务端 -> 客户端 |

**Payload 结构：**

```json
{
  "msg": "渲染超时（30000ms）",
  "jobId": "019436a2-7c8b-7000-8000-000000000001",
  "replyId": null
}
```

### render-pdf-success

模板渲染为 PDF 成功。

| 属性 | 说明 |
|------|------|
| 触发时机 | `render-pdf` 事件提交的渲染任务成功完成时 |
| 方向 | 服务端 -> 客户端 |

**Payload 结构：**

```json
{
  "templateId": "invoice-001",
  "jobId": "019436a2-7c8b-7000-8000-000000000001",
  "replyId": "reply-uuid-123",
  "buffer": "<Buffer ...>"
}
```

> `buffer` 字段为 PDF 文件的二进制 Buffer。

### render-pdf-error

模板渲染为 PDF 失败。

| 属性 | 说明 |
|------|------|
| 触发时机 | `render-pdf` 事件提交的渲染任务失败时 |
| 方向 | 服务端 -> 客户端 |

**Payload 结构：**

```json
{
  "msg": "渲染失败: page crash",
  "jobId": "019436a2-7c8b-7000-8000-000000000001",
  "replyId": null
}
```

### render-print-success

模板渲染后直接打印成功。

| 属性 | 说明 |
|------|------|
| 触发时机 | `render-print` 事件提交的渲染+打印任务成功完成时 |
| 方向 | 服务端 -> 客户端 |

> 注意：`render-print` 类型任务成功时通过 `success` / `successs` 事件回调，而非 `render-print-success`。这与 electron-hiprint 的行为一致。

### render-print-error

模板渲染后直接打印失败。

| 属性 | 说明 |
|------|------|
| 触发时机 | `render-print` 事件提交的任务在渲染阶段或打印阶段失败时 |
| 方向 | 服务端 -> 客户端 |

**Payload 结构：**

```json
{
  "msg": "渲染失败: ...",
  "jobId": "019436a2-7c8b-7000-8000-000000000001",
  "replyId": null
}
```

---

## 客户端 -> 服务端事件

### news

核心打印事件，提交 HTML / PDF 打印任务。

| 属性 | 说明 |
|------|------|
| 触发时机 | 客户端主动调用 |
| 方向 | 客户端 -> 服务端 |
| 成功回调 | `success` + `successs` |
| 失败回调 | `error` |

**Payload 结构：**

```json
{
  "html": "<html><body><h1>发票</h1>...</body></html>",
  "printer": "HP_LaserJet_Pro",
  "templateId": "invoice-001",
  "type": "html",
  "pageNum": 1,
  "replyId": "reply-uuid-123"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| html | string | 是 | 打印内容（HTML 字符串，或 PDF 数据取决于 type） |
| printer | string | 否 | 目标打印机名称，不传则使用 `defaultPrinter` 或系统默认 |
| templateId | string | 否 | 模板 ID，用于追踪和日志 |
| type | string | 否 | 打印类型，默认 `'html'` |
| pageNum | number | 否 | 页数 |
| replyId | string | 否 | 回调标识，原样返回在 success/error 中 |

**type 取值：**

| 值 | 说明 | 处理流程 |
|----|------|----------|
| `html` | HTML 内容（默认） | Playwright 渲染为 PDF -> CUPS 打印 |
| `pdf` | 本地 PDF 文件路径 | 直接提交 CUPS 打印 |
| `url_pdf` | PDF 文件 URL | 直接提交 CUPS 打印 |
| `blob_pdf` | 二进制 PDF 数据 | 直接提交 CUPS 打印 |

**使用示例：**

```javascript
// HTML 打印
socket.emit('news', {
  html: '<html><body><h1>Hello</h1></body></html>',
  printer: 'HP_LaserJet_Pro',
  templateId: 'test-001',
  type: 'html',
  replyId: 'abc-123'
});

// 监听结果
socket.on('success', (data) => {
  console.log('打印成功:', data.templateId, data.replyId);
});

socket.on('error', (data) => {
  console.error('打印失败:', data.msg, data.replyId);
});
```

### printByFragments

分片传输大型打印内容。当 HTML 内容过大（超出单次 Socket.IO 消息限制）时，vue-plugin-hiprint 会将内容拆分为多个分片发送。所有分片到齐后自动合并并提交打印。

| 属性 | 说明 |
|------|------|
| 触发时机 | 客户端主动调用（大型内容自动分片） |
| 方向 | 客户端 -> 服务端 |
| 成功回调 | `success` + `successs`（所有分片合并并打印成功后） |
| 失败回调 | `error` |

**Payload 结构：**

```json
{
  "id": "fragment-group-001",
  "total": 3,
  "index": 0,
  "htmlFragment": "<html><body><div>第一部分内容...",
  "printer": "HP_LaserJet_Pro",
  "templateId": "invoice-001",
  "type": "html",
  "replyId": "reply-uuid-123"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 分片组 ID，同一组分片使用相同 ID |
| total | number | 是 | 总分片数 |
| index | number | 是 | 当前分片索引（从 0 开始） |
| htmlFragment | string | 是 | 当前分片的 HTML 内容 |
| printer | string | 否 | 目标打印机（在最后一个分片时使用） |
| templateId | string | 否 | 模板 ID |
| type | string | 否 | 打印类型，默认 `'html'` |
| replyId | string | 否 | 回调标识 |

**注意事项：**
- 分片无需按顺序到达，合并时按 `index` 排序
- 未在 10 分钟内收齐所有分片的任务会被自动清理
- 每 5 分钟执行一次过期分片扫描

### render-print

将 HTML 模板渲染后直接打印（渲染 + 打印一体化）。

| 属性 | 说明 |
|------|------|
| 触发时机 | 客户端主动调用 |
| 方向 | 客户端 -> 服务端 |
| 成功回调 | `success` + `successs` |
| 失败回调 | `render-print-error` |

**Payload 结构：**

```json
{
  "html": "<html><body>...</body></html>",
  "printer": "HP_LaserJet_Pro",
  "templateId": "invoice-001",
  "pageNum": 1,
  "replyId": "reply-uuid-123"
}
```

**字段说明（同 news 事件）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| html | string | 是 | HTML 模板内容 |
| printer | string | 否 | 目标打印机 |
| templateId | string | 否 | 模板 ID |
| pageNum | number | 否 | 页数 |
| replyId | string | 否 | 回调标识 |

### render-jpeg

将 HTML 模板渲染为 JPEG 截图。仅渲染不打印，渲染结果通过事件返回二进制 Buffer。

| 属性 | 说明 |
|------|------|
| 触发时机 | 客户端主动调用 |
| 方向 | 客户端 -> 服务端 |
| 成功回调 | `render-jpeg-success` |
| 失败回调 | `render-jpeg-error` |

**Payload 结构：**

```json
{
  "html": "<html><body>...</body></html>",
  "printer": "HP_LaserJet_Pro",
  "templateId": "invoice-001",
  "pageNum": 1,
  "replyId": "reply-uuid-123"
}
```

### render-pdf

将 HTML 模板渲染为 PDF 文件。仅渲染不打印，渲染结果通过事件返回二进制 Buffer。

| 属性 | 说明 |
|------|------|
| 触发时机 | 客户端主动调用 |
| 方向 | 客户端 -> 服务端 |
| 成功回调 | `render-pdf-success` |
| 失败回调 | `render-pdf-error` |

**Payload 结构：**

```json
{
  "html": "<html><body>...</body></html>",
  "printer": "HP_LaserJet_Pro",
  "templateId": "invoice-001",
  "pageNum": 1,
  "replyId": "reply-uuid-123"
}
```

### getClientInfo

请求服务器推送客户端（Agent）信息。

| 属性 | 说明 |
|------|------|
| 触发时机 | 客户端主动调用 |
| 方向 | 客户端 -> 服务端 |
| 响应事件 | `clientInfo` |

**Payload：** 无（不需要携带数据）

**使用示例：**

```javascript
socket.emit('getClientInfo');
socket.on('clientInfo', (info) => {
  console.log('Agent 信息:', info.hostname, info.version);
});
```

### refreshPrinterList

请求服务器重新获取并推送打印机列表。

| 属性 | 说明 |
|------|------|
| 触发时机 | 客户端主动调用 |
| 方向 | 客户端 -> 服务端 |
| 响应事件 | `printerList` |

**Payload：** 无（不需要携带数据）

**使用示例：**

```javascript
socket.emit('refreshPrinterList');
socket.on('printerList', (printers) => {
  console.log('可用打印机:', printers.map(p => p.name));
});
```

### ippPrint

IPP 协议打印（Phase 2 预留，当前未实现）。

| 属性 | 说明 |
|------|------|
| 触发时机 | 客户端主动调用 |
| 方向 | 客户端 -> 服务端 |
| 当前响应 | `error`（返回"IPP 打印功能将在 Phase 2 中实现"） |

### ippRequest

IPP 请求（Phase 2 预留，当前未实现）。

| 属性 | 说明 |
|------|------|
| 触发时机 | 客户端主动调用 |
| 方向 | 客户端 -> 服务端 |
| 当前响应 | `error`（返回"IPP 请求功能将在 Phase 2 中实现"） |

---

## 任务生命周期

### 状态流转

```
received -> rendering -> printing -> done
    |           |           |
    |           |           +-> failed_print (最多重试 3 次)
    |           |
    |           +-> failed_render
    |           +-> timeout
    |
    +-> canceled (用户手动取消)
```

### 状态枚举

| 状态 | 说明 | 是否终态 |
|------|------|----------|
| `received` | 已接收，等待处理 | 否 |
| `rendering` | Playwright 渲染中 | 否 |
| `printing` | CUPS 打印中 | 否 |
| `done` | 已完成 | 是 |
| `failed_render` | 渲染失败 | 是 |
| `failed_print` | 打印失败（已达最大重试次数） | 是 |
| `canceled` | 用户手动取消 | 是 |
| `timeout` | 渲染超时 | 是 |

### 重试机制

- 打印失败时自动重试，最多 3 次
- 重试间隔：指数退避（1s, 2s, 4s）
- 渲染失败和超时不自动重试（可通过 Admin API 手动重试）

---

## 错误码汇总

| 错误 | 来源 | 触发条件 |
|------|------|----------|
| `Authentication error` | 认证中间件 | Token 不匹配 |
| `IP not allowed` | IP 白名单中间件 | 客户端 IP 不在白名单中 |
| `队列已满（当前 N/M），请稍后重试` | Job Manager | 任务队列达到 `maxQueueSize` 上限 |
| `渲染超时（Nms）` | Job Manager | 渲染耗时超过 `renderTimeout` |
| `打印任务提交失败: ...` | CUPS 适配器 | `lp` 命令执行失败 |
| `未指定打印机且未找到系统默认打印机` | 打印适配器 | 无可用打印机 |
| `PDF 文件路径缺失，无法执行打印` | Job Manager | 内部渲染流程异常 |
| `IPP 打印功能将在 Phase 2 中实现` | 事件处理器 | 调用未实现的 IPP 事件 |
| `IPP 请求功能将在 Phase 2 中实现` | 事件处理器 | 调用未实现的 IPP 事件 |

---

## 与 electron-hiprint 兼容性

HiPrint Agent 的 Socket.IO 协议设计目标是 100% 兼容 electron-hiprint，确保 vue-plugin-hiprint 无缝切换：

| 兼容项 | 说明 |
|--------|------|
| 事件名 | 所有客户端->服务端和服务端->客户端事件名完全对齐 |
| Token 认证 | 使用相同的 `handshake.auth.token` 方式 |
| 默认端口 | 均为 17521 |
| `successs` 拼写 | 保留三个 s 的拼写错误，兼容旧版 vue-plugin-hiprint |
| `printerList` 格式 | 打印机对象结构一致（name, displayName, isDefault, status, description, options） |
| `clientInfo` 格式 | 系统信息结构一致（hostname, version, platform, arch, mac, ip, ipv6, clientUrl） |
| 分片传输 | `printByFragments` 事件及分片合并逻辑一致 |
| 渲染事件 | `render-jpeg` / `render-pdf` / `render-print` 事件及回调一致 |

### 差异点

| 差异 | electron-hiprint | HiPrint Agent |
|------|------------------|---------------|
| 运行环境 | Windows / macOS / Linux (GUI) | Linux (无头) |
| 打印系统 | Electron `webContents.print()` | CUPS (`lp` 命令) |
| 渲染引擎 | Electron BrowserWindow | Playwright Chromium |
| IPP 打印 | 部分支持 | Phase 2 实现 |
| 管理面板 | Electron 窗口 | Web UI (端口 17522) |

---

## 完整通信示例

### 场景一：HTML 静默打印

```javascript
const socket = io('http://192.168.1.100:17521', {
  auth: { token: 'my-secret-token' }
});

// 连接后自动收到打印机列表
socket.on('printerList', (printers) => {
  console.log('可用打印机:', printers);

  // 提交打印任务
  socket.emit('news', {
    html: '<html><body><h1>订单 #12345</h1><p>商品清单...</p></body></html>',
    printer: printers[0].name,
    templateId: 'order-receipt',
    type: 'html',
    replyId: 'order-12345'
  });
});

socket.on('success', (data) => {
  console.log(`打印成功 [${data.replyId}] 任务ID: ${data.jobId}`);
});

socket.on('error', (data) => {
  console.error(`打印失败 [${data.replyId}]: ${data.msg}`);
});
```

### 场景二：模板渲染为 PDF

```javascript
socket.emit('render-pdf', {
  html: '<html><body><h1>报表</h1><table>...</table></body></html>',
  templateId: 'report-monthly',
  replyId: 'render-001'
});

socket.on('render-pdf-success', (data) => {
  // data.buffer 为 PDF 二进制数据
  const pdfBlob = new Blob([data.buffer], { type: 'application/pdf' });
  console.log(`PDF 渲染完成 [${data.replyId}], 大小: ${pdfBlob.size} bytes`);
});

socket.on('render-pdf-error', (data) => {
  console.error(`PDF 渲染失败 [${data.replyId}]: ${data.msg}`);
});
```

### 场景三：大型内容分片传输

```javascript
const html = '...非常大的 HTML 内容...';
const fragmentSize = 1024 * 512; // 512KB 每片
const total = Math.ceil(html.length / fragmentSize);
const groupId = 'frag-' + Date.now();

for (let i = 0; i < total; i++) {
  socket.emit('printByFragments', {
    id: groupId,
    total: total,
    index: i,
    htmlFragment: html.slice(i * fragmentSize, (i + 1) * fragmentSize),
    printer: 'HP_LaserJet_Pro',
    templateId: 'large-report',
    type: 'html',
    replyId: 'large-001'
  });
}

// 所有分片到达并合并后，自动进入打印流程
// 结果通过 success / error 事件回调
```
