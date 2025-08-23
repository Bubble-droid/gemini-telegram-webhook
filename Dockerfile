FROM node:current-alpine3.22 AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack disable && npm install -g pnpm@latest

WORKDIR /app
COPY . /app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build:server

FROM node:current-alpine3.22 AS prod

WORKDIR /app

COPY --from=build /app/dist/index.js /app/dist/index.js
COPY --from=build /app/dist/index.js.map /app/dist/index.js.map
COPY --from=build /app/package-docker.json /app/package.json

RUN npm install

EXPOSE 39001

CMD ["node", "--enable-source-maps", "/app/dist/index.js"]
