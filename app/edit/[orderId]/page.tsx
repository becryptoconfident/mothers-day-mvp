'use client';

import { useEffect, useState, use } from 'react';
import { EDIT_CLOSE_DATE, localToUTC } from '@/lib/dates';

type Messages = Record<`day_${1 | 2 | 3 | 4 | 5 | 6 | 7}`, string>;

type Order = {
  id: string;
  tier: 1 | 2 | 3;
  paid: boolean;
  mom_name: string | null;
  mom_email: string;
  user_email: string;
  delivery_time: string;
  delivery_timezone: string;
  messages: Messages;
  edit_locked: boolean;
};

const DAY_DATES = ['May 4th', 'May 5th', 'May 6th', 'May 7th', 'May 8th', 'May 9th', 'May 10th'];

export default function EditPage(props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(props.params);
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <EditFlow orderId={orderId} />
      </div>
    </div>
  );
}

function EditFlow({ orderId }: { orderId: string }) {
  const [stage, setStage] = useState<'request' | 'authed' | 'sent'>('request');
  const [token, setToken] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Pull token from URL hash (#t=...) on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    const m = hash.match(/[#&]t=([^&]+)/);
    if (m) {
      setToken(m[1]);
      setStage('authed');
    }
  }, []);

  useEffect(() => {
    if (stage !== 'authed' || !token) return;
    (async () => {
      try {
        const r = await fetch(`/api/edit-order?orderId=${orderId}&token=${encodeURIComponent(token)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'load failed');
        setOrder(j.order);
      } catch (e) {
        setError((e as Error).message);
        setStage('request');
      }
    })();
  }, [stage, token, orderId]);

  async function requestLink(email: string) {
    setError(null);
    try {
      const r = await fetch('/api/send-magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, email }),
      });
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error || 'send failed');
      }
      setStage('sent');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save(patch: Partial<Order>) {
    if (!order || !token) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const r = await fetch('/api/edit-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, token, patch }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'save failed');
      setOrder({ ...order, ...patch });
      setSavedMsg('Saved.');
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (stage === 'request') {
    return (
      <RequestLinkForm orderId={orderId} error={error} onSubmit={requestLink} />
    );
  }

  if (stage === 'sent') {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Check your email.</h1>
        <p className="text-gray-900">Click the edit link. It&rsquo;s good for an hour.</p>
      </div>
    );
  }

  if (!order) {
    return <div className="p-8 text-center text-gray-900">Loading…</div>;
  }

  if (order.edit_locked) {
    return (
      <div className="bg-white rounded-lg border p-8">
        <h1 className="text-2xl font-bold mb-2">Locked in.</h1>
        <p className="text-gray-900 mb-4">
          The edit window for messages closed May 7th. Your messages are scheduled.
        </p>
        <p className="text-gray-900 mb-4">
          Your Forever Page is still editable — it stays online for a full year. Save a copy before it expires.
        </p>
        <ReadOnlyMessages order={order} />
      </div>
    );
  }

  // Edit window closes May 7th 23:59 in user's local TZ. Show days remaining.
  const editCloseUTC = new Date(localToUTC(EDIT_CLOSE_DATE, '23:59', order.delivery_timezone));
  const msLeft = editCloseUTC.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60 * 24)));
  const hoursLeft = Math.max(0, Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const status =
    msLeft <= 0
      ? { tone: 'red', text: 'Locked — May 7th has passed' }
      : daysLeft === 0
        ? { tone: 'red', text: `Editable — ${hoursLeft} hours remaining` }
        : daysLeft <= 1
          ? { tone: 'amber', text: `Editable — ${daysLeft}d ${hoursLeft}h remaining` }
          : { tone: 'green', text: `Editable — ${daysLeft}d ${hoursLeft}h remaining` };
  const statusBg =
    status.tone === 'red'
      ? 'bg-red-50 border-red-200 text-red-900'
      : status.tone === 'amber'
        ? 'bg-amber-50 border-amber-300 text-amber-900'
        : 'bg-green-50 border-green-200 text-green-900';

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Edit your messages</h1>
      <p className="text-sm text-gray-900 mb-4">
        Order {order.id.slice(0, 8)} · {order.mom_email || order.user_email} · {savedMsg ? '✓ Saved' : 'auto-saved'}
      </p>

      {order.tier === 3 && order.paid ? (
        <ForeverPageLink orderId={order.id} />
      ) : null}

      <div className={`border rounded-lg p-3 mb-6 text-sm ${statusBg}`}>
        <p className="font-semibold">{status.text}</p>
        <p className="text-xs mt-1 opacity-90">
          You can edit messages, photos, your delivery time, and mom&rsquo;s name until <strong>May 7th, 11:59pm</strong>.
          After that, they&rsquo;re locked for delivery. Your Forever Page is editable all year — save a copy before it expires.
        </p>
      </div>

      <div className="space-y-6 mb-8">
        {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => (
          <div key={day} className="bg-white rounded-lg border p-5">
            <div className="text-xs uppercase tracking-wide text-gray-900 mb-2">
              Day {day} · {DAY_DATES[day - 1]}
            </div>
            <textarea
              value={order.messages[`day_${day}`]}
              onChange={(e) =>
                setOrder({
                  ...order,
                  messages: { ...order.messages, [`day_${day}`]: e.target.value },
                })
              }
              onBlur={() => save({ messages: order.messages })}
              className="w-full p-3 border rounded font-serif text-base leading-relaxed bg-gray-50 focus:bg-white"
              rows={4}
            />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border p-5 mb-8">
        <h2 className="font-semibold mb-3">Delivery</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold">Time (her local)</label>
            <input
              type="time"
              value={order.delivery_time}
              onChange={(e) => setOrder({ ...order, delivery_time: e.target.value })}
              onBlur={() => save({ delivery_time: order.delivery_time })}
              className="w-full p-2 border rounded mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Her email</label>
            <input
              type="email"
              value={order.mom_email}
              onChange={(e) => setOrder({ ...order, mom_email: e.target.value })}
              onBlur={() => save({ mom_email: order.mom_email })}
              className="w-full p-2 border rounded mt-1"
            />
          </div>
        </div>
      </div>

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}
      {saving ? <p className="text-xs text-gray-900">Saving…</p> : null}
    </>
  );
}

function ForeverPageLink({ orderId }: { orderId: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/forever/${orderId}`
      : `/forever/${orderId}`;
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-6 text-sm flex items-center gap-3">
      <span className="text-rose-700 font-semibold whitespace-nowrap">Your forever page:</span>
      <a
        href={`/forever/${orderId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-rose-900 truncate flex-1 font-mono text-xs"
      >
        {url}
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
        className="px-2.5 py-1 text-xs bg-white border border-rose-300 rounded hover:bg-rose-100"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

function RequestLinkForm(props: {
  orderId: string;
  error: string | null;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  return (
    <div className="bg-white rounded-lg border p-8">
      <h1 className="text-2xl font-bold mb-2">Edit your order</h1>
      <p className="text-gray-900 mb-6">
        Enter the email you used at checkout. We&rsquo;ll send you a one-hour edit link.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit(email);
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full p-3 border-2 rounded-lg mb-3"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
        >
          Send edit link
        </button>
      </form>
      {props.error ? <p className="text-sm text-red-600 mt-3">{props.error}</p> : null}
      <p className="text-xs text-gray-900 mt-6">
        Order: <code className="bg-gray-100 px-1">{props.orderId.slice(0, 8)}</code>
      </p>
    </div>
  );
}

function ReadOnlyMessages({ order }: { order: Order }) {
  return (
    <div className="space-y-4">
      {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => (
        <div key={day} className="border-l-4 border-gray-200 pl-4">
          <div className="text-xs text-gray-900">Day {day} · {DAY_DATES[day - 1]}</div>
          <p className="font-serif text-gray-900 mt-1">{order.messages[`day_${day}`]}</p>
        </div>
      ))}
    </div>
  );
}
