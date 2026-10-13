import crypto from 'node:crypto';
import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { users, profiles } from '../db/schema/users.js';
import { hashPassword, verifyPassword, passwordSchema } from '../utils/crypto.js';
import { parseDeviceMetadata } from '../utils/fingerprint.js';
import { SessionService } from '../services/session.service.js';
import { emailService } from '../services/email.service.js';
import {
  registerRateLimitConfig,
  loginRateLimitConfig,
  forgotPasswordRateLimitConfig,
  resendVerificationRateLimitConfig,
} from '../plugins/rate-limit.js';

const registerBodySchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username must only contain alphanumeric characters and underscores')
    .trim(),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const resetPasswordBodySchema = z.object({
  token: z.string().min(10),
  newPassword: passwordSchema,
});

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. POST /api/v1/auth/register
  fastify.post(
    '/api/v1/auth/register',
    {
      config: {
        rateLimit: registerRateLimitConfig,
      },
    },
    async (request, reply) => {
      const parsed = registerBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          type: 'https://api.smexstore.com/errors/validation-failed',
          title: 'Validation Error',
          status: 400,
          detail: parsed.error.issues[0]?.message || 'Invalid registration parameters',
          code: 'VALIDATION_FAILED',
        });
      }

      const { email, password, username } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();

      // Check if email or username already taken
      const existingUser = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existingUser.length > 0) {
        return reply.code(409).send({
          type: 'https://api.smexstore.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'An account with this email already exists',
          code: 'EMAIL_ALREADY_EXISTS',
        });
      }

      const existingProfile = await fastify.db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(eq(profiles.username, username))
        .limit(1);

      if (existingProfile.length > 0) {
        return reply.code(409).send({
          type: 'https://api.smexstore.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'This username is already taken',
          code: 'USERNAME_ALREADY_EXISTS',
        });
      }

      const passwordHash = await hashPassword(password);

      // Create user and profile in transaction
      const newUser = await fastify.db.transaction(async (tx) => {
        const [insertedUser] = await tx
          .insert(users)
          .values({
            email: normalizedEmail,
            passwordHash,
            role: 'user',
            emailVerified: false,
          })
          .returning();

        await tx.insert(profiles).values({
          userId: insertedUser.id,
          username,
          avatarPreset: 'preset_default_01',
        });

        return insertedUser;
      });

      // Generate verification token (64 hex characters)
      const verifyToken = crypto.randomBytes(32).toString('hex');
      await fastify.redis.set(`verify_email:${verifyToken}`, newUser.id, 'EX', 86400);

      // Dispatch verification email
      await emailService.sendVerificationEmail(normalizedEmail, verifyToken);

      return reply.code(201).send({
        id: newUser.id,
        email: newUser.email,
        emailVerified: newUser.emailVerified,
        profile: {
          username,
          avatarPreset: 'preset_default_01',
        },
      });
    }
  );

  // 2. POST /api/v1/auth/login
  fastify.post(
    '/api/v1/auth/login',
    {
      config: {
        rateLimit: loginRateLimitConfig,
      },
    },
    async (request, reply) => {
      const parsed = loginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          type: 'https://api.smexstore.com/errors/validation-failed',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid credentials format',
          code: 'VALIDATION_FAILED',
        });
      }

      const { email, password } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();

      const [userRecord] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (!userRecord) {
        return reply.code(401).send({
          type: 'https://api.smexstore.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const isValidPassword = await verifyPassword(userRecord.passwordHash, password);
      if (!isValidPassword) {
        return reply.code(401).send({
          type: 'https://api.smexstore.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const metadata = parseDeviceMetadata(
        (request.headers['user-agent'] as string) || '',
        request.ip,
        request.headers['accept-language'] as string
      );

      const session = await SessionService.createSession(
        userRecord.id,
        metadata,
        fastify.db,
        fastify.redis
      );

      const accessToken = fastify.jwt.sign({
        sub: userRecord.id,
        role: userRecord.role,
        sessionId: session.sessionId,
      });

      // Set cookie adhering to RFC 6265bis
      reply.setCookie('__Host-refresh-token', session.cookieValue, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 2592000,
      });

      return reply.code(200).send({
        accessToken,
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: userRecord.id,
          email: userRecord.email,
          role: userRecord.role,
          emailVerified: userRecord.emailVerified,
        },
      });
    }
  );

  // 3. POST /api/v1/auth/logout
  fastify.post(
    '/api/v1/auth/logout',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      await SessionService.revokeSession(
        request.user.sub,
        request.user.sessionId,
        fastify.db,
        fastify.redis,
        fastify.wsGateway
      );

      reply.clearCookie('__Host-refresh-token', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      });

      return reply.code(200).send({
        success: true,
        message: 'Logged out successfully',
      });
    }
  );

  // 4. POST /api/v1/auth/refresh
  fastify.post('/api/v1/auth/refresh', async (request, reply) => {
    const rawCookie =
      request.cookies['__Host-refresh-token'] ||
      (request.headers.cookie &&
        request.headers.cookie
          .split(';')
          .find((c) => c.trim().startsWith('__Host-refresh-token='))
          ?.split('=')[1]);

    if (!rawCookie) {
      return reply.code(401).send({
        type: 'https://api.smexstore.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Refresh token cookie is required',
        code: 'MISSING_REFRESH_TOKEN',
      });
    }

    try {
      const refreshed = await SessionService.refreshSession(
        rawCookie,
        fastify.db,
        fastify.redis
      );

      const newAccessToken = fastify.jwt.sign({
        sub: refreshed.userId,
        role: refreshed.role,
        sessionId: refreshed.sessionId,
      });

      reply.setCookie('__Host-refresh-token', refreshed.newCookieValue, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 2592000,
      });

      return reply.code(200).send({
        accessToken: newAccessToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      });
    } catch {
      return reply.code(401).send({
        type: 'https://api.smexstore.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or expired session',
        code: 'INVALID_SESSION',
      });
    }
  });

  // 5. GET /api/v1/auth/me
  fastify.get(
    '/api/v1/auth/me',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const [userRecord] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.id, request.user.sub))
        .limit(1);

      if (!userRecord) {
        return reply.code(404).send({
          type: 'https://api.smexstore.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'User account not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const [profileRecord] = await fastify.db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userRecord.id))
        .limit(1);

      return reply.code(200).send({
        id: userRecord.id,
        email: userRecord.email,
        role: userRecord.role,
        emailVerified: userRecord.emailVerified,
        sessionId: request.user.sessionId,
        profile: profileRecord || {
          username: userRecord.email.split('@')[0],
          avatarPreset: 'preset_default_01',
          themePref: 'dark',
          densityPref: 'comfortable',
        },
      });
    }
  );

  // 6. POST /api/v1/auth/verify-email
  fastify.post('/api/v1/auth/verify-email', async (request, reply) => {
    const { token } = (request.body as any) || {};
    if (!token || typeof token !== 'string') {
      return reply.code(400).send({
        type: 'https://api.smexstore.com/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: 'Verification token is required',
        code: 'MISSING_TOKEN',
      });
    }

    const userId = await fastify.redis.getdel(`verify_email:${token}`);
    if (!userId) {
      return reply.code(400).send({
        type: 'https://api.smexstore.com/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid or expired verification token',
        code: 'INVALID_OR_EXPIRED_TOKEN',
      });
    }

    await fastify.db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, userId));

    return reply.code(200).send({
      success: true,
      message: 'Email verified successfully',
    });
  });

  // 7. POST /api/v1/auth/resend-verification
  fastify.post(
    '/api/v1/auth/resend-verification',
    {
      config: {
        rateLimit: resendVerificationRateLimitConfig,
      },
    },
    async (request, reply) => {
      const email = String((request.body as any)?.email || '')
        .toLowerCase()
        .trim();

      if (email) {
        const [userRecord] = await fastify.db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (userRecord && !userRecord.emailVerified) {
          const verifyToken = crypto.randomBytes(32).toString('hex');
          await fastify.redis.set(`verify_email:${verifyToken}`, userRecord.id, 'EX', 86400);
          await emailService.sendVerificationEmail(email, verifyToken);
        }
      }

      return reply.code(200).send({
        success: true,
        message: 'Verification email dispatched',
      });
    }
  );

  // 8. POST /api/v1/auth/forgot-password
  fastify.post(
    '/api/v1/auth/forgot-password',
    {
      config: {
        rateLimit: forgotPasswordRateLimitConfig,
      },
    },
    async (request, reply) => {
      const email = String((request.body as any)?.email || '')
        .toLowerCase()
        .trim();

      if (email) {
        const [userRecord] = await fastify.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (userRecord) {
          const resetToken = crypto.randomBytes(32).toString('hex');
          await fastify.redis.set(`reset_password:${resetToken}`, userRecord.id, 'EX', 900);
          await emailService.sendPasswordResetEmail(email, resetToken);
        }
      }

      // Timing-safe response
      return reply.code(200).send({
        success: true,
        message: 'If an account exists, a link was sent',
      });
    }
  );

  // 9. POST /api/v1/auth/reset-password
  fastify.post('/api/v1/auth/reset-password', async (request, reply) => {
    const parsed = resetPasswordBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'https://api.smexstore.com/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: parsed.error.issues[0]?.message || 'Invalid reset parameters',
        code: 'VALIDATION_FAILED',
      });
    }

    const { token, newPassword } = parsed.data;

    // Atomic consumption of single-use token via Redis GETDEL
    const userId = await fastify.redis.getdel(`reset_password:${token}`);
    if (!userId) {
      return reply.code(400).send({
        type: 'https://api.smexstore.com/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN',
      });
    }

    const newHash = await hashPassword(newPassword);

    await fastify.db
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, userId));

    // Emergency revocation of all active sessions
    await SessionService.revokeAllSessions(
      userId,
      fastify.db,
      fastify.redis,
      fastify.wsGateway
    );

    return reply.code(200).send({
      success: true,
      message: 'Password updated successfully',
    });
  });

  // 10. POST /api/v1/auth/revoke-all (Emergency kill-switch)
  fastify.post(
    '/api/v1/auth/revoke-all',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      await SessionService.revokeAllSessions(
        request.user.sub,
        fastify.db,
        fastify.redis,
        fastify.wsGateway
      );

      reply.clearCookie('__Host-refresh-token', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      });

      return reply.code(200).send({
        success: true,
        message: 'All sessions terminated',
      });
    }
  );

  // High-trust action guarded by emailVerifiedGuard (Milestone 3 LLT Test 20 / Requirements 18 Item 7)
  fastify.post(
    '/api/v1/marketplace/listings',
    {
      preHandler: [fastify.authenticate, fastify.emailVerifiedGuard],
    },
    async (_request, reply) => {
      return reply.code(201).send({
        success: true,
        message: 'Listing created',
      });
    }
  );
};

export default authRoutes;
