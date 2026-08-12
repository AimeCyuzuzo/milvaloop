import { Button } from '@milvaloop/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">MilvaLoop</h1>
      <Button>Get started</Button>
    </main>
  );
}
