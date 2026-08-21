'use client';

/**
 * SAMPLE — throwaway visual brainstorm, not a real component.
 *
 * v7: three specific corrections to v6.
 *
 * 1. The "Outstanding balance" card's colored left border is gone — it
 *    read as an unwanted decoration, not a signal. The destructive icon
 *    next to its note carries that meaning on its own now.
 * 2. Table redesigned after a Resend-style reference: a real filter bar
 *    (search + mock status/date pills) above the table, a small icon
 *    avatar per row, status as a soft tinted chip (bg wash + colored text
 *    + faint border) instead of a solid fill, a hover-revealed row-action
 *    button, and no outer card/ring around the table at all — it sits
 *    directly on the page, same as the reference. The soft badge variants
 *    (successSoft/warningSoft/destructiveSoft) are a real addition to the
 *    shared Badge component, not a one-off override — Badge already ships
 *    on two real marketing pages, and this reads as a genuinely useful
 *    second option, not a mockup-only hack.
 * 3. The top bar is gone entirely. Its contents moved into the sidebar:
 *    the cooperative switcher and notification bell now sit at the top of
 *    the sidebar, and profile/theme/log out are behind a single account
 *    row at the bottom (name + avatar, opens a menu with a Theme submenu)
 *    — the standard Linear/Vercel/Notion sidebar shape. Mobile has no
 *    sidebar to put that account row into, so it keeps a minimal top strip
 *    (logo + the same account button) — not a reintroduction of top nav,
 *    just identity/account access with nowhere else to live on a phone
 *    screen.
 *
 * v6: v5's pass was too timid — real reference points (Resend, a Fynex-style
 * dashboard) all share a bolder visual language than anything tried so far:
 * one or two KPIs get a solid brand-color fill instead of another neutral
 * card, every section actually lives inside a card rather than floating on
 * the page background, the sidebar groups related links under a small
 * uppercase label, and buttons are fully pill-shaped. Rebuilt around that,
 * using this product's own tokens (Navy/Sky/Teal) rather than copying the
 * reference's purple palette.
 *
 * This reverses one earlier call: v2's header ruled out "tinted icon
 * chips" on stat cards. That was this file's own stylistic choice, not a
 * hard rule, and the reference direction the small icon-in-a-translucent-
 * circle on a solid-color tile relies on it, so it's back for the two hero
 * tiles specifically (not the two neutral ones, and not the nav).
 *
 * Still NOT done here: bumping the global --radius token, or changing the
 * shared Button/Input/Select's shape. Those are used on already-shipped
 * screens (auth forms, the cooperative switcher); this file hand-rolls its
 * own buttons/fields for exactly that reason. table.tsx/data-table.tsx
 * remain the exception — still no other real consumer, so their container
 * radius moved to rounded-3xl to match the rest of this page.
 */

import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  ArrowRight,
  Banknote,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Home,
  LogOut,
  Monitor,
  MoreHorizontal,
  Moon,
  Pencil,
  PiggyBank,
  Settings,
  Sun,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Vote,
  X,
} from 'lucide-react';

import { cn } from '@milvaloop/ui/lib/utils';
import { Badge } from '@milvaloop/ui/badge';
import { DataTable } from '@milvaloop/ui/data-table';
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

function rwf(amount: number) {
  return amount.toLocaleString('en-US');
}

const NAV_ITEMS = [
  { label: 'Overview', icon: Home, active: true },
  { label: 'Members', icon: Users, active: false },
  { label: 'Contributions', icon: Banknote, active: false },
  { label: 'Loans', icon: PiggyBank, active: false },
  { label: 'Governance', icon: Vote, active: false },
  { label: 'Settings', icon: Settings, active: false },
];

const NAV_GROUPS = [
  { label: 'Cooperative', items: NAV_ITEMS.slice(0, 4) },
  { label: 'Admin', items: NAV_ITEMS.slice(4) },
];

const MONTHLY = [
  { month: 'Jan', expected: 2_100_000, collected: 2_100_000 },
  { month: 'Feb', expected: 2_100_000, collected: 1_950_000 },
  { month: 'Mar', expected: 2_250_000, collected: 2_250_000 },
  { month: 'Apr', expected: 2_250_000, collected: 1_800_000 },
  { month: 'May', expected: 2_400_000, collected: 2_100_000 },
  { month: 'Jun', expected: 2_400_000, collected: 2_400_000 },
];

