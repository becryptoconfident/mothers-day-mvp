// Tier 3 Forever Page. The URL is the credential (order UUID is unguessable).
// Lazy-generates cleaned text + AI letter on first visit; caches into the
// orders.forever_data column so subsequent renders are zero-API-cost.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { cleanUserTextBatch } from '@/lib/text-cleaner';
import { generateForeverLetter } from '@/lib/forever-letter';

type Params = Promise<{ orderId: string }>;

type MediaItem = {
  day: number;
  type: 'photo' | 'video' | 'audio' | 'youtube';
  url: string;
  caption?: string;
};

type Messages = Partial<Record<`day_${1 | 2 | 3 | 4 | 5 | 6 | 7}`, string>>;

type ForeverData = {
  long_note?: string;
  video_url?: string;
  cleaned_answers?: { question_1: string; question_2: string; question_3: string; question_4: string };
  generated_letter?: string;
};

type Order = {
  id: string;
  tier: number;
  paid: boolean;
  user_email: string;
  user_name: string | null;
  mom_name: string | null;
  question_1: string;
  question_2: string;
  question_3: string;
  question_4: string;
  messages: Messages;
  media: MediaItem[];
  forever_data: ForeverData;
};

const DAY_DATES = ['May 4th', 'May 5th', 'May 6th', 'May 7th', 'May 8th', 'May 9th', 'May 10th'];
const DAY_THEMES = [
  'What you do for me',
  'A funny memory',
  'Something you taught me',
  'A small detail',
  'The weight of you',
  'Almost there',
  'Mother’s Day',
];

async function loadOrder(orderId: string): Promise<Order | null> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,tier,paid,user_email,user_name,mom_name,question_1,question_2,question_3,question_4,messages,media,forever_data')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Order;
}

async function ensureForeverContent(order: Order): Promise<{
  cleaned: { question_1: string; question_2: string; question_3: string; question_4: string };
  letter: string;
}> {
  const fd: ForeverData = order.forever_data || {};
  let cleaned = fd.cleaned_answers;
  let letter = fd.generated_letter;

  // First-visit generation. Each piece independently cached.
  let mutated = false;
  if (!cleaned) {
    const [c1, c2, c3, c4] = await cleanUserTextBatch([
      order.question_1,
      order.question_2,
      order.question_3,
      order.question_4,
    ]);
    cleaned = { question_1: c1, question_2: c2, question_3: c3, question_4: c4 };
    mutated = true;
  }
  if (!letter) {
    letter = await generateForeverLetter({
      cleanedAnswers: cleaned,
      longNote: fd.long_note,
      userName: order.user_name || undefined,
      momName: order.mom_name || undefined,
    });
    mutated = true;
  }

  if (mutated) {
    const next: ForeverData = { ...fd, cleaned_answers: cleaned, generated_letter: letter };
    await supabaseAdmin.from('orders').update({ forever_data: next }).eq('id', order.id);
  }

  return { cleaned, letter };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { orderId } = await params;
  const order = await loadOrder(orderId);
  const momName = order?.mom_name || 'Mom';
  const userName = order?.user_name || 'a son or daughter';
  return {
    title: `A Week of Love for ${momName}`,
    description: `A Mother's Day gift from ${userName}.`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `A Week of Love for ${momName}`,
      description: `A Mother's Day gift from ${userName}.`,
      type: 'website',
    },
  };
}

export default async function ForeverPage({ params }: { params: Params }) {
  const { orderId } = await params;
  const order = await loadOrder(orderId);
  if (!order || !order.paid) notFound();
  if (order.tier !== 3) notFound();

  const { cleaned, letter } = await ensureForeverContent(order);
  const photos = (order.media || []).filter((m) => m.type === 'photo');
  const videoUrl = order.forever_data?.video_url;
  const momName = order.mom_name || 'Mom';
  const userName = order.user_name || null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-rose-50/40 print:bg-white">
      {/* Hero */}
      <header className="max-w-3xl mx-auto px-6 pt-16 md:pt-24 pb-8 text-center">
        <div className="text-3xl mb-6">🌷</div>
        <p className="text-xs uppercase tracking-[0.3em] text-rose-700 mb-3">A week of love for</p>
        <h1 className="font-serif text-5xl md:text-7xl text-gray-900 leading-tight tracking-tight">
          {momName}
        </h1>
        {userName ? (
          <p className="mt-6 font-serif text-lg text-gray-600 italic">From {userName} · Mother&rsquo;s Day 2026</p>
        ) : (
          <p className="mt-6 font-serif text-lg text-gray-600 italic">Mother&rsquo;s Day 2026</p>
        )}
      </header>

      <div className="max-w-3xl mx-auto px-6 space-y-16 md:space-y-20 pb-20">
        {/* Intro */}
        <section className="text-center">
          <p className="font-serif text-xl md:text-2xl text-gray-700 leading-relaxed max-w-2xl mx-auto">
            What follows is a week of small notes — one for each day leading up to today.
            Plus the photos, the moments, and the things {userName ? `${userName} has` : "they've"} been
            holding onto.
          </p>
        </section>

        <Divider />

        {/* The 7 messages */}
        <section>
          <SectionTitle eyebrow="The week" title="Seven mornings" />
          <div className="space-y-6">
            {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => {
              const text = order.messages?.[`day_${day}`];
              if (!text) return null;
              return <MessageCard key={day} day={day} text={text} />;
            })}
          </div>
        </section>

        {/* Photo gallery (if any) */}
        {photos.length > 0 ? (
          <>
            <Divider />
            <section>
              <SectionTitle eyebrow="The pictures" title="Captured" />
              <PhotoGallery photos={photos} />
            </section>
          </>
        ) : null}

        <Divider />

        {/* Timeline of memories — cleaned answers */}
        <section>
          <SectionTitle eyebrow="The reasons" title="What I keep coming back to" />
          <Timeline cleaned={cleaned} />
        </section>

        <Divider />

        {/* AI letter */}
        <section>
          <SectionTitle eyebrow="The letter" title={`To ${momName}`} />
          <LetterSection letter={letter} userName={userName} />
        </section>

        {/* Optional video */}
        {videoUrl ? (
          <>
            <Divider />
            <section>
              <SectionTitle eyebrow="The video" title="From me" />
              <VideoBlock url={videoUrl} />
            </section>
          </>
        ) : null}

        {/* Footer */}
        <footer className="text-center pt-12 border-t border-rose-100">
          <p className="font-serif text-xl text-gray-700">
            Love{userName ? `, ${userName}` : ''}.
          </p>
          <p className="text-xs text-gray-800 mt-3 italic">Mother&rsquo;s Day 2026</p>
        </footer>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex justify-center">
      <span className="text-rose-300 text-2xl tracking-widest">· · ·</span>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center mb-8">
      <p className="text-xs uppercase tracking-[0.3em] text-rose-700 mb-2">{eyebrow}</p>
      <h2 className="font-serif text-3xl md:text-4xl text-gray-900">{title}</h2>
    </div>
  );
}

