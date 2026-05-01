'use client';

import { useState } from 'react';

// Standalone tip — no order. Hits /api/contribute without an orderId; the
// webhook records it as a `standalone_tip` analytics event. Used on the
// landing page (no order yet exists) and anywhere else we want a real
// contribute affordance independent of an order.
export default function StandaloneTipForm({ id }: { id?: string }) {
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
        body: JSON.stringify({ amount: value }),
      });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || 'tip failed');
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  const inputId = `${id || 'tip'}-amount`;

  return (
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end max-w-md">
        <div className="flex-1">
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-2">
            Contribute
          </label>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-gray-950" aria-hidden="true">$</span>
            <input
              id={inputId}
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl p-3 text-2xl bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
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
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
