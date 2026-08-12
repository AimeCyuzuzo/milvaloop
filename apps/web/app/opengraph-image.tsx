import { ImageResponse } from 'next/og';

import { siteConfig } from '@/lib/site-config';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 12,
            background: '#171717',
            color: '#fafafa',
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          M
        </div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 64, fontWeight: 700, color: '#171717' }}>
          {siteConfig.name}
        </div>
        <div style={{ display: 'flex', marginTop: 20, fontSize: 32, color: '#525252', maxWidth: 900 }}>
          {siteConfig.tagline}
        </div>
      </div>
    ),
    size,
  );
}
