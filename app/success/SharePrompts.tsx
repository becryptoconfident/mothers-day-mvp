'use client';

import { useState } from 'react';

export default function SharePrompts({ landingUrl }: { landingUrl: string }) {
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
    <section className="mt-10 pt-6 border-t" aria-label="Share with a friend">
      <p className="font-serif text-lg mb-1 text-gray-900">
        Know someone who freezes on this stuff too?
      </p>
      <p className="text-sm text-gray-900 mb-4">Send them the link. It&rsquo;s free.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg border border-rose-300 bg-white text-gray-900 text-sm font-semibold hover:bg-rose-50 focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
          aria-label="Copy link to clipboard"
        >
          {copied ? 'Copied ✓' : 'Copy Link'}
        </button>
        <a
          href={`sms:?body=${smsBody}`}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg border border-rose-300 bg-white text-gray-900 text-sm font-semibold hover:bg-rose-50 focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
          aria-label="Share via text message"
        >
          Text a Friend
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${tweetText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg border border-rose-300 bg-white text-gray-900 text-sm font-semibold hover:bg-rose-50 focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
          aria-label="Share on Twitter"
        >
          Share on Twitter
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
