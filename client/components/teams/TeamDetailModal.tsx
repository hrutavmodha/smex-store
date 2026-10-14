'use client';

import React, { useState, useEffect } from 'react';
import { X, Crown, Users, UserX, Check, Ban, AlertTriangle } from 'lucide-react';
import type { TeamCardData } from './TeamCard';

export interface RosterMember {
  id: string;
  userId: string;
  memberRole: string;
  joinedAt: string | Date;
  username?: string | null;
  inGameId?: string | null;
  avatarPreset?: string | null;
  playstyle?: string | null;
}

export interface JoinRequestItem {
  id: string;
  teamId: string;
  userId: string;
  playerIgn: string;
  playerRole: string;
  message?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: string | Date;
  username?: string | null;
  avatarPreset?: string | null;
}

export const STANDARDIZED_ROLES = ['Roam', 'Hyper', 'Exp', 'Gold', 'Mid'] as const;
export type StandardizedRole = (typeof STANDARDIZED_ROLES)[number];

export interface TeamDetailModalProps {
  team: TeamCardData;
  members: RosterMember[];
  pendingRequests?: JoinRequestItem[];
  currentUserId?: string | null;
  isCaptain?: boolean;
  hasPendingRequest?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSubmitJoinRequest?: (data: { playerIgn: string; playerRole: string; message?: string }) => Promise<void>;
  onResolveRequest?: (requestId: string, action: 'accept' | 'reject') => Promise<void>;
  onKickMember?: (userId: string) => Promise<void>;
  onToggleStatus?: () => Promise<void>;
  onDisbandTeam?: () => Promise<void>;
}

