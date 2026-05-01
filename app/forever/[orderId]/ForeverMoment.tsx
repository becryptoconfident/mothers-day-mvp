'use client';

import { useState } from 'react';

type Props = {
  contributeHref: string;
  shareUrl: string;
};

// Calm post-letter ask. Two outline buttons, side by side. The forever page
// is high-emotion (mom just saw the letter); this is "the door is open" —
// not a sales pitch.
export default function ForeverMoment({ contributeHref, shareUrl }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className="text-center px-6 py-12 max-w-2xl mx-auto"
      aria-label="Share or contribute"
    >
      <p className="font-serif text-xl md:text-2xl text-gray-950 mb-3">
        You just made this in 5 minutes.
      </p>
      <p className="text-base text-gray-800 leading-relaxed mb-8 max-w-lg mx-auto">
        If it meant something, share it with someone who needs it.
        Or help keep it free for everyone.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy link to share with a friend"
          className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-gray-400 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          {copied ? 'Link copied ✓' : 'Share With a Friend'}
        </button>
        <a
          href={contributeHref}
          className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-gray-400 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          Contribute
        </a>
      </div>
      {copied ? (
        <p role="status" aria-live="polite" className="sr-only">
          Link copied to clipboard
        </p>
      ) : null}
    </section>
  );
}
