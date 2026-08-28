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

  // More than one item's href can prefix-match the same pathname (e.g.
  // /contributions/analytics starts with both /contributions and
  // /contributions/analytics) — only the longest, most specific match
  // should light up, or a parent and its own sub-page would highlight
  // together.
  const activeHref = navItems
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

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
