import Link from 'next/link';
import { BarChart3, Clock, ShieldCheck, TrendingUp, Users, Vote } from 'lucide-react';

import { Button } from '@milvaloop/ui/button';
import { Typography } from '@milvaloop/ui/typography';
import { Card } from '@milvaloop/ui/card';

import { Reveal } from '@/components/marketing/reveal';

import { CornerBrackets, DashedLine, DotGrid, HeroWave, OrbitRings, WavyLine } from './_components/decorative-svgs';

const PROBLEMS = [
  'Contribution records split across spreadsheets, notebooks, and receipts nobody can find later.',
  'No one remembers why a member’s balance looks the way it does, or who approved what.',
  'The treasurer becomes the only person who understands how the numbers work.',
];

const STEPS = [
  {
    title: 'Create your cooperative',
    description: 'Sign up and set up your cooperative in minutes — no spreadsheet to migrate.',
  },
  {
    title: 'Invite your members',
    description: 'Add everyone who’s part of your cooperative, each with their own account.',
  },
  {
    title: 'Record and track together',
    description: 'Log contributions and approvals as a team, with the full history kept automatically.',
  },
];

const FEATURES = [
  {
    icon: Users,
    title: 'One record for every member',
    description:
      'Contributions, shares, loans, and obligations tracked in one place — no more reconciling five different sheets to answer one question.',
    featured: true,
  },
  {
    icon: Clock,
    title: 'A full history, always',
    description:
      'Every contribution, approval, and correction is kept. Anyone can see how a number was reached, not just what it currently is.',
    featured: false,
  },
  {
    icon: BarChart3,
    title: 'Analytics that explain themselves',
    description:
      'Compliance rates, outstanding balances, and loan portfolios — with clear definitions, not confusing dashboards.',
    featured: false,
  },
  {
    icon: ShieldCheck,
    title: 'Approvals, not arbitrary edits',
    description:
      'Contributions, loans, and corrections move through a controlled approval workflow, so every change is traceable to a person and a reason.',
    featured: false,
  },
  {
    icon: Vote,
    title: 'Governance built in',
    description:
      'Run proposals, votes, meetings, and resolutions inside the same system — decisions stay linked to the records they affect.',
    featured: false,
  },
  {
    icon: TrendingUp,
    title: 'See growth patterns over time',
    description:
      'Track how membership, contributions, and shares grow month over month, so decisions are based on trends, not guesswork.',
    featured: false,
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto mt-8 grid max-w-6xl gap-6 px-6 lg:grid-cols-1">
        <Card className="bg-transparent relative h-[75vh] overflow-hidden rounded-xl  p-6">
          <div className="flex flex-col gap-5 justify-center max-w-7/12 mx-auto text-center absolute top-[40%] left-1/2 -translate-1/2">
            <Typography variant="h1" className="w-full">
              A cooperative doesn&apos;t have to rely on one person&apos;s memory
            </Typography>
            <Typography variant="small" color="muted" className="mt-2 block">
              Use MilvaLoop to keep everyone on the same page, with analytics available at any time, so
              you can make informed decisions together.
            </Typography>
            <Link href="/auth/signup" className="">
              <Button size="3xl">Get Started</Button>
            </Link>
          </div>
          <HeroWave className="text-primary/70 pointer-events-none absolute right-0 bottom-0 h-2/3 w-full" />
        </Card>
      </section>

      <section className="relative mx-auto max-w-6xl overflow-hidden px-6 py-20">
        <WavyLine className="text-primary/10 pointer-events-none absolute top-6 left-1/2 h-10 w-72 -translate-x-1/2" />
        <Reveal className="relative mx-auto max-w-2xl text-center">
          <Typography variant="h3" as="h2" className="sm:text-3xl font-normal">
            It&apos;s not just a treasurer problem
          </Typography>
          <Typography variant="small" color="muted" className="mt-3 block">
            It&apos;s a team problem — one that shows up the same way in every cooperative.
          </Typography>
        </Reveal>
        <div className="relative mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
          {PROBLEMS.map((problem, index) => (
            <Reveal key={problem} delay={index * 100}>
              <Card className="relative h-full overflow-hidden p-6 transition-transform duration-300 hover:-translate-y-1">
                <span className="text-muted-foreground/10 absolute -top-3 -right-1 text-6xl font-semibold select-none">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Typography variant="small" color="muted" className="relative block">
                  {problem}
                </Typography>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Typography variant="h3" as="h2" className="sm:text-3xl font-normal">
            Up and running in three steps
          </Typography>
          <Typography variant="small" color="muted" className="mt-3 block">
            No spreadsheets to migrate, no training required to get started.
          </Typography>
        </Reveal>
        <div className="relative mt-16 grid gap-10 sm:grid-cols-3">
          <DashedLine className="text-border pointer-events-none absolute top-6 left-0 hidden w-full sm:block" />
          {STEPS.map((step, index) => (
            <Reveal
              key={step.title}
              delay={index * 120}
              className="relative flex flex-col items-center text-center"
            >
              <span className="bg-primary text-primary-foreground relative flex size-12 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
                {index + 1}
              </span>
              <Typography variant="large" className="mt-4 font-medium">
                {step.title}
              </Typography>
              <Typography variant="small" color="muted" className="mt-2 block max-w-xs">
                {step.description}
              </Typography>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-secondary/40 relative overflow-hidden">
        <OrbitRings className="text-primary/10 pointer-events-none absolute -top-16 -right-16 size-64" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Typography variant="h3" as="h2" className="sm:text-3xl font-normal">
              Everything your cooperative needs to explain itself
            </Typography>
            <Typography variant="small" color="muted" className="mt-3 block">
              Tracking made easy, history kept automatically, and analytics that show where
              you&apos;re growing.
            </Typography>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 80} className={feature.featured ? 'sm:col-span-2' : ''}>
                <Card className="relative h-full overflow-hidden p-6 transition-transform duration-300 hover:-translate-y-1">
                  {feature.featured ? (
                    <DotGrid className="text-primary/10 pointer-events-none absolute right-4 bottom-4 size-20" />
                  ) : null}
                  <span className="bg-primary/10 text-primary relative flex size-10 items-center justify-center rounded-full">
                    <feature.icon className="size-5" />
                  </span>
                  <Typography variant="large" className="relative mt-4 font-medium">
                    {feature.title}
                  </Typography>
                  <Typography variant="small" color="muted" className="relative mt-2 block">
                    {feature.description}
                  </Typography>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-4xl px-6 py-24 text-center">
        <CornerBrackets className="text-primary/15 pointer-events-none absolute inset-6 hidden sm:block" />
        <Reveal className="relative">
          <Typography variant="h3" as="p" className="text-2xl sm:text-4xl font-normal text-balance">
            Every number your cooperative shows should be explainable — not just displayed, but
            traceable to the event that produced it.
          </Typography>
          <Typography variant="small" color="muted" className="mt-6 block">
            That&apos;s the idea MilvaLoop is built around.
          </Typography>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <Card className="bg-primary relative items-center overflow-hidden rounded-xl px-6 py-16 text-center sm:px-16">
            <DotGrid className="text-primary-foreground/10 pointer-events-none absolute top-6 left-6 size-24" />
            <Typography variant="h3" as="h2" className="text-primary-foreground relative sm:text-3xl font-normal">
              Give your cooperative a record everyone can trust
            </Typography>
            <Typography variant="small" className="text-primary-foreground/80 relative mx-auto mt-3 block max-w-xl">
              Try MilvaLoop free for 2 months. No credit card required to get started.
            </Typography>
            <Link href="/pricing" className="relative mt-8 inline-flex self-center">
              <Button size="lg" variant="secondary">
                See pricing
              </Button>
            </Link>
          </Card>
        </Reveal>
      </section>
    </>
  );
}
