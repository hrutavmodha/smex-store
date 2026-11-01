'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  ShieldAlert,
  Send,
  Link2,
  User,
  Users,
} from 'lucide-react';
import { Alert } from '../ui/Alert';
import { fetchWithAuth } from '../../lib/api';
import type {
  IncidentType,
  IncidentSeverity,
  TournamentIncidentItem,
} from '@smex/shared';

export interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  tournamentId: string;
  teams?: Array<{ id: string; name: string }>;
  onIncidentReported?: (incident: TournamentIncidentItem) => void;
}

const INCIDENT_TYPES: Array<{ value: IncidentType; label: string; description: string }> = [
  {
    value: 'suspected_cheat',
    label: 'Suspected Cheat / Maphack / Scripting',
    description: 'Unusual vision, impossible cooldown timers, or automated inputs',
  },
  {
    value: 'unauthorized_substitute',
    label: 'Unauthorized Substitute / Smurf',
    description: 'Unregistered ringer or account sharing violation',
  },
  {
    value: 'toxic_behavior',
    label: 'Toxic Behavior / Harassment',
    description: 'Offensive in-game chat, hate speech, or unsportsmanlike conduct',
  },
  {
    value: 'connection_manipulation',
    label: 'Connection Manipulation / Lag Switching',
    description: 'Intentional DDoS, intentional DC, or packet stalling',
  },
  {
    value: 'other',
    label: 'Other Rule Violation',
    description: 'Other tournament rule violations or lobby disputes',
  },
];

const SEVERITIES: Array<{ value: IncidentSeverity; label: string; color: string }> = [
  { value: 'low', label: 'Low', color: 'border-slate-500/40 text-slate-300' },
  { value: 'medium', label: 'Medium', color: 'border-amber-500/40 text-amber-400' },
  { value: 'high', label: 'High', color: 'border-orange-500/40 text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'border-red-500/50 text-red-400' },
];

export function IncidentReportModal({
  isOpen,
  onClose,
  matchId,
  tournamentId: _tournamentId,
  teams = [],
  onIncidentReported,
}: IncidentReportModalProps) {
  const [incidentType, setIncidentType] = useState<IncidentType>('suspected_cheat');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [targetTeamId, setTargetTeamId] = useState<string>('');
  const [targetPlayerIgn, setTargetPlayerIgn] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (description.trim().length < 10) {
      setErrorMessage('Description must be at least 10 characters detailing the incident.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        incidentType,
        severity,
        description: description.trim(),
      };

      if (targetTeamId.trim()) {
        payload.targetTeamId = targetTeamId.trim();
      }
      if (targetPlayerIgn.trim()) {
        payload.targetPlayerIgn = targetPlayerIgn.trim();
      }
      if (evidenceUrl.trim()) {
        payload.evidenceUrl = evidenceUrl.trim();
      }

      const res = await fetchWithAuth(
        `/api/v1/tournaments/matches/${matchId}/incidents`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setSuccessMessage('Incident flagged successfully. Clan Leaders & Admins have been alerted.');
        if (onIncidentReported && data.incident) {
          onIncidentReported(data.incident);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(
          err.detail || err.message || 'Failed to submit incident report. Please verify inputs.'
        );
      }
    } catch {
      setErrorMessage('Network connection error while submitting report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-2xl text-text-primary transition-all duration-[120ms]">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="incident-modal-title" className="text-base font-bold text-text-primary">
                Flag Match Incident
              </h2>
              <p className="text-xs text-text-secondary">
                Report suspicious activity or rule violations in this live match.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-surface-elevated hover:text-text-primary transition-colors duration-[120ms]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <Alert variant="error" description={errorMessage} className="mt-4" />
        )}

        {successMessage && (
          <Alert variant="success" description={successMessage} className="mt-4" />
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Incident Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Incident Category
            </label>
            <select
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value as IncidentType)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-canvas border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-red-400 transition-colors duration-[120ms]"
            >
              {INCIDENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Severity Level
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITIES.map((s) => {
                const isSelected = severity === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeverity(s.value)}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold uppercase transition-all duration-[120ms] ${
                      isSelected
                        ? `bg-bg-surface-elevated ${s.color} ring-1 ring-current`
                        : 'border-border-subtle text-text-muted hover:border-border-prominent'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Squad & Player */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Squad */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-text-muted" />
                Target Squad
              </label>
              <select
                value={targetTeamId}
                onChange={(e) => setTargetTeamId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-bg-canvas border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-red-400 transition-colors duration-[120ms]"
              >
                <option value="">Unspecified Squad</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Player IGN */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-text-muted" />
                Player IGN (Optional)
              </label>
              <input
                type="text"
                value={targetPlayerIgn}
                onChange={(e) => setTargetPlayerIgn(e.target.value)}
                placeholder="e.g. Slayer99"
                className="w-full px-3 py-2 rounded-xl bg-bg-canvas border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-400 transition-colors duration-[120ms]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Incident Summary & Observations *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe timestamps, suspected behaviors, round numbers, or referee observations (min 10 characters)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-canvas border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-400 transition-colors duration-[120ms] resize-none"
            />
          </div>

          {/* Evidence URL */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-text-muted" />
              Evidence URL (VOD / Screenshot / Stream link)
            </label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=... or clip link"
              className="w-full px-3 py-2 rounded-xl bg-bg-canvas border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-400 transition-colors duration-[120ms]"
            />
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-bg-surface-elevated text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors duration-[120ms]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || description.trim().length < 10}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold tracking-wide transition-all duration-[120ms] disabled:opacity-50 min-h-[36px]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Dispatching Alert...' : 'Submit Incident'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default IncidentReportModal;
