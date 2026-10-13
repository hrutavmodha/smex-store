import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TeamCard, type TeamCardData } from '../components/teams/TeamCard';
import { TeamDetailModal, type RosterMember, type JoinRequestItem } from '../components/teams/TeamDetailModal';
import TeamsPage from '../app/teams/page';

import teamCardSource from '../components/teams/TeamCard.tsx?raw';
import teamModalSource from '../components/teams/TeamDetailModal.tsx?raw';
import teamsPageSource from '../app/teams/page.tsx?raw';

const mockTeams: TeamCardData[] = [
  {
    id: 'team-1',
    name: 'Omega Esports',
    tag: 'OMG',
    captainId: 'user-cap-1',
    gameSlug: 'mlbb',
    memberCap: 5,
    status: 'open',
    description: 'Premier tournament roster',
    activeMembersCount: 3,
    openSlots: 2,
    availability: 'open',
    captainUsername: 'OmegaCaptain',
    captainIgn: 'OMG_Leader',
  },
  {
    id: 'team-2',
    name: 'Valkyrie Squad',
    tag: 'VALK',
    captainId: 'user-cap-2',
    gameSlug: 'mlbb',
    memberCap: 5,
    status: 'closed',
    description: 'Full competitive squad',
    activeMembersCount: 5,
    openSlots: 0,
    availability: 'full',
    captainUsername: 'ValkLead',
    captainIgn: 'VALK_Alpha',
  },
];

const mockMembers: RosterMember[] = [
  {
    id: 'mem-1',
    userId: 'user-cap-1',
    memberRole: 'captain',
    joinedAt: new Date().toISOString(),
    username: 'OmegaCaptain',
    inGameId: 'OMG_Leader',
    avatarPreset: 'preset_default_01',
    playstyle: 'IGL',
  },
  {
    id: 'mem-2',
    userId: 'user-mem-2',
    memberRole: 'member',
    joinedAt: new Date().toISOString(),
    username: 'ShadowNinja',
    inGameId: 'Shadow99',
    avatarPreset: 'preset_default_02',
    playstyle: 'Assassin',
  },
];

const mockRequests: JoinRequestItem[] = [
  {
    id: 'req-1',
    teamId: 'team-1',
    userId: 'user-applicant-1',
    playerIgn: 'ValkyrieAce',
    playerRole: 'Marksman',
    message: 'High winrate marksman',
    status: 'pending',
    createdAt: new Date().toISOString(),
    username: 'ValkAce',
  },
];

