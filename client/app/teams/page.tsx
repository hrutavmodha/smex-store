'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Shield, Users, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { TeamCard } from '../../components/teams/TeamCard';
import type { TeamCardData, RosterMember, JoinRequestItem } from '@smex/shared';
import { TeamDetailModal } from '../../components/teams/TeamDetailModal';
import { fetchWithAuth } from '../../lib/api';

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; ign?: string } | null>(null);

  // Detail Modal state
  const [selectedTeam, setSelectedTeam] = useState<TeamCardData | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<RosterMember[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequestItem[]>([]);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Create Squad Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTag, setCreateTag] = useState('');
  const [createCap, setCreateCap] = useState(5);
  const [createDesc, setCreateDesc] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch current user
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetchWithAuth('/api/v1/auth/me');
        if (res.ok) {
          const data = await res.json();
          setCurrentUser({
            id: data.id,
            email: data.email,
            ign: data.profile?.username || data.username || data.ign,
          });
        }
      } catch {
        // Guest user
      }
    }
    checkAuth();
  }, []);

  // Fetch squads list
  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetchWithAuth(`/api/v1/teams?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      }
    } catch {
      // Handle network errors gracefully
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadTeams();
    }, 150);
    return () => clearTimeout(timeout);
  }, [loadTeams]);

  // Open squad detail modal
  const handleOpenTeam = async (team: TeamCardData) => {
    setSelectedTeam(team);
    setIsModalOpen(true);
    if (!isModalOpen || selectedTeam?.id !== team.id) {
      setSelectedMembers([]);
      setPendingRequests([]);
      setHasPendingRequest(false);
    }

    try {
      let teamData = team;
      const res = await fetchWithAuth(`/api/v1/teams/${team.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedMembers(data.team.members || []);
        if (data.team) {
          teamData = { ...team, ...data.team };
          setSelectedTeam((prev: TeamCardData | null) => ({
            ...(prev || team),
            ...data.team,
          }));
        }
        if (typeof data.team.hasPendingRequest === 'boolean') {
          setHasPendingRequest(data.team.hasPendingRequest);
        }
      }

      // If user is captain, fetch pending join requests
      if (currentUser?.id === teamData.captainId) {
        const reqRes = await fetchWithAuth(`/api/v1/teams/${team.id}/join-requests`);
        if (reqRes.ok) {
          const reqData = await reqRes.json();
          setPendingRequests(reqData.requests || []);
        }
      } else if (currentUser?.id) {
        // Query applicant's own request status if not already determined
        const myReqRes = await fetchWithAuth(`/api/v1/teams/${team.id}/my-request`);
        if (myReqRes.ok) {
          const myReqData = await myReqRes.json();
          setHasPendingRequest(!!myReqData.hasPendingRequest);
        }
      }
    } catch {
      // Ignore transient errors
    }
  };

  // Create squad form submission
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const res = await fetchWithAuth('/api/v1/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          tag: createTag.trim(),
          memberCap: createCap,
          description: createDesc.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create squad');
      }

      setIsCreateOpen(false);
      setCreateName('');
      setCreateTag('');
      setCreateCap(5);
      setCreateDesc('');
      await loadTeams();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Squad creation failed');
    } finally {
      setIsCreating(false);
    }
  };

  // Submit join request
  const handleSubmitJoin = async (payload: { playerIgn: string; playerRole: string; message?: string }) => {
    if (!selectedTeam) return;

    const res = await fetchWithAuth(`/api/v1/teams/${selectedTeam.id}/join-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to submit join request');
    }

    setHasPendingRequest(true);
  };

  // Captain resolves join request
  const handleResolveRequest = async (requestId: string, action: 'accept' | 'reject') => {
    if (!selectedTeam) return;

    const res = await fetchWithAuth(`/api/v1/teams/${selectedTeam.id}/join-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    if (res.ok) {
      // Refresh modal and list
      await handleOpenTeam(selectedTeam);
      await loadTeams();
    }
  };

  // Captain kicks member
  const handleKickMember = async (userId: string) => {
    if (!selectedTeam) return;

    const res = await fetchWithAuth(`/api/v1/teams/${selectedTeam.id}/members/${userId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      await handleOpenTeam(selectedTeam);
      await loadTeams();
    }
  };

  // Toggle open/closed status
  const handleToggleStatus = async () => {
    if (!selectedTeam) return;
    const nextStatus = selectedTeam.status === 'open' ? 'closed' : 'open';

    const res = await fetchWithAuth(`/api/v1/teams/${selectedTeam.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (res.ok) {
      const activeCount = selectedMembers.length;
      const openSlots = Math.max(0, selectedTeam.memberCap - activeCount);
      let nextAvailability: 'open' | 'closed' | 'full' = 'closed';
      if (nextStatus === 'open' && openSlots > 0) {
        nextAvailability = 'open';
      } else if (openSlots === 0) {
        nextAvailability = 'full';
      } else {
        nextAvailability = 'closed';
      }
      const updated: TeamCardData = {
        ...selectedTeam,
        status: nextStatus,
        availability: nextAvailability,
        openSlots,
        activeMembersCount: activeCount,
      };
      setSelectedTeam(updated);
      await handleOpenTeam(updated);
      await loadTeams();
    }
  };

  // Disband team
  const handleDisbandTeam = async () => {
    if (!selectedTeam) return;

    const res = await fetchWithAuth(`/api/v1/teams/${selectedTeam.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      setIsModalOpen(false);
      setSelectedTeam(null);
      await loadTeams();
    }
  };

  return (
    <main className="min-h-screen bg-bg-canvas py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Page Header Cluster */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1FAE7A]/15 text-emerald-primary text-xs">
              <Shield className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-primary">
              Esports Recruitment
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Competitive Squads & Teams
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-text-secondary">
            Discover verified squads, browse active tournament rosters, or assemble your own roster.
          </p>
        </div>

        {/* Create Squad CTA */}
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          data-testid="create-squad-button"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-primary text-black hover:bg-emerald-hover transition-transform duration-[80ms] active:scale-[0.98] shadow-sm min-h-[44px]"
        >
          <Plus className="h-4 w-4" />
          <span>Create Squad</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search squads by name or [TAG]..."
            data-testid="teams-search-input"
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-bg-surface border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms] min-h-[40px]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-bg-surface border border-border-subtle self-start sm:self-auto">
          {(['all', 'open', 'closed'] as const).map((filter) => {
            const isActive = statusFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                data-testid={`filter-${filter}`}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors duration-[120ms] min-h-[36px] ${
                  isActive
                    ? 'bg-emerald-primary text-black shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated'
                }`}
              >
                {filter === 'open' ? 'Open Only' : filter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Squad Cards Grid: 1 col mobile, 2 col tablet, 3 col desktop */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="teams-skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 rounded-xl border border-border-subtle bg-bg-surface animate-pulse p-5"
            />
          ))}
        </div>
      ) : teams.length > 0 ? (
        <div
          data-testid="teams-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} onViewRoster={handleOpenTeam} />
          ))}
        </div>
      ) : (
        <div
          data-testid="teams-empty-state"
          className="flex flex-col items-center justify-center p-12 rounded-2xl border border-border-subtle bg-bg-surface text-center my-8"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-border-subtle text-text-muted mb-4">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-text-primary">No Squads Found</h3>
          <p className="text-xs text-text-secondary max-w-sm mt-1">
            No squads match your search criteria. Try modifying your filters or create a new squad.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-bg-surface-elevated text-emerald-primary hover:bg-bg-canvas border border-border-subtle transition-colors duration-[120ms]"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Roster Detail Modal */}
      {selectedTeam && (
        <TeamDetailModal
          key={selectedTeam.id}
          team={selectedTeam}
          members={selectedMembers}
          pendingRequests={pendingRequests}
          currentUserId={currentUser?.id}
          isCaptain={currentUser?.id === selectedTeam.captainId}
          hasPendingRequest={hasPendingRequest}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmitJoinRequest={handleSubmitJoin}
          onResolveRequest={handleResolveRequest}
          onKickMember={handleKickMember}
          onToggleStatus={handleToggleStatus}
          onDisbandTeam={handleDisbandTeam}
        />
      )}

      {/* Create Squad Modal */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/80 transition-colors duration-[120ms]"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-2xl transition-transform duration-[120ms]">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              aria-label="Close"
              className="absolute top-5 right-5 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-extrabold text-text-primary mb-1">Create New Squad</h2>
            <p className="text-xs text-text-secondary mb-4">
              Found your competitive squad. You will be registered as the team captain.
            </p>

            {createError && (
              <Alert variant="error" description={createError} className="mb-4" />
            )}

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Squad Name *
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Omega Esports"
                  data-testid="create-name-input"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-primary min-h-[36px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Tag * (Max 10 chars)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={createTag}
                    onChange={(e) => setCreateTag(e.target.value)}
                    placeholder="e.g. OMG"
                    data-testid="create-tag-input"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-primary min-h-[36px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Roster Cap (1 - 10)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={createCap}
                    onChange={(e) => setCreateCap(parseInt(e.target.value, 10) || 5)}
                    data-testid="create-cap-input"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-primary min-h-[36px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Recruitment goals, practice schedules, roles needed..."
                  data-testid="create-desc-input"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg text-text-secondary hover:text-text-primary min-h-[36px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  data-testid="create-submit-button"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-primary text-black hover:bg-emerald-hover transition-transform duration-[80ms] active:scale-[0.98] min-h-[36px]"
                >
                  {isCreating ? 'Creating...' : 'Create Squad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
