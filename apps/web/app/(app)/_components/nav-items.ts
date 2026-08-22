import { Home, Users, type LucideIcon } from 'lucide-react';
import type { Permission } from '@milvaloop/types';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden unless the current member holds this permission (or is a tenant admin). Omit for anything every member can see. */
  permission?: Permission;
}

// Only real destinations — no placeholder Loans/Governance/Settings links
// for product areas that don't exist yet (see DESIGN.md's "no dead ends").
// Add to this list as real pages ship; the sidebar renders it, it doesn't
// hardcode links itself.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: Home },
  { label: 'Members', href: '/members', icon: Users },
];
