import type { Metadata } from 'next';

import { CenteredShell } from '@/components/layout/centered-shell';

// Same client-component constraint as app/auth/layout.tsx — see its comment.
export const metadata: Metadata = {
  title: 'Accept invite',
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <CenteredShell>{children}</CenteredShell>;
}
