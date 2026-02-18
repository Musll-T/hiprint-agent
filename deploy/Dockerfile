# =============================================================================
# HiPrint Agent - 无头打印服务 Docker 镜像
# 基于 Playwright 官方镜像，已包含 Chromium 及系统依赖
# =============================================================================

FROM mcr.microsoft.com/playwright:v1.49.0-noble

# 安装 CUPS 客户端和 CJK 字体（中日韩文字渲染支持）
RUN apt-get update && apt-get install -y --no-install-recommends \
    cups-client \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 先复制 package.json 和 lock 文件，利用 Docker 构建缓存层
COPY package.json package-lock.json* ./

# 安装生产依赖并下载 Chromium 浏览器
RUN npm install --production --ignore-scripts && \
    npx playwright install chromium

# 复制项目源码
COPY . .

# 创建数据目录和日志目录（运行时可通过 volume 挂载覆盖）
RUN mkdir -p /app/data /app/logs

# 暴露服务端口：17521（Socket.IO Gateway）、17522（Admin Web）
EXPOSE 17521 17522

# 设置生产环境变量
ENV NODE_ENV=production

# 启动服务
CMD ["node", "src/index.js"]
