'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CooperativeSummary } from '@milvaloop/types';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@milvaloop/ui/sidebar';

import { AccountMenu } from './account-menu';
import { CooperativeSwitcher } from './cooperative-switcher';
import { getActiveHref } from './nav-items';
import { useVisibleNavItems } from './use-visible-nav-items';

export function AppSidebar({
  tenantId,
  tenantName,
  cooperatives,
  name,
}: {
  tenantId: string;
  tenantName: string;
  cooperatives: CooperativeSummary[];
  name: string;
}) {
  const pathname = usePathname();
  const navItems = useVisibleNavItems();

  const activeHref = getActiveHref(navItems, pathname);

  return (
    <Sidebar>
      <SidebarHeader>
        <CooperativeSwitcher currentTenantId={tenantId} currentTenantName={tenantName} cooperatives={cooperatives} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive = item.href === activeHref;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link href={item.href}>
                      <item.icon />
                      {item.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <AccountMenu name={name} />
      </SidebarFooter>
    </Sidebar>
  );
}
