'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  ShoppingBag,
  Trophy,
  Activity,
  AlertTriangle,
  Trash2,
  UserX,
  CheckCircle,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { fetchWithAuth } from '../../lib/api';
import type { AdminMetrics, ModerationListingItem } from '@smex/shared';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminMetrics>({
    activeUsers: 0,
    activeListings: 0,
    liveTournaments: 0,
    databaseStatus: 'ok',
    dbLatencyMs: 0,
  });
  const [queue, setQueue] = useState<ModerationListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [metricsRes, queueRes] = await Promise.all([
          fetchWithAuth('/api/v1/admin/metrics'),
          fetchWithAuth('/api/v1/admin/marketplace/queue'),
        ]);

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData);
        }

        if (queueRes.ok) {
          const queueData = await queueRes.json();
          setQueue(queueData.queue || []);
        }
      } catch {
        // Fallback or offline state
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleTakedownListing = async (listingId: string) => {
    try {
      const res = await fetchWithAuth(`/api/v1/admin/marketplace/listings/${listingId}/takedown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Terms of service violation' }),
      });

      if (res.ok) {
        setQueue((prev) => prev.filter((item) => item.id !== listingId));
        setActionMessage(`Listing ${listingId} removed successfully`);
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch {
      // Non-fatal error handling
    }
  };

  const handleSuspendSeller = async (sellerId: string) => {
    try {
      const res = await fetchWithAuth(`/api/v1/admin/marketplace/sellers/${sellerId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Fraudulent listings and terms violation' }),
      });

      if (res.ok) {
        setQueue((prev) => prev.filter((item) => item.sellerId !== sellerId));
        setActionMessage(`Seller ${sellerId} suspended and listings removed`);
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch {
      // Non-fatal error handling
    }
  };

  return (
    <div
      data-testid="admin-dashboard-container"
      className="space-y-8 transition-all duration-120 ease-out"
    >
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary mb-1">
          Platform Health & Governance
        </h1>
        <p className="text-xs text-text-secondary font-mono">
          System telemetry and pending administrative moderation queues
        </p>
      </div>

      {actionMessage && (
        <div
          data-testid="action-notification"
          className="bg-emerald-950/70 border border-[#22C58F]/40 text-emerald-primary px-4 py-3 rounded-lg text-xs font-mono flex items-center gap-2 transition-all duration-120 ease-out"
        >
          <CheckCircle size={14} />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric: Active Users */}
        <div
          data-testid="metric-active-users"
          className="bg-bg-surface border border-border-subtle rounded-xl p-5 transition-all duration-120 ease-out hover:border-emerald-primary/50"
        >
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase">
              ACTIVE USERS
            </span>
            <Users size={16} className="text-emerald-primary" />
          </div>
          <div className="text-2xl font-black text-text-primary font-mono">
            {metrics.activeUsers.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted font-mono mt-1">Non-suspended accounts</div>
        </div>

        {/* Metric: Active Listings */}
        <div
          data-testid="metric-active-listings"
          className="bg-bg-surface border border-border-subtle rounded-xl p-5 transition-all duration-120 ease-out hover:border-emerald-primary/50"
        >
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase">
              ACTIVE LISTINGS
            </span>
            <ShoppingBag size={16} className="text-emerald-primary" />
          </div>
          <div className="text-2xl font-black text-text-primary font-mono">
            {metrics.activeListings.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted font-mono mt-1">Marketplace gaming IDs</div>
        </div>

        {/* Metric: Live Tournaments */}
        <Link
          href="/admin/tournaments"
          data-testid="metric-live-tournaments"
          className="bg-bg-surface border border-border-subtle rounded-xl p-5 transition-all duration-120 ease-out hover:border-emerald-primary/50 group block"
        >
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase group-hover:text-emerald-primary transition-colors">
              TOURNAMENTS (LIVE)
            </span>
            <Trophy size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-text-primary font-mono">
            {metrics.liveTournaments.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted font-mono mt-1 flex items-center justify-between">
            <span>Ongoing & active brackets</span>
            <span className="text-emerald-primary font-bold inline-flex items-center gap-0.5">Manage &rarr;</span>
          </div>
        </Link>

        {/* Metric: Database Latency */}
        <div
          data-testid="metric-db-latency"
          className="bg-bg-surface border border-border-subtle rounded-xl p-5 transition-all duration-120 ease-out hover:border-emerald-primary/50"
        >
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase">
              DB LATENCY
            </span>
            <Activity size={16} className="text-emerald-primary" />
          </div>
          <div className="text-2xl font-black text-text-primary font-mono flex items-center gap-2">
            <span>{metrics.dbLatencyMs}ms</span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-primary border border-emerald-primary/30 uppercase font-sans font-bold">
              {metrics.databaseStatus.toUpperCase()}
            </span>
          </div>
          <div className="text-[10px] text-text-muted font-mono mt-1">PostgreSQL pool probe</div>
        </div>
      </div>

      {/* Tournament Management Quick Link Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-xl bg-gradient-to-r from-bg-surface via-bg-surface-elevated to-bg-surface border border-border-subtle hover:border-emerald-primary/40 transition-all duration-120 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Tournament & Hall of Fame Management</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Create upcoming cash tournaments or record past tournament winners (Smex Cup) directly from the browser.
            </p>
          </div>
        </div>

        <Link
          href="/admin/tournaments"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-primary hover:bg-[#22C58F] text-[#0B1A15] font-bold text-xs tracking-wide transition-all duration-120 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Tournament Manager</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Urgent Action / Moderation Queue */}
      <section
        data-testid="moderation-queue-section"
        className="bg-bg-surface border border-border-subtle rounded-xl p-6 transition-all duration-120 ease-out"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-amber-400" />
            <h2 className="text-sm font-bold tracking-wider uppercase font-mono text-text-primary">
              URGENT ACTION QUEUE ({queue.length} PENDING)
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-text-muted">
            Loading moderation items...
          </div>
        ) : queue.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-text-muted flex flex-col items-center gap-2">
            <CheckCircle size={28} className="text-emerald-primary/60" />
            <span>Zero pending reports in moderation queue. Platform clean.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((item) => (
              <div
                key={item.id}
                data-testid={`queue-item-${item.id}`}
                className="bg-bg-canvas border border-border-subtle rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-120 ease-out"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800/40">
                      FLAGGED LISTING
                    </span>
                    <span className="text-xs font-mono text-text-muted">ID: {item.id}</span>
                  </div>
                  <h3 className="text-sm font-bold text-text-primary tracking-wide">{item.title}</h3>
                  <div className="text-xs text-text-secondary font-mono">
                    Price: <span className="text-emerald-primary font-bold">₹{item.priceInr} INR</span> •
                    Seller: <span className="text-text-primary">{item.sellerUsername || item.sellerId}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTakedownListing(item.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-700/40 text-xs font-bold transition-all duration-120 ease-out min-h-[38px]"
                  >
                    <Trash2 size={14} />
                    <span>Takedown Listing</span>
                  </button>
                  <button
                    onClick={() => handleSuspendSeller(item.sellerId)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-bg-surface-elevated hover:bg-bg-canvas text-text-secondary border border-border-subtle text-xs font-bold transition-all duration-120 ease-out min-h-[38px]"
                  >
                    <UserX size={14} />
                    <span>Suspend Seller</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
