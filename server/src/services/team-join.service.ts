import { eq, and, sql, desc } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { SmexDatabase } from '../db/index.js';
import {
  teams,
  teamMembers,
  teamJoinRequests,
  type TeamJoinRequest,
} from '../db/schema/teams.js';
import { profiles } from '../db/schema/users.js';
import { NotificationService } from './notification.service.js';
import type { WsGatewayDecorator } from '../plugins/websocket.js';

export interface SubmitJoinRequestInput {
  playerIgn: string;
  playerRole: string;
  message?: string;
}

export interface JoinRequestWithProfile extends TeamJoinRequest {
  username?: string | null;
  avatarPreset?: string | null;
}

export class TeamJoinService {
  /**
   * Submits a join request to an open squad.
   * Enforces MLBB single squad rule and duplicate pending prevention.
   */
  static async submitJoinRequest(
    teamId: string,
    applicantId: string,
    input: SubmitJoinRequestInput,
    db: SmexDatabase,
    redis?: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<TeamJoinRequest> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      const err: any = new Error('Team not found');
      err.statusCode = 404;
      err.code = 'TEAM_NOT_FOUND';
      throw err;
    }

    // Verify that the squad is open and has available roster slots
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));

    const activeMembersCount = countResult?.count ?? 0;
    if (team.status === 'closed' || activeMembersCount >= team.memberCap) {
      const err: any = new Error('Cannot submit join request to a full or closed squad');
      err.statusCode = 400;
      err.code = 'TEAM_CLOSED';
      throw err;
    }

    // Check if user is already an active member of this squad
    const [existingRosterMember] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, applicantId)))
      .limit(1);

    if (existingRosterMember) {
      const err: any = new Error('You are already a member of this squad');
      err.statusCode = 400;
      err.code = 'ALREADY_ROSTER_MEMBER';
      throw err;
    }

    // MLBB Single Squad Rule: Check if user is already in any active squad for this game
    const [existingGameMembership] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(and(eq(teamMembers.userId, applicantId), eq(teams.gameSlug, team.gameSlug)))
      .limit(1);

    if (existingGameMembership) {
      const err: any = new Error('Player is already a member of an active squad in this game');
      err.statusCode = 400;
      err.code = 'ALREADY_IN_SQUAD';
      throw err;
    }

    // Duplicate pending join request pre-check
    const [existingPending] = await db
      .select({ id: teamJoinRequests.id })
      .from(teamJoinRequests)
      .where(
        and(
          eq(teamJoinRequests.teamId, teamId),
          eq(teamJoinRequests.userId, applicantId),
          eq(teamJoinRequests.status, 'pending')
        )
      )
      .limit(1);

    if (existingPending) {
      const err: any = new Error('You already have a pending join request for this squad');
      err.statusCode = 409;
      err.code = 'DUPLICATE_PENDING_REQUEST';
      throw err;
    }

    let createdRequest: TeamJoinRequest;

    try {
      const [inserted] = await db
        .insert(teamJoinRequests)
        .values({
          teamId,
          userId: applicantId,
          playerIgn: input.playerIgn,
          playerRole: input.playerRole,
          message: input.message,
          status: 'pending',
        })
        .returning();

      createdRequest = inserted;
    } catch (dbErr: any) {
      // 23505 is PostgreSQL unique constraint violation (partial index team_join_requests_pending_unq)
      if (dbErr.code === '23505' || dbErr.cause?.code === '23505') {
        const err: any = new Error('You already have a pending join request for this squad');
        err.statusCode = 409;
        err.code = 'DUPLICATE_PENDING_REQUEST';
        throw err;
      }
      throw dbErr;
    }

    // Dispatch real-time WebSocket / Redis notification to captain
    try {
      await NotificationService.notifyCaptainJoinRequest(
        team.captainId,
        {
          teamId,
          teamName: team.name,
          requestId: createdRequest.id,
          applicantId,
          playerIgn: input.playerIgn,
          playerRole: input.playerRole,
        },
        redis,
        wsGateway
      );
    } catch {
      // Non-blocking notification dispatch: transport failures must not fail the created request
    }

    return createdRequest;
  }

  /**
   * Retrieves pending and historical join requests for a squad. Captain only.
   */
  static async listJoinRequests(
    teamId: string,
    callerId: string,
    db: SmexDatabase
  ): Promise<JoinRequestWithProfile[]> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      const err: any = new Error('Team not found');
      err.statusCode = 404;
      err.code = 'TEAM_NOT_FOUND';
      throw err;
    }

    if (team.captainId !== callerId) {
      const err: any = new Error('Only the team captain can view join requests');
      err.statusCode = 403;
      err.code = 'CAPTAIN_PERMISSION_REQUIRED';
      throw err;
    }

    const rows = await db
      .select({
        id: teamJoinRequests.id,
        teamId: teamJoinRequests.teamId,
        userId: teamJoinRequests.userId,
        playerIgn: teamJoinRequests.playerIgn,
        playerRole: teamJoinRequests.playerRole,
        message: teamJoinRequests.message,
        status: teamJoinRequests.status,
        createdAt: teamJoinRequests.createdAt,
        updatedAt: teamJoinRequests.updatedAt,
        username: profiles.username,
        avatarPreset: profiles.avatarPreset,
      })
      .from(teamJoinRequests)
      .leftJoin(profiles, eq(teamJoinRequests.userId, profiles.userId))
      .where(eq(teamJoinRequests.teamId, teamId))
      .orderBy(desc(teamJoinRequests.createdAt));

    return rows;
  }

  /**
   * Concurrency-safe atomic resolution (accept/reject) of join request using SELECT FOR UPDATE
   */
  static async resolveJoinRequest(
    teamId: string,
    requestId: string,
    callerId: string,
    action: 'accept' | 'reject',
    db: SmexDatabase,
    redis?: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<{ success: boolean; status: 'accepted' | 'rejected' }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      const err: any = new Error('Team not found');
      err.statusCode = 404;
      err.code = 'TEAM_NOT_FOUND';
      throw err;
    }

    if (team.captainId !== callerId) {
      const err: any = new Error('Only the team captain can resolve join requests');
      err.statusCode = 403;
      err.code = 'CAPTAIN_PERMISSION_REQUIRED';
      throw err;
    }

    const txResult = await db.transaction(async (tx) => {
      // 1. Pessimistic row-level lock on teams table
      const [lockedTeam] = await tx
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .for('update');

      // 2. Lock target join request record
      const [joinReq] = await tx
        .select()
        .from(teamJoinRequests)
        .where(and(eq(teamJoinRequests.id, requestId), eq(teamJoinRequests.teamId, teamId)))
        .for('update');

      if (!joinReq) {
        const err: any = new Error('Join request not found');
        err.statusCode = 404;
        err.code = 'REQUEST_NOT_FOUND';
        throw err;
      }

      // If action is accept, check roster capacity first under the lock
      if (action === 'accept') {
        const [countResult] = await tx
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(teamMembers)
          .where(eq(teamMembers.teamId, teamId));

        const activeCount = countResult?.count ?? 0;

        if (activeCount >= lockedTeam.memberCap) {
          await tx
            .update(teamJoinRequests)
            .set({ status: 'rejected', updatedAt: new Date() })
            .where(eq(teamJoinRequests.id, requestId));

          const err: any = new Error('Team roster is full');
          err.statusCode = 409;
          err.code = 'TEAM_ROSTER_FULL';
          throw err;
        }
      }

      if (joinReq.status !== 'pending') {
        const err: any = new Error(`Request has already been resolved (${joinReq.status})`);
        err.statusCode = 400;
        err.code = 'REQUEST_ALREADY_RESOLVED';
        throw err;
      }

      if (action === 'reject') {
        await tx
          .update(teamJoinRequests)
          .set({ status: 'rejected', updatedAt: new Date() })
          .where(eq(teamJoinRequests.id, requestId));

        return {
          success: true,
          status: 'rejected' as const,
          applicantId: joinReq.userId,
          teamName: lockedTeam.name,
        };
      }

      // Action is 'accept'
      const [countResult] = await tx
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));

      const activeCount = countResult?.count ?? 0;

      // 5. MLBB Single Squad check for applicant
      const [otherSquad] = await tx
        .select()
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(and(eq(teamMembers.userId, joinReq.userId), eq(teams.gameSlug, lockedTeam.gameSlug)))
        .limit(1);

      if (otherSquad) {
        await tx
          .update(teamJoinRequests)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(teamJoinRequests.id, requestId));

        const err: any = new Error('Player has already joined another squad in this game');
        err.statusCode = 409;
        err.code = 'ALREADY_IN_SQUAD';
        throw err;
      }

      // 6. Insert applicant into team_members with platform role 'member'
      await tx
        .insert(teamMembers)
        .values({
          teamId,
          userId: joinReq.userId,
          memberRole: 'member',
        });

      // 7. Update join request to accepted
      await tx
        .update(teamJoinRequests)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(teamJoinRequests.id, requestId));

      // 8. If new count reaches memberCap: auto-close squad & batch-cancel remaining pending requests
      const newCount = activeCount + 1;
      if (newCount >= lockedTeam.memberCap) {
        await tx
          .update(teams)
          .set({ status: 'closed', updatedAt: new Date() })
          .where(eq(teams.id, teamId));

        await tx
          .update(teamJoinRequests)
          .set({ status: 'rejected', updatedAt: new Date() })
          .where(and(eq(teamJoinRequests.teamId, teamId), eq(teamJoinRequests.status, 'pending')));
      }

      return {
        success: true,
        status: 'accepted' as const,
        applicantId: joinReq.userId,
        teamName: lockedTeam.name,
      };
    });

    // 9. Dispatch real-time WebSocket / Redis notification to applicant after transaction has committed
    try {
      await NotificationService.notifyApplicantStatus(
        txResult.applicantId,
        { teamId, teamName: txResult.teamName, status: txResult.status },
        redis,
        wsGateway
      );
    } catch {
      // Non-blocking notification dispatch: transport failures must not fail the committed transaction
    }

    return { success: txResult.success, status: txResult.status };
  }

  /**
   * Allows applicant to voluntarily cancel their pending join request
   */
  static async cancelJoinRequest(
    teamId: string,
    requestId: string,
    callerId: string,
    db: SmexDatabase
  ): Promise<{ success: boolean; message: string }> {
    const [joinReq] = await db
      .select()
      .from(teamJoinRequests)
      .where(and(eq(teamJoinRequests.id, requestId), eq(teamJoinRequests.teamId, teamId)))
      .limit(1);

    if (!joinReq) {
      const err: any = new Error('Join request not found');
      err.statusCode = 404;
      err.code = 'REQUEST_NOT_FOUND';
      throw err;
    }

    if (joinReq.userId !== callerId) {
      const err: any = new Error('You can only cancel your own join request');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (joinReq.status !== 'pending') {
      const err: any = new Error(`Cannot cancel a request that is already ${joinReq.status}`);
      err.statusCode = 400;
      err.code = 'REQUEST_ALREADY_RESOLVED';
      throw err;
    }

    await db
      .update(teamJoinRequests)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(teamJoinRequests.id, requestId));

    return {
      success: true,
      message: 'Join request cancelled',
    };
  }

  /**
   * Retrieves the active pending join request submitted by caller for target squad
   */
  static async getMyJoinRequest(
    teamId: string,
    callerId: string,
    db: SmexDatabase
  ): Promise<TeamJoinRequest | null> {
    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      const err: any = new Error('Team not found');
      err.statusCode = 404;
      err.code = 'TEAM_NOT_FOUND';
      throw err;
    }

    const [joinReq] = await db
      .select()
      .from(teamJoinRequests)
      .where(
        and(
          eq(teamJoinRequests.teamId, teamId),
          eq(teamJoinRequests.userId, callerId),
          eq(teamJoinRequests.status, 'pending')
        )
      )
      .limit(1);

    return joinReq || null;
  }
}
