// Backup messages page. No design, no fluff. If the daily emails fail or land
// in spam, the buyer can come here and copy/paste each message manually.
//
// Auth: URL is /backup/<order-uuid>. The order ID is the credential. Same
// capability-URL model as /forever/[id].

import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';

type Params = Promise<{ orderId: string }>;

const DAY_DATES = [
  'Mon May 4th', 'Tue May 5th', 'Wed May 6th', 'Thu May 7th',
  'Fri May 8th', 'Sat May 9th', 'Sun May 10th — Mother\'s Day',
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
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto p-6 md:p-10">
        <h1 className="font-serif text-3xl mb-2 text-gray-900">Backup messages</h1>
        <p className="text-gray-700 mb-1">
          Your full set of 7 messages, in case the daily emails get lost or filtered.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          For: {order.mom_name || 'mom'} · Bookmark this URL.
        </p>

        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-900 mb-8">
          <strong>How to use:</strong> tap the message text → triple-tap or long-press → Copy. Then
          paste it in a text to mom. Same as the daily emails, just from here.
        </div>

        <div className="space-y-6">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => {
            const text = order.messages?.[`day_${day}`];
            return (
              <div
                key={day}
                className="border-l-4 border-rose-300 pl-4 py-2"
              >
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                  Day {day} of 7 · {DAY_DATES[day - 1]}
                </div>
                {text ? (
                  <p className="font-serif text-base leading-relaxed text-gray-800 whitespace-pre-line select-all">
                    {text}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Not generated yet — pay first, then refresh.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 pt-6 border-t text-sm text-gray-500">
          <p>Order: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{order.id.slice(0, 8)}</code></p>
          <p className="mt-2">
            Need to change something? Use <a className="underline" href={`/edit/${order.id}`}>the edit link</a> from your confirmation email.
          </p>
        </div>
      </div>
    </div>
  );
}
