'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';

// Resume a saved /preview workspace from any device. Reads the draft_state
// stored in orders.forever_data.draft_state (saved by /api/save-progress),
// hydrates localStorage so /preview restores cleanly, then redirects.

export default function ResumePage(props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(props.params);
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'restored' | 'paid' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/resume?orderId=${orderId}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'lookup failed');
        if (j.paid) {
          setStatus('paid');
          setTimeout(() => router.replace(`/edit/${orderId}`), 1500);
          return;
        }
        const draft = j.draft;
        if (!draft) throw new Error('no draft state to restore');

        // Hydrate localStorage the way /builder + /preview expect.
        localStorage.setItem(
          'builderData',
          JSON.stringify({
            tier: draft.tier,
            answers: draft.answers,
            contact: draft.contact,
            extraReminders: !!draft.extraReminders,
            wantsMedia: !!draft.wantsMedia,
            mediaDays: draft.mediaDays || [],
            step: 'contact',
          }),
        );
        if (draft.previewMessages || draft.previewMedia || draft.foreverData) {
          localStorage.setItem(
            'previewData',
            JSON.stringify({
              answersHash: hashAnswers(draft.answers),
              messages: draft.previewMessages || {},
              media: draft.previewMedia || [],
              foreverData: draft.foreverData || { long_note: '', video_url: '' },
            }),
          );
        }
        setStatus('restored');
        setTimeout(() => router.replace('/preview'), 800);
      } catch (e) {
        setError((e as Error).message);
        setStatus('error');
      }
    })();
  }, [orderId, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-3xl mb-6">🌷</div>
        {status === 'loading' && (
          <>
            <h1 className="font-serif text-2xl mb-2 text-gray-900">Pulling up your workspace…</h1>
            <p className="text-gray-600 text-sm">One sec.</p>
          </>
        )}
        {status === 'restored' && (
          <>
            <h1 className="font-serif text-2xl mb-2 text-gray-900">Welcome back.</h1>
            <p className="text-gray-600 text-sm">Taking you to your messages…</p>
          </>
        )}
        {status === 'paid' && (
          <>
            <h1 className="font-serif text-2xl mb-2 text-gray-900">You already paid for this one.</h1>
            <p className="text-gray-600 text-sm">Sending you to the edit page…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="font-serif text-2xl mb-2 text-gray-900">Hmm.</h1>
            <p className="text-gray-600 text-sm mb-4">{error}</p>
            <a href="/" className="text-rose-700 underline">← back home</a>
          </>
        )}
      </div>
    </div>
  );
}

function hashAnswers(a: Record<string, string>): string {
  return [a.question_1, a.question_2, a.question_3, a.question_4]
    .map((s) => (s || '').slice(0, 60))
    .join('|');
}
