import { eq, and, sql, desc, or, ilike } from 'drizzle-orm';
import type { SmexDatabase } from '../db/index.js';
import {
  teams,
  teamMembers,
  teamJoinRequests,
  type Team,
  type TeamMember,
  type TeamJoinRequest,
} from '../db/schema/teams.js';
import { profiles } from '../db/schema/users.js';

export interface ServiceError extends Error {
  statusCode?: number;
  code?: string;
}

export function createServiceError(message: string, statusCode: number, code: string): ServiceError {
  const err = new Error(message) as ServiceError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export interface CreateTeamInput {
  name: string;
  tag: string;
  memberCap?: number;
  gameSlug?: string;
  description?: string;
}

export interface UpdateTeamInput {
  name?: string;
  tag?: string;
  memberCap?: number;
  status?: 'open' | 'closed';
  description?: string;
}

export interface TeamFilterOptions {
  q?: string;
  gameSlug?: string;
  status?: 'open' | 'closed' | 'all';
  limit?: number;
  offset?: number;
}

export interface TeamSummary extends Team {
  activeMembersCount: number;
  openSlots: number;
  availability: 'open' | 'closed' | 'full';
  captainUsername?: string | null;
  captainIgn?: string | null;
  captainAvatarPreset?: string | null;
}

export interface TeamMemberDetails extends TeamMember {
  username?: string | null;
  inGameId?: string | null;
  avatarPreset?: string | null;
  playstyle?: string | null;
}

export interface TeamDetails extends TeamSummary {
  members: TeamMemberDetails[];
  hasPendingRequest?: boolean;
  myJoinRequest?: TeamJoinRequest | null;
}

export class TeamService {
  /**
   * Creates a new squad, setting caller as initial captain
   */
  static async createTeam(
    userId: string,
    input: CreateTeamInput,
    db: SmexDatabase
  ): Promise<{ team: Team; captainMember: TeamMember }> {
    const gameSlug = input.gameSlug || 'mlbb';

    // Boundary check for memberCap
    if (input.memberCap !== undefined && (input.memberCap < 1 || input.memberCap > 10)) {
      throw createServiceError('Member capacity must be between 1 and 10', 422, 'INVALID_MEMBER_CAP');
    }

    // MLBB Single Squad Rule: Check if creator is already an active member/captain of a squad in this game
    const [existingMembership] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(and(eq(teamMembers.userId, userId), eq(teams.gameSlug, gameSlug)))
      .limit(1);

    if (existingMembership) {
      throw createServiceError('You are already an active member of a squad in this game', 400, 'ALREADY_IN_SQUAD');
    }

    // Duplicate squad name pre-check
    const [existingName] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.name, input.name))
      .limit(1);

    if (existingName) {
      throw createServiceError('A squad with this name already exists', 409, 'DUPLICATE_TEAM_NAME');
    }

    const memberCap = input.memberCap ?? 5;
    const initialStatus = memberCap === 1 ? 'closed' : 'open';

    return await db.transaction(async (tx) => {
      const [newTeam] = await tx
        .insert(teams)
        .values({
          name: input.name,
          tag: input.tag,
          captainId: userId,
          gameSlug,
          memberCap,
          status: initialStatus,
          description: input.description,
        })
        .returning();

      const [captainMember] = await tx
        .insert(teamMembers)
        .values({
          teamId: newTeam.id,
          userId,
          memberRole: 'captain',
        })
        .returning();

      return { team: newTeam, captainMember };
    });
  }

  /**
   * Queries squads with dynamic open slots calculation and filters without N+1 queries
   */
  static async listTeams(
    options: TeamFilterOptions,
    db: SmexDatabase
  ): Promise<{ teams: TeamSummary[]; total: number }> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);

    // Build base conditions
    const conditions = [];

    if (options.gameSlug) {
      conditions.push(eq(teams.gameSlug, options.gameSlug));
    }

    if (options.status && options.status !== 'all') {
      conditions.push(eq(teams.status, options.status));
    }

    if (options.q && options.q.trim()) {
      const term = `%${options.q.trim()}%`;
      conditions.push(or(ilike(teams.name, term), ilike(teams.tag, term)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Aggregated single query with dynamic count of members and captain profile
    const rawRows = await db
      .select({
        id: teams.id,
        name: teams.name,
        tag: teams.tag,
        captainId: teams.captainId,
        gameSlug: teams.gameSlug,
        memberCap: teams.memberCap,
        status: teams.status,
        description: teams.description,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
        activeMembersCount: sql<number>`COALESCE(COUNT(DISTINCT ${teamMembers.id}), 0)::int`,
        captainUsername: profiles.username,
        captainIgn: profiles.inGameId,
        captainAvatarPreset: profiles.avatarPreset,
      })
      .from(teams)
      .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .leftJoin(profiles, eq(teams.captainId, profiles.userId))
      .where(whereClause)
      .groupBy(teams.id, profiles.userId)
      .orderBy(desc(teams.createdAt))
      .limit(limit)
      .offset(offset);

    const summaries: TeamSummary[] = rawRows.map((row) => {
      const activeMembersCount = row.activeMembersCount;
      const openSlots = Math.max(0, row.memberCap - activeMembersCount);
      let availability: 'open' | 'closed' | 'full' = 'closed';
      if (row.status === 'open' && openSlots > 0) {
        availability = 'open';
      } else if (openSlots === 0) {
        availability = 'full';
      } else {
        availability = 'closed';
      }

      return {
        id: row.id,
        name: row.name,
        tag: row.tag,
        captainId: row.captainId,
        gameSlug: row.gameSlug,
        memberCap: row.memberCap,
        status: row.status,
        description: row.description,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        activeMembersCount,
        openSlots,
        availability,
        captainUsername: row.captainUsername,
        captainIgn: row.captainIgn,
        captainAvatarPreset: row.captainAvatarPreset,
      };
    });

    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(teams)
      .where(whereClause);

    return {
      teams: summaries,
      total: countResult?.count ?? summaries.length,
    };
  }

  /**
   * Retrieves single squad with detailed roster members
   */
  static async getTeamById(
    teamId: string,
    db: SmexDatabase,
    callerId?: string
  ): Promise<TeamDetails | null> {
    const [teamRow] = await db
      .select({
        id: teams.id,
        name: teams.name,
        tag: teams.tag,
        captainId: teams.captainId,
        gameSlug: teams.gameSlug,
        memberCap: teams.memberCap,
        status: teams.status,
        description: teams.description,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
        captainUsername: profiles.username,
        captainIgn: profiles.inGameId,
        captainAvatarPreset: profiles.avatarPreset,
      })
      .from(teams)
      .leftJoin(profiles, eq(teams.captainId, profiles.userId))
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!teamRow) {
      return null;
    }

    const memberRows = await db
      .select({
        id: teamMembers.id,
        teamId: teamMembers.teamId,
        userId: teamMembers.userId,
        memberRole: teamMembers.memberRole,
        joinedAt: teamMembers.joinedAt,
        username: profiles.username,
        inGameId: profiles.inGameId,
        avatarPreset: profiles.avatarPreset,
        playstyle: profiles.playstyle,
      })
      .from(teamMembers)
      .leftJoin(profiles, eq(teamMembers.userId, profiles.userId))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(teamMembers.joinedAt);

    const activeMembersCount = memberRows.length;
    const openSlots = Math.max(0, teamRow.memberCap - activeMembersCount);
    let availability: 'open' | 'closed' | 'full' = 'closed';
    if (teamRow.status === 'open' && openSlots > 0) {
      availability = 'open';
    } else if (openSlots === 0) {
      availability = 'full';
    } else {
      availability = 'closed';
    }

    let hasPendingRequest = false;
    let myJoinRequest: TeamJoinRequest | null = null;
    if (callerId) {
      const [pendingReq] = await db
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

      if (pendingReq) {
        hasPendingRequest = true;
        myJoinRequest = pendingReq;
      }
    }

    return {
      ...teamRow,
      activeMembersCount,
      openSlots,
      availability,
      members: memberRows,
      hasPendingRequest,
      myJoinRequest,
    };
  }

  /**
   * Updates squad metadata. Requires captain authority.
   */
  static async updateTeam(
    teamId: string,
    callerId: string,
    input: UpdateTeamInput,
    db: SmexDatabase
  ): Promise<Team> {
    const [existing] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!existing) {
      throw createServiceError('Team not found', 404, 'TEAM_NOT_FOUND');
    }

    if (existing.captainId !== callerId) {
      throw createServiceError('Only team captain can update squad metadata', 403, 'CAPTAIN_PERMISSION_REQUIRED');
    }

    if (input.memberCap !== undefined) {
      if (input.memberCap < 1 || input.memberCap > 10) {
        throw createServiceError('Member capacity must be between 1 and 10', 422, 'INVALID_MEMBER_CAP');
      }

      const [activeCountResult] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));

      const currentMembers = activeCountResult?.count ?? 0;
      if (input.memberCap < currentMembers) {
        throw createServiceError(
          `Cannot set member capacity to ${input.memberCap} because the team currently has ${currentMembers} active members`,
          400,
          'CAPACITY_BELOW_MEMBER_COUNT'
        );
      }
    }

    const [updated] = await db
      .update(teams)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    return updated;
  }

  /**
   * Disbands squad and cascades removal to all members and join requests.
   */
  static async disbandTeam(
    teamId: string,
    callerId: string,
    db: SmexDatabase
  ): Promise<{ success: boolean; message: string }> {
    const [existing] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!existing) {
      throw createServiceError('Team not found', 404, 'TEAM_NOT_FOUND');
    }

    if (existing.captainId !== callerId) {
      throw createServiceError('Only team captain can disband squad', 403, 'CAPTAIN_PERMISSION_REQUIRED');
    }

    await db.delete(teams).where(eq(teams.id, teamId));

    return {
      success: true,
      message: 'Squad successfully disbanded',
    };
  }

  /**
   * Removes member from squad (kick by captain OR voluntary leave by member).
   * Preserves captain's configured squad recruitment status.
   */
  static async removeMember(
    teamId: string,
    targetUserId: string,
    callerId: string,
    db: SmexDatabase
  ): Promise<{ success: boolean; message: string }> {
    return await db.transaction(async (tx) => {
      const [team] = await tx
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .for('update');

      if (!team) {
        throw createServiceError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      const isCaptain = team.captainId === callerId;
      const isSelf = targetUserId === callerId;

      if (!isCaptain && !isSelf) {
        throw createServiceError('You do not have permission to remove this member', 403, 'CAPTAIN_PERMISSION_REQUIRED');
      }

      // Captain cannot voluntarily leave without transferring captaincy or disbanding
      if (isSelf && team.captainId === callerId) {
        throw createServiceError('Captain cannot leave squad without transferring captaincy', 400, 'CAPTAIN_CANNOT_LEAVE');
      }

      const [memberRecord] = await tx
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)))
        .for('update');

      if (!memberRecord) {
        throw createServiceError('Member not found in squad roster', 404, 'MEMBER_NOT_FOUND');
      }

      await tx
        .delete(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)));

      return {
        success: true,
        message: isSelf ? 'Successfully left squad' : 'Member removed from squad',
      };
    });
  }

  /**
   * Reassigns team ownership/captaincy to another verified roster member
   */
  static async transferCaptaincy(
    teamId: string,
    callerId: string,
    newCaptainId: string,
    db: SmexDatabase
  ): Promise<{ success: boolean; newCaptainId: string }> {
    if (newCaptainId === callerId) {
      throw createServiceError('Target is already the captain', 400, 'ALREADY_CAPTAIN');
    }

    return await db.transaction(async (tx) => {
      const [team] = await tx
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .for('update');

      if (!team) {
        throw createServiceError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      if (team.captainId !== callerId) {
        throw createServiceError('Only the current captain can transfer captaincy', 403, 'CAPTAIN_PERMISSION_REQUIRED');
      }

      // Verify new captain is an active member of this squad
      const [targetMember] = await tx
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newCaptainId)))
        .for('update');

      if (!targetMember) {
        throw createServiceError('Target player must be an active member of the squad', 400, 'TARGET_NOT_A_MEMBER');
      }

      // 1. Update teams table captainId
      await tx
        .update(teams)
        .set({ captainId: newCaptainId, updatedAt: new Date() })
        .where(eq(teams.id, teamId));

      // 2. Demote previous captain in teamMembers
      await tx
        .update(teamMembers)
        .set({ memberRole: 'member' })
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, callerId)));

      // 3. Promote target member in teamMembers
      await tx
        .update(teamMembers)
        .set({ memberRole: 'captain' })
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newCaptainId)));

      return {
        success: true,
        newCaptainId,
      };
    });
  }
}
