'use client';

import { useState } from 'react';

type Props = {
  text: string;
  momName?: string;
  showCopy?: boolean;
  showTextMom?: boolean;
  showEmailMom?: boolean;
  ariaLabelSuffix?: string; // e.g. "for Friday's message" — disambiguates per-card buttons
};

export default function MessageActions({
  text,
  momName,
  showCopy = true,
  showTextMom = false,
  showEmailMom = false,
  ariaLabelSuffix,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const smsHref = `sms:?body=${encodeURIComponent(text)}`;
  const emailSubject = momName ? `For you, ${momName}` : '💌';
  const emailHref = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(text)}`;

  const suffix = ariaLabelSuffix ? ` ${ariaLabelSuffix}` : '';

  return (
    <div className="flex flex-wrap gap-2">
      {showCopy ? (
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy message to clipboard${suffix}`}
          className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-rose-600 hover:text-rose-600 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          <span aria-hidden="true">{copied ? '✓' : '📋'}</span>
          {copied ? 'Copied' : 'Copy Message'}
        </button>
      ) : null}
      {showTextMom ? (
        <a
          href={smsHref}
          aria-label={`Open Messages with this text prefilled${suffix}`}
          className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-rose-600 hover:text-rose-600 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          <span aria-hidden="true">💬</span>
          Text Mom
        </a>
      ) : null}
      {showEmailMom ? (
        <a
          href={emailHref}
          aria-label={`Open email with this message prefilled${suffix}`}
          className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-rose-600 hover:text-rose-600 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          <span aria-hidden="true">📧</span>
          Email Mom
        </a>
      ) : null}
      {copied ? (
        <span role="status" aria-live="polite" className="sr-only">
          Message copied to clipboard
        </span>
      ) : null}
    </div>
  );
}
