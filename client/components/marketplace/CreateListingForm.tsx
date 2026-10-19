'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, AlertCircle, Loader2 } from 'lucide-react';
import {
  uploadScreenshotProof,
  deleteUploadedProof,
  MAX_UPLOAD_SIZE,
  ALLOWED_UPLOAD_TYPES,
} from '../../lib/marketplace/uploader';
import { createMarketplaceListing } from '../../lib/marketplace/api';
import { ProofUploadGrid } from './ProofUploadGrid';
import type { ProofImageItem } from '@smex/shared';

const RANK_TIERS = [
  'Epic',
  'Legend',
  'Mythic',
  'Mythical Honor',
  'Mythical Glory',
  'Mythical Immortal',
] as const;

export function CreateListingForm() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [rankTier, setRankTier] = useState<string>('Mythic');
  const [priceInr, setPriceInr] = useState<string>('');
  const [contactChannel, setContactChannel] = useState<'whatsapp' | 'instagram'>('whatsapp');
  const [contactHandle, setContactHandle] = useState('');

  // Uploading state
  const [uploadedProofs, setUploadedProofs] = useState<ProofImageItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Form submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);

    const availableSlots = 5 - uploadedProofs.length;
    if (availableSlots <= 0) {
      setUploadError('Maximum 5 proof screenshots allowed per listing.');
      return;
    }

    const filesToUpload = Array.from(files).slice(0, availableSlots);

    for (const file of filesToUpload) {
      if (file.size > MAX_UPLOAD_SIZE) {
        setUploadError(`File '${file.name}' exceeds the 5MB size limit.`);
        return;
      }
      if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
        setUploadError(`File '${file.name}' has an unsupported format. Please upload JPEG, PNG, or WebP.`);
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const newProofs: ProofImageItem[] = [...uploadedProofs];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const result = await uploadScreenshotProof(file, (percent) => {
          const overallProgress = Math.round(
            ((i * 100) + percent) / filesToUpload.length
          );
          setUploadProgress(overallProgress);
        });

        newProofs.push({
          s3Key: result.s3Key,
          cdnUrl: result.cdnUrl,
          displayOrder: newProofs.length,
        });
      }

      setUploadedProofs(newProofs);
      setUploadProgress(100);
    } catch (err: unknown) {
      setUploadError((err as Error).message || 'Failed to upload screenshot proofs.');
    } finally {
      setIsUploading(false);
    }
  };

  // Track submission and uploaded proofs for unmount cleanup
  const isSubmittedRef = useRef(false);
  const uploadedProofsRef = useRef<ProofImageItem[]>([]);
  uploadedProofsRef.current = uploadedProofs;

  useEffect(() => {
    return () => {
      if (!isSubmittedRef.current && uploadedProofsRef.current.length > 0) {
        for (const proof of uploadedProofsRef.current) {
          deleteUploadedProof(proof.s3Key).catch(() => {});
        }
      }
    };
  }, []);

  const removeProof = (indexToRemove: number) => {
    const proofToRemove = uploadedProofs[indexToRemove];
    setUploadedProofs((prev) =>
      prev
        .filter((_, idx) => idx !== indexToRemove)
        .map((proof, idx) => ({ ...proof, displayOrder: idx }))
    );
    if (proofToRemove?.s3Key) {
      deleteUploadedProof(proofToRemove.s3Key).catch((err) => {
        console.error('Failed to cleanup uncommitted proof:', err);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const price = parseFloat(priceInr);
    if (isNaN(price) || price < 100) {
      setFormError('Listing price must be at least ₹100 INR.');
      return;
    }

    if (!title.trim() || title.trim().length < 3) {
      setFormError('Title must be at least 3 characters long.');
      return;
    }

    if (!contactHandle.trim()) {
      setFormError('Contact handle/number is required.');
      return;
    }

    if (uploadedProofs.length === 0) {
      setFormError('Please upload at least one verified screenshot proof.');
      return;
    }

    setIsSubmitting(true);

    try {
      const newListing = await createMarketplaceListing({
        title: title.trim(),
        gameSlug: 'mlbb',
        rankTier,
        priceInr: price,
        contactChannel,
        contactHandle: contactHandle.trim(),
        proofImages: uploadedProofs,
      });

      isSubmittedRef.current = true;
      router.push(`/marketplace/${newListing.id}`);
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to publish listing. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col gap-6">
      {formError && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-sm text-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Listing Title */}
      <div className="flex flex-col gap-2">
        <label htmlFor="listing-title" className="text-sm font-semibold text-text-primary">
          Listing Title <span className="text-emerald-primary">*</span>
        </label>
        <input
          id="listing-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. MLBB Mythical Glory 75★ - 120 Skins, Collector Granger"
          required
          maxLength={100}
          className="w-full px-4 py-3 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-emerald-primary transition-all duration-120 ease-out"
        />
      </div>

      {/* Grid: Rank Tier & Price */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="rank-tier" className="text-sm font-semibold text-text-primary">
            Rank Tier <span className="text-emerald-primary">*</span>
          </label>
          <select
            id="rank-tier"
            value={rankTier}
            onChange={(e) => setRankTier(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-primary transition-all duration-120 ease-out cursor-pointer"
          >
            {RANK_TIERS.map((tier) => (
              <option key={tier} value={tier} className="bg-bg-surface text-text-primary">
                {tier}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="price-inr" className="text-sm font-semibold text-text-primary">
            Asking Price (INR) <span className="text-emerald-primary">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold">
              ₹
            </span>
            <input
              id="price-inr"
              type="number"
              min={100}
              step={1}
              value={priceInr}
              onChange={(e) => setPriceInr(e.target.value)}
              placeholder="Min. 100"
              required
              className="w-full pl-8 pr-4 py-3 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-emerald-primary transition-all duration-120 ease-out"
            />
          </div>
        </div>
      </div>

      {/* Grid: Contact Channel & Handle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-channel" className="text-sm font-semibold text-text-primary">
            Preferred Contact Channel <span className="text-emerald-primary">*</span>
          </label>
          <select
            id="contact-channel"
            value={contactChannel}
            onChange={(e) => setContactChannel(e.target.value as 'whatsapp' | 'instagram')}
            className="w-full px-4 py-3 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-primary transition-all duration-120 ease-out cursor-pointer capitalize"
          >
            <option value="whatsapp" className="bg-bg-surface text-text-primary">WhatsApp</option>
            <option value="instagram" className="bg-bg-surface text-text-primary">Instagram</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="contact-handle" className="text-sm font-semibold text-text-primary">
            {contactChannel === 'whatsapp' ? 'WhatsApp Phone Number' : 'Instagram Username'}{' '}
            <span className="text-emerald-primary">*</span>
          </label>
          <input
            id="contact-handle"
            type="text"
            value={contactHandle}
            onChange={(e) => setContactHandle(e.target.value)}
            placeholder={contactChannel === 'whatsapp' ? '+91 98765 43210' : '@your_handle'}
            required
            className="w-full px-4 py-3 rounded-xl bg-bg-canvas border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-emerald-primary transition-all duration-120 ease-out"
          />
        </div>
      </div>

      {/* Screenshot Proof Dropzone & Thumbnails */}
      <ProofUploadGrid
        uploadedProofs={uploadedProofs}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
        onFileSelect={handleFileSelect}
        onRemoveProof={removeProof}
      />

      {/* Safety Notice */}
      <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle flex items-start gap-3 text-xs text-text-secondary">
        <ShieldAlert className="w-5 h-5 text-emerald-primary shrink-0 mt-0.5" />
        <span>
          Screenshots are verified automatically for binary authenticity. Disguised executable files are permanently purged. Always hide confidential account credentials.
        </span>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || isUploading}
        className="w-full py-3.5 px-6 rounded-xl font-bold text-center text-[#0B1A15] bg-emerald-primary hover:bg-[#22C58F] transition-all duration-120 ease-out active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Publishing Listing...
          </>
        ) : (
          'Publish Account Listing'
        )}
      </button>
    </form>
  );
}

export default CreateListingForm;
