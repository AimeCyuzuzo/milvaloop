'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleUserRound, Coins, History, Home, Users } from 'lucide-react';

import { cn } from '@milvaloop/ui/lib/utils';

import { getActiveHref } from './nav-items';

// The mobile-only replacement for opening the sidebar's off-canvas drawer
// to navigate — a persistent, one-tap bar instead of two taps (open the
// drawer, then tap an item). Deliberately its own fixed list rather than
// every item useVisibleNavItems() returns: Analytics stays reachable one
// tap deeper from Contributions' own "View analytics" link rather than
// costing a slot here, and Settings folds into Account below instead of
// getting a slot most members never use. Account isn't a sidebar nav item
// at all (see account-menu.tsx) — it's this bar's equivalent of the
// sidebar's own footer identity/switcher/sign-out row, which otherwise
// has nowhere to live once the sidebar itself is never opened on mobile.
const BOTTOM_NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: Home },
  { label: 'Members', href: '/members', icon: Users },
  { label: 'Contributions', href: '/contributions', icon: Coins },
  { label: 'Activity', href: '/activity', icon: History },
  { label: 'Account', href: '/account', icon: CircleUserRound },
] as const;

// md:hidden — the exact breakpoint the sidebar itself flips at (see
// packages/ui/src/hooks/use-mobile.ts's 768px), not the throwaway mockup's
// lg:hidden. Anything looser would leave a width range where the sidebar
// renders as a persistent rail *and* this bar shows at once — two ways to
// navigate on screen simultaneously — or a gap where neither does.
export function BottomTabBar() {
  const pathname = usePathname();
  const activeHref = getActiveHref(BOTTOM_NAV_ITEMS, pathname);

  return (
    <nav
      aria-label="Primary"
      className="bg-sidebar/85 supports-[backdrop-filter]:backdrop-blur-md fixed inset-x-0 bottom-0 z-40 flex justify-around border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {BOTTOM_NAV_ITEMS.map((item) => {
        const isActive = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs',
              isActive ? 'text-primary font-semibold' : 'text-muted-foreground font-medium',
            )}
          >
            {/* A color change alone reads as a hover state, not a
                selection — the pill behind the icon is what actually
                signals "you are here", the same way a native tab bar's
                selected item gets its own filled shape. */}
            <span className={cn('flex items-center justify-center rounded-full px-3.5 py-1 transition-colors', isActive && 'bg-primary/15')}>
              <item.icon className="size-5" strokeWidth={isActive ? 2.25 : 1.75} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
