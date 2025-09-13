FROM node:current-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack disable && npm install -g pnpm@latest

WORKDIR /app
COPY . /app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build:server

FROM node:current-bookworm-slim AS prod

WORKDIR /app

# 安装 sing-box + proxychains-ng（和最小工具）
RUN apt update && apt upgrade -y && apt install -y proxychains4 curl
RUN curl -fsSL https://sing-box.app/install.sh | sh

COPY --from=build /app/dist /app/dist
COPY --from=build /app/package-docker.json /app/package.json

# 复制 sing-box 配置
COPY ./proxy/sing-box-config.json /etc/sing-box/config.json

# 覆盖 proxychains 配置
COPY ./proxy/proxychains.conf /etc/proxychains/proxychains.conf

# 启动脚本（先后台启动 sing-box，再用 proxychains4 exec node）
COPY ./proxy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN npm install

EXPOSE 39001

CMD ["/usr/local/bin/docker-entrypoint.sh"]
