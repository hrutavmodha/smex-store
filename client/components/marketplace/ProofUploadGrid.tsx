'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import type { ProofImageItem } from '@smex/shared';

export interface ProofUploadGridProps {
  uploadedProofs: ProofImageItem[];
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  onFileSelect: (files: FileList | null) => void;
  onRemoveProof: (index: number) => void;
}

export function ProofUploadGrid({
  uploadedProofs,
  isUploading,
  uploadProgress,
  uploadError,
  onFileSelect,
  onRemoveProof,
}: ProofUploadGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
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
          onFileSelect(e.dataTransfer.files);
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
          onChange={(e) => onFileSelect(e.target.files)}
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
                onClick={() => onRemoveProof(idx)}
                className="absolute top-1 right-1 p-1 rounded-md bg-red-600/80 hover:bg-red-600 text-white transition-all duration-120 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
