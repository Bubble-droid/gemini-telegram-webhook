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

RUN apt update && apt upgrade -y && apt install -y proxychains4 curl && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://sing-box.app/install.sh | sh -s -- --beta

COPY ./proxy/sing-box-config.json /etc/sing-box/config.json
COPY ./proxy/proxychains.conf /etc/proxychains4.conf

COPY --from=build /app/dist /app/dist
COPY --from=build /app/package-docker.json /app/package.json

COPY ./proxy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN npm install

EXPOSE 39001

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
