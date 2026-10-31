'use client';

import React from 'react';
import { Calculator } from '../../components/boosting/Calculator';
import { ShieldCheck, MessageCircle, Sliders, UserCheck, Zap, CheckCircle2 } from 'lucide-react';
import { WhatsAppIcon } from '../../components/shell/SocialIcons';

export default function BoostingPage() {
  return (
    <main
      data-testid="boosting-page-container"
      /* AMOLED True Black palette (#000000) */
      className="min-h-screen bg-bg-canvas text-text-primary py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-[120ms] ease-out"
    >
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bg-surface border border-border-subtle text-emerald-primary text-xs font-semibold tracking-wide uppercase">
            Mobile Legends: Bang Bang
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">
            MLBB Rank Boosting Calculator
          </h1>
          <p className="max-w-2xl mx-auto text-sm text-text-secondary">
            Professional, vetted boosters. 100% account safety guaranteed. Zero ban record. Dual-mode calculation with live price attestation and instant dispatch.
          </p>
        </div>

        {/* Step-by-Step Customer Ordering Flow */}
        <section
          data-testid="boosting-ordering-flow"
          className="p-6 sm:p-8 rounded-2xl bg-bg-surface border border-border-subtle shadow-xl space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-primary">
                Ordering Procedure
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-text-primary mt-0.5">
                How To Order Rank Boosting
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-primary/10 border border-emerald-primary/30 text-emerald-primary text-xs font-bold">
              <ShieldCheck className="h-4 w-4" />
              <span>Official SMEX Esports Team Handoff</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="flex flex-col p-5 rounded-xl bg-bg-canvas border border-border-subtle space-y-3 relative group hover:border-emerald-primary/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-emerald-primary/15 text-emerald-primary font-black flex items-center justify-center text-sm border border-emerald-primary/30">
                1
              </div>
              <h3 className="font-bold text-sm text-text-primary">
                Select Ranks & Desired Mode
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Choose your current rank and desired target rank using the calculator below. Toggle role priority or duo play as needed.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col p-5 rounded-xl bg-bg-canvas border border-border-subtle space-y-3 relative group hover:border-cyan-depth/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-cyan-depth/15 text-cyan-depth font-black flex items-center justify-center text-sm border border-cyan-depth/30">
                2
              </div>
              <h3 className="font-bold text-sm text-text-primary">
                Enter In-Game Name (IGN)
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Provide your MLBB in-game name and optional server ID so our coordination team can verify match eligibility.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col p-5 rounded-xl bg-bg-canvas border border-border-subtle space-y-3 relative group hover:border-[#25D366]/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-[#25D366]/15 text-[#25D366] font-black flex items-center justify-center text-sm border border-[#25D366]/30">
                3
              </div>
              <h3 className="font-bold text-sm text-text-primary">
                Dispatch Order on WhatsApp
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Click &quot;Dispatch Order on WhatsApp&quot; to connect directly with the official SMEX Esports Team for booster assignment, scheduling, and payment.
              </p>
            </div>
          </div>

          {/* Policy & Safety Notice */}
          <div className="p-4 rounded-xl bg-bg-surface-elevated border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-text-secondary">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0" />
              <span>
                <strong>Zero Fabricated ETAs:</strong> Realistic booster scheduling confirmed directly with you before kickoff.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <WhatsAppIcon className="h-4 w-4 text-[#25D366] shrink-0" />
              <span>Dispatches exclusively to official SMEX Esports Team</span>
            </div>
          </div>
        </section>

        {/* Interactive Calculator Engine */}
        <Calculator />
      </div>
    </main>
  );
}
