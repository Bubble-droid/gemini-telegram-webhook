FROM node:current-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@latest

COPY . /app
WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:current-alpine AS prod

WORKDIR /app

COPY --from=build /app/dist /app/dist

CMD [ "node", "/app/dist/index.mjs" ]
