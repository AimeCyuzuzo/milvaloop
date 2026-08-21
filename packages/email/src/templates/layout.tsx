import type { ReactNode } from 'react';

import { EMAIL_COLORS, EMAIL_FONT_STACK } from './brand.js';

// Every email in this package renders inside this layout — a table-based
// single-column card, which is the layout technique that actually holds up
// across mail clients (Outlook's Word-based rendering engine in particular
// respects <table> width/alignment far more reliably than flexbox or grid).
//
// Deliberately plain HTML tags with inline styles here, not react-email's
// own <Html>/<Body>/<Container> component library — that library's runtime
// package pulls in a CLI dev-server's entire dependency graph (esbuild,
// socket.io, tailwindcss, prismjs...) into whatever process imports it,
// which has no business loading into services/main's production process
// just to render a handful of static HTML strings. @react-email/render
// (the only react-email package actually used here) renders any React
// tree, not specifically their components, so plain tags work identically
// and the dev-only `react-email` package is still available locally for
// live-previewing these templates in a browser (`pnpm email:dev`).
export function EmailLayout({ previewText, children }: { previewText: string; children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>MilvaLoop</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: EMAIL_COLORS.background, fontFamily: EMAIL_FONT_STACK }}>
        {/* Shown by mail clients as the inbox preview snippet; invisible in the body itself. */}
        <div style={{ display: 'none', overflow: 'hidden', lineHeight: '1px', opacity: 0, maxHeight: 0, maxWidth: 0 }}>
          {previewText}
        </div>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: '32px 16px' }}>
                <table
                  role="presentation"
                  width="480"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ maxWidth: 480, width: '100%', backgroundColor: EMAIL_COLORS.white, borderRadius: 16 }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: 32 }}>
                        {/* One cell, not two adjacent ones — the plain-text
                            fallback concatenates adjacent table cells with
                            no separator ("MMilvaLoop"), but preserves real
                            whitespace between inline elements in the same
                            cell correctly. */}
                        <table role="presentation" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
                          <tbody>
                            <tr>
                              <td>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: 28,
                                    height: 28,
                                    lineHeight: '28px',
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    backgroundColor: EMAIL_COLORS.navy,
                                    borderRadius: 8,
                                    color: EMAIL_COLORS.white,
                                    fontWeight: 700,
                                    fontSize: 14,
                                  }}
                                >
                                  M
                                </span>{' '}
                                <span style={{ fontWeight: 600, fontSize: 14, color: EMAIL_COLORS.ink, verticalAlign: 'middle' }}>
                                  MilvaLoop
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {children}

                        <hr
                          style={{ border: 'none', borderTop: `1px solid ${EMAIL_COLORS.border}`, margin: '32px 0 16px' }}
                        />
                        <p style={{ fontSize: 12, color: EMAIL_COLORS.muted, margin: 0 }}>
                          MilvaLoop is a product of MilvaLabs. You&rsquo;re receiving this email because of activity
                          on your MilvaLoop account.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

// A shared, table-safe CTA button — every template uses this rather than a
// bare <a> so the visual weight matches the app's own primary-button
// treatment (the same rounded, solid-navy button from packages/ui/button.tsx,
// re-expressed in the inline-style vocabulary email requires).
export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: '24px 0' }}>
      <tbody>
        <tr>
          <td style={{ backgroundColor: EMAIL_COLORS.navy, borderRadius: 8 }}>
            <a
              href={href}
              style={{
                display: 'inline-block',
                padding: '12px 20px',
                color: EMAIL_COLORS.white,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