const MEMBERSHIP_TREND = [24, 25, 27, 27, 29, 31];

type Status = 'paid' | 'pending' | 'overdue';

interface Contribution {
  member: string;
  month: string;
  amount: number;
  status: Status;
  recorded: string;
}

const CONTRIBUTIONS: Contribution[] = [
  { member: 'Member 004', month: 'June 2026', amount: 75_000, status: 'paid', recorded: 'Jun 3' },
  { member: 'Member 011', month: 'June 2026', amount: 75_000, status: 'paid', recorded: 'Jun 3' },
  { member: 'Member 014', month: 'June 2026', amount: 50_000, status: 'pending', recorded: 'Jun 5' },
  { member: 'Member 019', month: 'May 2026', amount: 75_000, status: 'overdue', recorded: '—' },
  { member: 'Member 023', month: 'June 2026', amount: 75_000, status: 'paid', recorded: 'Jun 2' },
  { member: 'Member 027', month: 'June 2026', amount: 75_000, status: 'paid', recorded: 'Jun 4' },
  { member: 'Member 031', month: 'May 2026', amount: 50_000, status: 'overdue', recorded: '—' },
  { member: 'Member 002', month: 'June 2026', amount: 75_000, status: 'paid', recorded: 'Jun 1' },
  { member: 'Member 007', month: 'June 2026', amount: 75_000, status: 'paid', recorded: 'Jun 2' },
  { member: 'Member 009', month: 'June 2026', amount: 50_000, status: 'pending', recorded: 'Jun 6' },
  { member: 'Member 013', month: 'May 2026', amount: 75_000, status: 'overdue', recorded: '—' },
  { member: 'Member 017', month: 'June 2026', amount: 75_000, status: 'paid', recorded: 'Jun 3' },
  { member: 'Member 021', month: 'June 2026', amount: 75_000, status: 'paid', recorded: 'Jun 4' },
  { member: 'Member 026', month: 'June 2026', amount: 50_000, status: 'pending', recorded: 'Jun 6' },
];

const CONTRIBUTION_COLUMNS: ColumnDef<Contribution>[] = [
  {
    accessorKey: 'member',
    header: 'Member',
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <span className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-lg">
          <User className="size-3.5" />
        </span>
        {row.original.member}
      </div>
    ),
  },
  { accessorKey: 'month', header: 'Month' },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => (
      <div className="text-right font-mono [font-variant-numeric:tabular-nums]">{rwf(row.original.amount)}</div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const { status } = row.original;
      const variant = status === 'paid' ? 'successSoft' : status === 'pending' ? 'warningSoft' : 'destructiveSoft';
      return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
    },
  },
  { accessorKey: 'recorded', header: 'Recorded', enableSorting: false },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: () => (
      <button
        aria-label="Row actions"
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
      >
        <MoreHorizontal className="size-4" />
      </button>
    ),
  },
];

const STATUS_LABEL: Record<Status, string> = {
  paid: 'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
};

const ACTIVITY_TONE = {
  success: 'bg-success/15 text-success',
  primary: 'bg-primary/15 text-primary',
  warning: 'bg-warning/15 text-warning',
  muted: 'bg-muted text-muted-foreground',
} as const;

const ACTIVITY = [
  {
    text: 'Contribution recorded for Member 023 — 75,000 RWF',
    time: '2h ago',
    icon: Banknote,
    tone: 'success',
  },
  { text: 'June statement approved by the treasurer', time: '5h ago', icon: CheckCircle2, tone: 'primary' },
  {
    text: "Correction applied to Member 014's May contribution",
    time: '1d ago',
    icon: Pencil,
    tone: 'warning',
  },
  {
    text: 'Contribution recorded for Member 027 — 75,000 RWF',
    time: '1d ago',
    icon: Banknote,
    tone: 'success',
  },
  { text: 'Member 031 joined the cooperative', time: '3d ago', icon: UserPlus, tone: 'muted' },
] satisfies { text: string; time: string; icon: LucideIcon; tone: keyof typeof ACTIVITY_TONE }[];

