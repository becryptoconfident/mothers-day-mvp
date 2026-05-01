// Forever Page — single-viewport collage. The URL is the credential
// (order UUID is unguessable). Lazy-generates cleaned text + AI letter
// on first visit; caches into the orders.forever_data column so subsequent
// renders are zero-API-cost.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { cleanUserTextBatch } from '@/lib/text-cleaner';
import { generateForeverLetter } from '@/lib/forever-letter';
import { FOREVER_THEMES, type ThemeKey } from '@/lib/forever-themes';
import ForeverMoment from './ForeverMoment';
import ExtraMediaEditor from './ExtraMediaEditor';

type Params = Promise<{ orderId: string }>;

type MediaItem = {
  day: number;
  type: 'photo' | 'video' | 'audio' | 'youtube';
  url: string;
  caption?: string;
};

type Messages = Partial<Record<`day_${1 | 2 | 3}`, string>>;

type ForeverData = {
  cleaned_answers?: { question_1: string; question_2: string; question_3: string; question_4: string };
  generated_letter?: string;
  language?: string;
  mom_nickname?: string;
  personal_audio_url?: string;
  personal_note?: string;
  song_url?: string;
  theme?: ThemeKey;
  headline?: string;
  signoff?: string;
  extra_media?: Array<{ url: string }>;
  captions?: Record<string, string>;
  mothers_day_photo?: { url: string; caption?: string };
};

type Order = {
  id: string;
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

async function loadOrder(orderId: string): Promise<Order | null> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,paid,user_email,user_name,mom_name,question_1,question_2,question_3,question_4,messages,media,forever_data')
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
      userName: order.user_name || undefined,
      momNickname: fd.mom_nickname || undefined,
      momName: order.mom_name || undefined,
      language: fd.language || undefined,
    });
    mutated = true;
  }

  if (mutated) {
    const next: ForeverData = { ...fd, cleaned_answers: cleaned, generated_letter: letter };
    await supabaseAdmin.from('orders').update({ forever_data: next }).eq('id', order.id);
  }

  return { cleaned, letter };
}

// Resolves a YouTube or Spotify URL to its embeddable form. Returns null
// for unrecognized URLs so the page can fall back to a clickable link.
function resolveSongEmbed(url: string): { type: 'youtube' | 'spotify'; embedUrl: string } | null {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;
  // YouTube
  const yt = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/,
  );
  if (yt) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${yt[1]}` };
  // Spotify (track / episode / album / playlist)
  const sp = trimmed.match(
    /open\.spotify\.com\/(track|episode|album|playlist)\/([a-zA-Z0-9]+)/,
  );
  if (sp) return { type: 'spotify', embedUrl: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}` };
  return null;
}

// Pulls a single emotionally-weighted line from the letter for the board.
// Heuristic: among 8–28-word sentences, pick one ~60% through. Letters tend
// to land their emotional weight in the second half.
function extractPullQuote(letter: string): string {
  const sentences = (letter.match(/[^.!?]+[.!?]+/g) || [letter])
    .map((s) => s.trim())
    .filter(Boolean);
  const candidates = sentences.filter((s) => {
    const wc = s.split(/\s+/).length;
    return wc >= 8 && wc <= 28;
  });
  if (candidates.length === 0) return sentences[Math.floor(sentences.length / 2)] || letter.slice(0, 200);
  const idx = Math.min(candidates.length - 1, Math.floor(candidates.length * 0.6));
  return candidates[idx];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { orderId } = await params;
  const order = await loadOrder(orderId);
  const momName = order?.mom_name || 'Mom';
  const userName = order?.user_name || 'a son or daughter';
  return {
    title: `Happy Mother's Day, ${momName}`,
    description: `A Mother's Day card from ${userName}.`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `Happy Mother's Day, ${momName}`,
      description: `A Mother's Day card from ${userName}.`,
      type: 'website',
    },
  };
}

