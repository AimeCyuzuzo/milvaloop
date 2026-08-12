import Link from 'next/link';
import { BarChart3, Clock, ShieldCheck, TrendingUp, Users, Vote } from 'lucide-react';

import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Badge } from '@milvaloop/ui/badge';
import { Typography } from '@milvaloop/ui/typography';

const PROBLEMS = [
  'Contribution records split across spreadsheets, notebooks, and receipts nobody can find later.',
  'No one remembers why a member’s balance looks the way it does, or who approved what.',
  'The treasurer becomes the only person who understands how the numbers work.',
  'Reminders, calculations, and meeting minutes are all done by hand, every single month.',
];

const FEATURES = [
  {
    icon: Users,
    title: 'One record for every member',
    description:
      'Contributions, shares, loans, and obligations tracked in one place — no more reconciling five different sheets to answer one question.',
  },
  {
    icon: Clock,
    title: 'A full history, always',
    description:
      'Every contribution, approval, and correction is kept. Anyone can see how a number was reached, not just what it currently is.',
  },
  {
    icon: BarChart3,
    title: 'Analytics that explain themselves',
    description:
      'Compliance rates, outstanding balances, and loan portfolios — with clear definitions, not confusing dashboards.',
  },
  {
    icon: TrendingUp,
    title: 'See growth patterns over time',
    description:
      'Track how membership, contributions, and shares grow month over month, so decisions are based on trends, not guesswork.',
  },
  {
    icon: ShieldCheck,
    title: 'Approvals, not arbitrary edits',
    description:
      'Contributions, loans, and corrections move through a controlled approval workflow, so every change is traceable to a person and a reason.',
  },
  {
    icon: Vote,
    title: 'Governance built in',
    description:
      'Run proposals, votes, meetings, and resolutions inside the same system — decisions stay linked to the records they affect.',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center sm:pt-28">
        <Badge variant="secondary">For cooperatives, not spreadsheets</Badge>
        <Typography variant="h1" className="mx-auto mt-6 max-w-3xl text-balance sm:text-5xl">
          Running a cooperative shouldn&apos;t depend on one person&apos;s memory
        </Typography>
        <Typography variant="lead" className="mx-auto mt-6 max-w-2xl">
          MilvaLoop gives your whole team one shared, trustworthy record of contributions, shares,
          loans, and decisions — so anyone can answer &quot;what happened, and why&quot; without
          asking around.
        </Typography>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/signup">Start your free 2-month trial</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/about">Learn more</Link>
          </Button>
        </div>
      </section>

      <section className="border-y bg-secondary/30">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Typography variant="h3" as="h2" className="text-center sm:text-3xl">
            It&apos;s not just a treasurer problem — it&apos;s a team problem
          </Typography>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {PROBLEMS.map((problem) => (
              <Card key={problem}>
                <CardContent>
                  <Typography variant="muted">{problem}</Typography>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <Typography variant="h3" as="h2" className="text-center sm:text-3xl">
          Everything your cooperative needs to explain itself
        </Typography>
        <Typography variant="muted" className="mx-auto mt-4 max-w-2xl text-center">
          Tracking made easy, history kept automatically, and analytics that show where you&apos;re
          growing.
        </Typography>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <feature.icon className="size-8 text-primary" />
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <Typography variant="muted">{feature.description}</Typography>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-secondary/30">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <Typography variant="h3" as="h2" className="sm:text-3xl">
            Give your cooperative a record everyone can trust
          </Typography>
          <Typography variant="muted" className="mx-auto mt-4 max-w-xl">
            Try MilvaLoop free for 2 months. No credit card required to get started.
          </Typography>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
