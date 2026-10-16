'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchMarketplaceListingById, type MarketplaceListingItem } from '../../../lib/marketplace/api';
import { ListingDetailView } from '../../../components/marketplace/ListingDetailView';
import { Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function MarketplaceDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [listing, setListing] = useState<MarketplaceListingItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!id) return;

    fetchMarketplaceListingById(id)
      .then((data) => {
        if (isMounted) {
          setListing(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError((err as Error).message || 'Failed to load listing.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <main
      className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-120 ease-out"
      style={{ backgroundColor: '#000000' }}
    >
      <div className="max-w-6xl mx-auto">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#8FA39C]">
            <Loader2 className="w-8 h-8 animate-spin text-[#1FAE7A]" />
            <span className="text-sm">Loading listing details...</span>
          </div>
        ) : error || !listing ? (
          <div className="py-20 px-6 rounded-2xl bg-[#121C19] border border-[#223530] flex flex-col items-center justify-center text-center gap-4 max-w-md mx-auto">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <h2 className="text-lg font-bold text-[#E9F5F1]">Listing Not Found</h2>
            <p className="text-xs text-[#8FA39C]">
              {error || 'This listing may have been sold or removed by the seller.'}
            </p>
            <Link
              href="/marketplace"
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#0B1A15] bg-[#1FAE7A] hover:bg-[#22C58F] transition-all duration-120 cursor-pointer"
            >
              Return to Marketplace
            </Link>
          </div>
        ) : (
          <ListingDetailView listing={listing} />
        )}
      </div>
    </main>
  );
}
