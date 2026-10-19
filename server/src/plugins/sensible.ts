import fp from 'fastify-plugin';
import sensible, { type FastifySensibleOptions } from '@fastify/sensible';

import { formatRfc7807 } from '@smex/shared';

export interface AppError extends Partial<Error> {
  statusCode?: number;
  status?: number;
  code?: string;
  title?: string;
  detail?: string;
  type?: string;
  validation?: Array<{
    instancePath?: string;
    params?: Record<string, unknown>;
    message?: string;
  }>;
  invalid_params?: Array<{ name: string; reason: string }>;
}

export default fp<FastifySensibleOptions>(async (fastify) => {
  await fastify.register(sensible);

  // Hook onSend to enforce Content-Type: application/problem+json on all 4xx and 5xx errors
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (reply.statusCode >= 400 && typeof payload === 'string') {
      reply.header('content-type', 'application/problem+json; charset=utf-8');

      try {
        const parsed = JSON.parse(payload);
        if (typeof parsed === 'object' && parsed !== null && !parsed.instance) {
          parsed.instance = request.url;
          return JSON.stringify(parsed);
        }
      } catch {
        // payload is not json
      }
    }
    return payload;
  });

  // Global error handler adhering to RFC 7807 Problem Details
  fastify.setErrorHandler((error: AppError, request, reply) => {
    const statusCode = error.validation ? 422 : (error.statusCode || error.status || 500);
    const code = error.code || (statusCode === 422 ? 'VALIDATION_FAILED' : 'INTERNAL_ERROR');
    const title = error.title || error.name || (statusCode === 422 ? 'Validation Error' : 'Internal Server Error');
    const detail = error.detail || error.message || 'An unexpected error occurred';

    let invalidParams: Array<{ name: string; reason: string }> | undefined;
    if (error.validation && Array.isArray(error.validation)) {
      invalidParams = error.validation.map((v) => ({
        name: v.instancePath ? v.instancePath.replace(/^\//, '') : (v.params?.missingProperty as string) || 'unknown',
        reason: v.message || 'Invalid value',
      }));
    } else if (error.invalid_params) {
      invalidParams = error.invalid_params;
    }

    const problem = formatRfc7807(
      statusCode,
      code,
      title,
      detail,
      request.url,
      invalidParams,
      error.type
    );

    reply
      .code(statusCode)
      .type('application/problem+json')
      .send(problem);
  });
});
