import { type FastifyPluginAsync, type FastifyRequest, type FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { eq } from 'drizzle-orm';
import { type AccessTokenPayload, type UserRole } from '@smex/shared';
import { users } from '../db/schema/users.js';
import { loadEnv } from '../config/env.js';
import { getCookie } from '../utils/cookies.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    emailVerifiedGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    managerGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    roleGuard: (
      allowedRoles: UserRole[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const env = fastify.hasDecorator('config') ? fastify.config : loadEnv();

  await fastify.register(fastifyCookie);
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: '15m',
    },
  });

  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const cookieToken = getCookie(request, 'smex_access_token');

      let payload: AccessTokenPayload;
      if (cookieToken) {
        payload = fastify.jwt.verify<AccessTokenPayload>(cookieToken);
      } else {
        payload = await request.jwtVerify<AccessTokenPayload>();
      }

      if (!payload.sessionId || !payload.sub) {
        return reply.code(401).send({
          type: 'https://api.smexstore.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid token structure',
          code: 'INVALID_TOKEN',
        });
      }

      // 1. Check if user is banned (Redis cache or database fallback)
      let isBanned = payload.isBanned ?? false;
      const cachedBan = await fastify.redis.get(`banned_user:${payload.sub}`);
      if (cachedBan === '1') {
        isBanned = true;
      } else if (cachedBan === null) {
        const [userRow] = await fastify.db
          .select({ isBanned: users.isBanned })
          .from(users)
          .where(eq(users.id, payload.sub))
          .limit(1);

        if (userRow?.isBanned) {
          isBanned = true;
          await fastify.redis.set(`banned_user:${payload.sub}`, '1', 'EX', 3600);
        } else {
          await fastify.redis.set(`banned_user:${payload.sub}`, '0', 'EX', 300);
        }
      }

      if (isBanned) {
        return reply.code(403).send({
          type: 'https://api.smexstore.com/errors/account-banned',
          title: 'Account Banned',
          status: 403,
          detail: 'Your account has been banned due to terms of service violation.',
          code: 'ACCOUNT_BANNED',
        });
      }

      // 2. Fast-path tombstone check via Redis for session revocation
      const isRevoked = await fastify.redis.exists(`revoked_token:${payload.sessionId}`);
      if (isRevoked) {
        return reply.code(401).send({
          type: 'https://api.smexstore.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Session has been revoked',
          code: 'SESSION_REVOKED',
        });
      }

      payload.isBanned = false;
      request.user = payload;
    } catch (err: unknown) {
      return reply.code(401).send({
        type: 'https://api.smexstore.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: err instanceof Error ? err.message : 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }
  };

  const emailVerifiedGuard = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user?.sub) {
      return reply.code(401).send({
        type: 'https://api.smexstore.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const [userRecord] = await fastify.db
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, request.user.sub))
      .limit(1);

    if (!userRecord || !userRecord.emailVerified) {
      return reply.code(403).send({
        type: 'https://api.smexstore.com/errors/email-verification-required',
        title: 'Email Verification Required',
        status: 403,
        detail: 'Email verification is required to perform this action.',
        code: 'EMAIL_VERIFICATION_REQUIRED',
      });
    }
  };

  const adminGuard = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({
        type: 'https://api.smexstore.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Admin privileges required',
        code: 'ADMIN_ACCESS_REQUIRED',
      });
    }
  };

  const managerGuard = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || (request.user.role !== 'manager' && request.user.role !== 'admin')) {
      return reply.code(403).send({
        type: 'https://api.smexstore.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Manager or Admin privileges required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
  };

  const roleGuard = (allowedRoles: UserRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.code(401).send({
          type: 'https://api.smexstore.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      if (!allowedRoles.includes(request.user.role)) {
        return reply.code(403).send({
          type: 'https://api.smexstore.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }
    };
  };

  fastify.decorate('authenticate', authenticate);
  fastify.decorate('emailVerifiedGuard', emailVerifiedGuard);
  fastify.decorate('adminGuard', adminGuard);
  fastify.decorate('managerGuard', managerGuard);
  fastify.decorate('roleGuard', roleGuard);
};

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['redis', 'db'],
});