export default async function ForeverPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { orderId } = await params;
  const sp = await searchParams;
  const editMode = sp.edit === 'true';
  const order = await loadOrder(orderId);
  if (!order || !order.paid) notFound();

  const { letter } = await ensureForeverContent(order);
  const photos = (order.media || []).filter((m) => m.type === 'photo').slice(0, 2);
  const photo1 = photos[0];
  const photo2 = photos[1];
  // Headline prefers first name → nickname → "Mom".
  const headlineName = order.mom_name || order.forever_data?.mom_nickname || 'Mom';
  const userName = order.user_name || null;
  const m1 = order.messages?.day_1 || '';
  const m2 = order.messages?.day_2 || '';
  const m3 = order.messages?.day_3 || '';
  const pullQuote = extractPullQuote(letter);

  // Theme + customizations from forever_data, with sensible defaults.
  const fd = order.forever_data || {};
  const themeKey: ThemeKey = (fd.theme && fd.theme in FOREVER_THEMES ? fd.theme : 'rose') as ThemeKey;
  const T = FOREVER_THEMES[themeKey];
  const headlineText = (fd.headline && fd.headline.trim()) || `Happy Mother's Day, ${headlineName}`;
  const signoffText =
    (fd.signoff && fd.signoff.trim()) || `With love${userName ? `, ${userName}` : ''}`;

  return (
    <main
      className="print:bg-white"
      style={{
        background: T.bg,
        color: T.text,
        ['--card-text' as string]: 'clamp(16px, 1.4vw, 18px)',
        ['--accent' as string]: T.accent,
        ['--card' as string]: T.card,
        ['--text' as string]: T.text,
      }}
    >
      {/* Hero — collage poster, fits the first viewport */}
      <section className="min-h-[100dvh] flex flex-col">
        <header className="text-center px-6 pt-8 md:pt-12 pb-3 md:pb-4 flex-none">
          <h1
            className="font-serif leading-[1.05] tracking-tight"
            style={{ fontSize: 'clamp(32px, 4.5vw, 56px)', color: T.text }}
          >
            {headlineText}
          </h1>
        </header>

        {/* Collage */}
        <div className="flex-1 min-h-0 px-4 md:px-8 py-3 md:py-4 pb-8">
          <div
            className="h-full grid gap-3 md:gap-4"
            style={{
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gridTemplateRows: 'minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1fr)',
            }}
          >
            {/* Row 1: Photo 1 (1 col) + Message 1 (2 cols) */}
            {photo1 ? <PhotoTile photo={photo1} index={1} /> : null}
            <MessageTile text={m1} colSpan={photo1 ? 2 : 3} isFinale={false} />

            {/* Row 2: Message 2 (2 cols) + Photo 2 (1 col) */}
            <MessageTile text={m2} colSpan={photo2 ? 2 : 3} isFinale={false} />
            {photo2 ? <PhotoTile photo={photo2} index={2} /> : null}

            {/* Row 3: Message 3 — full width, the big one */}
            <MessageTile text={m3} colSpan={3} isFinale />

            {/* Row 4: Pull quote — full width */}
            <div
              className="col-span-3 rounded-2xl flex items-center justify-center px-6 md:px-10 py-4 md:py-5"
              style={{ background: T.card }}
              aria-label="From the letter"
            >
              <p
                className="font-serif italic text-center leading-[1.45] max-w-3xl"
                style={{ fontSize: 'clamp(14px, 1.4vw, 19px)', color: T.text, opacity: 0.85 }}
              >
                &ldquo;{pullQuote}&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Edit-mode controls — only on /forever/{id}?edit=true */}
      {editMode ? (
        <ExtraMediaEditor
          orderId={order.id}
          initialExtras={fd.extra_media || []}
          initialCaptions={fd.captions || {}}
          initialMothersDayPhoto={fd.mothers_day_photo || null}
          accent={T.accent}
        />
      ) : null}

      {/* Static extras gallery — visible to both views (and to mom) when present */}
      {(fd.extra_media && fd.extra_media.length > 0) ? (
        <section className="px-6 pb-8 max-w-2xl mx-auto" aria-label="More photos">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {fd.extra_media.map((m, i) => (
              <figure key={`${m.url}-${i}`} className="space-y-1.5">
                <div className="aspect-square rounded-xl overflow-hidden shadow-sm bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt={fd.captions?.[String(i)] || `Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                {fd.captions?.[String(i)] ? (
                  <figcaption
                    className="text-xs text-center"
                    style={{ color: T.text, opacity: 0.75 }}
                  >
                    {fd.captions[String(i)]}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* Full letter — flows after the collage */}
      <section className="px-6 py-16 md:py-24" aria-label="The letter">
        <div className="rounded-2xl p-8 md:p-12 max-w-2xl mx-auto" style={{ background: T.card }}>
          <div
            className="font-serif text-xl leading-relaxed whitespace-pre-line max-w-prose mx-auto"
            style={{ color: T.text }}
          >
            {letter}
          </div>
        </div>
      </section>

      {/* Song / audio / note — order: song, voice, written. Only renders blocks that are present. */}
      {(() => {
        const fd = order.forever_data || {};
        const song = resolveSongEmbed(fd.song_url || '');
        const hasSongLink = !!fd.song_url && !song;
        const hasAnything = !!fd.song_url || !!fd.personal_audio_url || !!fd.personal_note;
        if (!hasAnything) return null;
        return (
          <section className="px-6 pb-16 md:pb-24 max-w-2xl mx-auto" aria-label="From the sender">
            <div className="space-y-4">
              {song ? (
                <div className="max-w-md mx-auto">
                  <p className="text-sm italic mb-2 text-center" style={{ color: T.text, opacity: 0.7 }}>
                    <span aria-hidden="true">♫ </span>A song for you
                  </p>
                  <div className="rounded-xl overflow-hidden shadow-sm bg-white">
                    <iframe
                      title="A song for Mom"
                      src={song.embedUrl}
                      className={song.type === 'youtube' ? 'w-full aspect-video' : 'w-full h-[152px]'}
                      loading="lazy"
                      allow="encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              ) : hasSongLink ? (
                <div className="max-w-md mx-auto text-center">
                  <p className="text-sm italic mb-2" style={{ color: T.text, opacity: 0.7 }}>
                    <span aria-hidden="true">♫ </span>A song for you
                  </p>
                  <a
                    href={fd.song_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium break-all"
                    style={{ color: T.accent }}
                  >
                    {fd.song_url}
                  </a>
                </div>
              ) : null}

              {fd.personal_audio_url ? (
                <figure className="bg-white rounded-2xl shadow-sm p-6">
                  <figcaption
                    className="text-xs uppercase tracking-[0.2em] font-medium mb-3"
                    style={{ color: T.accent }}
                  >
                    A message from {userName || 'them'}
                  </figcaption>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio
                    controls
                    src={fd.personal_audio_url}
                    className="w-full"
                    preload="metadata"
                    aria-label={`Voice message from ${userName || 'the sender'}`}
                  />
                </figure>
              ) : null}

              {fd.personal_note ? (
                <div className="rounded-2xl p-8" style={{ background: T.card }}>
                  <p
                    className="text-xs uppercase tracking-[0.2em] font-medium mb-3"
                    style={{ color: T.accent }}
                  >
                    In their words
                  </p>
                  <p
                    className="font-serif italic text-lg md:text-xl leading-relaxed whitespace-pre-line max-w-prose"
                    style={{ color: T.text }}
                  >
                    {fd.personal_note}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        );
      })()}

      {/* Mother's Day photo — last visual element before the sign-off, slightly bigger */}
      {fd.mothers_day_photo ? (
        <section className="px-6 pb-12 md:pb-16 max-w-3xl mx-auto" aria-label="Mother's Day photo">
          <figure className="space-y-3">
            <div className="rounded-2xl overflow-hidden shadow-md bg-white aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fd.mothers_day_photo.url}
                alt={fd.mothers_day_photo.caption || "A photo from Mother's Day"}
                className="w-full h-full object-cover"
              />
            </div>
            {fd.mothers_day_photo.caption ? (
              <figcaption
                className="text-center font-serif italic text-sm md:text-base"
                style={{ color: T.text, opacity: 0.75 }}
              >
                {fd.mothers_day_photo.caption}
              </figcaption>
            ) : null}
          </figure>
        </section>
      ) : null}

      {/* Sign-off — the emotional landing */}
      <section className="text-center px-6" aria-label="Sign-off">
        <p
          className="font-serif italic text-lg md:text-xl"
          style={{ color: T.accent }}
        >
          {signoffText}
        </p>
      </section>

      {/* The moment — calm post-letter ask */}
      <ForeverMoment
        contributeHref={`/success?orderId=${order.id}#contribute`}
        shareUrl={process.env.NEXT_PUBLIC_URL || ''}
      />

      {/* Whisper footer — quiet, last */}
      <footer className="text-center px-6 pb-12 md:pb-16">
        <p className="text-xs" style={{ color: T.text, opacity: 0.5 }}>
          Made for people whose brains don&rsquo;t compute this stuff
        </p>
      </footer>
    </main>
  );
}

function PhotoTile({ photo, index }: { photo: MediaItem; index: number }) {
  return (
    <figure className="row-span-1 col-span-1 rounded-2xl overflow-hidden shadow-md bg-gray-50 min-h-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || `Photo ${index} of mom`}
        className="w-full h-full object-cover"
      />
    </figure>
  );
}

function MessageTile({
  text,
  colSpan,
  isFinale,
}: {
  text: string;
  colSpan: 1 | 2 | 3;
  isFinale: boolean;
}) {
  const colClass = colSpan === 3 ? 'col-span-3' : colSpan === 2 ? 'col-span-2' : 'col-span-1';
  return (
    <article
      className={`row-span-1 ${colClass} bg-white rounded-2xl shadow-sm p-4 md:p-6 flex flex-col justify-center min-h-0 relative ${isFinale ? 'shadow-md' : ''}`}
    >
      {isFinale ? (
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
          style={{ background: 'var(--accent)' }}
          aria-hidden="true"
        />
      ) : null}
      <p
        className="font-serif leading-[1.45] whitespace-pre-line overflow-hidden"
        style={{ fontSize: 'var(--card-text)', color: 'var(--text)' }}
      >
        {text}
      </p>
    </article>
  );
}
