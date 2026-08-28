'use client';

import { PERMISSIONS } from '@milvaloop/types';

import { Card, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';

import { useHasPermission } from '@/lib/auth/use-permissions';

import { SharePriceSection } from './_components/share-price-section';

// Cooperative-wide config only — one value that's true regardless of who's
// looking, unlike a per-member action (which belongs on that member's row
// on the Members page) or a personal preference (which belongs on
// Account). Nothing on this page is transparent to a member who can't
// manage it, so a direct link without permission still needs a real
// answer rather than a blank page (see DESIGN.md's "no dead ends") — the
// nav item itself is already hidden for that case (see nav-items.ts).
export default function SettingsPage() {
  const canManageSettings = useHasPermission(PERMISSIONS.CONTRIBUTIONS_SETTINGS);

  if (!canManageSettings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nothing to manage here</CardTitle>
          <CardDescription>Ask an admin if you need something changed.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <SharePriceSection />;
}