export function TeamDetailModal({
  team,
  members,
  pendingRequests = [],
  currentUserId,
  isCaptain = false,
  hasPendingRequest = false,
  isOpen,
  onClose,
  onSubmitJoinRequest,
  onResolveRequest,
  onKickMember,
  onToggleStatus,
  onDisbandTeam,
}: TeamDetailModalProps) {
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [playerIgn, setPlayerIgn] = useState('');
  const [playerRole, setPlayerRole] = useState<string>('Roam');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(hasPendingRequest);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'kick' | 'disband';
    targetUserId?: string;
    targetName?: string;
  } | null>(null);

  useEffect(() => {
    setRequestSubmitted(hasPendingRequest);
    setShowJoinForm(false);
    setErrorMsg(null);
    setConfirmAction(null);
    setPlayerIgn('');
    setMessage('');
    setPlayerRole('Roam');
  }, [team.id, hasPendingRequest, isOpen]);

  if (!isOpen) return null;

  const isFullOrClosed = team.availability !== 'open';
  const isAlreadyMember = members.some((m) => m.userId === currentUserId);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (confirmAction.type === 'disband' && onDisbandTeam) {
        await onDisbandTeam();
      } else if (confirmAction.type === 'kick' && confirmAction.targetUserId && onKickMember) {
        await onKickMember(confirmAction.targetUserId);
      }
      setConfirmAction(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Action failed');
      setConfirmAction(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerIgn.trim() || !playerRole.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (onSubmitJoinRequest) {
        await onSubmitJoinRequest({ playerIgn: playerIgn.trim(), playerRole: playerRole.trim(), message: message.trim() || undefined });
      }
      setRequestSubmitted(true);
      setShowJoinForm(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit join request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-team-title"
      data-testid="team-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/80 transition-colors duration-[120ms]"
    >
      {/* Solid Opaque Panel: No blur, no opacity fade */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-2xl transition-transform duration-[120ms] ease-out">
        {/* Modal Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Modal"
          className="absolute top-5 right-5 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated transition-colors duration-[120ms] min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Squad Header */}
        <div className="mb-6 pr-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold text-cyan-depth bg-[#1B8F97]/15 border border-[#1B8F97]/30">
              [{team.tag}]
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                team.availability === 'open'
                  ? 'text-emerald-primary bg-[#1FAE7A]/15 border-[#1FAE7A]/30'
                  : 'text-text-muted bg-[#223530]/20 border-[#223530]'
              }`}
            >
              {team.availability === 'open' ? 'Open to Join' : team.availability === 'full' ? 'Full / Closed' : 'Closed'}
            </span>
          </div>

          <h2 id="modal-team-title" className="text-2xl font-extrabold text-text-primary">
            {team.name}
          </h2>

          <p className="mt-1 text-xs text-text-secondary">
            {team.description || 'Competitive squad recruiting active players for ranked tournaments.'}
          </p>

          <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5 font-medium">
              <Users className="h-3.5 w-3.5" />
              {members.length} / {team.memberCap} Members
            </span>
            <span className="text-emerald-primary font-semibold">
              {Math.max(0, team.memberCap - members.length)} Slots Available
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section: Active Roster Members */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
            <span>Active Roster</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-bg-surface-elevated text-text-secondary">
              {members.length}
            </span>
          </h3>

          <div className="flex flex-col gap-2">
            {members.map((member) => {
              const isMemberCaptain = member.memberRole === 'captain' || member.userId === team.captainId;

              return (
                <div
                  key={member.id}
                  data-testid="roster-member-row"
                  className="flex items-center justify-between p-3 rounded-xl border border-border-subtle bg-bg-surface-elevated transition-colors duration-[120ms]"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar Preset Circle */}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-primary/15 text-emerald-primary text-xs font-bold border border-emerald-primary/30">
                      {(member.username || member.inGameId || '?').charAt(0).toUpperCase()}
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text-primary">
                          {member.username || `Player_${member.userId.slice(0, 5)}`}
                        </span>
                        {isMemberCaptain && (
                          <span
                            data-testid="captain-crown"
                            title="Squad Captain"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30"
                          >
                            <Crown className="h-3 w-3" />
                            Captain
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-muted">
                        IGN: {member.inGameId || 'Unspecified'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {member.playstyle && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium text-text-secondary bg-bg-canvas border border-border-subtle">
                        {member.playstyle}
                      </span>
                    )}

                    {/* Captain controls: Kick member */}
                    {isCaptain && !isMemberCaptain && onKickMember && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmAction({
                            type: 'kick',
                            targetUserId: member.userId,
                            targetName: member.username || member.inGameId || member.userId,
                          })
                        }
                        data-testid="kick-member-button"
                        className="p-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg border border-transparent hover:border-red-900/30 transition-colors duration-[120ms] min-h-[36px] flex items-center gap-1"
                        title="Kick member from squad"
                      >
                        <UserX className="h-4 w-4" />
                        <span className="hidden sm:inline">Kick</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section: Captain Controls (Pending Requests & Roster Actions) */}
        {isCaptain && (
          <div data-testid="captain-controls" className="mb-6 pt-5 border-t border-border-subtle">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center justify-between">
              <span>Captain Management</span>
              <div className="flex items-center gap-2">
                {onToggleStatus && (
                  <button
                    type="button"
                    onClick={onToggleStatus}
                    data-testid="close-roster-toggle"
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border-prominent transition-colors duration-[120ms]"
                  >
                    {team.status === 'open' ? 'Close Roster' : 'Open Roster'}
                  </button>
                )}
                {onDisbandTeam && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        type: 'disband',
                      })
                    }
                    data-testid="disband-team-button"
                    className="px-2.5 py-1 text-xs font-semibold rounded text-red-400 bg-red-950/20 border border-red-900/30 hover:bg-red-950/40 transition-colors duration-[120ms]"
                  >
                    Disband Squad
                  </button>
                )}
              </div>
            </h3>

            {/* Pending Requests Queue */}
            {pendingRequests.length > 0 ? (
              <div className="flex flex-col gap-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    data-testid="pending-request-row"
                    className="flex items-center justify-between p-3 rounded-xl border border-cyan-depth/30 bg-[#1B8F97]/5"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-text-primary">
                          {req.playerIgn}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold text-cyan-depth bg-[#1B8F97]/15">
                          {req.playerRole}
                        </span>
                      </div>
                      {req.message && (
                        <span className="text-[11px] text-text-muted mt-0.5 line-clamp-1">
                          &quot;{req.message}&quot;
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onResolveRequest?.(req.id, 'accept')}
                        data-testid="approve-request-button"
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-primary text-black hover:bg-emerald-hover transition-transform duration-[80ms] active:scale-[0.98] min-h-[32px] flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveRequest?.(req.id, 'reject')}
                        data-testid="reject-request-button"
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-bg-surface-elevated text-text-secondary hover:text-red-400 border border-border-subtle hover:border-red-900/30 transition-colors duration-[120ms] min-h-[32px] flex items-center gap-1"
                      >
                        <Ban className="h-3 w-3" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center rounded-xl bg-bg-surface-elevated/50 border border-border-subtle text-xs text-text-muted">
                No pending join requests
              </div>
            )}
          </div>
        )}

        {/* Section: Applicant / Visitor Actions */}
        {!isCaptain && !isAlreadyMember && (
          <div className="pt-4 border-t border-border-subtle">
            {requestSubmitted ? (
              <div
                data-testid="request-pending-badge"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1FAE7A]/10 border border-[#1FAE7A]/30 text-emerald-primary text-xs font-semibold"
              >
                <Check className="h-4 w-4" />
                <span>Join Request Pending (Awaiting Captain Approval)</span>
              </div>
            ) : showJoinForm ? (
              <form
                onSubmit={handleJoinSubmit}
                data-testid="join-request-form"
                className="flex flex-col gap-3 p-4 rounded-xl border border-border-subtle bg-bg-surface-elevated"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Submit Join Request
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                      In-Game Name (IGN) *
                    </label>
                    <input
                      type="text"
                      required
                      value={playerIgn}
                      onChange={(e) => setPlayerIgn(e.target.value)}
                      placeholder="e.g. Valkyrie99"
                      data-testid="join-ign-input"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-primary min-h-[36px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                      Designated Role *
                    </label>
                    <select
                      required
                      value={playerRole}
                      onChange={(e) => setPlayerRole(e.target.value)}
                      data-testid="join-role-input"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-primary min-h-[36px]"
                    >
                      {STANDARDIZED_ROLES.map((role) => (
                        <option key={role} value={role} className="bg-bg-surface text-text-primary">
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                    Message to Captain (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Briefly state your tournament experience or availability..."
                    className="w-full px-3 py-2 text-xs rounded-lg bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-primary resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowJoinForm(false)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-text-secondary hover:text-text-primary min-h-[36px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="join-submit-button"
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-primary text-black hover:bg-emerald-hover transition-transform duration-[80ms] active:scale-[0.98] min-h-[36px]"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                disabled={isFullOrClosed}
                onClick={() => setShowJoinForm(true)}
                data-testid="request-to-join-button"
                className={`w-full py-2.5 px-4 text-xs font-semibold rounded-xl transition-transform duration-[80ms] active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2 ${
                  isFullOrClosed
                    ? 'bg-border-subtle/50 text-text-muted cursor-not-allowed'
                    : 'bg-emerald-primary text-black hover:bg-emerald-hover shadow-md'
                }`}
              >
                <span>{isFullOrClosed ? 'Roster Full or Closed' : 'Request to Join Squad'}</span>
              </button>
            )}
          </div>
        )}

        {/* Destructive Action Confirmation Dialog */}
        {confirmAction && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-desc"
            data-testid="confirmation-dialog"
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#000000]/80 transition-colors duration-[120ms]"
          >
            <div className="relative w-full max-w-md rounded-2xl border border-red-900/40 bg-bg-surface p-6 shadow-2xl transition-transform duration-[120ms] ease-out">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-full bg-red-950/30 text-red-400 border border-red-900/30">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h4 id="confirm-dialog-title" className="text-lg font-bold text-text-primary">
                    {confirmAction.type === 'disband' ? 'Disband Squad?' : 'Kick Member?'}
                  </h4>
                  <span className="text-xs text-text-muted">Destructive Action</span>
                </div>
              </div>

              <p id="confirm-dialog-desc" className="text-xs text-text-secondary mb-6 leading-relaxed">
                {confirmAction.type === 'disband'
                  ? 'Are you sure you want to disband this squad? This will permanently delete the squad profile and remove all members. This action cannot be undone.'
                  : `Are you sure you want to kick ${confirmAction.targetName || 'this member'} from the squad? They will need to re-apply to rejoin.`}
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  data-testid="cancel-confirm-button"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border-prominent transition-colors duration-[120ms] min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  data-testid="confirm-destructive-button"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors duration-[120ms] min-h-[44px] flex items-center gap-1.5"
                >
                  {isSubmitting
                    ? 'Processing...'
                    : confirmAction.type === 'disband'
                    ? 'Yes, Disband Squad'
                    : 'Yes, Kick Member'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamDetailModal;
