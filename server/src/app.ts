import { type FastifyPluginAsync } from 'fastify'
import sensiblePlugin from './plugins/sensible.js'
import supportPlugin from './plugins/support.js'
import rootRoutes from './routes/root.js'
import exampleRoutes from './routes/example/index.js'

export type AppOptions = {
  // Place your custom options for app below here.
}

const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // Register plugins
  await fastify.register(sensiblePlugin)
  await fastify.register(supportPlugin)

  // Register routes
  await fastify.register(rootRoutes)
  await fastify.register(exampleRoutes, { prefix: '/example' })
}

export default app
export { app, options }
