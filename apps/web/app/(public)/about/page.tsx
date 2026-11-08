import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@milvaloop/ui/button';
import { Typography } from '@milvaloop/ui/typography';
import { siteConfig } from '@/lib/site-config';

const TITLE = 'About';
const DESCRIPTION = `Why ${siteConfig.name} exists and what it does.`;

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
          Most cooperatives track their records using spreadsheets, paper registers, receipts, and
          WhatsApp messages. This causes problems when someone needs an answer: how a member&apos;s
          balance was calculated, whether a payment was approved, or why a decision was made. Often,
          only one person knows the answer.
        </Typography>
        <Typography variant="muted">
          We built {siteConfig.name} to give a cooperative one shared record. Members, contributions,
          shares, loans, votes, and decisions are all kept in one place, with a full history behind
          each one.
        </Typography>
        <Typography variant="muted">
          Anyone on the team can open a record and see what happened, who did it, when, why, and what
          it affected, without asking the treasurer.
        </Typography>
        <Typography variant="muted">
          {siteConfig.name} is built so a cooperative can explain its own records to its own members.
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
