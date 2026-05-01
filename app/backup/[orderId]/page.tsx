// Backup messages page. No design, no fluff. If the daily emails fail or land
// in spam, the buyer can come here and copy/paste each message manually.
//
// Auth: URL is /backup/<order-uuid>. The order ID is the credential. Same
// capability-URL model as /forever/[id].

import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import MessageActions from '@/app/_components/MessageActions';
import TipJar from '@/app/_components/TipJar';

type Params = Promise<{ orderId: string }>;

const DAY_LABELS = [
  'Friday, May 8th — The Memory',
  'Saturday, May 9th — What She Does',
  "Sunday, May 10th — Mother's Day",
];

type Order = {
  id: string;
  paid: boolean;
  user_email: string;
  mom_name: string | null;
  messages: Record<string, string>;
};

export default async function BackupPage(props: { params: Params }) {
  const { orderId } = await props.params;
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,paid,user_email,mom_name,messages')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !data) notFound();
  const order = data as Order;
  if (!order.paid) notFound();

  return (
    <main id="main" className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto p-6 py-12 md:py-16">
        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl mb-3 text-gray-950">Backup messages</h1>
          <p className="text-gray-800 mb-1 leading-relaxed">
            All 3 messages, in case the daily emails get lost or filtered.
          </p>
          <p className="text-sm text-gray-700">
            For: {order.mom_name || 'mom'} · Bookmark this URL.
          </p>
        </header>

        <div className="bg-gray-50 rounded-2xl p-5 text-sm text-gray-700 mb-10">
          <strong className="text-gray-950">How to use:</strong> tap the message text → triple-tap or long-press → Copy. Then
          paste it in a text to mom. Same as the daily emails, just from here.
        </div>

        <section className="space-y-8" aria-label="Your three messages">
          {([1, 2, 3] as const).map((day) => {
            const text = order.messages?.[`day_${day}`];
            return (
              <article key={day} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 p-6 md:p-8">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-700 font-medium mb-3">
                  {DAY_LABELS[day - 1]}
                </div>
                {text ? (
                  <>
                    <p className="font-serif text-lg leading-relaxed text-gray-950 whitespace-pre-line select-all">
                      {text}
                    </p>
                    <div className="mt-5">
                      <MessageActions
                        text={text}
                        momName={order.mom_name || undefined}
                        ariaLabelSuffix={`for ${DAY_LABELS[day - 1]}`}
                        showCopy
                        showTextMom
                        showEmailMom
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-700 italic">
                    Not generated yet — refresh after payment confirms.
                  </p>
                )}
              </article>
            );
          })}
        </section>

        {/* Tip jar — normal */}
        <TipJar variant="normal" orderId={order.id} />

        <footer className="mt-10 pt-6 border-t border-gray-100 text-sm text-gray-700">
          <p>
            Order: <code className="bg-gray-50 px-1.5 py-0.5 rounded text-gray-700">{order.id.slice(0, 8)}</code>
          </p>
          <p className="mt-2">
            <a className="text-rose-600 hover:text-rose-700 font-medium" href={`/forever/${order.id}?edit=true`}>
              View your forever page →
            </a>
          </p>
          <p className="mt-3 text-xs text-gray-600">
            We email YOU. You text mom. We never message her directly.
          </p>
        </footer>
      </div>
    </main>
  );
}