const NOTE_VARIANT = {
  success: { text: 'text-success', icon: TrendingUp },
  destructive: { text: 'text-destructive', icon: null },
  muted: { text: 'text-muted-foreground', icon: null },
} as const;

function StatCard({
  label,
  value,
  note,
  noteVariant,
}: {
  label: string;
  value: string;
  note: string;
  noteVariant: keyof typeof NOTE_VARIANT;
}) {
  const { text, icon: Icon } = NOTE_VARIANT[noteVariant];

  return (
    <div className="bg-card ring-border/60 rounded-3xl p-5 ring-1">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-2 font-mono text-[1.9rem] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">
        {value}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className={cn('inline-flex items-center gap-1.5 text-sm', text)}>
          {Icon ? <Icon className="size-3.5" /> : null}
          {note}
        </span>
        <a href="#" className="text-muted-foreground hover:text-foreground text-sm font-medium">
          History
        </a>
      </div>
    </div>
  );
}

// The two KPIs worth leading with get a solid brand-color fill instead of
// another neutral card — the hierarchy trick the reference dashboards use:
// color draws the eye to the one or two numbers that matter most, and
// everything else stays quiet. The icon-in-a-translucent-circle only
// appears here, on these two — see the file header for why that's back.
const HERO_TONE = {
  primary: { card: 'bg-primary text-primary-foreground', chip: 'bg-primary-foreground/15', fill: 'bg-primary-foreground' },
  success: { card: 'bg-success text-success-foreground', chip: 'bg-success-foreground/15', fill: 'bg-success-foreground' },
} as const;

