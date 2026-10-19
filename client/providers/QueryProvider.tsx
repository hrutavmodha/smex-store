'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';

let globalFallbackClient: QueryClient | undefined;

export function getFallbackQueryClient(): QueryClient {
  if (!globalFallbackClient) {
    globalFallbackClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          gcTime: 5 * 60 * 1000,
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });
  }
  return globalFallbackClient;
}

export function useSafeQueryClient(): QueryClient {
  try {
    return useQueryClient();
  } catch {
    return getFallbackQueryClient();
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export default QueryProvider;
