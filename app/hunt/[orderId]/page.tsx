'use client';

import { useEffect, useState, use } from 'react';

type Clue = {
  platform: string;
  memory: string;
  riddle: string;
  hints: string[];
  answer: string;
};

type HuntData = {
  order_id: string;
  mom_name: string | null;
  user_name: string | null;
  clues: Clue[];
  finale: { message: string; media_url?: string | null };
  progress: {
    current_clue: number;
    hints_revealed: Record<string, number>;
    completed: boolean;
  };
};

export default function HuntPage(props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(props.params);
  const [hunt, setHunt] = useState<HuntData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/hunt?orderId=${orderId}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'load failed');
        setHunt(j);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [orderId]);

  async function recordProgress(patch: Partial<HuntData['progress']>) {
    if (!hunt) return;
    const next = { ...hunt.progress, ...patch };
    setHunt({ ...hunt, progress: next });
    await fetch('/api/hunt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, progress: next }),
    });
  }

  if (error) {
    return (
      <Wrap>
        <h1 className="text-3xl font-serif mb-3">Hmm.</h1>
        <p className="text-gray-900">{error}</p>
      </Wrap>
    );
  }
  if (!hunt) {
    return (
      <Wrap>
        <p className="text-gray-900 italic">Loading…</p>
      </Wrap>
    );
  }

  const { progress, clues } = hunt;

  if (progress.completed) {
    return <Finale hunt={hunt} />;
  }

  const idx = Math.min(progress.current_clue, clues.length - 1);
  const clue = clues[idx];
  const hintsShown = progress.hints_revealed[String(idx)] || 0;

  function showHint() {
    if (hintsShown >= 3) return;
    void recordProgress({
      hints_revealed: { ...progress.hints_revealed, [String(idx)]: hintsShown + 1 },
    });
  }

  function nextClue() {
    if (idx + 1 >= clues.length) {
      void recordProgress({ completed: true });
      return;
    }
    void recordProgress({ current_clue: idx + 1 });
  }

  return (
    <Wrap>
      <div className="text-xs uppercase tracking-wide text-gray-900 mb-2">
        Clue {idx + 1} of {clues.length}
      </div>
      <div className="w-full bg-gray-200 h-1 rounded-full mb-8">
        <div
          className="bg-rose-500 h-1 rounded-full transition-all"
          style={{ width: `${((idx + 1) / clues.length) * 100}%` }}
        />
      </div>

      <p className="text-2xl font-serif leading-relaxed whitespace-pre-line mb-8">
        {clue.riddle}
      </p>

      {hintsShown > 0 ? (
        <div className="space-y-2 mb-6">
          {clue.hints.slice(0, hintsShown).map((h, i) => (
            <div
              key={i}
              className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900"
            >
              <span className="font-semibold mr-2">Hint {i + 1}:</span>
              {h}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <button
          onClick={nextClue}
          className="px-6 py-3 bg-rose-500 text-white rounded-lg font-semibold hover:bg-rose-600"
        >
          {idx + 1 === clues.length ? 'I found it — show the finale' : 'I found it →'}
        </button>
        <button
          onClick={showHint}
          disabled={hintsShown >= 3}
          className="px-6 py-2 text-sm text-gray-900 underline disabled:text-gray-900 disabled:no-underline"
        >
          {hintsShown >= 3 ? 'No more hints' : `Need a hint? (${3 - hintsShown} left)`}
        </button>
      </div>
    </Wrap>
  );
}

function Finale({ hunt }: { hunt: HuntData }) {
  const fromName = hunt.user_name || 'Your kid';
  return (
    <Wrap>
      <h1 className="text-4xl font-serif mb-4">Happy Mother&rsquo;s Day{hunt.mom_name ? `, ${hunt.mom_name}` : ''}.</h1>
      <p className="text-lg font-serif leading-relaxed whitespace-pre-line mb-6">
        {hunt.finale.message}
      </p>
      {hunt.finale.media_url ? (
        <div className="mb-6">
          {/youtu/.test(hunt.finale.media_url) ? (
            <a href={hunt.finale.media_url} className="text-blue-600 underline">
              Watch the video →
            </a>
          ) : (
            <video controls src={hunt.finale.media_url} className="w-full rounded-lg" />
          )}
        </div>
      ) : null}
      <p className="text-sm text-gray-900">— {fromName}</p>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-rose-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-sm p-8 md:p-10">
        {children}
      </div>
    </div>
  );
}
