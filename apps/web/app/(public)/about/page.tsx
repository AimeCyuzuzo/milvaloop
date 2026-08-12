import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@milvaloop/ui/button';
import { Typography } from '@milvaloop/ui/typography';
import { siteConfig } from '@/lib/site-config';

const TITLE = 'About';
const DESCRIPTION = `Why ${siteConfig.name} exists and what we believe a cooperative platform should do.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    url: '/about',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <Typography variant="h1">Why we built {siteConfig.name}</Typography>

      <div className="mt-8 space-y-6">
        <Typography variant="muted">
          Most cooperatives run on a mix of spreadsheets, paper registers, receipts, and WhatsApp
          messages. It works, until it doesn&apos;t — until someone needs to know how a member&apos;s
          balance was calculated, whether a payment was approved, or why a decision was made, and the
          answer only lives in one person&apos;s memory.
        </Typography>
        <Typography variant="muted">
          That&apos;s the problem we set out to fix. Not by digitizing the spreadsheet, but by giving a
          cooperative a shared operational record — one place where members, contributions, shares,
          loans, votes, and decisions all live together, with a full history behind every one of them.
        </Typography>
        <Typography variant="muted">
          The goal isn&apos;t dashboards for their own sake. It&apos;s that anyone on your team should be
          able to open a record and answer: what happened, who did it, when, why, and what it affected —
          without asking the treasurer.
        </Typography>
        <Typography variant="muted">
          We believe a cooperative that can explain itself is a stronger, more transparent cooperative.
          That belief shapes everything we build.
        </Typography>
        <Typography variant="muted">
          {siteConfig.name} is built and operated by{' '}
          <a
            href={siteConfig.parentOrg.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-4 hover:text-foreground"
          >
            {siteConfig.parentOrg.name}
          </a>
          .
        </Typography>
      </div>

      <div className="mt-12">
        <Button size="lg" asChild>
          <Link href="/pricing">See pricing</Link>
        </Button>
      </div>
    </div>
  );
}
