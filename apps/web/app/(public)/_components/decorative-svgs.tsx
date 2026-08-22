// Hand-drawn, minimal line-art accents — decorative only (aria-hidden, no
// meaningful content), not icons: a handful of thin strokes rather than a
// stock illustration or a photo. `currentColor` so each usage sets its own
// tint via a wrapping element's text color. (HeroWave, below, is plain
// div/CSS rather than SVG — see its own comment for why.)

import { cn } from '@milvaloop/ui/lib/utils';

export function DotGrid({ className }: { className?: string }) {
  const cells = Array.from({ length: 6 }, (_, i) => i);
  return (
    <svg aria-hidden viewBox="0 0 120 120" fill="none" className={className}>
      {cells.map((row) =>
        cells.map((col) => (
          <circle key={`${row}-${col}`} cx={10 + col * 20} cy={10 + row * 20} r={1.5} fill="currentColor" />
        )),
      )}
    </svg>
  );
}

export function WavyLine({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 400 60" fill="none" className={className}>
      <path
        d="M0 30 C 50 0, 100 60, 150 30 S 250 0, 300 30 S 380 50, 400 30"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function OrbitRings({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 200" fill="none" className={className}>
      <circle cx={100} cy={100} r={99} stroke="currentColor" strokeWidth={1} opacity={0.5} />
      <circle cx={100} cy={100} r={70} stroke="currentColor" strokeWidth={1} opacity={0.35} />
      <circle cx={100} cy={100} r={40} stroke="currentColor" strokeWidth={1} opacity={0.2} />
    </svg>
  );
}

export function DashedLine({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 400 2" fill="none" preserveAspectRatio="none" className={className}>
      <line x1={0} y1={1} x2={400} y2={1} stroke="currentColor" strokeWidth={2} strokeDasharray="6 10" strokeLinecap="round" />
    </svg>
  );
}

// Four corner brackets, like a viewfinder frame — a quiet way to set a
// standalone statement apart from the surrounding sections without a card,
// a border, or a background color change.
export function CornerBrackets({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" fill="none" className={className}>
      <path d="M2 22 V2 H22" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M78 2 H98 V22" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M98 78 V98 H78" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M22 98 H2 V78" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

// A row of rounded-top columns forming a symmetric valley — the same shape
// as the hero's old spiral2 artwork. Plain flex + div, not an SVG viewBox:
// stretching a square viewBox with preserveAspectRatio="none" to fill a
// wide, short box scales width and height by different factors, which
// flattens a round corner into a shallow ellipse. A CSS border-radius in
// pixels doesn't have that problem at any container size, so the tops stay
// genuinely round. bg-current follows the primary token across light/dark
// automatically. Each column breathes on its own offset via the
// animate-breathe utility (globals.css), reading as a slow, ambient ripple
// rather than every column moving together.
const HERO_WAVE_COLUMNS = [
  { height: 88, opacity: 1 },
  { height: 64, opacity: 0.85 },
  { height: 50, opacity: 0.7 },
  { height: 30, opacity: 0.5 },
  { height: 50, opacity: 0.7 },
  { height: 64, opacity: 0.85 },
  { height: 88, opacity: 1 },
];

export function HeroWave({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex items-end gap-3', className)}>
      {HERO_WAVE_COLUMNS.map((column, index) => (
        <div
          key={index}
          className="bg-current animate-breathe flex-1 rounded-t-full"
          style={{
            height: `${column.height}%`,
            opacity: column.opacity,
            transformOrigin: 'bottom',
            animationDelay: `${index * 250}ms`,
          }}
        />
      ))}
    </div>
  );
}
