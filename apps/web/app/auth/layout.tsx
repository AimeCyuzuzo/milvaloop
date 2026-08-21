import type { Metadata } from 'next';

import { CenteredShell } from '@/components/layout/centered-shell';

// Every page under here is a Client Component (react-hook-form, hooks), so
// none can export its own metadata — this is a placeholder default rather
// than the marketing homepage's tagline until they're split into a
// server/client pair each with a real per-page title.
export const metadata: Metadata = {
  // The root layout's title template already appends "— MilvaLoop".
  title: 'Sign in',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <CenteredShell>{children}</CenteredShell>;
}
