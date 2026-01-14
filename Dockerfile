FROM debian:bookworm-slim AS fetch

RUN apt update && apt install -y curl tar && \
    VERSION=$(curl -s https://api.github.com/repos/SagerNet/sing-box/releases | \
        grep -oP '"tag_name": "\K[^"]+' | grep -E "alpha|beta" | head -n 1) && \
    curl -Lo sing-box.tar.gz "https://github.com/SagerNet/sing-box/releases/download/${VERSION}/sing-box-${VERSION#v}-linux-amd64.tar.gz" && \
    tar -xzf sing-box.tar.gz && \
    mv sing-box-*/sing-box /usr/local/bin/sing-box

FROM node:current-bookworm-slim AS build

RUN npm install -g pnpm@latest

COPY . /app
WORKDIR /app

RUN pnpm install --frozen-lockfile
RUN pnpm run build:only

FROM node:current-bookworm-slim AS prod

WORKDIR /app

RUN apt update && apt install -y proxychains4 ca-certificates && \
    apt autoremove -y && rm -rf /var/lib/apt/lists/*

COPY --from=fetch /usr/local/bin/sing-box /usr/local/bin/sing-box

COPY ./proxy/sing-box-config.json /etc/sing-box/config.json
COPY ./proxy/proxychains.conf /etc/proxychains4.conf
COPY ./proxy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

COPY --from=build /app/dist /app/dist

EXPOSE 39001

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
