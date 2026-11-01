import type { Redis } from 'ioredis';
import { eq, and, sql, desc, or, ilike } from 'drizzle-orm';
import type { SmexDatabase } from '../db/index.js';
import { users, profiles } from '../db/schema/users.js';
import { teams, teamMembers } from '../db/schema/teams.js';
import { tournamentParticipants, tournaments } from '../db/schema/tournaments.js';
import { activityLogs } from '../db/schema/activity.js';
import { SessionService } from './session.service.js';
import { NotificationService } from './notification.service.js';
import { TournamentParticipantService } from './tournament-participant.service.js';
import type { WsGatewayDecorator } from '../plugins/websocket.js';
import type { UserRole } from '@smex/shared';

export interface UserModerationErrorOptions {
  code: string;
  statusCode: number;
}

export class UserModerationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, options: UserModerationErrorOptions) {
    super(message);
    this.name = 'UserModerationError';
    this.code = options.code;
    this.statusCode = options.statusCode;
  }
}

export interface BanUserResult {
  success: boolean;
  bannedUserId: string;
  banReason: string;
  bannedAt: Date;
}

export interface UnbanUserResult {
  success: boolean;
  unbannedUserId: string;
}

export interface DisbandTeamResult {
  success: boolean;
  teamId: string;
  teamName: string;
  withdrawnTournamentsCount: number;
  notifiedMembersCount: number;
}

export interface UpdateUserRoleResult {
  success: boolean;
  user: {
    id: string;
    email: string;
    role: UserRole;
    promotedBy?: string | null;
    promotedAt?: Date | null;
  };
}

