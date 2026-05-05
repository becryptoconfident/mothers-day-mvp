// Dynamic OG image. Renders at /og.png as a 1200x630 PNG.
// Used by Open Graph + Twitter card metadata in app/layout.tsx.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const contentType = 'image/png';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '96px 120px',
          fontFamily: 'serif',
        }}
      >
        {/* Subtle rose accent bar */}
        <div
          style={{
            width: 64,
            height: 4,
            background: '#e11d48',
            borderRadius: 2,
            marginBottom: 56,
          }}
        />

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            fontSize: 112,
            fontWeight: 600,
            color: '#0a0a0a',
            letterSpacing: -2,
            lineHeight: 1.02,
            textAlign: 'center',
          }}
        >
          Mother&rsquo;s Day. Handled.
        </div>

        {/* Subline */}
        <div
          style={{
            display: 'flex',
            fontFamily: 'sans-serif',
            fontSize: 32,
            color: '#525252',
            marginTop: 48,
            textAlign: 'center',
            lineHeight: 1.4,
            maxWidth: 880,
          }}
        >
          5 minutes. Free. She gets messages all weekend and a page that stays online for a full year.
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
