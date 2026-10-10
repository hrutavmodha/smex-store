import { type FastifyPluginAsync } from 'fastify'

const health: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get('/health', async function (_request, _reply) {
    const memory = process.memoryUsage()
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: fastify.config?.NODE_ENV ?? 'development',
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
      },
    }
  })
}

export default health
