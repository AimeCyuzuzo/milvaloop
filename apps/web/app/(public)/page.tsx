import Link from 'next/link';
import Image from 'next/image';

import { Button } from '@milvaloop/ui/button';
import { Typography } from '@milvaloop/ui/typography';
import { Card } from '@milvaloop/ui/card';

const DASHBOARD_TAGS = ['History', 'Financial goals', 'Analytics', 'Exporting'];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto mt-8 grid max-w-6xl gap-6 px-6 lg:grid-cols-2">
        <Card className="relative min-h-96 overflow-hidden rounded-xl bg-linear-to-b from-card to-muted p-6">
          <Typography variant="h1" className="font-normal">
            A cooperative doesn&apos;t have to rely on one person&apos;s memory
          </Typography>
          <Typography variant="small" color="muted" className="mt-2 block">
            Use MilvaLoop to keep everyone on the same page, with analytics available at any time, so
            you can make informed decisions together.
          </Typography>
          <Link href="/auth/signup" className="mt-6 inline-flex">
            <Button size="lg">Get Started</Button>
          </Link>
          <Image
            src="/spiral2.avif"
            alt=""
            width={1000}
            height={600}
            className="absolute right-0 bottom-0"
          />
        </Card>

        <Card className="relative min-h-96 overflow-hidden rounded-xl bg-secondary">
          <div className="relative z-10 m-4 flex flex-wrap gap-2">
            {DASHBOARD_TAGS.map((tag) => (
              <Typography key={tag} variant="small" color="muted" className="bg-card rounded-full px-3 py-1.5">
                {tag}
              </Typography>
            ))}
          </div>
          <div className="absolute inset-4 top-16">
            <Image
              src="/dashboard-sample.avif"
              alt="A preview of the MilvaLoop dashboard"
              fill
              className="rounded-lg object-cover"
            />
          </div>
        </Card>
      </section>
    </>
  );
}
