import { BarChart3, Coins, History, Home, Settings, Users, type LucideIcon } from 'lucide-react';
import { PERMISSIONS, type Permission } from '@milvaloop/types';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden unless the current member holds this permission (or is a tenant admin). Omit for anything every member can see. */
  permission?: Permission;
}

// Only real destinations — no placeholder Loans/Governance links for
// product areas that don't exist yet (see DESIGN.md's "no dead ends").
// Add to this list as real pages ship; the sidebar renders it, it doesn't
// hardcode links itself.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: Home },
  { label: 'Members', href: '/members', icon: Users },
  // No `permission` — every member can at least see their own contribution
  // status (transparency is the design, see the feature plan); recording
  // and approving are gated inside the page itself, not at the nav level.
  { label: 'Contributions', href: '/contributions', icon: Coins },
  // Same transparency as Contributions above — it's the same data,
  // aggregated (see ContributionsService.getAnalytics) — plus it handles
  // its own "not set up yet" state, so a direct link is never a dead end.
  { label: 'Analytics', href: '/contributions/analytics', icon: BarChart3 },
  // No `permission` — full transparency (see MAIN.md's explainability
  // thesis): the audit trail is a read surface every member can see,
  // never gated by what they can do.
  { label: 'Activity', href: '/activity', icon: History },
  // Unlike Contributions/Activity, Settings has nothing transparent about
  // it for someone who can't manage it — hidden entirely rather than
  // linking to a page that would just say "ask an admin."
  { label: 'Settings', href: '/settings', icon: Settings, permission: PERMISSIONS.CONTRIBUTIONS_SETTINGS },
];
