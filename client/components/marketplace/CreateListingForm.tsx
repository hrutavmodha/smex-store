'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, X, ShieldAlert, AlertCircle, Loader2 } from 'lucide-react';
import { uploadScreenshotProof, MAX_UPLOAD_SIZE, ALLOWED_UPLOAD_TYPES } from '../../lib/marketplace/uploader';
import { createMarketplaceListing, type ProofImageItem } from '../../lib/marketplace/api';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeProof = (indexToRemove: number) => {
    setUploadedProofs((prev) =>
      prev
        .filter((_, idx) => idx !== indexToRemove)
        .map((proof, idx) => ({ ...proof, displayOrder: idx }))
    );
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
      setFormError('Please enter your contact handle or phone number.');
      return;
    }

    if (uploadedProofs.length === 0) {
      setFormError('Please upload at least 1 verified proof screenshot of the account.');
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createMarketplaceListing({
        title: title.trim(),
        gameSlug: 'mlbb',
        rankTier,
        priceInr: price,
        contactChannel,
        contactHandle: contactHandle.trim(),
        proofImages: uploadedProofs,
      });

      router.push(`/marketplace/${created.id}`);
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to publish listing. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      {/* Error banner */}
      {formError && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* Listing Title */}
      <div className="flex flex-col gap-2">
        <label htmlFor="listing-title" className="text-sm font-semibold text-[#E9F5F1]">
          Listing Title <span className="text-[#1FAE7A]">*</span>
        </label>
        <input
          id="listing-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. MLBB Mythical Glory 75★ - 120 Skins, All Heroes"
          maxLength={150}
          required
          className="w-full px-4 py-3 rounded-xl bg-[#121C19] border border-[#223530] text-[#E9F5F1] placeholder-[#8FA39C] focus:outline-none focus:border-[#1FAE7A] transition-all duration-120 ease-out"
        />
      </div>

      {/* Grid: Rank Tier & Price */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="rank-tier" className="text-sm font-semibold text-[#E9F5F1]">
            Rank Tier <span className="text-[#1FAE7A]">*</span>
          </label>
          <select
            id="rank-tier"
            value={rankTier}
            onChange={(e) => setRankTier(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#121C19] border border-[#223530] text-[#E9F5F1] focus:outline-none focus:border-[#1FAE7A] transition-all duration-120 ease-out cursor-pointer"
          >
            {RANK_TIERS.map((tier) => (
              <option key={tier} value={tier} className="bg-[#121C19] text-[#E9F5F1]">
                {tier}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="price-inr" className="text-sm font-semibold text-[#E9F5F1]">
            Price (INR) <span className="text-[#1FAE7A]">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8FA39C] font-bold">
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
              className="w-full pl-8 pr-4 py-3 rounded-xl bg-[#121C19] border border-[#223530] text-[#E9F5F1] placeholder-[#8FA39C] focus:outline-none focus:border-[#1FAE7A] transition-all duration-120 ease-out"
            />
          </div>
        </div>
      </div>

      {/* Grid: Contact Channel & Handle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-channel" className="text-sm font-semibold text-[#E9F5F1]">
            Preferred Contact Channel <span className="text-[#1FAE7A]">*</span>
          </label>
          <select
            id="contact-channel"
            value={contactChannel}
            onChange={(e) => setContactChannel(e.target.value as 'whatsapp' | 'instagram')}
            className="w-full px-4 py-3 rounded-xl bg-[#121C19] border border-[#223530] text-[#E9F5F1] focus:outline-none focus:border-[#1FAE7A] transition-all duration-120 ease-out cursor-pointer capitalize"
          >
            <option value="whatsapp" className="bg-[#121C19] text-[#E9F5F1]">WhatsApp</option>
            <option value="instagram" className="bg-[#121C19] text-[#E9F5F1]">Instagram</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="contact-handle" className="text-sm font-semibold text-[#E9F5F1]">
            {contactChannel === 'whatsapp' ? 'WhatsApp Phone Number' : 'Instagram Username'}{' '}
            <span className="text-[#1FAE7A]">*</span>
          </label>
          <input
            id="contact-handle"
            type="text"
            value={contactHandle}
            onChange={(e) => setContactHandle(e.target.value)}
            placeholder={contactChannel === 'whatsapp' ? '+91 98765 43210' : '@your_handle'}
            required
            className="w-full px-4 py-3 rounded-xl bg-[#121C19] border border-[#223530] text-[#E9F5F1] placeholder-[#8FA39C] focus:outline-none focus:border-[#1FAE7A] transition-all duration-120 ease-out"
          />
        </div>
      </div>

      {/* Screenshot Proof Dropzone */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-[#E9F5F1] flex items-center justify-between">
          <span>
            Verified Proof Screenshots <span className="text-[#1FAE7A]">*</span>
          </span>
          <span className="text-xs font-normal text-[#8FA39C]">
            {uploadedProofs.length}/5 uploaded
          </span>
        </label>

        {uploadError && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300">
            {uploadError}
          </div>
        )}

        {/* Dropzone Container */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileSelect(e.dataTransfer.files);
          }}
          className={`relative w-full p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-120 ease-out ${
            isUploading
              ? 'border-[#1FAE7A] bg-[#121C19]/80 cursor-wait'
              : 'border-[#223530] hover:border-[#1FAE7A] bg-[#121C19] hover:bg-[#16211D]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={isUploading || uploadedProofs.length >= 5}
          />

          <div className="p-3.5 rounded-2xl bg-[#0B0F12] border border-[#223530] text-[#1FAE7A] mb-3">
            <Upload className="w-6 h-6 stroke-[1.75]" />
          </div>

          <p className="text-sm font-bold text-[#E9F5F1] mb-1">
            Click or drag & drop account proof screenshots
          </p>
          <p className="text-xs text-[#8FA39C]">
            JPEG, PNG, or WebP up to 5MB each. Direct encrypted upload to storage.
          </p>
        </div>

        {/* Deterministic Upload Progress Bar */}
        {isUploading && (
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex justify-between text-xs font-semibold text-[#8FA39C]">
              <span>Uploading to storage...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Upload progress"
              aria-valuenow={uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-2 rounded-full bg-[#16211D] border border-[#223530] overflow-hidden"
            >
              <div
                className="h-full bg-[#1FAE7A] transition-all duration-120 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Uploaded Thumbnails Grid */}
        {uploadedProofs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
            {uploadedProofs.map((proof, idx) => (
              <div
                key={proof.s3Key}
                className="relative aspect-video rounded-xl overflow-hidden border border-[#223530] bg-[#0B0F12] group"
              >
                <Image
                  src={proof.cdnUrl || `/api/v1/media/${proof.s3Key}`}
                  alt={`Uploaded Proof ${idx + 1}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-bold text-white z-10">
                  #{idx + 1}
                </div>
                <button
                  type="button"
                  aria-label={`Remove screenshot ${idx + 1}`}
                  onClick={() => removeProof(idx)}
                  className="absolute top-1 right-1 p-1 rounded-md bg-red-600/80 hover:bg-red-600 text-white transition-all duration-120 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Safety Notice */}
      <div className="p-4 rounded-xl bg-[#121C19] border border-[#223530] flex items-start gap-3 text-xs text-[#8FA39C]">
        <ShieldAlert className="w-5 h-5 text-[#1FAE7A] shrink-0 mt-0.5" />
        <span>
          Screenshots are verified automatically for binary authenticity. Disguised executable files are permanently purged. Always hide confidential account credentials.
        </span>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || isUploading}
        className="w-full py-3.5 px-6 rounded-xl font-bold text-center text-[#0B1A15] bg-[#1FAE7A] hover:bg-[#22C58F] transition-all duration-120 ease-out active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-2"
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
