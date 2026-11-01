'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Save, RotateCcw, Calculator } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { fetchWithAuth } from '../../../lib/api';
import type { BoostingRateRow } from '@smex/shared';

interface RateItem {
  id: string;
  label: string;
  pricingMode: 'fixed_tier' | 'per_star';
  fromTier?: string;
  toTier?: string;
  starTier?: string;
  minStars?: number;
  maxStars?: number;
  priceInr: number;
  isActive: boolean;
}

const DEFAULT_RATES: RateItem[] = [
  // Sub-mythic fixed tiers
  {
    id: 'epic-legend',
    label: 'Epic → Legend',
    pricingMode: 'fixed_tier',
    fromTier: 'Epic',
    toTier: 'Legend',
    priceInr: 400,
    isActive: true,
  },
  {
    id: 'legend-mythic',
    label: 'Legend → Mythic',
    pricingMode: 'fixed_tier',
    fromTier: 'Legend',
    toTier: 'Mythic',
    priceInr: 300,
    isActive: true,
  },
  {
    id: 'epic-mythic-bundle',
    label: 'Epic → Mythic (Bundle)',
    pricingMode: 'fixed_tier',
    fromTier: 'Epic',
    toTier: 'Mythic',
    priceInr: 600,
    isActive: true,
  },
  // Mythic+ progressive per-star tiers
  {
    id: 'mythic-base',
    label: 'Mythic (0–24★)',
    pricingMode: 'per_star',
    starTier: 'mythic',
    minStars: 0,
    maxStars: 24,
    priceInr: 20,
    isActive: true,
  },
  {
    id: 'mythic-honor',
    label: 'Mythical Honor (25–49★)',
    pricingMode: 'per_star',
    starTier: 'honor',
    minStars: 25,
    maxStars: 49,
    priceInr: 30,
    isActive: true,
  },
  {
    id: 'mythic-glory',
    label: 'Mythical Glory (50–99★)',
    pricingMode: 'per_star',
    starTier: 'glory',
    minStars: 50,
    maxStars: 99,
    priceInr: 35,
    isActive: true,
  },
  {
    id: 'mythic-immortal',
    label: 'Mythical Immortal (100+★)',
    pricingMode: 'per_star',
    starTier: 'immortal',
    minStars: 100,
    maxStars: 999,
    priceInr: 40,
    isActive: true,
  },
];

