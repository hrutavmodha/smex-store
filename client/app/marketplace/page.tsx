'use client';

import React from 'react';
import { MarketplaceCatalog } from '../../components/marketplace/MarketplaceCatalog';

export default function MarketplacePage() {
  return (
    <main
      className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-120 ease-out"
      style={{ backgroundColor: '#000000' }}
    >
      <div className="max-w-7xl mx-auto">
        <MarketplaceCatalog />
      </div>
    </main>
  );
}
