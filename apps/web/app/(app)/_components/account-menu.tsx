'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { ChevronsUpDown, LogOut, Settings } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@milvaloop/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@milvaloop/ui/sidebar';
import { THEME_OPTIONS } from '@milvaloop/ui/theme-toggle';

import { useLogoutMutation } from '@/lib/auth/use-auth-mutations';

// The account row pinned at the bottom of the sidebar — avatar-style
// initials, email, and a menu covering theme, account settings, and log
// out. No avatar image or role label: neither exists in the real data model
// yet (see AuthSession's user shape) — this shows only what's real.
export function AccountMenu({ email }: { email: string }) {
  const { isMobile } = useSidebar();
  const { setTheme } = useTheme();
  const router = useRouter();
  const logout = useLogoutMutation();

  async function handleLogout() {
    await logout.mutateAsync();
    router.push('/auth/login');
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                {email.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{email}</span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? 'bottom' : 'top'} align="start">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                    <Icon />
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem asChild>
              <Link href="/account">
                <Settings />
                Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
