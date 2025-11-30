# ==============================================================================
# Stage 1: Dependency Builder
# 目标：拉取自定义依赖源码 -> 编译 TypeScript -> 打包成 .tgz
# ==============================================================================
FROM node:current-bookworm-slim AS dep-builder

WORKDIR /build_deps

# 安装构建依赖 (Git, C++, Python)
RUN apt update && apt install -y git

# 拉取修改版的 mcp-local-rag
# 注意：这里使用 HTTPS 克隆。如果是私有仓库，需要处理 SSH Key 或 Token
RUN git clone https://github.com/Bubble-droid/mcp-local-rag.git .

# 安装依赖并构建 (生成 dist 目录)
RUN npm install
RUN npm run build

# 打包成标准 NPM 包 (输出 mcp-local-rag-x.x.x.tgz)
RUN npm pack

# ==============================================================================
# Stage 2: App Builder
# 目标：构建主应用，替换依赖源，输出 dist 和 修正后的 package.json
# ==============================================================================
FROM node:current-bookworm-slim AS app-builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@latest

WORKDIR /app

# 1. 复制项目源码
COPY . .

# 2. 从 Stage 1 获取打包好的依赖文件
COPY --from=dep-builder /build_deps/*.tgz /app/libs/mcp-local-rag.tgz

# 3. [关键] 修改 package.json 指向本地 .tgz 文件
# - 设置 dependencies
# - 删除 overrides (防止 pnpm 强制覆盖版本导致冲突)
RUN npm pkg set dependencies.mcp-local-rag="file:/app/libs/mcp-local-rag.tgz" && \
    npm pkg delete overrides.mcp-local-rag

# 4. 安装主项目依赖 & 构建
# 此时 pnpm 会安装那个 .tgz 文件，并解析它的依赖
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build-only

# ==============================================================================
# Stage 3: Production
# 目标：极简运行时，只包含构建产物和系统级工具 (Proxy)
# ==============================================================================
FROM node:current-bookworm-slim AS prod

WORKDIR /app

# 1. 安装运行时系统依赖
# 注意：better-sqlite3 在 install 时需要编译，所以这里暂时需要 build-essential
# 策略：安装构建工具 -> npm install -> 删除构建工具 (减小体积)
RUN apt update && \
    apt install -y proxychains4 curl && \
    curl -fsSL https://sing-box.app/install.sh | sh -s -- --beta && \
    rm -rf /var/lib/apt/lists/*

# 2. 复制 Proxy 配置 (保持原样)
COPY ./proxy/sing-box-config.json /etc/sing-box/config.json
COPY ./proxy/proxychains.conf /etc/proxychains4.conf
COPY ./proxy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 3. 复制 App Builder 的产物
# - 复制构建好的 dist 目录
# - 复制修改过依赖路径的 package.json
# - 复制那个 .tgz 依赖包 (因为 npm install --production 运行时仍需解压它)
COPY --from=app-builder /app/dist /app/dist
COPY --from=app-builder /app/package.json /app/package.json
COPY --from=app-builder /app/libs/mcp-local-rag.tgz /app/libs/mcp-local-rag.tgz

# 4. 安装生产依赖
# 这一步会编译 native 模块 (如 better-sqlite3)
RUN npm install --omit=dev

# 5. [可选] 清理编译工具以减小镜像体积
# 如果你确定运行时不再需要 python/gcc，可以卸载
# RUN apt remove -y curl build-essential python3 && apt autoremove -y

# 6. Rebuild 确保 native binding 正确 (双重保险)
# RUN cd node_modules/better-sqlite3 && npm run build-release

EXPOSE 39001

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
