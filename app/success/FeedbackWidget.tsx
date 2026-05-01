'use client';

import { useState } from 'react';

type Mode = 'idle' | 'positive' | 'negative' | 'comment' | 'submitted';

export default function FeedbackWidget({ orderId }: { orderId: string }) {
  const [mode, setMode] = useState<Mode>('idle');
  const [comment, setComment] = useState('');

  async function logFeedback(event: string, payload: Record<string, unknown> = {}) {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, event, ...payload }),
      });
    } catch {
      // Silent fail — feedback shouldn't block the user.
    }
  }

  if (mode === 'submitted') {
    return (
      <section className="mt-10 pt-6 border-t" aria-label="Feedback">
        <p role="status" aria-live="polite" className="text-sm text-gray-900">
          Thanks. This helps me make it better.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 pt-6 border-t" aria-label="Rate your experience">
      <p className="font-serif text-lg mb-3 text-gray-900">How was this?</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            await logFeedback('feedback_positive');
            setMode('submitted');
          }}
          className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-gray-400 hover:text-gray-950 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
          aria-label="Great experience"
        >
          👍 Great
        </button>
        <button
          type="button"
          onClick={() => setMode('negative')}
          className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-gray-400 hover:text-gray-950 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
          aria-label="Needs improvement"
        >
          👎 Needs work
        </button>
        <button
          type="button"
          onClick={() => setMode('comment')}
          className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-gray-400 hover:text-gray-950 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
          aria-label="Leave a comment"
        >
          💬 Tell me something
        </button>
      </div>

      {mode === 'negative' || mode === 'comment' ? (
        <form
          className="mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await logFeedback(
              mode === 'negative' ? 'feedback_negative' : 'feedback_comment',
              { comment },
            );
            setMode('submitted');
          }}
        >
          <label htmlFor="feedback-text" className="block text-sm text-gray-900 mb-2">
            What would make this better?
          </label>
          <textarea
            id="feedback-text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
          />
          <button
            type="submit"
            className="mt-3 px-6 py-2 min-h-[44px] rounded-full bg-gray-950 text-white text-sm font-medium shadow-sm hover:shadow-md hover:bg-gray-800 transition-all focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
          >
            Send
          </button>
        </form>
      ) : null}
    </section>
  );
}
