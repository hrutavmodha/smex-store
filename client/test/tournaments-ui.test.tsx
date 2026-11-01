import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import TournamentsPage from '../app/tournaments/page';
import { type MatchNodeData } from '@smex/shared';
import { BracketVisualizer } from '../components/tournaments/BracketVisualizer';
import { TournamentLobbyRoom } from '../components/tournaments/TournamentLobbyRoom';

const mockTournaments = [
  {
    id: 'tourney-1',
    title: 'Smex Summer Invitational',
    gameSlug: 'mlbb',
    format: 'single_elimination' as const,
    status: 'upcoming' as const,
    startTime: new Date(Date.now() + 86400000).toISOString(),
    maxTeams: 16,
    registeredTeams: 8,
  },
  {
    id: 'tourney-2',
    title: 'MLBB Masters Live',
    gameSlug: 'mlbb',
    format: 'single_elimination' as const,
    status: 'ongoing' as const,
    startTime: new Date().toISOString(),
    maxTeams: 8,
    registeredTeams: 8,
  },
  {
    id: 'tourney-3',
    title: 'Community Clash Vol. 1',
    gameSlug: 'mlbb',
    format: 'single_elimination' as const,
    status: 'completed' as const,
    startTime: new Date(Date.now() - 86400000 * 5).toISOString(),
    maxTeams: 16,
    registeredTeams: 16,
  },
];

const mock8TeamBracket: MatchNodeData[] = [
  // Round 1 (4 matches)
  {
    id: 'm1-1',
    roundNumber: 1,
    matchOrder: 1,
    bracketType: 'upper',
    teamAId: 'team-1',
    teamBId: 'team-8',
    teamAName: 'Omega Elite',
    teamBName: 'Shadow Strikers',
    teamAScore: 2,
    teamBScore: 0,
    winnerId: 'team-1',
    status: 'completed',
  },
  {
    id: 'm1-2',
    roundNumber: 1,
    matchOrder: 2,
    bracketType: 'upper',
    teamAId: 'team-2',
    teamBId: 'team-7',
    teamAName: 'Valkyrie Squad',
    teamBName: 'Titan Force',
    teamAScore: 2,
    teamBScore: 1,
    winnerId: 'team-2',
    status: 'completed',
  },
  {
    id: 'm1-3',
    roundNumber: 1,
    matchOrder: 3,
    bracketType: 'upper',
    teamAId: 'team-3',
    teamBId: 'team-6',
    teamAName: 'Apex Predator',
    teamBName: 'Neon Knights',
    teamAScore: 1,
    teamBScore: 2,
    winnerId: 'team-6',
    status: 'completed',
  },
  {
    id: 'm1-4',
    roundNumber: 1,
    matchOrder: 4,
    bracketType: 'upper',
    teamAId: 'team-4',
    teamBId: 'team-5',
    teamAName: 'Dragon Slayers',
    teamBName: 'Cyber Prowlers',
    teamAScore: 2,
    teamBScore: 0,
    winnerId: 'team-4',
    status: 'completed',
  },
  // Round 2 (2 matches - Semifinals)
  {
    id: 'm2-1',
    roundNumber: 2,
    matchOrder: 1,
    bracketType: 'upper',
    teamAId: 'team-1',
    teamBId: 'team-2',
    teamAName: 'Omega Elite',
    teamBName: 'Valkyrie Squad',
    teamAScore: 0,
    teamBScore: 0,
    winnerId: null,
    status: 'live',
  },
  {
    id: 'm2-2',
    roundNumber: 2,
    matchOrder: 2,
    bracketType: 'upper',
    teamAId: 'team-6',
    teamBId: 'team-4',
    teamAName: 'Neon Knights',
    teamBName: 'Dragon Slayers',
    teamAScore: 0,
    teamBScore: 0,
    winnerId: null,
    status: 'scheduled',
  },
  // Round 3 (1 match - Championship Final)
  {
    id: 'm3-1',
    roundNumber: 3,
    matchOrder: 1,
    bracketType: 'upper',
    teamAId: null,
    teamBId: null,
    teamAName: null,
    teamBName: null,
    teamAScore: 0,
    teamBScore: 0,
    winnerId: null,
    status: 'scheduled',
  },
];

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 1; // WebSocket.OPEN
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      if (this.onopen) this.onopen(new Event('open'));
    }, 0);
  }

  send(data: string) {}
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose(new CloseEvent('close'));
  }

  simulateMessage(payload: any) {
    if (this.onmessage) {
      this.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify(payload),
        })
      );
    }
  }
}

