'use client';

import Link from 'next/link';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { CooperativeSummary } from '@milvaloop/types';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@milvaloop/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@milvaloop/ui/sidebar';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { useSwitchCooperativeMutation } from '@/lib/auth/use-auth-mutations';

// One dropdown covers both switching and creating — mirrors AccountMenu's
// shape at the bottom of the sidebar rather than a Select next to a
// separate link, so there's a single control for "which cooperative,"
// not two. Always rendered, even with a single cooperative, since creating
// a second one needs to be reachable from here regardless of how many
// exist already.
export function CooperativeSwitcher({
  currentTenantId,
  currentTenantName,
  cooperatives,
}: {
  currentTenantId: string;
  currentTenantName: string;
  cooperatives: CooperativeSummary[];
}) {
  const { isMobile } = useSidebar();
  const switchCooperative = useSwitchCooperativeMutation();

  async function handleSelect(cooperativeId: string) {
    if (cooperativeId === currentTenantId) {
      return;
    }
    try {
      await switchCooperative.mutateAsync({ cooperativeId });
      // A full reload, not a client-side navigation. Every mounted
      // component's in-memory state — every query's cached data, every
      // page's local state — belongs to the cooperative just left; a
      // client-side cache clear doesn't reliably force an already-mounted
      // component to refetch. Reloading throws all of it away outright and
      // starts clean, which is the only thing that actually guarantees it.
      // The refresh cookie is already rotated to the new tenant (see
      // AuthService.switchCooperative), so re-authenticating on the way
      // back in resolves to the new cooperative, not the old one.
      window.location.href = '/dashboard';
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" disabled={switchCooperative.isPending}>
              <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                {currentTenantName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{currentTenantName}</span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? 'bottom' : 'right'} align="start">
            {cooperatives.map((cooperative) => (
              <DropdownMenuItem key={cooperative.id} onSelect={() => handleSelect(cooperative.id)}>
                <span className="min-w-0 flex-1 truncate">{cooperative.name}</span>
                {cooperative.id === currentTenantId ? <Check /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/cooperatives/new">
                <Plus />
                Create a cooperative
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
