'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CreateListingForm } from '../../../components/marketplace/CreateListingForm';

export default function CreateListingPage() {
  return (
    <main
      className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-120 ease-out"
      style={{ backgroundColor: '#000000' }}
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#8FA39C] hover:text-[#1FAE7A] transition-colors duration-120"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Marketplace
          </Link>
        </div>

        <div className="flex flex-col gap-2 border-b border-[#223530] pb-5">
          <h1 className="text-2xl sm:text-3xl font-black text-[#E9F5F1] tracking-tight">
            Create Account Listing
          </h1>
          <p className="text-sm text-[#8FA39C]">
            List your game account for sale. Upload verified screenshot proofs. Direct contact via WhatsApp or Instagram.
          </p>
        </div>

        <div className="p-6 sm:p-8 rounded-2xl bg-[#121C19] border border-[#223530]">
          <CreateListingForm />
        </div>
      </div>
    </main>
  );
}
