import { type FastifyPluginAsync } from 'fastify'
import sensiblePlugin from './plugins/sensible.js'
import supportPlugin from './plugins/support.js'
import corsPlugin from './plugins/cors.js'
import websocketPlugin from './plugins/websocket.js'
import dbPlugin from './plugins/db.js'
import redisPlugin from './plugins/redis.js'
import authPlugin from './plugins/auth.js'
import rateLimitPlugin from './plugins/rate-limit.js'
import { loadEnv } from './config/env.js'
import rootRoutes from './routes/root.js'
import healthRoutes from './routes/health.js'
import authRoutes from './routes/auth.js'
import devicesRoutes from './routes/devices.js'
import teamsRoutes from './routes/teams.js'
import tournamentsRoutes from './routes/tournaments.js'
import exampleRoutes from './routes/example/index.js'
import boostingRoutes from './routes/boosting.js'
import adminBoostingRoutes from './routes/admin/boosting.js'
import adminMetricsRoutes from './routes/admin/metrics.js'
import adminUsersRoutes from './routes/admin/users.js'
import adminTeamsRoutes from './routes/admin/teams.js'
import adminMarketplaceRoutes from './routes/admin/marketplace.js'
import adminSystemRoutes from './routes/admin/system.js'
import marketplaceRoutes from './routes/marketplace/index.js'
import marketplaceUploadsRoutes from './routes/marketplace/uploads.js'
import notificationsRoutes from './routes/notifications.js'
import searchRoutes from './routes/search.js'


export type AppOptions = {
  // Place your custom options for app below here.
}

const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  _opts
): Promise<void> => {
  // Validate and load typed environment configuration
  const config = loadEnv()
  fastify.decorate('config', config)

  // Register foundational security and networking plugins
  await fastify.register(corsPlugin)
  await fastify.register(redisPlugin)
  await fastify.register(dbPlugin)
  await fastify.register(authPlugin)
  await fastify.register(rateLimitPlugin)
  await fastify.register(websocketPlugin)
  await fastify.register(sensiblePlugin)
  await fastify.register(supportPlugin)

  // Register routes
  await fastify.register(rootRoutes)
  await fastify.register(healthRoutes)
  await fastify.register(authRoutes)
  await fastify.register(devicesRoutes)
  await fastify.register(teamsRoutes)
  await fastify.register(tournamentsRoutes)
  await fastify.register(boostingRoutes)
  await fastify.register(adminBoostingRoutes)
  await fastify.register(adminMetricsRoutes)
  await fastify.register(adminUsersRoutes)
  await fastify.register(adminTeamsRoutes)
  await fastify.register(adminMarketplaceRoutes)
  await fastify.register(adminSystemRoutes)
  await fastify.register(marketplaceRoutes)
  await fastify.register(marketplaceUploadsRoutes)
  await fastify.register(notificationsRoutes)
  await fastify.register(searchRoutes)
  await fastify.register(exampleRoutes, { prefix: '/example' })
}

export default app
export { app, options }
