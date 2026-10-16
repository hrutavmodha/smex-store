import { type FastifyPluginAsync } from 'fastify';

export interface DataLayerHealthResponse {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  environment: string;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  database: {
    status: 'connected' | 'disconnected';
    latencyMs: number;
    pool: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    };
  };
}

const health: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get('/health', async function (_request, reply) {
    const memory = process.memoryUsage();
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    let latencyMs = -1;

    const pool = fastify.dbPool;
    const poolStats = {
      totalCount: pool?.totalCount ?? 0,
      idleCount: pool?.idleCount ?? 0,
      waitingCount: pool?.waitingCount ?? 0,
    };

    if (pool) {
      let timeoutId: NodeJS.Timeout | undefined;
      const start = performance.now();
      try {
        const queryPromise = pool.query('SELECT 1');
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('HEALTH_TIMEOUT')), 1000);
        });

        await Promise.race([queryPromise, timeoutPromise]);
        const elapsed = performance.now() - start;

        if (elapsed <= 1000) {
          dbStatus = 'connected';
          latencyMs = Math.round(elapsed * 100) / 100;
        } else {
          dbStatus = 'disconnected';
          latencyMs = Math.round(elapsed * 100) / 100;
        }
      } catch (err: unknown) {
        const elapsed = performance.now() - start;
        dbStatus = 'disconnected';
        if (err instanceof Error && err.message === 'HEALTH_TIMEOUT') {
          latencyMs = Math.round(elapsed * 100) / 100;
        } else {
          latencyMs = -1;
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    const isHealthy = dbStatus === 'connected';

    const response: DataLayerHealthResponse & { type?: string; title?: string; detail?: string } = {
      status: isHealthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: fastify.config?.NODE_ENV ?? 'development',
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
      },
      database: {
        status: dbStatus,
        latencyMs,
        pool: poolStats,
      },
      ...(!isHealthy
        ? {
            type: 'https://api.smexstore.com/errors/service-unavailable',
            title: 'Service Unavailable',
            detail: 'Database probe failed or timed out',
          }
        : {}),
    };

    if (!isHealthy) {
      reply.status(503);
    }

    return response;
  });
};

export default health;
