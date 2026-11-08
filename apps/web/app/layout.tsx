import type { Metadata } from 'next';
import localFont from 'next/font/local';
import NextTopLoader from 'nextjs-toploader';
import { Poppins } from 'next/font/google';
import './globals.css';

import { Providers } from './providers';
import { siteConfig } from '@/lib/site-config';
import { GoogleAnalytics } from '@next/third-parties/google';

// The body font is Poppins (below); Geist Mono is reserved for actual
// monospace use — see typography.tsx's inlineCode variant.
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: siteConfig.name,
  description: siteConfig.description,
  url: siteConfig.url,
  applicationCategory: 'BusinessApplication',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free plan for up to 10 members; Premium includes a 2-month free trial',
  },
  brand: {
    '@type': 'Organization',
    name: siteConfig.parentOrg.name,
    url: siteConfig.parentOrg.url,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <GoogleAnalytics gaId={"G-L8KJNSBXL9"} />
      <body className={`${poppins.variable} ${geistMono.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {/* Reads the brand primary token directly, not a literal hex — this
            keeps it in sync with the active theme (Navy in light mode, Sky
            in dark) without needing its own light/dark branching. No
            spinner: a bare top bar reads cleaner against this design
            language than the default corner spinner. */}
        <NextTopLoader color="var(--primary)" showSpinner={false} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