export interface GetUsersFilter {
  role?: UserRole;
  isBanned?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export class UserModerationService {
  /**
   * Bans a user account, revokes all sessions in Redis and PostgreSQL,
   * dispatches real-time session:revoked frame, and logs the action in activity_logs.
   */
  static async banUser(
    targetUserId: string,
    reason: string,
    adminId: string,
    db: SmexDatabase,
    redis: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<BanUserResult> {
    if (!reason || reason.trim().length === 0) {
      throw new UserModerationError('Ban reason is mandatory', {
        code: 'VALIDATION_FAILED',
        statusCode: 400,
      });
    }

    const [targetUser] = await db
      .select({ id: users.id, role: users.role, isBanned: users.isBanned })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      throw new UserModerationError(`User with id '${targetUserId}' not found`, {
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    }

    // Platform administrators cannot ban themselves or other administrators
    if (targetUser.role === 'admin' || targetUserId === adminId) {
      throw new UserModerationError('Cannot ban an administrative account', {
        code: 'CANNOT_BAN_ADMIN',
        statusCode: 400,
      });
    }

    const bannedAt = new Date();

    // 1. Update user record in PostgreSQL
    await db
      .update(users)
      .set({
        isBanned: true,
        banReason: reason.trim(),
        bannedAt,
        updatedAt: bannedAt,
      })
      .where(eq(users.id, targetUserId));

    // 2. Insert audit log record
    await db.insert(activityLogs).values({
      userId: adminId,
      actionType: 'admin_user_ban',
      entityType: 'user',
      entityId: targetUserId,
      metadataJson: {
        reason: reason.trim(),
        adminId,
        bannedUserId: targetUserId,
      },
    });

    // 3. Set Redis ban cache key for O(1) authenticate lookup
    await redis.set(`banned_user:${targetUserId}`, '1', 'EX', 86400 * 30);

    // 4. Evict all Redis sessions and mark inactive in PostgreSQL
    await SessionService.revokeAllSessions(targetUserId, db, redis, wsGateway);

    // 5. Broadcast real-time WebSocket session:revoked frame with reason: 'account_banned'
    if (wsGateway) {
      wsGateway.broadcastToChannel(`user:${targetUserId}`, {
        event: 'session:revoked',
        channel: `user:${targetUserId}`,
        timestamp: Date.now(),
        reason: 'account_banned',
        payload: {
          reason: 'account_banned',
          banReason: reason.trim(),
        },
      });
      wsGateway.terminateUserSockets(targetUserId);
    }

    return {
      success: true,
      bannedUserId: targetUserId,
      banReason: reason.trim(),
      bannedAt,
    };
  }

  /**
   * Restores a banned user account, clears ban metadata, and removes Redis ban cache
   */
  static async unbanUser(
    targetUserId: string,
    adminId: string,
    db: SmexDatabase,
    redis: Redis
  ): Promise<UnbanUserResult> {
    const [targetUser] = await db
      .select({ id: users.id, isBanned: users.isBanned })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      throw new UserModerationError(`User with id '${targetUserId}' not found`, {
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    }

    const updatedAt = new Date();

    // 1. Restore user record in PostgreSQL
    await db
      .update(users)
      .set({
        isBanned: false,
        banReason: null,
        bannedAt: null,
        updatedAt,
      })
      .where(eq(users.id, targetUserId));

    // 2. Insert audit log record
    await db.insert(activityLogs).values({
      userId: adminId,
      actionType: 'admin_user_unban',
      entityType: 'user',
      entityId: targetUserId,
      metadataJson: {
        adminId,
        unbannedUserId: targetUserId,
      },
    });

    // 3. Clear Redis ban key
    await redis.del(`banned_user:${targetUserId}`);

    return {
      success: true,
      unbannedUserId: targetUserId,
    };
  }

  /**
   * Promotes or demotes user role (e.g. appointing or firing a Manager).
   * Standing appointment persisted in users table and activity_logs.
   * If demoting from manager to user, active sessions are revoked.
   */
  static async updateUserRole(
    targetUserId: string,
    newRole: UserRole,
    adminId: string,
    db: SmexDatabase,
    redis: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<UpdateUserRoleResult> {
    if (targetUserId === adminId) {
      throw new UserModerationError('Cannot alter your own administrative role', {
        code: 'CANNOT_ALTER_OWN_ROLE',
        statusCode: 400,
      });
    }

    const [targetUser] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      throw new UserModerationError(`User with id '${targetUserId}' not found`, {
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    }

    const previousRole = targetUser.role;
    const now = new Date();
    const promotedBy = newRole === 'manager' ? adminId : null;
    const promotedAt = newRole === 'manager' ? now : null;

    // 1. Update user record in PostgreSQL
    const [updatedUser] = await db
      .update(users)
      .set({
        role: newRole,
        promotedBy,
        promotedAt,
        updatedAt: now,
      })
      .where(eq(users.id, targetUserId))
      .returning();

    // 2. Insert audit log record
    const actionType =
      newRole === 'manager'
        ? 'admin_user_promote_manager'
        : previousRole === 'manager'
          ? 'admin_user_demote_manager'
          : 'admin_user_role_update';

    await db.insert(activityLogs).values({
      userId: adminId,
      actionType,
      entityType: 'user',
      entityId: targetUserId,
      metadataJson: {
        previousRole,
        newRole,
        adminId,
        targetUserId,
      },
    });

    // 3. If demoting manager to user, revoke active sessions so outdated credentials cannot be used
    if (previousRole === 'manager' && newRole === 'user') {
      await SessionService.revokeAllSessions(targetUserId, db, redis, wsGateway);
    }

    return {
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role as UserRole,
        promotedBy: updatedUser.promotedBy,
        promotedAt: updatedUser.promotedAt,
      },
    };
  }

  /**
   * Disbands a squad, sets status = 'disbanded', withdraws from upcoming tournaments,
   * notifies all members via system notification, and writes an audit log.
   */
  static async disbandTeam(
    teamId: string,
    reason: string,
    adminId: string,
    db: SmexDatabase,
    redis?: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<DisbandTeamResult> {
    const [targetTeam] = await db
      .select({ id: teams.id, name: teams.name, status: teams.status })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!targetTeam) {
      throw new UserModerationError(`Team with id '${teamId}' not found`, {
        code: 'TEAM_NOT_FOUND',
        statusCode: 404,
      });
    }

    const cleanReason = (reason && reason.trim()) || 'Disbanded by platform administration';

    // 1. Transition team status to 'disbanded'
    await db
      .update(teams)
      .set({
        status: 'disbanded',
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId));

    // 2. Withdraw from upcoming tournaments
    // Find all upcoming tournaments the squad is registered in
    const participants = await db
      .select({
        participantId: tournamentParticipants.id,
        tournamentId: tournamentParticipants.tournamentId,
        status: tournaments.status,
      })
      .from(tournamentParticipants)
      .innerJoin(tournaments, eq(tournamentParticipants.tournamentId, tournaments.id))
      .where(
        and(
          eq(tournamentParticipants.teamId, teamId),
          or(eq(tournaments.status, 'upcoming'), eq(tournaments.status, 'registration_open'))
        )
      );

    const affectedTournamentIds = new Set<string>();
    let withdrawnCount = 0;
    for (const p of participants) {
      await db
        .delete(tournamentParticipants)
        .where(eq(tournamentParticipants.id, p.participantId));
      withdrawnCount++;
      affectedTournamentIds.add(p.tournamentId);
    }

    // Re-compact seeds sequentially for all affected tournaments (Bug 5)
    for (const tourneyId of affectedTournamentIds) {
      await TournamentParticipantService.recompactSeeds(tourneyId, db);
    }

    // 3. Fetch all team members to deliver disbandment notification
    const members = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));

    const notificationMessage = `Squad '${targetTeam.name}' has been disbanded by administration.`;
    for (const member of members) {
      await NotificationService.dispatchNotification(
        member.userId,
        'system',
        'Squad Disbanded',
        notificationMessage,
        {
          entityType: 'team',
          entityId: teamId,
          metadata: {
            teamId,
            teamName: targetTeam.name,
            reason: cleanReason,
          },
        },
        db,
        redis,
        wsGateway
      );
    }

    // 4. Purge roster records from team_members for disbanded squad
    await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));

    // 5. Record administrative intervention in activity_logs
    await db.insert(activityLogs).values({
      userId: adminId,
      actionType: 'admin_team_disband',
      entityType: 'team',
      entityId: teamId,
      metadataJson: {
        teamId,
        teamName: targetTeam.name,
        reason: cleanReason,
        adminId,
        withdrawnTournaments: withdrawnCount,
        notifiedMembers: members.length,
      },
    });

    return {
      success: true,
      teamId,
      teamName: targetTeam.name,
      withdrawnTournamentsCount: withdrawnCount,
      notifiedMembersCount: members.length,
    };
  }

  /**
   * Retrieves paginated list of users with optional role, ban status, and search filters
   */
  static async getUsers(
    filter: GetUsersFilter,
    db: SmexDatabase
  ): Promise<{ users: Array<unknown>; total: number; page: number; limit: number }> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.max(1, Math.min(100, filter.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (filter.role) {
      conditions.push(eq(users.role, filter.role));
    }
    if (filter.isBanned !== undefined) {
      conditions.push(eq(users.isBanned, filter.isBanned));
    }
    if (filter.search && filter.search.trim().length > 0) {
      const searchTerm = `%${filter.search.trim()}%`;
      conditions.push(
        or(
          ilike(users.email, searchTerm),
          ilike(profiles.username, searchTerm),
          ilike(profiles.inGameId, searchTerm)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        emailVerified: users.emailVerified,
        isBanned: users.isBanned,
        banReason: users.banReason,
        bannedAt: users.bannedAt,
        promotedBy: users.promotedBy,
        promotedAt: users.promotedAt,
        createdAt: users.createdAt,
        username: profiles.username,
        inGameId: profiles.inGameId,
        avatarPreset: profiles.avatarPreset,
      })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ totalCount }] = await db
      .select({ totalCount: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(whereClause);

    return {
      users: userList,
      total: totalCount || 0,
      page,
      limit,
    };
  }
}
