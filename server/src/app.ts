import { type FastifyPluginAsync } from 'fastify'
import sensiblePlugin from './plugins/sensible.js'
import supportPlugin from './plugins/support.js'
import corsPlugin from './plugins/cors.js'
import websocketPlugin from './plugins/websocket.js'
import { loadEnv } from './config/env.js'
import rootRoutes from './routes/root.js'
import healthRoutes from './routes/health.js'
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
  await fastify.register(websocketPlugin)
  await fastify.register(sensiblePlugin)
  await fastify.register(supportPlugin)

  // Register routes
  await fastify.register(rootRoutes)
  await fastify.register(healthRoutes)
  await fastify.register(exampleRoutes, { prefix: '/example' })
}

export default app
export { app, options }
