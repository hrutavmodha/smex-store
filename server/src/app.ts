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

export type AppOptions = {
  // Place your custom options for app below here.
}

const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
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
  await fastify.register(exampleRoutes, { prefix: '/example' })
}

export default app
export { app, options }
