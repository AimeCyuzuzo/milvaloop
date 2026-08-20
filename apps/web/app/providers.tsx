'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { Toaster } from '@milvaloop/ui/sonner';

import { createQueryClient } from '@/lib/api/query-client';
import { SessionBootstrap } from '@/lib/auth/session-bootstrap';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
