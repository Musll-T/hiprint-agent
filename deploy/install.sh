#!/bin/bash
# =============================================================================
# HiPrint Agent - Linux 一键安装脚本
#
# 功能：
#   1. 检测运行环境（root 权限、系统类型）
#   2. 安装 Node.js 20 LTS（通过 NodeSource）
#   3. 安装 CUPS 客户端
#   4. 安装 CJK 字体（中日韩文字渲染）
#   5. 安装 Playwright Chromium
#   6. 创建 hiprint 系统用户和目录
#   7. 部署项目文件到 /opt/hiprint-agent
#   8. 安装 systemd 服务
#
# 使用方法：
#   sudo bash install.sh
#
# 支持系统：Ubuntu/Debian (apt)、CentOS/RHEL (yum/dnf)
# =============================================================================

set -euo pipefail

# ---------- 颜色定义 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # 重置颜色

# ---------- 输出函数 ----------
info()    { echo -e "${BLUE}[INFO]${NC}    $*"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}    $*"; }
error()   { echo -e "${RED}[ERROR]${NC}   $*"; exit 1; }

# ---------- 常量 ----------
INSTALL_DIR="/opt/hiprint-agent"
LOG_DIR="/var/log/hiprint-agent"
SERVICE_NAME="hiprint-agent"
SERVICE_USER="hiprint"
NODE_MAJOR=20

# 获取脚本所在目录（项目 deploy 目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 项目根目录（deploy 的上一级）
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# =============================================================================
# 步骤 1：环境检测
# =============================================================================
info "步骤 1/8：检测运行环境..."

# 检查 root 权限
if [[ $EUID -ne 0 ]]; then
    error "此脚本需要 root 权限运行，请使用 sudo bash install.sh"
fi

# 检测包管理器，确定系统类型
PKG_MANAGER=""
if command -v apt-get &>/dev/null; then
    PKG_MANAGER="apt"
elif command -v dnf &>/dev/null; then
    PKG_MANAGER="dnf"
elif command -v yum &>/dev/null; then
    PKG_MANAGER="yum"
else
    error "不支持的系统：未找到 apt-get、dnf 或 yum 包管理器"
fi

info "检测到包管理器：${PKG_MANAGER}"

# 检测 systemd
if ! command -v systemctl &>/dev/null; then
    error "未检测到 systemd，此脚本仅支持 systemd 系统"
fi

success "环境检测通过"

# =============================================================================
# 步骤 2：安装 Node.js 20 LTS
# =============================================================================
info "步骤 2/8：安装 Node.js ${NODE_MAJOR} LTS..."

# 检查是否已安装且版本满足要求
if command -v node &>/dev/null; then
    CURRENT_NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [[ "$CURRENT_NODE_VERSION" -ge "$NODE_MAJOR" ]]; then
        success "Node.js $(node -v) 已安装，满足版本要求（>= ${NODE_MAJOR}）"
    else
        warn "Node.js $(node -v) 版本过低，将安装 Node.js ${NODE_MAJOR}..."
        NEED_NODE=true
    fi
else
    info "未检测到 Node.js，将安装 Node.js ${NODE_MAJOR}..."
    NEED_NODE=true
fi

if [[ "${NEED_NODE:-false}" == "true" ]]; then
    if [[ "$PKG_MANAGER" == "apt" ]]; then
        # 通过 NodeSource 安装（Debian/Ubuntu）
        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg
        mkdir -p /etc/apt/keyrings
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null || true
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
        apt-get update -qq
        apt-get install -y -qq nodejs
    else
        # 通过 NodeSource 安装（RHEL/CentOS）
        curl -fsSL https://rpm.nodesource.com/setup_${NODE_MAJOR}.x | bash -
        ${PKG_MANAGER} install -y nodejs
    fi
    success "Node.js $(node -v) 安装完成"
fi

# =============================================================================
# 步骤 3：安装 CUPS 客户端
# =============================================================================
info "步骤 3/8：安装 CUPS 客户端..."

if [[ "$PKG_MANAGER" == "apt" ]]; then
    apt-get install -y -qq cups-client
else
    ${PKG_MANAGER} install -y cups
fi

success "CUPS 客户端安装完成"

