'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  ShoppingBag,
  Trophy,
  Activity,
  AlertTriangle,
  Trash2,
  UserX,
  CheckCircle,
  ExternalLink,
  Shield,
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
        <h1 className="text-xl font-bold tracking-tight text-white mb-1">
          Platform Health & Governance
        </h1>
        <p className="text-xs text-gray-400 font-mono">
          System telemetry and pending administrative moderation queues
        </p>
      </div>

      {actionMessage && (
        <div
          data-testid="action-notification"
          className="bg-emerald-950/70 border border-[#22C58F]/40 text-[#22C58F] px-4 py-3 rounded-lg text-xs font-mono flex items-center gap-2 transition-all duration-120 ease-out"
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
          className="bg-[#121C19] border border-[#223530] rounded-xl p-5 transition-all duration-120 ease-out hover:border-[#1FAE7A]/50"
          style={{ backgroundColor: '#121C19', borderColor: '#223530' }}
        >
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase">
              ACTIVE USERS
            </span>
            <Users size={16} className="text-[#22C58F]" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {metrics.activeUsers.toLocaleString()}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">Non-suspended accounts</div>
        </div>

        {/* Metric: Active Listings */}
        <div
          data-testid="metric-active-listings"
          className="bg-[#121C19] border border-[#223530] rounded-xl p-5 transition-all duration-120 ease-out hover:border-[#1FAE7A]/50"
          style={{ backgroundColor: '#121C19', borderColor: '#223530' }}
        >
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase">
              ACTIVE LISTINGS
            </span>
            <ShoppingBag size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {metrics.activeListings.toLocaleString()}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">Marketplace gaming IDs</div>
        </div>

        {/* Metric: Live Tournaments */}
        <div
          data-testid="metric-live-tournaments"
          className="bg-[#121C19] border border-[#223530] rounded-xl p-5 transition-all duration-120 ease-out hover:border-[#1FAE7A]/50"
          style={{ backgroundColor: '#121C19', borderColor: '#223530' }}
        >
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase">
              TOURNAMENTS (LIVE)
            </span>
            <Trophy size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {metrics.liveTournaments.toLocaleString()}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">Ongoing & active brackets</div>
        </div>

        {/* Metric: Database Latency */}
        <div
          data-testid="metric-db-latency"
          className="bg-[#121C19] border border-[#223530] rounded-xl p-5 transition-all duration-120 ease-out hover:border-[#1FAE7A]/50"
          style={{ backgroundColor: '#121C19', borderColor: '#223530' }}
        >
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase">
              DB LATENCY
            </span>
            <Activity size={16} className="text-[#22C58F]" />
          </div>
          <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
            <span>{metrics.dbLatencyMs}ms</span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-[#22C58F] border border-[#22C58F]/30 uppercase font-sans font-bold">
              {metrics.databaseStatus.toUpperCase()}
            </span>
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">PostgreSQL pool probe</div>
        </div>
      </div>

      {/* Urgent Action / Moderation Queue */}
      <section
        data-testid="moderation-queue-section"
        className="bg-[#121C19] border border-[#223530] rounded-xl p-6 transition-all duration-120 ease-out"
        style={{ backgroundColor: '#121C19', borderColor: '#223530' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-amber-400" />
            <h2 className="text-sm font-bold tracking-wider uppercase font-mono text-white">
              URGENT ACTION QUEUE ({queue.length} PENDING)
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-gray-400">
            Loading moderation items...
          </div>
        ) : queue.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-gray-500 flex flex-col items-center gap-2">
            <CheckCircle size={28} className="text-[#22C58F]/60" />
            <span>Zero pending reports in moderation queue. Platform clean.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((item) => (
              <div
                key={item.id}
                data-testid={`queue-item-${item.id}`}
                className="bg-[#0B0F12] border border-[#223530] rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-120 ease-out"
                style={{ backgroundColor: '#0B0F12', borderColor: '#223530' }}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800/40">
                      FLAGGED LISTING
                    </span>
                    <span className="text-xs font-mono text-gray-400">ID: {item.id}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-wide">{item.title}</h3>
                  <div className="text-xs text-gray-400 font-mono">
                    Price: <span className="text-[#22C58F] font-bold">₹{item.priceInr} INR</span> •
                    Seller: <span className="text-gray-200">{item.sellerUsername || item.sellerId}</span>
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
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#16211D] hover:bg-[#223530] text-gray-300 border border-[#223530] text-xs font-bold transition-all duration-120 ease-out min-h-[38px]"
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
