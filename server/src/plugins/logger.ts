import { type FastifyPluginAsync, type FastifyServerOptions } from 'fastify';
import fp from 'fastify-plugin';

export const REDACTED_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'token',
  'secret',
];

export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers.set-cookie',
  'body.password',
  'body.token',
  'body.secret',
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
];

export const loggerOptions: FastifyServerOptions['logger'] = {
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        remoteAddress: req.ip || req.socket?.remoteAddress,
        headers: req.headers,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
};

const loggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Add onRequest hook to ensure correlation ID / reqId is tracked
  fastify.addHook('onRequest', async (request) => {
    if (!request.id) {
      request.id = `req_${crypto.randomUUID()}`;
    }
  });
};

export default fp(loggerPlugin, {
  name: 'structured-logger',
});
