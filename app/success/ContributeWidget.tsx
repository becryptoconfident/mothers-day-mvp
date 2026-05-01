'use client';

import { useState } from 'react';

export default function ContributeWidget({
  orderId,
  alreadyContributed,
}: {
  orderId: string;
  alreadyContributed?: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1) {
      setError('Pick at least $1.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/contribute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, amount: value }),
      });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || 'contribution failed');
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <section
      id="contribute"
      className="mt-12 bg-gray-50 rounded-2xl p-8 md:p-10 scroll-mt-8"
      aria-label="Contribute"
    >
      {alreadyContributed ? (
        <div role="status" aria-live="polite" className="bg-white rounded-2xl p-5 mb-6 shadow-sm">
          <p className="font-serif text-lg text-gray-950 mb-1">Thanks for contributing.</p>
          <p className="text-sm text-gray-700">Means a lot. Now go love on your mom.</p>
        </div>
      ) : null}

      <p className="text-gray-900 leading-relaxed mb-2">
        I built this for free because I get it. Some of us just aren&rsquo;t wired for this stuff.
      </p>
      <p className="text-gray-900 leading-relaxed mb-5">
        If you found value in this, please{' '}
        <a
          href="#contribute-amount"
          className="text-rose-600 hover:text-rose-700 font-medium"
        >
          contribute
        </a>{' '}
        and{' '}
        <a
          href="https://twitter.com/intent/tweet?text=i+just+set+up+mother%27s+day+messages+for+my+mom+in+5+minutes.+free+if+you+need+it."
          target="_blank"
          rel="noopener noreferrer"
          className="text-rose-600 hover:text-rose-700 font-medium"
        >
          share
        </a>
        .
      </p>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
        <div className="flex-1">
          <label htmlFor="contribute-amount" className="block text-sm font-semibold text-gray-900 mb-2">
            Contribute
          </label>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-gray-900" aria-hidden="true">$</span>
            <input
              id="contribute-amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder=""
              className="flex-1 border border-gray-300 rounded-lg p-3 text-2xl bg-white focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={go}
          disabled={submitting || !amount}
          className="min-h-[52px] border-2 border-rose-600 text-rose-600 bg-white px-6 py-3 rounded-full font-medium hover:bg-rose-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          {submitting ? 'Setting up…' : 'Contribute →'}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>
      ) : null}

      <p className="mt-6 font-serif text-lg text-gray-900 italic">
        Regardless — go make your mom&rsquo;s Mother&rsquo;s Day great.
      </p>
    </section>
  );
}
