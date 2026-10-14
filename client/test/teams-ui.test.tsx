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
    const roleInput = getByTestId('join-role-input') as HTMLSelectElement;
    const submitBtn = getByTestId('join-submit-button');

    fireEvent.change(ignInput, { target: { value: 'NewChallenger' } });
    fireEvent.change(roleInput, { target: { value: 'Gold' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmitJoin).toHaveBeenCalledWith({
        playerIgn: 'NewChallenger',
        playerRole: 'Gold',
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

    // Kick member action for non-captain (requires confirmation dialog)
    const kickBtn = getByTestId('kick-member-button');
    expect(kickBtn).toBeTruthy();
    fireEvent.click(kickBtn);
    expect(handleKick).not.toHaveBeenCalled();

    // Confirm kick dialog
    const confirmBtn = getByTestId('confirm-destructive-button');
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn);
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

  it('Test 27: Modal state synchronization and cross-squad stale state reset (BUG-M4-002)', async () => {
    // 1. Direct component level test
    const handleSubmitJoin = vi.fn().mockResolvedValue(undefined);
    const { getByTestId, queryByTestId, rerender } = render(
      <TeamDetailModal
        team={mockTeams[0]}
        members={mockMembers}
        currentUserId="user-visitor-99"
        isOpen={true}
        onClose={vi.fn()}
        onSubmitJoinRequest={handleSubmitJoin}
      />
    );

    // Submit join request for squad 1
    fireEvent.click(getByTestId('request-to-join-button'));
    fireEvent.change(getByTestId('join-ign-input'), { target: { value: 'Applicant1' } });
    fireEvent.change(getByTestId('join-role-input'), { target: { value: 'Mid' } });
    fireEvent.click(getByTestId('join-submit-button'));

    await waitFor(() => {
      expect(getByTestId('request-pending-badge')).toBeTruthy();
    });

    // Switch team prop to a second open squad with hasPendingRequest = false
    const teamB: TeamCardData = {
      ...mockTeams[0],
      id: 'team-diff-2',
      name: 'Beta Squadron',
      tag: 'BETA',
    };

    rerender(
      <TeamDetailModal
        team={teamB}
        members={mockMembers}
        currentUserId="user-visitor-99"
        isOpen={true}
        hasPendingRequest={false}
        onClose={vi.fn()}
        onSubmitJoinRequest={handleSubmitJoin}
      />
    );

    // Stale request pending state must be cleared and action button restored
    await waitFor(() => {
      expect(queryByTestId('request-pending-badge')).toBeNull();
      expect(getByTestId('request-to-join-button')).toBeTruthy();
    });

    // 2. Full TeamsPage integration test
    cleanup();
    const squads: TeamCardData[] = [
      mockTeams[0],
      {
        ...mockTeams[0],
        id: 'team-open-2',
        name: 'Solaris Esports',
        tag: 'SLR',
        captainId: 'user-cap-99',
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/teams') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ request: { id: 'req-new', status: 'pending' } }),
        });
      }
      if (url.includes('/api/v1/teams/team-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ team: { ...mockTeams[0], members: mockMembers } }),
        });
      }
      if (url.includes('/api/v1/teams/team-open-2')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ team: { ...squads[1], members: mockMembers } }),
        });
      }
      if (url.includes('/api/v1/teams')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ teams: squads, total: 2 }),
        });
      }
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'user-visitor-99', email: 'visitor@smexstore.com' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const page = render(<TeamsPage />);

    await waitFor(() => {
      expect(page.getByTestId('teams-grid')).toBeTruthy();
    });

    const viewButtons = page.getAllByTestId('view-roster-button');
    expect(viewButtons.length).toBe(2);

    // Open first squad modal
    fireEvent.click(viewButtons[0]);
    await waitFor(() => {
      expect(page.getByTestId('team-detail-modal')).toBeTruthy();
      expect(page.getByTestId('request-to-join-button')).toBeTruthy();
    });

    // Submit join request on squad 1
    fireEvent.click(page.getByTestId('request-to-join-button'));
    fireEvent.change(page.getByTestId('join-ign-input'), { target: { value: 'GhostPlayer' } });
    fireEvent.change(page.getByTestId('join-role-input'), { target: { value: 'Hyper' } });
    fireEvent.click(page.getByTestId('join-submit-button'));

    await waitFor(() => {
      expect(page.getByTestId('request-pending-badge')).toBeTruthy();
    });

    // Close modal for squad 1
    const closeBtn = page.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);

    // Open second squad modal
    fireEvent.click(viewButtons[1]);
    await waitFor(() => {
      expect(page.getByTestId('team-detail-modal')).toBeTruthy();
    });

    // Stale state must NOT leak to squad 2: should display "Request to Join Squad" button
    expect(page.queryByTestId('request-pending-badge')).toBeNull();
    expect(page.getByTestId('request-to-join-button')).toBeTruthy();
    expect(page.getByTestId('request-to-join-button').textContent).toContain('Request to Join Squad');
  });

  it('Test 28: Existing applicant opening squad modal shows Request Pending badge immediately (BUG-M4-003)', async () => {
    cleanup();

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/teams/team-1/my-request')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ hasPendingRequest: true, request: mockRequests[0] }),
        });
      }
      if (url.includes('/api/v1/teams/team-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            team: {
              ...mockTeams[0],
              hasPendingRequest: true,
              members: mockMembers,
            },
          }),
        });
      }
      if (url.includes('/api/v1/teams')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ teams: [mockTeams[0]], total: 1 }),
        });
      }
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'user-applicant-1', email: 'applicant@smexstore.com' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const page = render(<TeamsPage />);

    await waitFor(() => {
      expect(page.getByTestId('teams-grid')).toBeTruthy();
    });

    // Click View Roster for team-1 where user has a pending request
    const viewButton = page.getByTestId('view-roster-button');
    fireEvent.click(viewButton);

    // Modal opens and immediately displays the pending badge
    await waitFor(() => {
      expect(page.getByTestId('team-detail-modal')).toBeTruthy();
      expect(page.getByTestId('request-pending-badge')).toBeTruthy();
    });

    expect(page.queryByTestId('request-to-join-button')).toBeNull();
    expect(page.queryByTestId('join-request-form')).toBeNull();
    expect(page.getByTestId('request-pending-badge').textContent).toContain('Join Request Pending (Awaiting Captain Approval)');
  });

  it('Test 29: Destructive action confirmation dialogs for squad disbanding and member kick (BUG-M4-007)', async () => {
    const handleKick = vi.fn().mockResolvedValue(undefined);
    const handleDisband = vi.fn().mockResolvedValue(undefined);

    const { getByTestId, queryByTestId } = render(
      <TeamDetailModal
        team={mockTeams[0]}
        members={mockMembers}
        currentUserId="user-cap-1"
        isCaptain={true}
        isOpen={true}
        onClose={vi.fn()}
        onKickMember={handleKick}
        onDisbandTeam={handleDisband}
      />
    );

    // 1. Kick Member: Cancel dismisses dialog without calling onKickMember
    const kickBtn = getByTestId('kick-member-button');
    fireEvent.click(kickBtn);

    const kickDialog = getByTestId('confirmation-dialog');
    expect(kickDialog).toBeTruthy();
    expect(kickDialog.textContent).toContain('Kick Member?');
    expect(handleKick).not.toHaveBeenCalled();

    const cancelKickBtn = getByTestId('cancel-confirm-button');
    fireEvent.click(cancelKickBtn);
    expect(queryByTestId('confirmation-dialog')).toBeNull();
    expect(handleKick).not.toHaveBeenCalled();

    // 2. Kick Member: Confirm executes onKickMember
    fireEvent.click(kickBtn);
    expect(getByTestId('confirmation-dialog')).toBeTruthy();
    const confirmKickBtn = getByTestId('confirm-destructive-button');
    fireEvent.click(confirmKickBtn);
    await waitFor(() => {
      expect(handleKick).toHaveBeenCalledWith('user-mem-2');
      expect(queryByTestId('confirmation-dialog')).toBeNull();
    });

    // 3. Disband Squad: Cancel dismisses dialog without calling onDisbandTeam
    const disbandBtn = getByTestId('disband-team-button');
    fireEvent.click(disbandBtn);

    const disbandDialog = getByTestId('confirmation-dialog');
    expect(disbandDialog).toBeTruthy();
    expect(disbandDialog.textContent).toContain('Disband Squad?');
    expect(handleDisband).not.toHaveBeenCalled();

    const cancelDisbandBtn = getByTestId('cancel-confirm-button');
    fireEvent.click(cancelDisbandBtn);
    expect(queryByTestId('confirmation-dialog')).toBeNull();
    expect(handleDisband).not.toHaveBeenCalled();

    // 4. Disband Squad: Confirm executes onDisbandTeam
    fireEvent.click(disbandBtn);
    expect(getByTestId('confirmation-dialog')).toBeTruthy();
    const confirmDisbandBtn = getByTestId('confirm-destructive-button');
    fireEvent.click(confirmDisbandBtn);
    await waitFor(() => {
      expect(handleDisband).toHaveBeenCalled();
      expect(queryByTestId('confirmation-dialog')).toBeNull();
    });
  });

  it('Test 30: Standardized competitive roles dropdown options validation (BUG-M4-008)', async () => {
    const { getByTestId } = render(
      <TeamDetailModal
        team={mockTeams[0]}
        members={mockMembers}
        currentUserId="user-visitor-99"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Open join request form
    fireEvent.click(getByTestId('request-to-join-button'));

    const roleSelect = getByTestId('join-role-input') as HTMLSelectElement;
    expect(roleSelect.tagName.toLowerCase()).toBe('select');

    // Extract all option values
    const options = Array.from(roleSelect.querySelectorAll('option')).map((opt) => opt.value);
    expect(options).toEqual(['Roam', 'Hyper', 'Exp', 'Gold', 'Mid']);
    expect(roleSelect.value).toBe('Roam');
  });

  it('Test 31: Modal header availability badge and vacancy counts update dynamically after roster mutations and status toggle (BUG-M4-009)', async () => {
    cleanup();

    let teamState = {
      ...mockTeams[0],
      memberCap: 5,
      activeMembersCount: 2,
      openSlots: 3,
      status: 'open' as 'open' | 'closed',
      availability: 'open' as 'open' | 'closed' | 'full',
      members: [...mockMembers],
    };

    let pendingReqs = [...mockRequests];

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'user-cap-1', email: 'captain@omega.com' }),
        });
      }
      if (url.includes('/api/v1/teams/team-1/join-requests/req-1') && init?.method === 'PATCH') {
        const newMember: RosterMember = {
          id: 'mem-3',
          userId: 'user-applicant-1',
          memberRole: 'member',
          joinedAt: new Date().toISOString(),
          username: 'ValkAce',
          inGameId: 'ValkyrieAce',
          avatarPreset: 'preset_default_03',
          playstyle: 'Marksman',
        };
        teamState = {
          ...teamState,
          members: [...teamState.members, newMember],
          activeMembersCount: 3,
          openSlots: 2,
        };
        pendingReqs = [];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, status: 'accepted' }),
        });
      }
      if (url.includes('/api/v1/teams/team-1/join-requests')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ requests: pendingReqs }),
        });
      }
      if (url.includes('/api/v1/teams/team-1') && init?.method === 'PATCH') {
        const body = JSON.parse(init.body as string);
        teamState = {
          ...teamState,
          status: body.status,
          availability: body.status === 'open' ? 'open' : 'closed',
        };
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ team: teamState }),
        });
      }
      if (url.includes('/api/v1/teams/team-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ team: teamState }),
        });
      }
      if (url.includes('/api/v1/teams')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ teams: [teamState], total: 1 }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const page = render(<TeamsPage />);

    await waitFor(() => {
      expect(page.getByTestId('teams-grid')).toBeTruthy();
    });

    // 1. Open squad modal
    const viewButton = page.getByTestId('view-roster-button');
    fireEvent.click(viewButton);

    const modal = await page.findByTestId('team-detail-modal');
    expect(modal).toBeTruthy();

    // Verify initial open state in modal header once details resolve
    await waitFor(() => {
      expect(modal.textContent).toContain('Open to Join');
      expect(modal.textContent).toContain('2 / 5 Members');
      expect(modal.textContent).toContain('3 Slots Available');
    });

    // 2. Toggle Status: Captain closes roster
    const toggleBtn = page.getByTestId('close-roster-toggle');
    expect(toggleBtn.textContent).toContain('Close Roster');
    fireEvent.click(toggleBtn);

    // Modal header availability badge must immediately update to "Closed"
    await waitFor(() => {
      expect(modal.textContent).toContain('Closed');
      expect(modal.textContent).not.toContain('Open to Join');
      expect(toggleBtn.textContent).toContain('Open Roster');
    });

    // Toggle Status back to Open
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(modal.textContent).toContain('Open to Join');
      expect(toggleBtn.textContent).toContain('Close Roster');
    });

    // 3. Approve Join Request: Roster expands and capacity synchronizes
    const approveBtn = page.getByTestId('approve-request-button');
    expect(approveBtn).toBeTruthy();
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(modal.textContent).toContain('3 / 5 Members');
      expect(modal.textContent).toContain('2 Slots Available');
      expect(modal.textContent).toContain('Open to Join');
    });
  });
});
