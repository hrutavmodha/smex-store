import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import TournamentsPage from '../app/tournaments/page';
import { BracketVisualizer, type MatchNodeData } from '../components/tournaments/BracketVisualizer';
import { TournamentLobbyRoom } from '../components/tournaments/TournamentLobbyRoom';

import tournamentsPageSource from '../app/tournaments/page.tsx?raw';
import bracketVisualizerSource from '../components/tournaments/BracketVisualizer.tsx?raw';
import lobbyRoomSource from '../components/tournaments/TournamentLobbyRoom.tsx?raw';

const mockTournaments = [
  {
    id: 'tourney-1',
    title: 'Smex Summer Invitational',
    gameSlug: 'mlbb',
    format: 'single_elimination' as const,
    status: 'upcoming' as const,
    startTime: new Date(Date.now() + 86400000).toISOString(),
    prizePoolInr: '25000.00',
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
    prizePoolInr: '50000.00',
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
    prizePoolInr: '10000.00',
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
    expect(liveIndicator.className).toContain('text-[#1FAE7A]');
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
      expect(winnerRow.className).toContain('text-[#1FAE7A]');
      expect(winnerRow.className).toContain('border-l-[#1FAE7A]');
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

  // Test 27: AMOLED theme pure true-black surface, motion audit, and production purity
  it('Test 27: AMOLED theme pure true-black surface, motion audit, and production purity (LLT 27)', async () => {
    // 1. Surface colors: True-Black #000000 and Obsidian #0B0F12
    expect(tournamentsPageSource.includes('#000000')).toBe(true);
    expect(tournamentsPageSource.includes('#0B0F12')).toBe(true);
    expect(bracketVisualizerSource.includes('#000000')).toBe(true);
    expect(bracketVisualizerSource.includes('#0B0F12')).toBe(true);
    expect(lobbyRoomSource.includes('#000000')).toBe(true);
    expect(lobbyRoomSource.includes('#0B0F12')).toBe(true);

    // 2. Prohibited visual effects: zero backdrop-filter: blur, zero opacity fades
    expect(tournamentsPageSource.includes('backdrop-blur')).toBe(false);
    expect(tournamentsPageSource.includes('backdrop-filter')).toBe(false);
    expect(bracketVisualizerSource.includes('backdrop-blur')).toBe(false);
    expect(bracketVisualizerSource.includes('backdrop-filter')).toBe(false);
    expect(lobbyRoomSource.includes('backdrop-blur')).toBe(false);
    expect(lobbyRoomSource.includes('backdrop-filter')).toBe(false);

    // 3. Motion physics: snappy transitions <= 120ms
    expect(tournamentsPageSource.includes('duration-[120ms]')).toBe(true);
    expect(bracketVisualizerSource.includes('duration-[120ms]')).toBe(true);
    expect(lobbyRoomSource.includes('duration-[120ms]')).toBe(true);

    // 4. Production Code Purity: Zero test-only data-testid attributes in production components
    expect(tournamentsPageSource.includes('data-testid')).toBe(false);
    expect(bracketVisualizerSource.includes('data-testid')).toBe(false);
    expect(lobbyRoomSource.includes('data-testid')).toBe(false);
  });
});
