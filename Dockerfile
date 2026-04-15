FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

FROM base AS build

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm prisma:generate
RUN pnpm build

FROM base AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app /app

RUN printf '#!/bin/sh\nset -e\nif [ "${APP_ROLE:-web}" = "worker" ]; then\n  exec pnpm worker\nfi\nexec pnpm start\n' > /usr/local/bin/start-app \
  && chmod +x /usr/local/bin/start-app

EXPOSE 3000
CMD ["start-app"]
