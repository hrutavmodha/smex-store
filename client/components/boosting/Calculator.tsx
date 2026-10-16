'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  calculateBoostingPrice,
  type BoostingAddons,
  type BoostingRateRow,
  type BoostingSurchargeConfig,
} from '../../lib/boosting/calculator';
import {
  generateOrderRef,
  resolveWhatsAppHandoff,
  resolveInstagramHandoff,
} from '../../lib/boosting/dispatcher';
import { fetchWithAuth } from '../../lib/api';

const SUB_MYTHIC_TIERS = ['Epic', 'Legend', 'Mythic'];
const MYTHIC_TIERS = ['Mythic', 'Mythical Honor', 'Mythical Glory', 'Mythical Immortal'];
const ROLES = ['Jungle', 'Gold', 'Mid', 'Roam', 'EXP'] as const;

function getTierFromStars(stars: number): string {
  if (stars >= 100) return 'Mythical Immortal';
  if (stars >= 50) return 'Mythical Glory';
  if (stars >= 25) return 'Mythical Honor';
  return 'Mythic';
}

function getBaseStarsFromTier(tier: string): number {
  switch (tier) {
    case 'Mythical Immortal':
      return 100;
    case 'Mythical Glory':
      return 50;
    case 'Mythical Honor':
      return 25;
    case 'Mythic':
    default:
      return 0;
  }
}