function MessageCard({ day, text }: { day: 1 | 2 | 3 | 4 | 5 | 6 | 7; text: string }) {
  const isFinale = day === 7;
  return (
    <article className={`bg-white rounded-2xl border ${isFinale ? 'border-rose-300 shadow-md' : 'border-rose-100 shadow-sm'} p-6 md:p-8 relative overflow-hidden`}>
      {isFinale ? (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-400 via-amber-300 to-rose-400" />
      ) : null}
      <div className="flex justify-between items-baseline mb-4">
        <p className="text-xs uppercase tracking-widest text-rose-700 font-semibold">
          Day {day} · {DAY_DATES[day - 1]}{isFinale ? ' · Mother’s Day' : ''}
        </p>
        <p className="text-xs text-gray-700 italic">{DAY_THEMES[day - 1]}</p>
      </div>
      <p className="font-serif text-lg md:text-xl leading-relaxed text-gray-800 whitespace-pre-line">
        {text}
      </p>
    </article>
  );
}

function PhotoGallery({ photos }: { photos: MediaItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
      {photos.map((p, i) => (
        <a
          key={`${p.url}-${i}`}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white rounded-2xl overflow-hidden border border-rose-100 shadow-sm aspect-square"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.url}
            alt={p.caption || `Photo ${i + 1}`}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          />
        </a>
      ))}
    </div>
  );
}

function Timeline({
  cleaned,
}: {
  cleaned: { question_1: string; question_2: string; question_3: string; question_4: string };
}) {
  const rows: { eyebrow: string; text: string }[] = [
    { eyebrow: 'What you do for me', text: cleaned.question_1 },
    { eyebrow: 'A memory we share', text: cleaned.question_2 },
    { eyebrow: 'Something you taught me', text: cleaned.question_3 },
    { eyebrow: 'What I’d say if I weren’t awkward', text: cleaned.question_4 },
  ].filter((r) => r.text && r.text.length > 0);

  return (
    <ol className="space-y-8 max-w-2xl mx-auto">
      {rows.map((r, i) => (
        <li key={i} className="relative pl-8">
          <span className="absolute left-0 top-3 w-3 h-3 rounded-full bg-rose-400 ring-4 ring-rose-100" />
          {i < rows.length - 1 ? (
            <span className="absolute left-[5px] top-8 bottom-[-32px] w-px bg-rose-200" />
          ) : null}
          <p className="text-xs uppercase tracking-widest text-rose-700 mb-2">{r.eyebrow}</p>
          <p className="font-serif text-lg text-gray-800 leading-relaxed">{r.text}</p>
        </li>
      ))}
    </ol>
  );
}

function LetterSection({ letter, userName }: { letter: string; userName: string | null }) {
  return (
    <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-7 md:p-10">
      <div className="font-serif text-lg md:text-xl text-gray-800 leading-relaxed whitespace-pre-line">
        {letter}
      </div>
      {userName ? (
        <p className="font-serif text-lg text-gray-700 mt-8 text-right italic">— {userName}</p>
      ) : null}
    </div>
  );
}

function VideoBlock({ url }: { url: string }) {
  const isYoutube = /youtu\.?be/.test(url);
  if (isYoutube) {
    const id = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (id) {
      return (
        <div className="aspect-video bg-black rounded-2xl overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${id}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
  }
  return (
    <video controls src={url} className="w-full rounded-2xl bg-black" />
  );
}