export default function AdminRatesPage() {
  const [rates, setRates] = useState<RateItem[]>(DEFAULT_RATES);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRates() {
      try {
        const res = await fetchWithAuth('/api/v1/admin/boosting/rates');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.rates) && data.rates.length > 0) {
            setRates((prev) =>
              prev.map((item) => {
                const match = data.rates.find(
                  (r: BoostingRateRow) =>
                    r.id === item.id ||
                    (r.pricingMode === item.pricingMode &&
                      (r.fromTier === item.fromTier || r.starTier === item.starTier))
                );
                if (match) {
                  return {
                    ...item,
                    id: match.id || item.id,
                    priceInr: Number(match.priceInr) || item.priceInr,
                    isActive: match.isActive !== undefined ? match.isActive : item.isActive,
                  };
                }
                return item;
              })
            );
          }
        }
      } catch {
        // Fallback to local default rates
      }
    }

    fetchRates();
  }, []);

  const handlePriceChange = (id: string, valStr: string) => {
    const val = parseFloat(valStr);
    setRates((prev) =>
      prev.map((r) => (r.id === id ? { ...r, priceInr: isNaN(val) ? 0 : val } : r))
    );
  };

  // Instant calculation preview: Mythic 10★ -> Honor 30★
  // Mythic (0-24★): 10★ to 24★ (15 stars: 10,11,...,24) @ mythic rate
  // Honor (25-49★): 25★ to 30★ (5 stars: 25,26,27,28,29) @ honor rate
  const quotePreview = useMemo(() => {
    const mythicRate = rates.find((r) => r.id === 'mythic-base')?.priceInr || 20;
    const honorRate = rates.find((r) => r.id === 'mythic-honor')?.priceInr || 30;

    const starsInMythic = 15; // 10 to 24 stars
    const starsInHonor = 5; // 25 to 30 stars

    const mythicCost = starsInMythic * mythicRate;
    const honorCost = starsInHonor * honorRate;
    const total = mythicCost + honorCost;

    return {
      starsInMythic,
      mythicRate,
      starsInHonor,
      honorRate,
      total,
    };
  }, [rates]);

  const handleSave = async () => {
    setErrorMessage(null);
    try {
      for (const r of rates) {
        if (r.priceInr <= 0) {
          setErrorMessage('All prices must be strictly positive');
          return;
        }
        await fetchWithAuth(`/api/v1/admin/boosting/rates/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceInr: r.priceInr, isActive: r.isActive }),
        });
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      setErrorMessage('Failed to save rate overrides');
    }
  };

  const handleRevert = () => {
    setRates(DEFAULT_RATES);
    setErrorMessage(null);
  };

  return (
    <div
      data-testid="admin-rates-container"
      className="space-y-8 transition-all duration-120 ease-out"
    >
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary mb-1">
          LIVE BOOSTING RATE CONFIGURATION
        </h1>
        <p className="text-xs text-text-secondary font-mono">
          Adjust base rates in INR. Updates take effect immediately with zero server restart.
        </p>
      </div>

      {savedSuccess && (
        <Alert
          data-testid="rates-saved-alert"
          variant="success"
          description="Rates updated successfully. Cache invalidated sitewide."
        />
      )}

      {errorMessage && (
        <Alert
          data-testid="rates-error-alert"
          variant="error"
          description={errorMessage}
        />
      )}

      {/* Sub-Mythic Fixed Tiers */}
      <section
        className="bg-bg-surface border border-border-subtle rounded-xl p-6 transition-all duration-120 ease-out"
      >
        <h2 className="text-xs font-bold font-mono tracking-wider text-text-secondary uppercase mb-4">
          SUB-MYTHIC FIXED TIERS
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rates
            .filter((r) => r.pricingMode === 'fixed_tier')
            .map((r) => (
              <div
                key={r.id}
                className="bg-bg-canvas border border-border-subtle rounded-lg p-4 space-y-2 transition-all duration-120 ease-out"
              >
                <div className="text-xs font-semibold text-text-primary">{r.label}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-muted">₹</span>
                  <input
                    type="number"
                    data-testid={`rate-input-${r.id}`}
                    value={r.priceInr}
                    onChange={(e) => handlePriceChange(r.id, e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-emerald-primary min-h-[38px] transition-all duration-120 ease-out"
                  />
                  <span className="text-[10px] font-mono text-text-muted">INR</span>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Mythic+ Progressive Per-Star Rates */}
      <section
        className="bg-bg-surface border border-border-subtle rounded-xl p-6 transition-all duration-120 ease-out"
      >
        <h2 className="text-xs font-bold font-mono tracking-wider text-text-secondary uppercase mb-4">
          MYTHIC+ PROGRESSIVE PER-STAR RATES
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {rates
            .filter((r) => r.pricingMode === 'per_star')
            .map((r) => (
              <div
                key={r.id}
                className="bg-bg-canvas border border-border-subtle rounded-lg p-4 space-y-2 transition-all duration-120 ease-out"
              >
                <div className="text-xs font-semibold text-text-primary">{r.label}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-muted">₹</span>
                  <input
                    type="number"
                    data-testid={`rate-input-${r.id}`}
                    value={r.priceInr}
                    onChange={(e) => handlePriceChange(r.id, e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-emerald-primary min-h-[38px] transition-all duration-120 ease-out"
                  />
                  <span className="text-[10px] font-mono text-text-muted">/star</span>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Live Quote Preview Calculator */}
      <section
        data-testid="quote-preview-section"
        className="bg-bg-surface border border-border-subtle rounded-xl p-6 transition-all duration-120 ease-out"
      >
        <div className="flex items-center gap-2 mb-3">
          <Calculator size={16} className="text-emerald-primary" />
          <h2 className="text-xs font-bold font-mono tracking-wider text-text-primary uppercase">
            LIVE QUOTE PREVIEW CALCULATOR
          </h2>
        </div>
        <p className="text-xs text-text-secondary mb-4">
          Instant client-side evaluation without network overhead ($&lt; 5\text&#123;ms&#125;$):
        </p>

        <div
          data-testid="quote-preview-result"
          className="bg-bg-canvas border border-border-subtle rounded-lg p-4 font-mono text-xs text-text-primary transition-all duration-120 ease-out"
        >
          <span className="text-text-secondary">Test: Mythic 10★ → Honor 30★ = </span>
          <span>
            {quotePreview.starsInMythic}★@{quotePreview.mythicRate} +{' '}
            {quotePreview.starsInHonor}★@{quotePreview.honorRate} ={' '}
          </span>
          <span className="text-emerald-primary font-bold text-sm">
            ₹{quotePreview.total.toFixed(2)} INR
          </span>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={handleRevert}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-bg-surface-elevated hover:bg-bg-canvas text-text-secondary border border-border-subtle text-xs font-bold transition-all duration-120 ease-out min-h-[44px]"
        >
          <RotateCcw size={14} />
          <span>REVERT TO DEFAULTS</span>
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg bg-emerald-primary hover:bg-[#22C58F] text-[#0B1A15] text-xs font-bold transition-all duration-120 ease-out min-h-[44px]"
        >
          <Save size={14} />
          <span>SAVE RATE OVERRIDES</span>
        </button>
      </div>
    </div>
  );
}
