import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';

import { Button } from '@milvaloop/ui/button';
import { Badge } from '@milvaloop/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardDescription } from '@milvaloop/ui/card';
import { Typography } from '@milvaloop/ui/typography';

const TITLE = 'Pricing';
const DESCRIPTION = 'Try MilvaLoop free for 2 months, then pick the plan that fits your cooperative.';

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

const PLANS = [
  {
    name: 'Free trial',
    price: '$0',
    period: 'for 2 months',
    description: 'Full access, no credit card required. See if MilvaLoop fits your cooperative.',
    features: [
      'Unlimited members',
      'Contributions, shares, and obligations',
      'Approval workflow and audit trail',
      'Email reminders and notifications',
    ],
    cta: 'Start free trial',
    highlighted: false,
  },
  {
    name: 'Standard',
    price: '$39',
    period: 'per month, per cooperative',
    description: 'Everything a running cooperative needs, billed monthly after your trial ends.',
    features: [
      'Everything in the free trial',
      'Governance: proposals, voting, resolutions',
      'Loan applications and repayment tracking',
      'Meetings, minutes, and action items',
      'Standard analytics and reports',
    ],
    cta: 'Start free trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'for federations & multi-cooperative groups',
    description: 'For organizations managing several cooperatives or with dedicated support needs.',
    features: [
      'Everything in Standard',
      'Multiple cooperatives, one account',
      'Custom roles and approval rules',
      'Dedicated onboarding and support',
    ],
    cta: 'Contact us',
    highlighted: false,
  },
];

const FAQS = [
  {
    question: 'What happens after the 2-month free trial?',
    answer:
      'You can move to the Standard plan to keep everything you\'ve set up, or export your records and stop — nothing is locked in.',
  },
  {
    question: 'Do you charge per member?',
    answer:
      'No. Pricing is per cooperative, not per member, so adding members never increases your bill.',
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
          Start free for 2 months. No credit card required, no per-member fees.
        </Typography>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
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
                <Link href={plan.name === 'Enterprise' ? '/about' : '/auth/signup'}>{plan.cta}</Link>
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
