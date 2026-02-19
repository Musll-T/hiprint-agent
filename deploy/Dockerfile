# =============================================================================
# HiPrint Agent - 无头打印服务 Docker 镜像
# 基于 Playwright 官方镜像，已包含 Chromium 及系统依赖
# 使用多阶段构建分离编译环境和运行环境以减小镜像体积
# =============================================================================

# ---- 阶段 1：构建依赖 ----
# Playwright 版本参数化：构建时通过 --build-arg PLAYWRIGHT_VERSION=x.x.x 指定
# 默认值应与 package.json 中 playwright 依赖的实际安装版本保持一致
ARG PLAYWRIGHT_VERSION=1.58.2
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS builder

# 安装原生模块编译工具链（仅在构建阶段需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制 package.json 和 lock 文件，利用 Docker 构建缓存层
COPY package.json package-lock.json* ./

# 安装生产依赖（better-sqlite3 需要编译原生模块）
RUN npm ci --omit=dev && \
    npm cache clean --force

# ---- 阶段 2：运行时镜像 ----
ARG PLAYWRIGHT_VERSION=1.58.2
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

# 安装 CUPS 完整包（含 cupsd 守护进程）和 CJK 字体（中日韩文字渲染支持）
# 容器内无 systemd，cupsd 由维护服务直接管理进程生命周期
RUN apt-get update && apt-get install -y --no-install-recommends \
    cups \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 从构建阶段复制已编译的 node_modules（无需 build-essential/python3）
COPY --from=builder /app/node_modules ./node_modules

# 复制项目源码和配置
COPY package.json ./
COPY src ./src
COPY config.json* ./

# 创建数据目录和日志目录（运行时可通过 volume 挂载覆盖）
RUN mkdir -p /app/data /app/logs

# 暴露服务端口：17521（Socket.IO Gateway）、17522（Admin Web）
EXPOSE 17521 17522

# 设置生产环境变量
ENV NODE_ENV=production

# 启动服务
CMD ["node", "src/index.js"]