function HeroStat({
  icon: Icon,
  label,
  value,
  note,
  progress,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  progress?: number;
  tone: keyof typeof HERO_TONE;
}) {
  const { card, chip, fill } = HERO_TONE[tone];

  return (
    <div className={cn('rounded-3xl p-5', card)}>
      <div className="flex items-center gap-2">
        <span className={cn('flex size-7 items-center justify-center rounded-full', chip)}>
          <Icon className="size-3.5" />
        </span>
        <p className="text-sm opacity-70">{label}</p>
      </div>
      <p className="mt-3 font-mono text-[1.9rem] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">
        {value}
      </p>
      {progress !== undefined ? (
        <div className={cn('mt-3 h-1.5 w-full overflow-hidden rounded-full', chip)}>
          <div className={cn('h-full rounded-full', fill)} style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between">
        {progress !== undefined ? (
          <span className="text-xs opacity-70">{note}</span>
        ) : (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', chip)}>{note}</span>
        )}
        <a href="#" className="text-xs font-medium opacity-70 hover:opacity-100">
          History
        </a>
      </div>
    </div>
  );
}

function MonthlyBarChart() {
  const width = 520;
  const height = 190;
  const padding = { top: 8, bottom: 24 };
  const max = Math.max(...MONTHLY.map((m) => m.expected)) * 1.05;
  const groupWidth = width / MONTHLY.length;
  const barWidth = 22;
  const plotHeight = height - padding.top - padding.bottom;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Monthly contributions, expected versus collected"
    >
      {MONTHLY.map((m, i) => {
        const cx = groupWidth * i + groupWidth / 2;
        const expectedH = (m.expected / max) * plotHeight;
        const collectedH = (m.collected / max) * plotHeight;
        const short = m.collected < m.expected;
        return (
          <g key={m.month}>
            <rect
              x={cx - barWidth - 2}
              y={padding.top + plotHeight - expectedH}
              width={barWidth}
              height={expectedH}
              rx={6}
              fill="var(--muted)"
            />
            <rect
              x={cx + 2}
              y={padding.top + plotHeight - collectedH}
              width={barWidth}
              height={collectedH}
              rx={6}
              fill={short ? 'var(--warning)' : 'var(--primary)'}
            />
            <text x={cx} y={height - 4} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)">
              {m.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MembershipTrendChart() {
  const width = 400;
  const height = 160;
  const padding = 12;
  const max = Math.max(...MEMBERSHIP_TREND);
  const min = Math.min(...MEMBERSHIP_TREND);
  const range = max - min || 1;
  const step = (width - padding * 2) / (MEMBERSHIP_TREND.length - 1);

  const points = MEMBERSHIP_TREND.map((v, i) => {
    const x = padding + step * i;
    const y = padding + (height - padding * 2) * (1 - (v - min) / range);
    return { x, y, v };
  });
  const line = points.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Membership growth over six months">
      <polygon points={area} fill="color-mix(in oklch, var(--ring) 12%, transparent)" />
      <polyline points={line} fill="none" stroke="var(--ring)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points[points.length - 1]?.x} cy={points[points.length - 1]?.y} r={4} fill="var(--foreground)" />
    </svg>
  );
}

function RecordContributionModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center font-sans sm:items-center">
      <button aria-label="Close" onClick={onClose} className="bg-foreground/40 absolute inset-0" />
      <div className="bg-card relative w-full max-w-sm rounded-t-3xl p-7 shadow-xl sm:rounded-3xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Record a contribution</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">Umurenge Savings Group</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full p-1.5"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Member</span>
            <select className="border-input bg-transparent dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-xl border px-3.5 py-3 text-base focus-visible:ring-[3px] focus-visible:outline-none">
              <option>Member 004</option>
              <option>Member 011</option>
              <option>Member 014</option>
              <option>Member 019</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Amount (RWF)</span>
            <input
              type="number"
              defaultValue={75000}
              className="border-input bg-transparent dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-xl border px-3.5 py-3 font-mono text-base [font-variant-numeric:tabular-nums] focus-visible:ring-[3px] focus-visible:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Date</span>
            <input
              type="date"
              defaultValue="2026-06-05"
              className="border-input bg-transparent dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-xl border px-3.5 py-3 text-base focus-visible:ring-[3px] focus-visible:outline-none"
            />
          </label>

          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-1 rounded-full py-3.5 text-base font-semibold"
          >
            Save contribution
          </button>
        </form>
      </div>
    </div>
  );
}

// Replaces the old top bar's profile/theme/log-out cluster — one account
// row at the bottom of the sidebar, in the shape most dashboards with a
// left sidebar use (Linear, Vercel, Notion). The theme options are reused
// from ThemeToggle's underlying next-themes hook directly rather than
// nesting the standalone ThemeToggle component inside another dropdown —
// this "theme as a submenu of the account menu" composition doesn't have a
// second consumer yet (the real app header still uses the standalone
// button), so it isn't factored out on its own yet either.
function AccountMenu() {
  const { theme, setTheme } = useTheme();
  const THEME_OPTIONS = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const;
  const ActiveThemeIcon = THEME_OPTIONS.find((t) => t.value === theme)?.icon ?? Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hover:bg-accent flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors">
          <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
            AU
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">Aime Uwimana</span>
            <span className="text-muted-foreground block truncate text-xs">Treasurer</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">Aime Uwimana</p>
          <p className="text-muted-foreground truncate text-xs">aime@example.com</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ActiveThemeIcon />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                <Icon />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Sample() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="bg-background text-foreground font-sans min-h-screen">
      {/* Minimal mobile-only strip — mobile has no sidebar to hold the
          account row, so identity/account access needs *somewhere* to
          live. Not a reintroduction of top nav; there are no nav links
          here, just the logo and the same account menu the sidebar uses. */}
      <header className="bg-background sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-xl text-sm font-bold">
            M
          </span>
          <span className="text-sm font-semibold">MilvaLoop</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full text-xs font-medium">
              AU
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive">
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="mx-auto flex max-w-350">
        {/* ------------------------------------------------------ sidenav */}
        <nav className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r p-4 lg:flex">
          <div className="mb-6 flex items-center justify-between gap-2">
            <button className="hover:bg-accent -ml-1 flex min-w-0 items-center gap-2 rounded-xl py-1.5 pr-2 pl-1 text-left transition-colors">
              <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
                M
              </span>
              <span className="truncate text-sm font-semibold">Umurenge Savings Group</span>
              <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
            </button>
            <button
              aria-label="Notifications"
              className="text-muted-foreground hover:bg-accent hover:text-foreground relative flex size-8 shrink-0 items-center justify-center rounded-full"
            >
              <Bell className="size-4" />
              <span className="bg-destructive absolute top-1.5 right-1.5 size-1.5 rounded-full" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <p className="text-muted-foreground px-2.5 text-xs font-semibold tracking-wide uppercase">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <a
                    key={item.label}
                    href="#"
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors',
                      item.active
                        ? 'bg-primary/15 text-primary shadow-xs font-semibold'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium',
                    )}
                  >
                    <item.icon className="size-4" strokeWidth={item.active ? 2.25 : 1.75} />
                    {item.label}
                  </a>
                ))}
              </div>
            ))}
          </div>

          <div className="border-t pt-2">
            <AccountMenu />
          </div>
        </nav>

        {/* mobile tab bar */}
        <nav className="bg-card fixed right-0 bottom-0 left-0 z-20 flex justify-around border-t py-2 lg:hidden">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <a
              key={item.label}
              href="#"
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[0.65rem] transition-colors',
                item.active ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground font-medium',
              )}
            >
              <item.icon className="size-4.5" strokeWidth={item.active ? 2.25 : 1.75} />
              {item.label}
            </a>
          ))}
        </nav>

        {/* -------------------------------------------------------- main */}
        <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 lg:p-10 lg:pb-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Umurenge Savings Group</h1>
              <p className="text-muted-foreground mt-1 text-sm">June 2026 · 31 active members</p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-5 py-2.5 text-sm font-semibold transition"
            >
              Record a contribution
            </button>
          </div>

          {/* ---------------------------------------------------- stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <HeroStat
              icon={Banknote}
              label="Collected this month"
              value={rwf(2_400_000)}
              note="+12.5% vs May"
              tone="primary"
            />
            <HeroStat
              icon={TrendingUp}
              label="Compliance rate"
              value="92%"
              note="27 of 31 current"
              progress={92}
              tone="success"
            />
            <StatCard
              label="Outstanding balance"
              value={rwf(620_000)}
              note="2 members overdue"
              noteVariant="destructive"
            />
            <StatCard label="Active members" value="31" note="+2 this quarter" noteVariant="muted" />
          </div>

          {/* ---------------------------------------------------- charts */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="bg-card ring-border/60 rounded-3xl p-6 ring-1 lg:col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium">Expected vs. collected</p>
                <button className="border-border text-muted-foreground hover:bg-accent inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium">
                  This year <ChevronDown className="size-3" />
                </button>
              </div>
              <MonthlyBarChart />
              <div className="text-muted-foreground mt-4 flex items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span className="bg-primary size-2 rounded-full" /> Collected
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="bg-warning size-2 rounded-full" /> Shortfall
                </span>
              </div>
            </div>
            <div className="bg-card ring-border/60 rounded-3xl p-6 ring-1 lg:col-span-2">
              <p className="mb-4 text-sm font-medium">Membership growth</p>
              <MembershipTrendChart />
              <p className="text-muted-foreground mt-4 text-xs">24 → 31 members in six months</p>
            </div>
          </div>

          {/* ------------------------------------------------ table + feed */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium">Contributions</p>
                <a
                  href="#"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium"
                >
                  View all <ArrowRight className="size-3" />
                </a>
              </div>
              <DataTable
                columns={CONTRIBUTION_COLUMNS}
                data={CONTRIBUTIONS}
                filterPlaceholder="Search by member…"
                pageSize={5}
                filters={
                  <>
                    <button className="border-border text-muted-foreground hover:bg-accent inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium">
                      This month <ChevronDown className="size-3" />
                    </button>
                    <button className="border-border text-muted-foreground hover:bg-accent inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium">
                      All statuses <ChevronDown className="size-3" />
                    </button>
                  </>
                }
              />
            </div>

            <div className="bg-card ring-border/60 rounded-3xl p-6 ring-1 lg:col-span-2">
              <p className="mb-4 text-sm font-medium">Recent activity</p>
              <ul className="flex flex-col gap-4">
                {ACTIVITY.map((entry, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full',
                        ACTIVITY_TONE[entry.tone],
                      )}
                    >
                      <entry.icon className="size-4" />
                    </span>
                    <div className="flex flex-col gap-0.5 pt-1">
                      <p className="text-sm">{entry.text}</p>
                      <p className="text-muted-foreground text-xs">{entry.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>
      </div>

      {modalOpen && <RecordContributionModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

export { Sample };
export default Sample;
