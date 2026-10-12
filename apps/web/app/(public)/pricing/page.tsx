import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';

import { Button } from '@milvaloop/ui/button';
import { Badge } from '@milvaloop/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardDescription } from '@milvaloop/ui/card';
import { Typography } from '@milvaloop/ui/typography';

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  // Only Premium has a second cadence to show — monthly is the default,
  // this is the discounted once-a-year alternative shown right below it.
  annualPrice?: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
  // Free's signup and Premium's are the same form (see
  // apps/web/app/auth/signup/page.tsx) — only Premium's carries ?plan=,
  // which is what actually starts its free trial at signup.
  signupHref: string;
}

const TITLE = 'Pricing';
const DESCRIPTION = 'Free for cooperatives with up to 10 members, or try Premium free for 2 months.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    url: '/pricing',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    title: TITLE,
    description: DESCRIPTION,
  },
};

const PLANS: PricingPlan[] = [
  {
    name: 'Free',
    price: 'Free',
    period: 'up to 10 members',
    description: 'For a small cooperative, free with no time limit.',
    features: [
      'Up to 10 members',
      'Contributions, shares, and obligations',
      'Approval workflow and audit trail',
      'Email reminders and monthly digest',
      'Analytics and reports',
    ],
    cta: 'Start for free',
    highlighted: false,
    signupHref: '/auth/signup',
  },
  {
    name: 'Premium',
    price: '12,000 RWF',
    period: 'per month, up to 30 members',
    annualPrice: '115,000 RWF billed annually',
    description: 'For a growing cooperative. Free for the first 2 months, then billed monthly.',
    features: [
      'Everything in Free',
      'Up to 30 members',
      '+5,000 RWF/month for every 10 members beyond 30',
    ],
    cta: 'Start free trial',
    highlighted: true,
    signupHref: '/auth/signup?plan=premium',
  },
];

const FAQS = [
  {
    question: 'What happens after the 2-month free trial?',
    answer:
      'You keep everything you\'ve set up and move to paid Premium billing. If your cooperative has 10 members or fewer, you can switch to the Free plan instead and never be billed.',
  },
  {
    question: 'How does pricing scale with members?',
    answer:
      'Free covers up to 10 members. Premium starts at 12,000 RWF/month for up to 30 members, then adds 5,000 RWF/month for every 10 additional members — a 40-member cooperative pays 17,000 RWF/month.',
  },
  {
    question: 'Can I pay annually instead of monthly?',
    answer:
      'Yes. Annual billing works out to about 20% less than paying monthly — Premium at the base tier is 115,000 RWF billed once a year, instead of 12,000 RWF billed each month.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. There\'s no long-term contract — you can cancel at the end of any billing period.',
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <div className="text-center">
        <Typography variant="h1">Simple pricing for your cooperative</Typography>
        <Typography variant="muted" className="mx-auto mt-4 max-w-xl">
          Free for cooperatives with 10 or fewer members. Premium includes a 2-month free trial.
        </Typography>
      </div>

      <div className="mx-auto mt-14 grid max-w-3xl gap-6 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <Card key={plan.name} variant={plan.highlighted ? 'highlighted' : 'default'}>
            <CardHeader>
              {plan.highlighted && <Badge className="mb-2">Most popular</Badge>}
              <Typography variant="h4">{plan.name}</Typography>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4 flex items-baseline gap-2">
                <Typography variant="h3" as="span">
                  {plan.price}
                </Typography>
                <Typography variant="muted" as="span">
                  {plan.period}
                </Typography>
              </div>
              {plan.annualPrice ? (
                <Typography variant="muted" className="mt-1 block">
                  or {plan.annualPrice}
                </Typography>
              ) : null}
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant={plan.highlighted ? 'default' : 'outline'} asChild>
                <Link href={plan.signupHref}>{plan.cta}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-24 max-w-2xl">
        <Typography variant="h3" as="h2" className="text-center">
          Frequently asked questions
        </Typography>
        <div className="mt-8 space-y-6">
          {FAQS.map((faq) => (
            <div key={faq.question}>
              <Typography variant="large">{faq.question}</Typography>
              <Typography variant="muted" className="mt-1">
                {faq.answer}
              </Typography>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
