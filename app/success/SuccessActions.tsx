'use client';

import Link from 'next/link';
import { useState } from 'react';

type Props = {
  orderId: string;
  landingUrl: string;
};

export default function SuccessActions({ orderId, landingUrl }: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = landingUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const smsBody = encodeURIComponent(
    `this thing writes mother's day messages for you from like 4 questions about your mom. i just did it. its free if you need it to be. ${url}`,
  );
  const tweetText = encodeURIComponent(
    `i just set up mother's day messages for my mom in 5 minutes. free if you need it. ${url}`,
  );

  return (
    <section className="mb-8" aria-label="What you can do now">
      {/* Primary — the gift reveal (creator view with edit controls) */}
      <Link
        href={`/forever/${orderId}?edit=true`}
        className="w-full inline-flex items-center justify-center min-h-[60px] px-8 py-4 rounded-full bg-rose-600 text-white text-base md:text-lg font-medium text-center shadow-lg hover:shadow-xl hover:bg-rose-700 transition-all duration-200 focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
      >
        See what she&rsquo;s going to get →
      </Link>
      <p className="mt-3 text-sm text-gray-700 text-center leading-relaxed">
        After you see it — if it&rsquo;s worth something to you, come back and{' '}
        <a href="#contribute" className="text-rose-600 hover:text-rose-700 font-medium">
          contribute
        </a>
        . No pressure.
      </p>

      {/* Secondary — quieter alternates */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href={`/backup/${orderId}`}
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-gray-400 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          View Your Messages
        </Link>
        <button
          type="button"
          onClick={() => setShareOpen((o) => !o)}
          aria-expanded={shareOpen}
          aria-controls="share-panel"
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-gray-400 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          Share With a Friend
        </button>
      </div>

      {shareOpen ? (
        <div
          id="share-panel"
          className="mt-4 bg-gray-50 rounded-2xl p-6"
        >
          <p className="text-sm text-gray-950 mb-1 font-medium">
            Know someone who freezes on this stuff too?
          </p>
          <p className="text-xs text-gray-700 mb-4">
            Send them the link. It&rsquo;s free.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy link to clipboard"
              className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-rose-600 hover:text-rose-600 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
            >
              {copied ? 'Copied ✓' : 'Copy Link'}
            </button>
            <a
              href={`sms:?body=${smsBody}`}
              aria-label="Share via text message"
              className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-rose-600 hover:text-rose-600 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
            >
              Text a Friend
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${tweetText}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on Twitter"
              className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-rose-600 hover:text-rose-600 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
            >
              Share on Twitter
            </a>
          </div>
          {copied ? (
            <p role="status" aria-live="polite" className="sr-only">
              Link copied to clipboard
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
