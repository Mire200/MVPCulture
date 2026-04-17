FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/realtime/package.json apps/realtime/
COPY packages/shared/package.json packages/shared/
COPY packages/content/package.json packages/content/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @mvpc/shared build || true
RUN pnpm --filter @mvpc/realtime build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/realtime/dist /app/apps/realtime/dist
COPY --from=build /app/apps/realtime/package.json /app/apps/realtime/package.json
COPY --from=build /app/packages /app/packages
WORKDIR /app/apps/realtime
EXPOSE 4000
CMD ["node", "dist/index.js"]
