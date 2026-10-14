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
      const err: any = new Error('Member capacity must be between 1 and 10');
      err.statusCode = 422;
      err.code = 'INVALID_MEMBER_CAP';
      throw err;
    }

    // MLBB Single Squad Rule: Check if creator is already an active member/captain of a squad in this game
    const [existingMembership] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(and(eq(teamMembers.userId, userId), eq(teams.gameSlug, gameSlug)))
      .limit(1);

    if (existingMembership) {
      const err: any = new Error('You are already an active member of a squad in this game');
      err.statusCode = 400;
      err.code = 'ALREADY_IN_SQUAD';
      throw err;
    }

    // Duplicate squad name pre-check
    const [existingName] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.name, input.name))
      .limit(1);

    if (existingName) {
      const err: any = new Error('A squad with this name already exists');
      err.statusCode = 409;
      err.code = 'DUPLICATE_TEAM_NAME';
      throw err;
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
      const err: any = new Error('Team not found');
      err.statusCode = 404;
      err.code = 'TEAM_NOT_FOUND';
      throw err;
    }

    if (existing.captainId !== callerId) {
      const err: any = new Error('Only team captain can update squad metadata');
      err.statusCode = 403;
      err.code = 'CAPTAIN_PERMISSION_REQUIRED';
      throw err;
    }

    if (input.memberCap !== undefined) {
      if (input.memberCap < 1 || input.memberCap > 10) {
        const err: any = new Error('Member capacity must be between 1 and 10');
        err.statusCode = 422;
        err.code = 'INVALID_MEMBER_CAP';
        throw err;
      }

      const [activeCountResult] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));

      const currentMembers = activeCountResult?.count ?? 0;
      if (input.memberCap < currentMembers) {
        const err: any = new Error(
          `Cannot set member capacity to ${input.memberCap} because the team currently has ${currentMembers} active members`
        );
        err.statusCode = 400;
        err.code = 'CAPACITY_BELOW_MEMBER_COUNT';
        throw err;
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
      const err: any = new Error('Team not found');
      err.statusCode = 404;
      err.code = 'TEAM_NOT_FOUND';
      throw err;
    }

    if (existing.captainId !== callerId) {
      const err: any = new Error('Only team captain can disband squad');
      err.statusCode = 403;
      err.code = 'CAPTAIN_PERMISSION_REQUIRED';
      throw err;
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
        const err: any = new Error('Team not found');
        err.statusCode = 404;
        err.code = 'TEAM_NOT_FOUND';
        throw err;
      }

      const isCaptain = team.captainId === callerId;
      const isSelf = targetUserId === callerId;

      if (!isCaptain && !isSelf) {
        const err: any = new Error('You do not have permission to remove this member');
        err.statusCode = 403;
        err.code = 'CAPTAIN_PERMISSION_REQUIRED';
        throw err;
      }

      // Captain cannot voluntarily leave without transferring captaincy or disbanding
      if (isSelf && team.captainId === callerId) {
        const err: any = new Error('Captain cannot leave squad without transferring captaincy');
        err.statusCode = 400;
        err.code = 'CAPTAIN_CANNOT_LEAVE';
        throw err;
      }

      const [memberRecord] = await tx
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)))
        .for('update');

      if (!memberRecord) {
        const err: any = new Error('Member not found in squad roster');
        err.statusCode = 404;
        err.code = 'MEMBER_NOT_FOUND';
        throw err;
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
      const err: any = new Error('Target is already the captain');
      err.statusCode = 400;
      err.code = 'ALREADY_CAPTAIN';
      throw err;
    }

    return await db.transaction(async (tx) => {
      const [team] = await tx
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .for('update');

      if (!team) {
        const err: any = new Error('Team not found');
        err.statusCode = 404;
        err.code = 'TEAM_NOT_FOUND';
        throw err;
      }

      if (team.captainId !== callerId) {
        const err: any = new Error('Only the current captain can transfer captaincy');
        err.statusCode = 403;
        err.code = 'CAPTAIN_PERMISSION_REQUIRED';
        throw err;
      }

      // Verify new captain is an active member of this squad
      const [targetMember] = await tx
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newCaptainId)))
        .for('update');

      if (!targetMember) {
        const err: any = new Error('Target player must be an active member of the squad');
        err.statusCode = 400;
        err.code = 'TARGET_NOT_A_MEMBER';
        throw err;
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