describe('Milestone 5: Client Presentation Tier & Bracket UI Suite (LLT Tests 22-27)', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    MockWebSocket.instances = [];
    (window as any).WebSocket = MockWebSocket;

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/tournaments?status=ongoing')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ tournaments: [mockTournaments[1]], total: 1 }),
        });
      }
      if (url.includes('/api/v1/tournaments?status=past')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ tournaments: [mockTournaments[2]], total: 1 }),
        });
      }
      // Default to upcoming
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tournaments: [mockTournaments[0]], total: 1 }),
      });
    });
  });

  // Test 22: Tournaments directory segmented tabs rendering
  it('Test 22: Tournaments directory segmented tabs rendering (LLT 22)', async () => {
    const { getByRole, queryByText } = render(<TournamentsPage />);

    const tabUpcoming = getByRole('tab', { name: /upcoming/i });
    const tabOngoing = getByRole('tab', { name: /ongoing/i });
    const tabPast = getByRole('tab', { name: /past/i });

    expect(tabUpcoming).toBeTruthy();
    expect(tabOngoing).toBeTruthy();
    expect(tabPast).toBeTruthy();

    await waitFor(() => {
      expect(queryByText('Smex Summer Invitational')).toBeTruthy();
    });

    // Click Ongoing tab
    fireEvent.click(tabOngoing);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=ongoing')
      );
      expect(queryByText('MLBB Masters Live')).toBeTruthy();
    });

    // Click Past tab
    fireEvent.click(tabPast);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=past')
      );
      expect(queryByText('Community Clash Vol. 1')).toBeTruthy();
    });
  });

  // Test 23: Ongoing tournament card displays live glowing status indicator
  it('Test 23: Ongoing tournament card displays live glowing status indicator (LLT 23)', async () => {
    // Override fetch to return ongoing tournament
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tournaments: [mockTournaments[1]], total: 1 }),
    });

    const { findByText } = render(<TournamentsPage />);

    const liveIndicator = await findByText('LIVE');
    expect(liveIndicator).toBeTruthy();
    expect(liveIndicator.className).toContain('text-emerald-primary');
  });

  // Test 24: Bracket visualizer renders rounds, match nodes, dynamic SVG connectors, and format-aware titles
  it('Test 24: Bracket visualizer renders rounds, match nodes, dynamic SVG connectors, and format-aware titles (LLT 24)', async () => {
    const { getByRole, getByText, getAllByText, queryByText } = render(
      <BracketVisualizer
        tournamentId="test-tourney"
        initialMatches={mock8TeamBracket}
      />
    );

    // Section and round columns exist
    expect(getByRole('region', { name: /tournament bracket/i })).toBeTruthy();
    expect(getByText('Round 1')).toBeTruthy();
    expect(getByText('Semifinals')).toBeTruthy();
    expect(getByText('Championship Final')).toBeTruthy();

    // Renders team names & seeds
    expect(getAllByText('Omega Elite').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Valkyrie Squad').length).toBeGreaterThanOrEqual(1);

    // Dynamic SVG cubic bezier connector curves connect feeder matches into parent nodes
    const svgConnectors = document.querySelectorAll('svg path[d*="M 0 25 C"]');
    expect(svgConnectors.length).toBeGreaterThanOrEqual(1);

    // Round robin format does not mash knockout titles
    cleanup();
    const { getByText: getByTextRR, queryByText: queryByTextRR } = render(
      <BracketVisualizer
        tournamentId="test-tourney"
        format="round_robin"
        initialMatches={[
          {
            id: 'rr-1',
            roundNumber: 1,
            matchOrder: 1,
            teamAId: 'team-1',
            teamBId: 'team-2',
            teamAScore: 0,
            teamBScore: 0,
            winnerId: null,
            status: 'scheduled',
          },
          {
            id: 'rr-2',
            roundNumber: 2,
            matchOrder: 1,
            teamAId: 'team-1',
            teamBId: 'team-3',
            teamAScore: 0,
            teamBScore: 0,
            winnerId: null,
            status: 'scheduled',
          },
        ]}
      />
    );
    expect(getByTextRR('Round 1')).toBeTruthy();
    expect(getByTextRR('Round 2')).toBeTruthy();
    expect(queryByTextRR('Semifinals')).toBeNull();
    expect(queryByTextRR('Championship Final')).toBeNull();

    // Double elimination format renders distinct tier sections
    cleanup();
    const { getByText: getByTextDE, getByRole: getByRoleDE } = render(
      <BracketVisualizer
        tournamentId="test-tourney"
        format="double_elimination"
        initialMatches={[
          {
            id: 'de-u1',
            roundNumber: 1,
            matchOrder: 1,
            bracketType: 'upper',
            teamAId: 'team-1',
            teamBId: 'team-2',
            teamAScore: 0,
            teamBScore: 0,
            winnerId: null,
            status: 'scheduled',
          },
          {
            id: 'de-l1',
            roundNumber: 1,
            matchOrder: 1,
            bracketType: 'lower',
            teamAId: 'team-3',
            teamBId: 'team-4',
            teamAScore: 0,
            teamBScore: 0,
            winnerId: null,
            status: 'scheduled',
          },
          {
            id: 'de-gf',
            roundNumber: 1,
            matchOrder: 1,
            bracketType: 'grand_final',
            teamAId: null,
            teamBId: null,
            teamAScore: 0,
            teamBScore: 0,
            winnerId: null,
            status: 'scheduled',
          },
        ]}
      />
    );
    expect(getByRoleDE('heading', { name: /upper bracket/i })).toBeTruthy();
    expect(getByRoleDE('heading', { name: /lower bracket/i })).toBeTruthy();
    expect(getByRoleDE('heading', { name: /grand championship final/i })).toBeTruthy();
    expect(getByRoleDE('tab', { name: /all brackets/i })).toBeTruthy();
    expect(getByRoleDE('tab', { name: /upper bracket/i })).toBeTruthy();
    expect(getByRoleDE('tab', { name: /lower bracket/i })).toBeTruthy();
    expect(getByRoleDE('tab', { name: /grand finals/i })).toBeTruthy();
  });

  // Test 25: Live WebSocket score update dynamically advances bracket visualizer
  it('Test 25: Live WebSocket score update dynamically advances bracket visualizer (LLT 25)', async () => {
    const { getByRole } = render(
      <BracketVisualizer
        tournamentId="test-tourney"
        initialMatches={mock8TeamBracket}
      />
    );

    // Initial state: Match 1 in Semifinals
    const matchNode = getByRole('article', { name: /match 1.*semifinals/i });
    expect(matchNode).toBeTruthy();
    expect(matchNode.textContent).toContain('Omega Elite');

    // Dispatch real WebSocket frame to visualizer subscriber
    act(() => {
      const socket = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      socket?.simulateMessage({
        event: 'bracket:update',
        payload: {
          matchId: 'm2-1',
          roundNumber: 2,
          matchOrder: 1,
          teamAScore: 2,
          teamBScore: 0,
          winnerId: 'team-1',
          status: 'completed',
          nextMatchId: 'm3-1',
        },
      });
    });

    // Score updates to 2-0 and winner row highlights in #1FAE7A
    await waitFor(() => {
      const winnerRow = matchNode.querySelector('[aria-label*="Omega Elite"]') as HTMLElement;
      expect(winnerRow).toBeTruthy();
      expect(winnerRow.className).toContain('text-emerald-primary');
      expect(winnerRow.className).toContain('border-l-emerald-primary');
      expect(matchNode.textContent).toContain('2');
    });
  });

  // Test 26: Admin match lobby controls and score counter inputs
  it('Test 26: Admin match lobby controls and score counter inputs (LLT 26)', async () => {
    const onScoreUpdateMock = vi.fn().mockResolvedValue(undefined);

    const { getByRole } = render(
      <TournamentLobbyRoom
        tournamentId="test-tourney"
        matches={mock8TeamBracket}
        participants={[
          { id: 'p1', teamId: 'team-1', teamName: 'Omega Elite', seed: 1 },
          { id: 'p2', teamId: 'team-2', teamName: 'Valkyrie Squad', seed: 2 },
        ]}
        isAdmin={true}
        onScoreUpdate={onScoreUpdateMock}
      />
    );

    // Admin score counters exist
    const incA = getByRole('button', { name: /increase team a score/i });
    const scoreDisplay = incA.parentElement;
    expect(incA).toBeTruthy();
    expect(scoreDisplay?.textContent).toContain('2'); // from match 1 initial score

    // Increment score
    fireEvent.click(incA);
    expect(scoreDisplay?.textContent).toContain('3');

    // Confirm winner button exists and triggers callback
    const confirmWinnerA = getByRole('button', { name: /confirm team a winner/i });
    expect(confirmWinnerA).toBeTruthy();
    fireEvent.click(confirmWinnerA);

    await waitFor(() => {
      expect(onScoreUpdateMock).toHaveBeenCalledWith('m1-1', 3, 0, 'team-1');
    });
  });

  // Test 26b: TournamentLobbyRoom dispatches authenticated PATCH using credentials: include (BUG-M5-005)
  it('Test 26b: TournamentLobbyRoom dispatches authenticated PATCH using credentials: include (BUG-M5-005)', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedCredentials: any = null;
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      capturedUrl = urlStr;
      capturedMethod = init?.method || 'GET';
      capturedCredentials = init?.credentials;
      if (init?.body) {
        try {
          capturedBody = JSON.parse(init.body as string);
        } catch {
          capturedBody = init.body;
        }
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
    });

    const { getByRole, findByText } = render(
      <TournamentLobbyRoom
        tournamentId="test-tourney"
        matches={mock8TeamBracket}
        participants={[
          { id: 'p1', teamId: 'team-1', teamName: 'Omega Elite', seed: 1 },
          { id: 'p2', teamId: 'team-2', teamName: 'Valkyrie Squad', seed: 2 },
        ]}
        isAdmin={true}
      />
    );

    const confirmBtn = getByRole('button', { name: /confirm team a winner/i });
    fireEvent.click(confirmBtn);

    const successMsg = await findByText(/match completed and winner confirmed!/i);
    expect(successMsg).toBeTruthy();

    expect(capturedUrl).toContain('/api/v1/tournaments/test-tourney/matches/m1-1');
    expect(capturedMethod).toBe('PATCH');
    expect(capturedCredentials).toBe('include');
    expect(capturedBody).toEqual({
      teamAScore: 2,
      teamBScore: 0,
      winnerId: 'team-1',
    });
  });

  // Test 26c: TournamentLobbyRoom preserves selected match operator focus during matches list updates (BUG-M5-009)
  it('Test 26c: TournamentLobbyRoom preserves selected match operator focus during matches list updates (BUG-M5-009)', async () => {
    const { getByRole, getByText, rerender } = render(
      <TournamentLobbyRoom
        tournamentId="test-tourney"
        matches={mock8TeamBracket}
        participants={[
          { id: 'p1', teamId: 'team-1', teamName: 'Omega Elite', seed: 1 },
          { id: 'p2', teamId: 'team-2', teamName: 'Valkyrie Squad', seed: 2 },
        ]}
        isAdmin={true}
      />
    );

    // Initial focus is on Match 1
    expect(getByText(/Round 1 • Match #1/i)).toBeTruthy();

    // Operator selects Match 2 in the match queue
    const selectMatch2Btn = getByRole('button', { name: /select match 2 round 1/i });
    fireEvent.click(selectMatch2Btn);

    // Active operations desk switches to Match 2
    expect(getByText(/Round 1 • Match #2/i)).toBeTruthy();

    // Simulate an incoming match update (e.g. WebSocket event where Match 1 score changed)
    const updatedMatches = mock8TeamBracket.map((m) =>
      m.id === 'm1-1' ? { ...m, teamAScore: 3 } : { ...m }
    );

    // Re-render with updated matches prop
    rerender(
      <TournamentLobbyRoom
        tournamentId="test-tourney"
        matches={updatedMatches}
        participants={[
          { id: 'p1', teamId: 'team-1', teamName: 'Omega Elite', seed: 1 },
          { id: 'p2', teamId: 'team-2', teamName: 'Valkyrie Squad', seed: 2 },
        ]}
        isAdmin={true}
      />
    );

    // Operator focus must remain securely on Match 2, NOT yanked back to Match 1
    expect(getByText(/Round 1 • Match #2/i)).toBeTruthy();
  });

  // Test 27: Theme semantic surface, motion audit, and production purity
  it('Test 27: Theme semantic surface, motion audit, and production purity (LLT 27)', async () => {
    // Override fetch for TournamentsPage
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tournaments: mockTournaments, total: 3 }),
    });

    const pageRender = render(<TournamentsPage />);
    const bracketRender = render(
      <BracketVisualizer
        tournamentId="test-tourney"
        initialMatches={mock8TeamBracket}
      />
    );
    const lobbyRender = render(
      <TournamentLobbyRoom
        tournamentId="test-tourney"
        matches={mock8TeamBracket}
        participants={[
          { id: 'p1', teamId: 'team-1', teamName: 'Omega Elite', seed: 1 },
          { id: 'p2', teamId: 'team-2', teamName: 'Valkyrie Squad', seed: 2 },
        ]}
      />
    );

    const renderedContainers = [
      pageRender.container,
      bracketRender.container,
      lobbyRender.container,
    ];

    // 1. Surface colors: semantic tokens bg-bg-canvas, bg-bg-surface, bg-bg-surface-elevated
    expect(pageRender.container.querySelector('main')?.className).toContain('bg-bg-canvas');

    for (const cont of renderedContainers) {
      // 2. Prohibited visual effects: zero backdrop-filter: blur, zero opacity fades
      const blurElements = cont.querySelectorAll('[class*="backdrop-blur"]');
      expect(blurElements.length).toBe(0);

      const fadeElements = cont.querySelectorAll('[class*="fade-in"], [class*="animate-fade"], [class*="opacity-0"]');
      expect(fadeElements.length).toBe(0);

      // 3. Motion physics: snappy transitions <= 120ms
      const transitionElements = cont.querySelectorAll('[class*="transition-"]');
      for (const el of transitionElements) {
        const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
        expect(cls.includes('duration-[120ms]') || cls.includes('duration-120')).toBe(true);
      }

      // 4. Production Code Purity: Zero test-only data-testid attributes in production components
      const testIdElements = cont.querySelectorAll('[data-testid]');
      expect(testIdElements.length).toBe(0);
    }
  });
});
