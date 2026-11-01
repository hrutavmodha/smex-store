'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { RegisterForm } from '../../components/auth/RegisterForm';

export default function SignUpPage() {
  const router = useRouter();

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8 shadow-2xl transition-colors duration-[120ms]">
        <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-border-subtle">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-primary/10 text-emerald-primary border border-emerald-primary/20">
            <UserPlus className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-extrabold uppercase text-xs tracking-wider text-text-primary">
              Create Account
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-primary">
              Join Smex Store
            </span>
          </div>
        </div>

        <RegisterForm
          onSwitchToLogin={() => router.push('/?auth=login')}
        />
      </div>
    </div>
  );
}
