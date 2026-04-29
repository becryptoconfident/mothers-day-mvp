import { Suspense } from 'react';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';

type SP = { session_id?: string };

const TIER_PRICE: Record<number, number> = { 1: 19, 2: 29, 3: 49 };

const TIER_NAME: Record<number, string> = {
  1: 'Mother Lover Package',
  2: 'Mother Lover Package + Feels',
  3: 'Mother Lover Package + Feels + Forever Page',
};

export default async function SuccessPage(props: {
  searchParams: Promise<SP>;
}) {
  const sp = await props.searchParams;
  return (
    <Suspense fallback={<div className="p-12 text-center">Loading…</div>}>
      <SuccessInner sessionId={sp.session_id} />
    </Suspense>
  );
}

type SuccessOrder = {
  id: string;
  tier: number;
  mom_email: string | null;
  mom_name: string | null;
  user_email: string;
  delivery_time: string;
  paid: boolean;
};

async function SuccessInner({ sessionId }: { sessionId?: string }) {
  if (!sessionId) {
    return (
      <Wrap>
        <h1 className="font-serif text-3xl mb-3">Hmm — no session ID.</h1>
        <p className="text-gray-600">If you just paid, give it 30 seconds and refresh.</p>
      </Wrap>
    );
  }

  let order: SuccessOrder | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data } = await supabaseAdmin
      .from('orders')
      .select('id,tier,mom_email,mom_name,user_email,delivery_time,paid')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();
    const candidate = data as SuccessOrder | null;
    if (candidate && candidate.paid) {
      order = candidate;
      break;
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  if (!order) {
    return (
      <Wrap>
        <h1 className="font-serif text-3xl mb-3">Payment received — finalizing…</h1>
        <p className="text-gray-600">
          Reload in 30 seconds. If this page still doesn&rsquo;t update, email{' '}
          <a className="underline" href={`mailto:${process.env.SUPPORT_EMAIL || ''}`}>
            {process.env.SUPPORT_EMAIL || 'support'}
          </a>{' '}
          with this code: <code className="bg-gray-100 px-1">{sessionId.slice(-8)}</code>
        </p>
      </Wrap>
    );
  }

  const price = TIER_PRICE[order.tier] || 19;
  const tierName = TIER_NAME[order.tier] || 'Mother Lover Package';
  const time = order.delivery_time || '08:00';
  const isTier3 = order.tier === 3;

  return (
    <Wrap>
      <div className="text-center mb-8">
        <span className="text-3xl">🌷</span>
      </div>
      <h1 className="font-serif text-4xl text-center mb-3 text-gray-900">You&rsquo;re set.</h1>

      {/* Status checklist — what just happened, what's next, what to do */}
      <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-6 mb-8 shadow-sm">
        <h2 className="font-serif text-xl mb-4 text-gray-900">What happens next</h2>
        <div className="space-y-4">
          <StatusRow done bold="Payment received">
            ${price} charged. Order {order.id.slice(0, 8)}.
          </StatusRow>
          <StatusRow done bold="7 messages scheduled">
            Ready to send May 4th–10th. {isTier3 ? 'Plus your Forever Page.' : ''}
          </StatusRow>
          <StatusRow now bold={`First delivery: May 4th at ${time}`}>
            We email <em>YOU</em> the message. You copy, paste in a text to{' '}
            {order.mom_name || 'mom'}, send. ~30 seconds.
          </StatusRow>
          <StatusRow pending bold="Nothing to do until then">
            We&rsquo;ll nudge you every morning at {time}.
          </StatusRow>
        </div>

        <div className="mt-5 bg-white border border-rose-200 rounded-lg p-4">
          <p className="font-semibold text-sm mb-2">Backup copy of your messages</p>
          <p className="text-xs text-gray-600 mb-3">
            We&rsquo;ll email these to you daily, but here&rsquo;s a permanent URL in case
            anything ends up in spam:
          </p>
          <Link
            href={`/backup/${order.id}`}
            className="text-rose-700 underline font-semibold text-sm"
          >
            View all 7 messages →
          </Link>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-8">
        <p className="font-semibold mb-2">Email confirmation just sent to:</p>
        <p className="font-mono text-sm text-gray-700">{order.user_email}</p>
        <p className="text-xs text-gray-500 mt-2 italic">
          Not in inbox in 5 minutes? Check spam, then add the sender to your contacts so future
          daily emails don&rsquo;t get filtered.
        </p>
      </div>

      <div className="text-center mb-6">
        <p className="text-sm text-gray-600 mb-2">Tier: <strong>{tierName}</strong></p>
        <p className="text-sm text-gray-600 mb-4">Need to change anything? Edit until <strong>May 3rd, 11:59pm</strong>.</p>
        <Link
          href={`/edit/${order.id}`}
          className="inline-block bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800"
        >
          Edit messages →
        </Link>
      </div>

      {/* Viral share — #doitforbonnie */}
      <div className="bg-white border-2 border-rose-300 rounded-2xl p-5 md:p-6 mb-8 text-center">
        <p className="font-serif text-lg md:text-xl text-gray-900 mb-1">
          You did it for {order.mom_name || 'your mom'}.
        </p>
        <p className="text-sm text-gray-600 mb-4 italic">
          Memphis built this for his mom Bonnie. Pass the tag along — use it with your mom&rsquo;s name.
        </p>
        <p className="font-serif text-xl text-rose-700 mb-4 tracking-wide">#doitforbonnie</p>
        <a
          href={shareTweetUrl(order.mom_name)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-gray-900 text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-gray-800"
        >
          Tweet it →
        </a>
      </div>

      {isTier3 ? (
        <div className="mt-8 pt-6 border-t">
          <p className="font-serif text-lg mb-2 text-gray-900">Your Forever Page</p>
          <p className="text-gray-600 text-sm mb-3">
            We&rsquo;re generating the AI letter and cleaning up your text now. Takes about 5
            minutes. We&rsquo;ll email you the link when it&rsquo;s ready (usually within 10 minutes
            of payment). On May 10th at 9am we&rsquo;ll send it to you again so you can text the
            link to {order.mom_name || 'mom'} that morning.
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Want to peek? The page exists, but the AI letter may still be rendering on the first visit.
          </p>
          <Link
            href={`/forever/${order.id}`}
            className="inline-block text-sm underline text-rose-700 font-semibold"
          >
            Preview the Forever Page (may take ~15s on first load) →
          </Link>
        </div>
      ) : null}
    </Wrap>
  );
}

function shareTweetUrl(momName: string | null): string {
  const who = momName || 'my mom';
  const text = `Just set up a week of mother's day notes for ${who}. 10 minutes. ai writes them, i copy/paste/send. did it for bonnie. now my mom is the favorite. — built by @memphis__carter`;
  const url = process.env.NEXT_PUBLIC_URL || '';
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=doitforbonnie`;
}

function StatusRow(props: {
  done?: boolean;
  now?: boolean;
  pending?: boolean;
  bold: string;
  children: React.ReactNode;
}) {
  const icon = props.done ? '✓' : props.now ? '→' : '□';
  const iconColor = props.done ? 'text-green-600' : props.now ? 'text-rose-500' : 'text-gray-400';
  return (
    <div className="flex items-start gap-3">
      <span className={`text-xl font-bold ${iconColor} leading-tight w-5`}>{icon}</span>
      <div>
        <p className="font-semibold text-gray-900">{props.bold}</p>
        <p className="text-sm text-gray-600">{props.children}</p>
      </div>
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white p-4 py-12">
      <div className="max-w-xl mx-auto">{children}</div>
    </div>
  );
}
