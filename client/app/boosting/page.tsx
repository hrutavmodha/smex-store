'use client';

import React from 'react';
import { Calculator } from '../../components/boosting/Calculator';

export default function BoostingPage() {
  return (
    <main
      data-testid="boosting-page-container"
      className="min-h-screen bg-bg-canvas text-text-primary py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-[120ms] ease-out"
    >
      <div className="max-w-5xl mx-auto space-y-8">
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

        {/* Interactive Calculator Engine */}
        <Calculator />
      </div>
    </main>
  );
}