export function Calculator() {
  const [pricingMode, setPricingMode] = useState<'fixed_tier' | 'per_star'>('per_star');

  // Sub-mythic selection
  const [fixedStartTier, setFixedStartTier] = useState<string>('Epic');
  const [fixedTargetTier, setFixedTargetTier] = useState<string>('Legend');

  // Star ladder selection
  const [starStartTier, setStarStartTier] = useState<string>('Mythic');
  const [starTargetTier, setStarTargetTier] = useState<string>('Mythical Honor');
  const [startingStars, setStartingStars] = useState<number>(10);
  const [targetStars, setTargetStars] = useState<number>(30);

  // Active rates and surcharges fetched from API (BUG-M6-002)
  const [rates, setRates] = useState<BoostingRateRow[] | undefined>(undefined);
  const [surcharges, setSurcharges] = useState<Partial<BoostingSurchargeConfig> | undefined>(undefined);

  useEffect(() => {
    fetch('/api/v1/boosting/rates')
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.rates) setRates(data.rates);
        if (data?.surcharges) setSurcharges(data.surcharges);
      })
      .catch(() => {});
  }, []);

  // Dropdown <-> Slider bidirectional synchronization handlers (BUG-M6-003)
  const handleStartTierChange = (tier: string) => {
    setStarStartTier(tier);
    setStartingStars(getBaseStarsFromTier(tier));
  };

  const handleStartStarsChange = (stars: number) => {
    const clamped = Math.max(0, Math.min(999, isNaN(stars) ? 0 : stars));
    setStartingStars(clamped);
    setStarStartTier(getTierFromStars(clamped));
  };

  const handleTargetTierChange = (tier: string) => {
    setStarTargetTier(tier);
    setTargetStars(getBaseStarsFromTier(tier));
  };

  const handleTargetStarsChange = (stars: number) => {
    const clamped = Math.max(0, Math.min(999, isNaN(stars) ? 0 : stars));
    setTargetStars(clamped);
    setStarTargetTier(getTierFromStars(clamped));
  };

  // Add-ons
  const [hasRolePriority, setHasRolePriority] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<string>('Jungle');
  const [hasHeroPool, setHasHeroPool] = useState<boolean>(false);
  const [heroPoolText, setHeroPoolText] = useState<string>('');
  const [duoPlay, setDuoPlay] = useState<boolean>(false);

  // Credentials
  const [customerIgn, setCustomerIgn] = useState<string>('');
  const [serverId, setServerId] = useState<string>('');

  // UI state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Parse hero list
  const restrictedHeroPool = useMemo(() => {
    if (!hasHeroPool || !heroPoolText.trim()) return [];
    return heroPoolText
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
  }, [hasHeroPool, heroPoolText]);

  const addons: BoostingAddons = useMemo(() => {
    return {
      rolePriority: hasRolePriority ? selectedRole : undefined,
      restrictedHeroPool: hasHeroPool && restrictedHeroPool.length > 0 ? restrictedHeroPool : undefined,
      duoPlayWithBooster: duoPlay,
    };
  }, [hasRolePriority, selectedRole, hasHeroPool, restrictedHeroPool, duoPlay]);

  // Real-time zero-latency client calculation
  const quote = useMemo(() => {
    try {
      if (pricingMode === 'fixed_tier') {
        return calculateBoostingPrice({
          pricingMode: 'fixed_tier',
          startingRank: fixedStartTier,
          targetRank: fixedTargetTier,
          addons,
          rates,
          surcharges,
        });
      } else {
        return calculateBoostingPrice({
          pricingMode: 'per_star',
          startingRank: starStartTier,
          targetRank: starTargetTier,
          startingStars,
          targetStars,
          addons,
          rates,
          surcharges,
        });
      }
    } catch {
      return {
        basePriceInr: '0.00',
        discountInr: '0.00',
        breakdown: [],
        surcharges: [],
        totalPriceInr: '0.00',
      };
    }
  }, [
    pricingMode,
    fixedStartTier,
    fixedTargetTier,
    starStartTier,
    starTargetTier,
    startingStars,
    targetStars,
    addons,
    rates,
    surcharges,
  ]);

  const isDispatchDisabled = !customerIgn.trim() || Number(quote.totalPriceInr) <= 0 || isSubmitting;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDispatch = async (channel: 'whatsapp' | 'instagram') => {
    if (isDispatchDisabled) return;

    setIsSubmitting(true);
    const orderPayload = {
      pricingMode,
      startingRank: pricingMode === 'fixed_tier' ? fixedStartTier : starStartTier,
      targetRank: pricingMode === 'fixed_tier' ? fixedTargetTier : starTargetTier,
      startingStars: pricingMode === 'fixed_tier' ? 0 : startingStars,
      targetStars: pricingMode === 'fixed_tier' ? 0 : targetStars,
      customerIgn: customerIgn.trim(),
      serverId: serverId.trim() || undefined,
      contactChannel: channel,
      addons,
    };

    let destinationUrl = '';
    let formattedText = '';

    try {
      const res = await fetchWithAuth('/api/v1/boosting/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (res.ok) {
        const data = await res.json();
        destinationUrl = data.dispatch?.destinationUrl;
        formattedText = data.dispatch?.formattedText;
      }
    } catch {
      // Offline fallback: format client-side
    }

    if (!destinationUrl || !formattedText) {
      const orderRef = generateOrderRef();
      const clientInput = {
        orderRef,
        customerIgn: customerIgn.trim(),
        serverId: serverId.trim() || undefined,
        startingRank: orderPayload.startingRank,
        targetRank: orderPayload.targetRank,
        startingStars: orderPayload.startingStars,
        targetStars: orderPayload.targetStars,
        pricingMode,
        totalPriceInr: quote.totalPriceInr,
        addons,
      };

      if (channel === 'whatsapp') {
        const wa = resolveWhatsAppHandoff(clientInput);
        destinationUrl = wa.destinationUrl;
        formattedText = wa.formattedText;
      } else {
        const ig = resolveInstagramHandoff(clientInput);
        destinationUrl = ig.destinationUrl;
        formattedText = ig.formattedText;
      }
    }

    // Copy formatted plain text to clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(formattedText);
      } catch {
        // Clipboard permission denied or unsupported
      }
    }

    if (channel === 'instagram') {
      showToast('Order details copied to clipboard! Paste into Instagram DM to confirm.');
    } else {
      showToast('Order details copied to clipboard! Opening WhatsApp...');
    }

    if (destinationUrl) {
      window.open(destinationUrl, '_blank', 'noopener,noreferrer');
    }

    setIsSubmitting(false);
  };

  return (
    <div
      data-testid="boosting-calculator"
      className="w-full max-w-4xl mx-auto rounded-2xl bg-bg-surface border border-[#223530] p-6 sm:p-8 space-y-8"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          data-testid="toast-notification"
          className="p-3 rounded-lg bg-[#121C19] border border-[#22C58F] text-[#22C58F] text-sm font-medium transition-all duration-[120ms] ease-out text-center"
        >
          {toastMessage}
        </div>
      )}

      {/* Mode Selector */}
      <div className="flex rounded-xl bg-[#121C19] p-1 border border-[#223530]">
        <button
          type="button"
          data-testid="mode-fixed-tier"
          onClick={() => setPricingMode('fixed_tier')}
          className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all duration-[120ms] ease-out ${
            pricingMode === 'fixed_tier'
              ? 'bg-[#22C58F] text-black shadow-md'
              : 'text-[#EDEDED] hover:text-[#22C58F]'
          }`}
        >
          Fixed Tier Packages (Sub-Mythic)
        </button>
        <button
          type="button"
          data-testid="mode-per-star"
          onClick={() => setPricingMode('per_star')}
          className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all duration-[120ms] ease-out ${
            pricingMode === 'per_star'
              ? 'bg-[#22C58F] text-black shadow-md'
              : 'text-[#EDEDED] hover:text-[#22C58F]'
          }`}
        >
          Per-Star Ladder (Mythic & Above)
        </button>
      </div>

      {/* Rank & Progression Configuration */}
      {pricingMode === 'fixed_tier' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-4 rounded-xl bg-[#121C19] border border-[#223530] space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#22C58F]">
              1. Starting Rank
            </label>
            <select
              data-testid="starting-rank-select"
              value={fixedStartTier}
              onChange={(e) => setFixedStartTier(e.target.value)}
              className="w-full py-2.5 px-3 rounded-lg bg-[#000000] border border-[#223530] text-[#EDEDED] text-sm focus:outline-none focus:border-[#22C58F] transition-all duration-[120ms] ease-out"
            >
              {SUB_MYTHIC_TIERS.filter((t) => t !== 'Mythic').map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 rounded-xl bg-[#121C19] border border-[#223530] space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#22C58F]">
              2. Target Rank
            </label>
            <select
              data-testid="target-rank-select"
              value={fixedTargetTier}
              onChange={(e) => setFixedTargetTier(e.target.value)}
              className="w-full py-2.5 px-3 rounded-lg bg-[#000000] border border-[#223530] text-[#EDEDED] text-sm focus:outline-none focus:border-[#22C58F] transition-all duration-[120ms] ease-out"
            >
              {SUB_MYTHIC_TIERS.filter((t) => t !== 'Epic').map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-[#121C19] border border-[#223530] space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#22C58F]">
                  1. Current Rank & Stars
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    data-testid="starting-stars-input"
                    min={0}
                    max={999}
                    value={startingStars}
                    onChange={(e) => handleStartStarsChange(parseInt(e.target.value, 10))}
                    className="w-16 py-0.5 px-1.5 rounded bg-[#000000] border border-[#223530] text-[#22C58F] font-mono text-sm font-bold text-right focus:outline-none focus:border-[#22C58F] transition-all duration-[120ms] ease-out"
                  />
                  <span className="font-mono text-sm text-[#22C58F] font-bold">★</span>
                </div>
              </div>
              <select
                data-testid="starting-rank-select"
                value={starStartTier}
                onChange={(e) => handleStartTierChange(e.target.value)}
                className="w-full py-2 px-3 rounded-lg bg-[#000000] border border-[#223530] text-[#EDEDED] text-sm focus:outline-none focus:border-[#22C58F] transition-all duration-[120ms] ease-out"
              >
                {MYTHIC_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
              <input
                type="range"
                data-testid="starting-stars-slider"
                min={0}
                max={999}
                value={startingStars}
                onChange={(e) => handleStartStarsChange(parseInt(e.target.value, 10))}
                className="w-full accent-[#22C58F] cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#121C19] border border-[#223530] space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#22C58F]">
                  2. Target Rank & Stars
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    data-testid="target-stars-input"
                    min={0}
                    max={999}
                    value={targetStars}
                    onChange={(e) => handleTargetStarsChange(parseInt(e.target.value, 10))}
                    className="w-16 py-0.5 px-1.5 rounded bg-[#000000] border border-[#223530] text-[#22C58F] font-mono text-sm font-bold text-right focus:outline-none focus:border-[#22C58F] transition-all duration-[120ms] ease-out"
                  />
                  <span className="font-mono text-sm text-[#22C58F] font-bold">★</span>
                </div>
              </div>
              <select
                data-testid="target-rank-select"
                value={starTargetTier}
                onChange={(e) => handleTargetTierChange(e.target.value)}
                className="w-full py-2 px-3 rounded-lg bg-[#000000] border border-[#223530] text-[#EDEDED] text-sm focus:outline-none focus:border-[#22C58F] transition-all duration-[120ms] ease-out"
              >
                {MYTHIC_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
              <input
                type="range"
                data-testid="target-stars-slider"
                min={0}
                max={999}
                value={targetStars}
                onChange={(e) => handleTargetStarsChange(parseInt(e.target.value, 10))}
                className="w-full accent-[#22C58F] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Surcharges / Add-ons Section */}
      <div className="p-4 rounded-xl bg-[#121C19] border border-[#223530] space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#22C58F]">
          3. Service Add-ons (Optional)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Role Priority */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#EDEDED]">
              <input
                type="checkbox"
                data-testid="role-priority-checkbox"
                checked={hasRolePriority}
                onChange={(e) => setHasRolePriority(e.target.checked)}
                className="accent-[#22C58F] h-4 w-4 rounded"
              />
              <span>Role Priority (+15%)</span>
            </label>
            {hasRolePriority && (
              <select
                data-testid="role-priority-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full py-1.5 px-2.5 rounded bg-[#000000] border border-[#223530] text-xs text-[#EDEDED] focus:outline-none focus:border-[#22C58F]"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Hero Pool */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#EDEDED]">
              <input
                type="checkbox"
                data-testid="hero-pool-checkbox"
                checked={hasHeroPool}
                onChange={(e) => setHasHeroPool(e.target.checked)}
                className="accent-[#22C58F] h-4 w-4 rounded"
              />
              <span>Specific Hero Pool (+₹150)</span>
            </label>
            {hasHeroPool && (
              <input
                type="text"
                data-testid="hero-pool-input"
                placeholder="e.g. Ling, Fanny, Hayabusa"
                value={heroPoolText}
                onChange={(e) => setHeroPoolText(e.target.value)}
                className="w-full py-1.5 px-2.5 rounded bg-[#000000] border border-[#223530] text-xs text-[#EDEDED] focus:outline-none focus:border-[#22C58F]"
              />
            )}
          </div>

          {/* Duo Play */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#EDEDED]">
              <input
                type="checkbox"
                data-testid="duo-play-checkbox"
                checked={duoPlay}
                onChange={(e) => setDuoPlay(e.target.checked)}
                className="accent-[#22C58F] h-4 w-4 rounded"
              />
              <span>Duo Play (+25%)</span>
            </label>
            <p className="text-[11px] text-[#A0AEC0]">Play on your own account with booster</p>
          </div>
        </div>
      </div>

      {/* Player Credentials */}
      <div className="p-4 rounded-xl bg-[#121C19] border border-[#223530] space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#22C58F]">
          4. Player Credentials
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#A0AEC0] mb-1">
              Player In-Game Name (IGN) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              data-testid="customer-ign-input"
              placeholder="e.g. ViperMLBB"
              value={customerIgn}
              onChange={(e) => setCustomerIgn(e.target.value)}
              className="w-full py-2 px-3 rounded-lg bg-[#000000] border border-[#223530] text-sm text-[#EDEDED] focus:outline-none focus:border-[#22C58F] transition-all duration-[120ms] ease-out"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A0AEC0] mb-1">Server ID (Optional)</label>
            <input
              type="text"
              data-testid="server-id-input"
              placeholder="e.g. 2048"
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              className="w-full py-2 px-3 rounded-lg bg-[#000000] border border-[#223530] text-sm text-[#EDEDED] focus:outline-none focus:border-[#22C58F] transition-all duration-[120ms] ease-out"
            />
          </div>
        </div>
      </div>

      {/* Live Quote & Order Summary */}
      <div className="p-6 rounded-xl bg-[#121C19] border border-[#223530] space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#22C58F]">
          Order Summary & Live Quote
        </h3>

        <div className="space-y-2 border-b border-[#223530] pb-4">
          {quote.breakdown.map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs text-[#EDEDED]">
              <span>
                {item.tier} {item.stars ? `(${item.stars}★ @ ₹${item.rate})` : ''}
              </span>
              <span className="font-mono">₹{item.subtotal}</span>
            </div>
          ))}
          {Number(quote.discountInr) > 0 && (
            <div className="flex justify-between text-xs text-[#22C58F]">
              <span>Bundle Leap Discount</span>
              <span className="font-mono">-₹{quote.discountInr}</span>
            </div>
          )}
          {quote.surcharges.map((s, idx) => (
            <div key={idx} className="flex justify-between text-xs text-[#20A6AE]">
              <span>
                {s.name} ({s.rate})
              </span>
              <span className="font-mono">+₹{s.amount}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-sm font-semibold uppercase tracking-wider text-[#EDEDED]">
            Total Estimated Price:
          </span>
          <span
            data-testid="live-quote-price"
            className="text-2xl font-black font-mono text-[#22C58F]"
          >
            ₹{quote.totalPriceInr} INR
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
          <button
            type="button"
            data-testid="dispatch-whatsapp-btn"
            disabled={isDispatchDisabled}
            onClick={() => handleDispatch('whatsapp')}
            className={`py-3.5 px-4 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 transition-all duration-[120ms] ease-out ${
              isDispatchDisabled
                ? 'bg-[#16211D] text-[#4A5568] cursor-not-allowed border border-[#223530]'
                : 'bg-[#22C58F] hover:bg-[#1FAE7A] active:scale-[0.98] shadow-lg shadow-[#22C58F]/20'
            }`}
          >
            1-Click WhatsApp
          </button>

          <button
            type="button"
            data-testid="dispatch-instagram-btn"
            disabled={isDispatchDisabled}
            onClick={() => handleDispatch('instagram')}
            className={`py-3.5 px-4 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 transition-all duration-[120ms] ease-out ${
              isDispatchDisabled
                ? 'bg-[#16211D] text-[#4A5568] cursor-not-allowed border border-[#223530]'
                : 'bg-[#20A6AE] hover:bg-[#1B8F97] active:scale-[0.98] shadow-lg shadow-[#20A6AE]/20'
            }`}
          >
            Copy & Open Instagram
          </button>
        </div>
      </div>
    </div>
  );
}

export default Calculator;
