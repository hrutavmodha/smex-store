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

# Stage 2: Next.js standalone build
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.10.1 --activate

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/shared/node_modules ./shared/node_modules
COPY --from=dependencies /app/client/node_modules ./client/node_modules

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm --filter @smex/shared build 2>/dev/null || true
RUN pnpm --filter @smex/client build

# Stage 3: Unprivileged production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Security: Create and run as unprivileged nextjs user (UID 1001)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/client/public ./client/public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/client/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/client/.next/static ./client/.next/static

USER nextjs:nodejs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request({ hostname: '127.0.0.1', port: 3000, path: '/', method: 'GET' }, (res) => process.exit(res.statusCode < 500 ? 0 : 1)); req.on('error', () => process.exit(1)); req.end();"

CMD ["node", "client/server.js"]
