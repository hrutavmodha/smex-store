import fp from 'fastify-plugin';
import sensible, { type FastifySensibleOptions } from '@fastify/sensible';

export interface Rfc7807Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code?: string;
  invalid_params?: Array<{ name: string; reason: string }>;
}

export function formatRfc7807Problem(
  statusCode: number,
  code: string,
  title: string,
  detail: string,
  instance?: string,
  invalidParams?: Array<{ name: string; reason: string }>
): Rfc7807Problem {
  const problem: Rfc7807Problem = {
    type: `https://api.smexstore.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
    title,
    status: statusCode,
    detail,
    code,
  };
  if (instance) problem.instance = instance;
  if (invalidParams && invalidParams.length > 0) problem.invalid_params = invalidParams;
  return problem;
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
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.validation ? 422 : (error.statusCode || 500);
    const code = (error as any).code || (statusCode === 422 ? 'VALIDATION_FAILED' : 'INTERNAL_ERROR');
    const title = error.name || (statusCode === 422 ? 'Validation Error' : 'Internal Server Error');
    const detail = error.message || 'An unexpected error occurred';

    let invalidParams: Array<{ name: string; reason: string }> | undefined;
    if (error.validation) {
      invalidParams = error.validation.map((v) => ({
        name: v.instancePath ? v.instancePath.replace(/^\//, '') : (v.params as any)?.missingProperty || 'unknown',
        reason: v.message || 'Invalid value',
      }));
    } else if ((error as any).invalid_params) {
      invalidParams = (error as any).invalid_params;
    }

    const problem = formatRfc7807Problem(
      statusCode,
      code,
      title,
      detail,
      request.url,
      invalidParams
    );

    reply
      .code(statusCode)
      .type('application/problem+json')
      .send(problem);
  });
});
