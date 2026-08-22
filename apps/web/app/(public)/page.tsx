import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Image as ImageIcon,
  ShieldCheck,
  TrendingUp,
  Users,
  Vote,
} from 'lucide-react';

import { Button } from '@milvaloop/ui/button';
import { Badge } from '@milvaloop/ui/badge';
import { Typography } from '@milvaloop/ui/typography';
import { Card } from '@milvaloop/ui/card';
import { Label } from '@milvaloop/ui/label';
import Image from 'next/image';

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

// Illustrative bar heights for the hero mockup's mini chart — not real
// contribution data, a data-driven dimension like sample.tsx's HeroStat
// progress bar, not a design token, so an inline style is the right tool
// here rather than a fixed Tailwind height class.
const CONTRIBUTION_TREND = [40, 55, 48, 70, 62, 85];

export default function HomePage() {
  return (
    <>
      <section className='flex justify-around mt-[2vh] max-w-6xl mx-auto'>
        <Card className='bg-linear-to-b from-card to-muted w-[49%] h-[60vh] relative rounded-xl overflow-hidden p-3' >
          <Typography variant={`h1`} className=' font-normal'>
            A cooperative doesn't have to rely on one person's memory
          </Typography>
          <Typography variant={`small`} color={`muted`}>
            Use MilvaLoop to keep everyone on the same page, with analytics available at any time, so you can make informed decisions together.
          </Typography>
          <Link href={`/auth/signup`} className='absolute flex top-1/2 left-1/2 -translate-1/2'>
            <Button size={`lg`}>
                Get Started
            </Button>
          </Link>
          <Image
            src="/spiral2.avif"
            alt="Description of image"
            width={1000}
            height={600}
            className="absolute bottom-0 right-0"
          />
        </Card>
        <Card className='bg-secondary w-[49%] h-[60vh] relative rounded-xl overflow-hidden' >
          {/* <Image
            src="/spiral3.avif"
            alt="Description of image"
            width={1000}
            height={600}
            className="absolute rotate-180 top-0 right-0 opacity-20"
          /> */}
          <div className="m-2 flex gap-x-2 z-10">
            {
              [
                "History", "Financial goals", "Analytics", "Exporting"
              ].map((text) => (
                <Typography key={text} variant="small" color='muted' className='bg-card rounded-full p-2'>
                  {text}
                </Typography>
              ))
            }
          </div>
          <Image
            src="/dashboard-sample.avif"
            alt="Description of image"
            width={1000}
            height={1400}
            className="absolute bottom-[2%] rounded-lg bg-blue-200 left-[2%] w-[96%] h-[80%]"
          />
        </Card>
        
      </section>
    </>
  );
}
