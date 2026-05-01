'use client';

import { useState } from 'react';

type Variant = 'whisper' | 'normal';

type Props = {
  variant: Variant;
  // If present, contribute links go to /success?orderId=...#contribute (the
  // ContributeWidget on the success page). If absent, contribute links anchor
  // to the about section on the landing page (where StandaloneTipForm lives).
  orderId?: string;
  // Override what "share" prompts share. Defaults to the landing page.
  shareUrl?: string;
  // Override the contribute target URL. Default behavior is described above.
  contributeHref?: string;
  // Whether to render the contribute affordance at all. Builder hides it.
  showContribute?: boolean;
  // Whether to render the share affordance.
  showShare?: boolean;
};

export default function TipJar({
  variant,
  orderId,
  shareUrl,
  contributeHref,
  showContribute = true,
  showShare = true,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const fallbackUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const url = shareUrl || fallbackUrl;
  const contributeTarget =
    contributeHref ||
    (orderId ? `/success?orderId=${orderId}#contribute` : '/#about');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const smsBody = encodeURIComponent(
    `this thing writes mother's day messages for you from like 4 questions about your mom. its free if you need it to be. ${url}`,
  );
  const tweetText = encodeURIComponent(
    `i just set up mother's day messages for my mom in 5 minutes. free if you need it. ${url}`,
  );

  // Shared inline panel of share options. Used in both variants.
  const sharePanel = shareOpen ? (
    <div className="mt-3 flex flex-wrap gap-2 justify-center">
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-rose-600 hover:text-rose-600 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        aria-label="Copy link to clipboard"
      >
        {copied ? 'Copied ✓' : 'Copy Link'}
      </button>
      <a
        href={`sms:?body=${smsBody}`}
        className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-rose-600 hover:text-rose-600 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        aria-label="Share via text message"
      >
        Text a Friend
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${tweetText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-rose-600 hover:text-rose-600 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        aria-label="Share on Twitter"
      >
        Share on Twitter
      </a>
    </div>
  ) : null;

  if (variant === 'whisper') {
    return (
      <section
        className="text-center text-sm text-gray-700 leading-relaxed mt-6 pt-6 border-t border-gray-100"
        aria-label="Tip jar"
      >
        {/* Lede — plain prose, no inline links. The action row below carries the clickability. */}
        {showContribute || showShare ? (
          <p className="text-gray-800">
            This is free for everyone.{' '}
            {showContribute && showShare
              ? 'Contributions and shares keep it going.'
              : showContribute
                ? 'Contributions keep it going.'
                : 'Shares keep it going.'}
          </p>
        ) : null}
        {/* Action row — these are the visible rose links. */}
        <p className="mt-1.5 space-x-1">
          {showShare ? (
            <button
              type="button"
              onClick={() => setShareOpen((o) => !o)}
              aria-expanded={shareOpen}
              aria-controls="share-panel-whisper"
              className="text-rose-600 hover:text-rose-700 font-medium focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
            >
              Share with a friend
            </button>
          ) : null}
          {showShare && showContribute ? <span aria-hidden="true">·</span> : null}
          {showContribute ? (
            <a
              href={contributeTarget}
              className="text-rose-600 hover:text-rose-700 font-medium focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
            >
              Contribute
            </a>
          ) : null}
        </p>
        {shareOpen ? (
          <div id="share-panel-whisper">{sharePanel}</div>
        ) : null}
      </section>
    );
  }

  // Normal variant
  return (
    <section className="mt-6 pt-6 border-t border-gray-100 max-w-2xl mx-auto" aria-label="Tip jar">
      <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
        {/* Lede — plain prose; the action row below is where the clicks live. */}
        {showContribute || showShare ? (
          <p className="text-base text-gray-800 leading-relaxed">
            This is free for everyone.
            {showContribute ? ' Contributions keep it running.' : ''}
            {showShare ? ' Share it with someone who needs it.' : ''}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {showContribute ? (
            <a
              href={contributeTarget}
              className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-gray-400 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
            >
              Contribute →
            </a>
          ) : null}
          {showShare ? (
            <button
              type="button"
              onClick={() => setShareOpen((o) => !o)}
              aria-expanded={shareOpen}
              aria-controls="share-panel-normal"
              className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-gray-400 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
            >
              Share With a Friend →
            </button>
          ) : null}
        </div>

        {shareOpen && showShare ? (
          <div id="share-panel-normal">{sharePanel}</div>
        ) : null}
      </div>
    </section>
  );
}
