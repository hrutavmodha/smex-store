'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Plus,
  IndianRupee,
  Crown,
  Medal,
  Flame,
  CheckCircle,
  AlertCircle,
  Trash2,
  ExternalLink,
  Loader2,
  Swords,
  Play,
  Settings,
  X,
  Users,
} from 'lucide-react';
import { fetchWithAuth } from '../../../lib/api';
import type { TournamentCardData, TournamentFormat, TournamentStatus } from '@smex/shared';

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<TournamentCardData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Create Form State
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TournamentStatus>('upcoming');
  const [format, setFormat] = useState<TournamentFormat>('single_elimination');
  const [prizePoolInr, setPrizePoolInr] = useState('5000');
  const [maxTeams, setMaxTeams] = useState<number>(16);
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [winnerName, setWinnerName] = useState('');
  const [runnerUpName, setRunnerUpName] = useState('');
  const [mvpName, setMvpName] = useState('');
  const [rulesMarkdown, setRulesMarkdown] = useState('');

  // Edit / Configure Modal State
  const [editingTournament, setEditingTournament] = useState<TournamentCardData | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStatus, setEditStatus] = useState<TournamentStatus>('upcoming');
  const [editFormat, setEditFormat] = useState<TournamentFormat>('single_elimination');
  const [editPrizePoolInr, setEditPrizePoolInr] = useState('5000');
  const [editMaxTeams, setEditMaxTeams] = useState<number>(16);
  const [editStartTime, setEditStartTime] = useState('');
  const [editWinnerName, setEditWinnerName] = useState('');
  const [editRunnerUpName, setEditRunnerUpName] = useState('');
  const [editMvpName, setEditMvpName] = useState('');
  const [editRulesMarkdown, setEditRulesMarkdown] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Quick Complete Modal State
  const [completingTournament, setCompletingTournament] = useState<TournamentCardData | null>(null);
  const [completeWinnerName, setCompleteWinnerName] = useState('');
  const [completeRunnerUpName, setCompleteRunnerUpName] = useState('');
  const [completeMvpName, setCompleteMvpName] = useState('');
  const [isCompleting, setIsCompleting] = useState<boolean>(false);

  const loadTournaments = async (statusFilter = filterStatus) => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' ? '/api/v1/tournaments' : `/api/v1/tournaments?status=${statusFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTournaments(data.tournaments || []);
      }
    } catch {
      // Non-fatal fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournaments(filterStatus);
  }, [filterStatus]);

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setActionMessage({ type: 'error', text: 'Tournament title is required' });
      return;
    }

    try {
      setIsSubmitting(true);
      setActionMessage(null);

      const payload = {
        title: title.trim(),
        gameSlug: 'mlbb',
        format,
        status,
        startTime: new Date(startTime).toISOString(),
        prizePoolInr: prizePoolInr || '0.00',
        maxTeams: Number(maxTeams) || 16,
        rulesMarkdown: rulesMarkdown.trim() || undefined,
        winnerName: status === 'completed' && winnerName.trim() ? winnerName.trim() : undefined,
        runnerUpName: status === 'completed' && runnerUpName.trim() ? runnerUpName.trim() : undefined,
        mvpName: status === 'completed' && mvpName.trim() ? mvpName.trim() : undefined,
      };

      const res = await fetchWithAuth('/api/v1/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || 'Failed to create tournament');
      }

      setActionMessage({
        type: 'success',
        text: `Tournament "${title}" successfully ${status === 'completed' ? 'recorded as past tournament' : 'created'}!`,
      });

      // Reset form
      setTitle('');
      setWinnerName('');
      setRunnerUpName('');
      setMvpName('');
      setRulesMarkdown('');
      loadTournaments(filterStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStatusTransition = async (id: string, targetStatus: TournamentStatus) => {
    try {
      setActionLoadingId(id);
      setActionMessage(null);

      const res = await fetchWithAuth(`/api/v1/tournaments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || `Failed to transition tournament to ${targetStatus}`);
      }

      setActionMessage({
        type: 'success',
        text: `Tournament status advanced to "${targetStatus.replace('_', ' ')}"!`,
      });
      loadTournaments(filterStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update tournament status';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openEditModal = (t: TournamentCardData) => {
    setEditingTournament(t);
    setEditTitle(t.title);
    setEditStatus(t.status);
    setEditFormat(t.format);
    setEditPrizePoolInr(t.prizePoolInr);
    setEditMaxTeams(t.maxTeams);
    setEditStartTime(t.startTime ? new Date(t.startTime).toISOString().slice(0, 16) : '');
    setEditWinnerName(t.winnerName || '');
    setEditRunnerUpName(t.runnerUpName || '');
    setEditMvpName(t.mvpName || '');
    setEditRulesMarkdown(t.rulesMarkdown || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTournament) return;

    try {
      setIsSubmittingEdit(true);
      setActionMessage(null);

      const payload = {
        title: editTitle.trim(),
        status: editStatus,
        format: editFormat,
        prizePoolInr: editPrizePoolInr,
        maxTeams: Number(editMaxTeams),
        startTime: new Date(editStartTime).toISOString(),
        rulesMarkdown: editRulesMarkdown.trim() || undefined,
        winnerName: editWinnerName.trim() || undefined,
        runnerUpName: editRunnerUpName.trim() || undefined,
        mvpName: editMvpName.trim() || undefined,
      };

      const res = await fetchWithAuth(`/api/v1/tournaments/${editingTournament.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || 'Failed to update tournament configuration');
      }

      setActionMessage({
        type: 'success',
        text: `Tournament "${editTitle}" configuration saved!`,
      });
      setEditingTournament(null);
      loadTournaments(filterStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update tournament';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleCompleteTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTournament) return;
    if (!completeWinnerName.trim()) {
      setActionMessage({ type: 'error', text: 'Champion / Winner Name is required to complete tournament' });
      return;
    }

    try {
      setIsCompleting(true);
      setActionMessage(null);

      const res = await fetchWithAuth(`/api/v1/tournaments/${completingTournament.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          winnerName: completeWinnerName.trim(),
          runnerUpName: completeRunnerUpName.trim() || undefined,
          mvpName: completeMvpName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || 'Failed to complete tournament');
      }

      setActionMessage({
        type: 'success',
        text: `Tournament "${completingTournament.title}" completed! Crowned Champion: ${completeWinnerName.trim()}`,
      });
      setCompletingTournament(null);
      setCompleteWinnerName('');
      setCompleteRunnerUpName('');
      setCompleteMvpName('');
      loadTournaments(filterStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to finalize tournament';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleDelete = async (id: string, tourneyTitle: string) => {
    if (!confirm(`Are you sure you want to delete tournament "${tourneyTitle}"?`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/api/v1/tournaments/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setTournaments((prev) => prev.filter((t) => t.id !== id));
        setActionMessage({ type: 'success', text: `Tournament "${tourneyTitle}" deleted.` });
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage({ type: 'error', text: err.detail || 'Failed to delete tournament' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Error connecting to server' });
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-5 w-5 text-emerald-primary" />
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Tournament Manager
            </h1>
          </div>
          <p className="text-xs text-text-secondary font-mono">
            Create upcoming clash brackets, configure active tournaments, and crown Hall of Fame champions
          </p>
        </div>

        <Link
          href="/tournaments?tab=past"
          target="_blank"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-bg-surface hover:bg-bg-surface-elevated text-xs font-semibold text-text-secondary hover:text-emerald-primary transition-colors duration-[120ms]"
        >
          <span>View Public Tournaments</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-mono flex items-center gap-2.5 border transition-all duration-[120ms] ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-primary'
              : 'bg-red-950/70 border-red-500/40 text-red-400'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Form: Create Tournament / Record Past Tournament */}
      <section className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
          <Plus className="h-4 w-4 text-emerald-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-text-primary">
            Create or Record Tournament
          </h2>
        </div>

        <form onSubmit={handleCreateTournament} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Tournament Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Smex Cup Season 2 or MLBB Weekly Clash #4"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TournamentStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
              >
                <option value="upcoming">Upcoming (Pre-Registration)</option>
                <option value="registration_open">Registration Open</option>
                <option value="ongoing">Ongoing (Live Brackets)</option>
                <option value="completed">Completed / Past Tournament</option>
              </select>
            </div>

            {/* Prize Pool */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Prize Pool (₹ INR)
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-primary" />
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={prizePoolInr}
                  onChange={(e) => setPrizePoolInr(e.target.value)}
                  placeholder="5000"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
                />
              </div>
            </div>

            {/* Start Date & Time */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Start Date & Time
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
                />
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Bracket Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
              >
                <option value="single_elimination">Single Elimination</option>
                <option value="double_elimination">Double Elimination</option>
                <option value="round_robin">Round Robin</option>
              </select>
            </div>

            {/* Max Teams */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Max Participating Teams
              </label>
              <input
                type="number"
                min="2"
                max="128"
                value={maxTeams}
                onChange={(e) => setMaxTeams(parseInt(e.target.value, 10) || 16)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
              />
            </div>
          </div>

          {/* Past Tournament Honorees (Revealed if Completed) */}
          {status === 'completed' && (
            <div className="p-4 rounded-xl bg-bg-canvas border border-amber-500/30 space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Crown className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  Past Tournament Honorees & Metadata
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-amber-400" />
                    <span>Champion / Winner Name</span>
                  </label>
                  <input
                    type="text"
                    value={winnerName}
                    onChange={(e) => setWinnerName(e.target.value)}
                    placeholder="e.g. VO DUDU"
                    className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-amber-400 transition-colors duration-[120ms]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                    <Medal className="h-3.5 w-3.5 text-slate-300" />
                    <span>Runner-up Name</span>
                  </label>
                  <input
                    type="text"
                    value={runnerUpName}
                    onChange={(e) => setRunnerUpName(e.target.value)}
                    placeholder="e.g. Goon"
                    className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-slate-300 transition-colors duration-[120ms]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-rose-400" />
                    <span>Audience Favourite / MVP</span>
                  </label>
                  <input
                    type="text"
                    value={mvpName}
                    onChange={(e) => setMvpName(e.target.value)}
                    placeholder="e.g. Marvelous Grievous"
                    className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-rose-400 transition-colors duration-[120ms]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rules Markdown */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Tournament Rules & Description (Markdown)
            </label>
            <textarea
              rows={2}
              value={rulesMarkdown}
              onChange={(e) => setRulesMarkdown(e.target.value)}
              placeholder="e.g. 5v5 Draft Pick. Best of 3 Finals. Room IDs will be shared in WhatsApp group."
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-primary hover:bg-[#22C58F] text-[#0B1A15] font-bold text-sm tracking-wide transition-all duration-[120ms] disabled:opacity-50 cursor-pointer shadow-lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving Tournament...</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>{status === 'completed' ? 'Record Past Tournament' : 'Publish Tournament'}</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* Existing Tournaments Table */}
      <section className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-emerald-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-text-primary">
              Existing Tournaments ({tournaments.length})
            </h2>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-canvas border border-border-subtle text-xs">
            {['all', 'upcoming', 'ongoing', 'past'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-md font-semibold capitalize transition-colors duration-[120ms] ${
                  filterStatus === s
                    ? 'bg-emerald-primary text-[#0B1A15]'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-text-secondary">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-primary" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-sm font-mono">
            No tournaments found for status &quot;{filterStatus}&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-text-secondary font-mono uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Title</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Prize</th>
                  <th className="pb-3 font-semibold">Honorees</th>
                  <th className="pb-3 font-semibold">Lifecycle & Actions</th>
                  <th className="pb-3 font-semibold text-right">Settings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {tournaments.map((t) => (
                  <tr key={t.id} className="hover:bg-bg-surface-elevated/40 transition-colors duration-[120ms]">
                    <td className="py-3 pr-3 font-medium text-text-primary">
                      <div className="font-bold">{t.title}</div>
                      <div className="text-[10px] text-text-muted font-mono capitalize">
                        {t.format.replace('_', ' ')} • Max {t.maxTeams} Teams • {t.registeredTeams ?? 0} Reg
                      </div>
                    </td>

                    <td className="py-3 pr-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          t.status === 'completed'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : t.status === 'ongoing'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : t.status === 'registration_open'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            : 'bg-bg-canvas text-text-secondary border border-border-subtle'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 pr-3 font-mono font-bold text-emerald-primary">
                      ₹{Number(t.prizePoolInr).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 pr-3">
                      {t.winnerName || t.runnerUpName || t.mvpName ? (
                        <div className="space-y-0.5 text-[11px]">
                          {t.winnerName && (
                            <div className="text-amber-400 flex items-center gap-1 font-semibold">
                              <Crown className="h-3 w-3" />
                              <span>{t.winnerName}</span>
                            </div>
                          )}
                          {t.runnerUpName && (
                            <div className="text-slate-300 flex items-center gap-1">
                              <Medal className="h-3 w-3 text-slate-400" />
                              <span>{t.runnerUpName}</span>
                            </div>
                          )}
                          {t.mvpName && (
                            <div className="text-rose-400 flex items-center gap-1">
                              <Flame className="h-3 w-3" />
                              <span>{t.mvpName}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted font-mono">—</span>
                      )}
                    </td>

                    {/* Lifecycle Action Buttons */}
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        {t.status === 'upcoming' && (
                          <button
                            type="button"
                            disabled={actionLoadingId === t.id}
                            onClick={() => handleQuickStatusTransition(t.id, 'registration_open')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold transition-all duration-[120ms] cursor-pointer"
                            title="Open team registrations"
                          >
                            {actionLoadingId === t.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Users className="h-3 w-3" />
                            )}
                            <span>Open Registration</span>
                          </button>
                        )}

                        {t.status === 'registration_open' && (
                          <button
                            type="button"
                            disabled={actionLoadingId === t.id}
                            onClick={() => handleQuickStatusTransition(t.id, 'ongoing')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition-all duration-[120ms] cursor-pointer"
                            title="Launch live tournament brackets (requires min 2 teams)"
                          >
                            {actionLoadingId === t.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                            <span>Start Tournament</span>
                          </button>
                        )}

                        {t.status === 'ongoing' && (
                          <button
                            type="button"
                            onClick={() => {
                              setCompletingTournament(t);
                              setCompleteWinnerName(t.winnerName || '');
                              setCompleteRunnerUpName(t.runnerUpName || '');
                              setCompleteMvpName(t.mvpName || '');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold transition-all duration-[120ms] cursor-pointer"
                            title="Crown winner and complete tournament"
                          >
                            <Crown className="h-3 w-3" />
                            <span>Complete Tournament</span>
                          </button>
                        )}

                        {t.status === 'completed' && (
                          <span className="text-[10px] text-text-muted font-mono inline-flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-emerald-400" />
                            <span>Finalized</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Settings & Admin Controls */}
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(t)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-emerald-primary hover:bg-bg-canvas border border-transparent hover:border-border-subtle transition-colors duration-[120ms] cursor-pointer"
                          title="Configure tournament settings & metadata"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`/tournaments/${t.id}`}
                          target="_blank"
                          className="p-1.5 rounded-lg text-text-secondary hover:text-emerald-primary hover:bg-bg-canvas border border-transparent hover:border-border-subtle transition-colors duration-[120ms]"
                          title="View public bracket page"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id, t.title)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 hover:bg-bg-canvas border border-transparent hover:border-border-subtle transition-colors duration-[120ms] cursor-pointer"
                          title="Delete tournament"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit / Configure Tournament Modal */}
      {editingTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-primary" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-text-primary">
                  Configure Tournament: {editingTournament.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTournament(null)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-canvas transition-colors duration-[120ms] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TournamentStatus)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="registration_open">Registration Open</option>
                    <option value="ongoing">Ongoing (Live Brackets)</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                    Prize Pool (₹ INR)
                  </label>
                  <input
                    type="number"
                    value={editPrizePoolInr}
                    onChange={(e) => setEditPrizePoolInr(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                    Max Teams
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="128"
                    value={editMaxTeams}
                    onChange={(e) => setEditMaxTeams(parseInt(e.target.value, 10) || 16)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                    Bracket Format
                  </label>
                  <select
                    value={editFormat}
                    onChange={(e) => setEditFormat(e.target.value as TournamentFormat)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
                  >
                    <option value="single_elimination">Single Elimination</option>
                    <option value="double_elimination">Double Elimination</option>
                    <option value="round_robin">Round Robin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
                  />
                </div>
              </div>

              {/* Honorees (always editable in configuration) */}
              <div className="p-3.5 rounded-xl bg-bg-canvas border border-border-subtle space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-amber-400 block">
                  Honorees & Winners
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                      Champion / Winner
                    </label>
                    <input
                      type="text"
                      value={editWinnerName}
                      onChange={(e) => setEditWinnerName(e.target.value)}
                      placeholder="e.g. VO DUDU"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-amber-400 transition-colors duration-[120ms]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                      Runner-up
                    </label>
                    <input
                      type="text"
                      value={editRunnerUpName}
                      onChange={(e) => setEditRunnerUpName(e.target.value)}
                      placeholder="e.g. Goon"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-slate-300 transition-colors duration-[120ms]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                      Audience MVP
                    </label>
                    <input
                      type="text"
                      value={editMvpName}
                      onChange={(e) => setEditMvpName(e.target.value)}
                      placeholder="e.g. Marvelous Grievous"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-rose-400 transition-colors duration-[120ms]"
                    />
                  </div>
                </div>
              </div>

              {/* Rules Markdown */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                  Tournament Rules & Description (Markdown)
                </label>
                <textarea
                  rows={3}
                  value={editRulesMarkdown}
                  onChange={(e) => setEditRulesMarkdown(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setEditingTournament(null)}
                  className="px-4 py-2 rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors duration-[120ms] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-primary hover:bg-[#22C58F] text-[#0B1A15] text-xs font-bold transition-all duration-[120ms] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingEdit ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Configuration</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Complete / Crown Champion Modal */}
      {completingTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-bg-surface border border-amber-500/30 rounded-2xl p-6 max-w-md w-full space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2 text-amber-400">
                <Crown className="h-5 w-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                  Crown Champion & Finalize
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCompletingTournament(null)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-canvas transition-colors duration-[120ms] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Finalizing <strong className="text-text-primary">{completingTournament.title}</strong> will conclude the bracket and add the champions to the Hall of Fame.
            </p>

            <form onSubmit={handleCompleteTournament} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span>Champion / Winner *</span>
                </label>
                <input
                  type="text"
                  value={completeWinnerName}
                  onChange={(e) => setCompleteWinnerName(e.target.value)}
                  placeholder="e.g. VO DUDU"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-amber-400 transition-colors duration-[120ms]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                  <Medal className="h-3.5 w-3.5 text-slate-300" />
                  <span>Runner-up</span>
                </label>
                <input
                  type="text"
                  value={completeRunnerUpName}
                  onChange={(e) => setCompleteRunnerUpName(e.target.value)}
                  placeholder="e.g. Goon"
                  className="w-full px-3 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-slate-300 transition-colors duration-[120ms]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-rose-400" />
                  <span>Audience Favourite / MVP</span>
                </label>
                <input
                  type="text"
                  value={completeMvpName}
                  onChange={(e) => setCompleteMvpName(e.target.value)}
                  placeholder="e.g. Marvelous Grievous"
                  className="w-full px-3 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-rose-400 transition-colors duration-[120ms]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setCompletingTournament(null)}
                  className="px-4 py-2 rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors duration-[120ms] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCompleting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all duration-[120ms] disabled:opacity-50 cursor-pointer"
                >
                  {isCompleting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Finalizing...</span>
                    </>
                  ) : (
                    <span>Crown & Complete</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
