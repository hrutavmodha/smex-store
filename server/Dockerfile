# syntax=docker/dockerfile:1

# Stage 1: Dependencies installation
FROM node:22-alpine AS dependencies
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.10.1 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN pnpm install --frozen-lockfile

# Stage 2: Build bundle
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.10.1 --activate

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/shared/node_modules ./shared/node_modules
COPY --from=dependencies /app/server/node_modules ./server/node_modules

COPY . .

RUN pnpm --filter @smex/shared build 2>/dev/null || true
RUN pnpm --filter @smex/server build

# Stage 3: Minimal hardened production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Security: Run as unprivileged node user
USER node:node

COPY --chown=node:node --from=builder /app/server/dist ./dist
COPY --chown=node:node --from=builder /app/server/package.json ./package.json
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node --from=dependencies /app/server/node_modules ./server_node_modules

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request({ hostname: '127.0.0.1', port: 3001, path: '/health', method: 'GET' }, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1)); req.end();"

CMD ["node", "dist/server.mjs"]
