import { Suspense } from 'react';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { formatTime12 } from '@/lib/dates';
import SuccessActions from './SuccessActions';
import FeedbackWidget from './FeedbackWidget';
import ContributeWidget from './ContributeWidget';

type SP = { session_id?: string; orderId?: string; contributed?: string };

export default async function SuccessPage(props: {
  searchParams: Promise<SP>;
}) {
  const sp = await props.searchParams;
  return (
    <Suspense fallback={<div className="p-12 text-center">Loading…</div>}>
      <SuccessInner
        sessionId={sp.session_id}
        orderIdParam={sp.orderId}
        contributed={sp.contributed === '1'}
      />
    </Suspense>
  );
}

type SuccessOrder = {
  id: string;
  mom_name: string | null;
  user_email: string;
  delivery_time: string;
  paid: boolean;
  amount_paid: number;
};

async function SuccessInner({
  sessionId,
  orderIdParam,
  contributed,
}: {
  sessionId?: string;
  orderIdParam?: string;
  contributed: boolean;
}) {
  let order: SuccessOrder | null = null;

  // Free path uses ?orderId=, paid path uses ?session_id=. Either is fine.
  if (orderIdParam) {
    const { data } = await supabaseAdmin
      .from('orders')
      .select('id,mom_name,user_email,delivery_time,paid,amount_paid')
      .eq('id', orderIdParam)
      .maybeSingle();
    if (data && (data as SuccessOrder).paid) order = data as SuccessOrder;
  } else if (sessionId) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data } = await supabaseAdmin
        .from('orders')
        .select('id,mom_name,user_email,delivery_time,paid,amount_paid')
        .eq('stripe_session_id', sessionId)
        .maybeSingle();
      const candidate = data as SuccessOrder | null;
      if (candidate && candidate.paid) {
        order = candidate;
        break;
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  } else {
    return (
      <Wrap>
        <h1 className="font-serif text-3xl mb-3">Hmm — no order ID.</h1>
        <p className="text-gray-900">If you just paid, give it 30 seconds and refresh.</p>
      </Wrap>
    );
  }

  if (!order) {
    return (
      <Wrap>
        <h1 className="font-serif text-3xl mb-3">Payment received — finalizing…</h1>
        <p className="text-gray-900">
          Reload in 30 seconds. If this page still doesn&rsquo;t update, email{' '}
          <a className="text-rose-600 hover:text-rose-700 font-medium" href={`mailto:${process.env.SUPPORT_EMAIL || ''}`}>
            {process.env.SUPPORT_EMAIL || 'support'}
          </a>{' '}
          with this code: <code className="bg-gray-100 px-1">{(sessionId || orderIdParam || '').slice(-8)}</code>
        </p>
      </Wrap>
    );
  }

  const time = formatTime12(order.delivery_time || '09:00');
  const wasFree = order.amount_paid === 0;
  const landingUrl = process.env.NEXT_PUBLIC_URL || '';

  return (
    <Wrap>
      <main id="main">
        <header className="text-center mb-6">
          <h1 className="font-serif text-3xl md:text-4xl mb-3 text-gray-950">You&rsquo;re set.</h1>
        </header>

        {/* Status checklist */}
        <section
          className="bg-white rounded-2xl shadow-sm p-8 mb-6"
          aria-label="Status of your order"
        >
          <h2 className="font-serif text-xl mb-4 text-gray-900">What happens next</h2>
          <div className="space-y-4">
            <StatusRow done bold={wasFree ? 'You&rsquo;re in.' : 'Payment received.'}>
              {wasFree ? null : `$${(order.amount_paid / 100).toFixed(2)} charged.`}
            </StatusRow>
            <StatusRow done bold="3 messages scheduled.">
              Friday May 8th, Saturday May 9th, Sunday May 10th — Mother&rsquo;s Day morning.
            </StatusRow>
            <StatusRow now bold={`First delivery: Friday, May 8th at ${time}.`}>
              We email <em>YOU</em> the message. You copy, paste in a text to{' '}
              {order.mom_name || 'mom'}, send. ~30 seconds.
            </StatusRow>
            <StatusRow pending bold="Nothing to do until then.">
              We&rsquo;ll nudge you each morning at {time}.
            </StatusRow>
          </div>

        </section>

        {/* Three primary actions, same level, same style */}
        <SuccessActions orderId={order.id} landingUrl={landingUrl} />

        {/* Contribute — surfaced here so the ask isn't buried under housekeeping */}
        <ContributeWidget orderId={order.id} alreadyContributed={contributed} />

        <section className="bg-white rounded-2xl shadow-sm p-6 mb-6" aria-label="Email confirmation">
          <p className="font-medium text-gray-950 mb-2">Email confirmation just sent to:</p>
          <p className="font-mono text-sm text-gray-700">{order.user_email}</p>
          <p className="text-xs text-gray-700 mt-2">
            Not in inbox in 5 minutes? Check spam, then add the sender to your contacts so future
            daily emails don&rsquo;t get filtered.
          </p>
        </section>

        <section className="text-center mb-6">
          <p className="text-sm text-gray-700 mb-3">
            Need to change anything? Edit until <strong className="text-gray-700">May 7th, 11:59pm</strong>.
          </p>
          <Link
            href={`/edit/${order.id}`}
            className="inline-block text-sm text-rose-600 font-medium hover:text-rose-700 focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
          >
            Edit messages →
          </Link>
        </section>

        {/* Feedback */}
        <FeedbackWidget orderId={order.id} />
      </main>
    </Wrap>
  );
}

function StatusRow(props: {
  done?: boolean;
  now?: boolean;
  pending?: boolean;
  bold: string;
  children?: React.ReactNode;
}) {
  const icon = props.done ? '✓' : props.now ? '→' : '○';
  const iconColor = props.done ? 'text-rose-600' : props.now ? 'text-rose-600' : 'text-gray-300';
  return (
    <div className="flex items-start gap-3">
      <span className={`text-xl font-medium ${iconColor} leading-tight w-5`} aria-hidden="true">{icon}</span>
      <div>
        <p className="font-medium text-gray-950" dangerouslySetInnerHTML={{ __html: props.bold }} />
        {props.children ? (
          <p className="text-sm text-gray-800 mt-0.5">{props.children}</p>
        ) : null}
      </div>
    </div>
  );
}


function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white p-4 pt-6 md:pt-10 pb-12 md:pb-16">
      <div className="max-w-xl mx-auto">{children}</div>
    </div>
  );
}