# =============================================================================
# 步骤 4：安装 CJK 字体
# =============================================================================
info "步骤 4/8：安装 CJK 字体（中日韩文字渲染支持）..."

if [[ "$PKG_MANAGER" == "apt" ]]; then
    apt-get install -y -qq fonts-noto-cjk fonts-noto-cjk-extra
else
    ${PKG_MANAGER} install -y google-noto-sans-cjk-ttc-fonts google-noto-serif-cjk-ttc-fonts
fi

success "CJK 字体安装完成"

# =============================================================================
# 步骤 5：创建系统用户和目录
# =============================================================================
info "步骤 5/8：创建系统用户和目录..."

# 创建系统用户（幂等：如果已存在则跳过）
if id "${SERVICE_USER}" &>/dev/null; then
    info "用户 ${SERVICE_USER} 已存在，跳过创建"
else
    useradd --system --no-create-home --shell /usr/sbin/nologin "${SERVICE_USER}"
    success "系统用户 ${SERVICE_USER} 创建完成"
fi

# 创建安装目录
mkdir -p "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}/data"
mkdir -p "${INSTALL_DIR}/logs"
mkdir -p "${LOG_DIR}"

success "目录结构创建完成"

# =============================================================================
# 步骤 6：部署项目文件
# =============================================================================
info "步骤 6/8：部署项目文件到 ${INSTALL_DIR}..."

# 复制源码（排除 node_modules、deploy、.git）
rsync -a --delete \
    --exclude='node_modules' \
    --exclude='deploy' \
    --exclude='.git' \
    --exclude='data' \
    --exclude='logs' \
    "${PROJECT_DIR}/" "${INSTALL_DIR}/"

# 如果没有 config.json，复制默认配置
if [[ ! -f "${INSTALL_DIR}/config.json" ]]; then
    if [[ -f "${PROJECT_DIR}/config.json" ]]; then
        cp "${PROJECT_DIR}/config.json" "${INSTALL_DIR}/config.json"
        info "已复制默认配置文件"
    fi
fi

success "项目文件部署完成"

# =============================================================================
# 步骤 7：安装依赖和 Playwright Chromium
# =============================================================================
info "步骤 7/8：安装 npm 依赖和 Playwright Chromium..."

cd "${INSTALL_DIR}"
npm install --production --ignore-scripts

# 安装 Playwright Chromium 及其系统依赖
npx playwright install --with-deps chromium

# 设置目录所有权
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${LOG_DIR}"

success "依赖安装完成"

# =============================================================================
# 步骤 8：安装 systemd 服务
# =============================================================================
info "步骤 8/8：安装 systemd 服务..."

# 复制 service 文件
cp "${SCRIPT_DIR}/hiprint-agent.service" "/etc/systemd/system/${SERVICE_NAME}.service"

# 重新加载 systemd 配置
systemctl daemon-reload

# 启用开机自启
systemctl enable "${SERVICE_NAME}"

success "systemd 服务安装完成"

# =============================================================================
# 安装完成，输出后续步骤
# =============================================================================
echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  HiPrint Agent 安装完成！${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "安装目录：  ${BLUE}${INSTALL_DIR}${NC}"
echo -e "配置文件：  ${BLUE}${INSTALL_DIR}/config.json${NC}"
echo -e "数据目录：  ${BLUE}${INSTALL_DIR}/data/${NC}"
echo -e "日志目录：  ${BLUE}${INSTALL_DIR}/logs/${NC}"
echo -e "系统日志：  ${BLUE}${LOG_DIR}/${NC}"
echo ""
echo -e "${YELLOW}后续步骤：${NC}"
echo -e "  1. 编辑配置文件：  ${BLUE}sudo nano ${INSTALL_DIR}/config.json${NC}"
echo -e "  2. 启动服务：      ${BLUE}sudo systemctl start ${SERVICE_NAME}${NC}"
echo -e "  3. 查看状态：      ${BLUE}sudo systemctl status ${SERVICE_NAME}${NC}"
echo -e "  4. 查看日志：      ${BLUE}journalctl -u ${SERVICE_NAME} -f${NC}"
echo ""
echo -e "${YELLOW}服务端口：${NC}"
echo -e "  Socket.IO Gateway：${BLUE}17521${NC}"
echo -e "  Admin Web 管理台：${BLUE}17522${NC}"
echo ""