describe('Milestone 4: Client Recruitment Directory & Modal UI Suite (LLT Tests 22-26)', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('Test 22: Teams directory renders squad cards with dynamic open slots (LLT 22)', async () => {
    // Mock fetchWithAuth for /api/v1/teams
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/teams')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ teams: mockTeams, total: 2 }),
        });
      }
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'user-guest', email: 'guest@smexstore.com' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { getByTestId, getAllByTestId } = render(<TeamsPage />);

    await waitFor(() => {
      expect(getByTestId('teams-grid')).toBeTruthy();
    });

    const cards = getAllByTestId('team-card');
    expect(cards.length).toBe(2);

    // Verify first card: Open to join, [OMG], 3/5 members, 2 Open Slots
    const tags = getAllByTestId('team-tag');
    expect(tags[0].textContent).toContain('[OMG]');

    const availabilityBadges = getAllByTestId('team-availability-badge');
    expect(availabilityBadges[0].textContent).toContain('Open to Join');
    expect(availabilityBadges[1].textContent).toContain('Full / Closed');

    const openSlotsBadges = getAllByTestId('team-open-slots');
    expect(openSlotsBadges[0].textContent).toContain('2 Open Slots');
    expect(openSlotsBadges[1].textContent).toContain('0 Open Slots');
  });

  it('Test 23: Team card button opens detail modal with active roster (LLT 23)', async () => {
    const handleViewRoster = vi.fn();
    const { getByTestId } = render(
      <TeamCard team={mockTeams[0]} onViewRoster={handleViewRoster} />
    );

    const viewButton = getByTestId('view-roster-button');
    expect(viewButton).toBeTruthy();
    fireEvent.click(viewButton);
    expect(handleViewRoster).toHaveBeenCalledWith(mockTeams[0]);

    // Now render modal directly to verify active roster display
    const { getByTestId: getModalId, getAllByTestId: getAllModalRows } = render(
      <TeamDetailModal
        team={mockTeams[0]}
        members={mockMembers}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(getModalId('team-detail-modal')).toBeTruthy();
    const memberRows = getAllModalRows('roster-member-row');
    expect(memberRows.length).toBe(2);

    // Verify captain crown is displayed for the captain
    expect(getModalId('captain-crown')).toBeTruthy();
    expect(memberRows[0].textContent).toContain('OmegaCaptain');
    expect(memberRows[0].textContent).toContain('OMG_Leader');
    expect(memberRows[1].textContent).toContain('ShadowNinja');
  });

  it('Test 24: Prospective player join request submission interaction (LLT 24)', async () => {
    const handleSubmitJoin = vi.fn().mockResolvedValue(undefined);

    const { getByTestId, queryByTestId } = render(
      <TeamDetailModal
        team={mockTeams[0]}
        members={mockMembers}
        currentUserId="user-visitor-99"
        isOpen={true}
        onClose={vi.fn()}
        onSubmitJoinRequest={handleSubmitJoin}
      />
    );

    const requestButton = getByTestId('request-to-join-button');
    expect(requestButton).toBeTruthy();
    fireEvent.click(requestButton);

    // Form should now appear
    const form = getByTestId('join-request-form');
    expect(form).toBeTruthy();

    const ignInput = getByTestId('join-ign-input') as HTMLInputElement;
    const roleInput = getByTestId('join-role-input') as HTMLInputElement;
    const submitBtn = getByTestId('join-submit-button');

    fireEvent.change(ignInput, { target: { value: 'NewChallenger' } });
    fireEvent.change(roleInput, { target: { value: 'Marksman' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmitJoin).toHaveBeenCalledWith({
        playerIgn: 'NewChallenger',
        playerRole: 'Marksman',
      });
    });

    // Form closes and request pending badge displays
    await waitFor(() => {
      expect(queryByTestId('join-request-form')).toBeNull();
      expect(getByTestId('request-pending-badge')).toBeTruthy();
    });
  });

  it('Test 25: Captain roster management controls and action buttons (LLT 25)', async () => {
    const handleResolve = vi.fn().mockResolvedValue(undefined);
    const handleKick = vi.fn().mockResolvedValue(undefined);
    const handleToggle = vi.fn().mockResolvedValue(undefined);

    const { getByTestId, getAllByTestId } = render(
      <TeamDetailModal
        team={mockTeams[0]}
        members={mockMembers}
        pendingRequests={mockRequests}
        currentUserId="user-cap-1"
        isCaptain={true}
        isOpen={true}
        onClose={vi.fn()}
        onResolveRequest={handleResolve}
        onKickMember={handleKick}
        onToggleStatus={handleToggle}
      />
    );

    // Captain controls panel must be rendered
    expect(getByTestId('captain-controls')).toBeTruthy();

    // Pending requests row and action buttons
    const requestRows = getAllByTestId('pending-request-row');
    expect(requestRows.length).toBe(1);
    expect(requestRows[0].textContent).toContain('ValkyrieAce');

    const approveBtn = getByTestId('approve-request-button');
    const rejectBtn = getByTestId('reject-request-button');
    expect(approveBtn).toBeTruthy();
    expect(rejectBtn).toBeTruthy();

    fireEvent.click(approveBtn);
    expect(handleResolve).toHaveBeenCalledWith('req-1', 'accept');

    // Kick member action for non-captain
    const kickBtn = getByTestId('kick-member-button');
    expect(kickBtn).toBeTruthy();
    fireEvent.click(kickBtn);
    expect(handleKick).toHaveBeenCalledWith('user-mem-2');

    // Close roster toggle button
    const toggleBtn = getByTestId('close-roster-toggle');
    expect(toggleBtn).toBeTruthy();
    fireEvent.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalled();
  });

  it('Test 26: AMOLED theme pure true-black surface and 120ms motion audit (LLT 26)', async () => {
    // 1. Audit TeamCard source code
    // Strictly zero backdrop-filter blur
    expect(teamCardSource.includes('backdrop-blur')).toBe(false);
    expect(teamCardSource.includes('backdrop-filter')).toBe(false);

    // Strictly zero opacity fades
    expect(teamCardSource.includes('fade-in')).toBe(false);
    expect(teamCardSource.includes('opacity-0')).toBe(false);

    // Transition timing strictly <= 120ms
    expect(teamCardSource.includes('duration-[120ms]') || teamCardSource.includes('duration-[80ms]')).toBe(true);

    // 2. Audit TeamDetailModal source code
    expect(teamModalSource.includes('backdrop-blur')).toBe(false);
    expect(teamModalSource.includes('backdrop-filter')).toBe(false);
    expect(teamModalSource.includes('fade-in')).toBe(false);
    expect(teamModalSource.includes('opacity-0')).toBe(false);
    expect(teamModalSource.includes('duration-[120ms]') || teamModalSource.includes('duration-[80ms]')).toBe(true);

    // 3. Audit TeamsPage source code
    expect(teamsPageSource.includes('backdrop-blur')).toBe(false);
    expect(teamsPageSource.includes('backdrop-filter')).toBe(false);
    expect(teamsPageSource.includes('fade-in')).toBe(false);
    expect(teamsPageSource.includes('opacity-0')).toBe(false);

    // 4. Verify AMOLED tokens are supported
    // Pure true-black base surface token is bg-bg-surface and bg-bg-canvas which map to #000000 in globals.css
    expect(teamCardSource.includes('bg-bg-surface')).toBe(true);
    expect(teamModalSource.includes('bg-bg-surface')).toBe(true);
    expect(teamsPageSource.includes('bg-bg-canvas')).toBe(true);
  });
});
