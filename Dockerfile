FROM node:current-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@latest

COPY . /app
WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build:only

FROM node:current-bookworm-slim AS prod

WORKDIR /app

RUN apt update && \
    apt install -y proxychains4 curl && \
    curl -fsSL https://sing-box.app/install.sh | sh -s -- --beta && \
    rm -rf /var/lib/apt/lists/*

COPY ./proxy/sing-box-config.json /etc/sing-box/config.json
COPY ./proxy/proxychains.conf /etc/proxychains4.conf
COPY ./proxy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

COPY --from=build /app/dist /app/dist
COPY --from=build /app/package.json /app/package.json

RUN npm install --omit=dev

EXPOSE 39001

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
