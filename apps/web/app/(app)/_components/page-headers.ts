import { usePathname } from 'next/navigation';

export interface PageHeader {
  title: string;
  description: string;
}

// The top bar's title/description, one entry per page under (app) — this is
// the page's single source of a real <h1> (see AppLayout), so a page body
// itself should never render its own duplicate heading. Add an entry here
// for every new page; one not listed just renders no title (a plain
// SidebarTrigger row), not a crash.
const PAGE_HEADERS: Record<string, PageHeader> = {
  '/onboarding': { title: 'Set up your cooperative', description: 'A few things to get right before you start.' },
  '/dashboard': { title: 'Overview', description: 'A quick look at your cooperative.' },
  '/members': { title: 'Members', description: 'Who has access to this cooperative, and what they can do.' },
  '/members/import': { title: 'Import members', description: 'Add a member list from a spreadsheet.' },
  '/contributions': { title: 'Contributions', description: 'Shares, monthly contributions, and approvals.' },
  '/contributions/import': { title: 'Import history', description: 'Bring in contributions from before this cooperative used MilvaLoop.' },
  '/contributions/analytics': { title: 'Analytics', description: 'Every number the ledger can produce, in one place.' },
  '/activity': { title: 'Activity', description: 'Everything that has happened in this cooperative.' },
  '/settings': { title: 'Settings', description: 'Manage the share price.' },
  '/group-settings': { title: 'Group Settings', description: 'Plan and other cooperative-wide settings.' },
  '/account': { title: 'Account', description: 'Manage your account settings.' },
  '/cooperatives/new': { title: 'Create a cooperative', description: 'Set up a new cooperative under your existing account.' },
};

export function usePageHeader(): PageHeader | undefined {
  const pathname = usePathname();
  return PAGE_HEADERS[pathname];
}
