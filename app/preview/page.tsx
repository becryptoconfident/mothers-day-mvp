'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import MessageActions from '../_components/MessageActions';
import TipJar from '../_components/TipJar';
import VoiceNoteSection from './VoiceNoteSection';
import CustomizeSection, { type ThemeKey } from './CustomizeSection';

const STORAGE_BUILDER = 'mdmvp_builder_v3';
const STORAGE_PREVIEW = 'mdmvp_preview_v3';

type Answers = { question_1: string; question_2: string; question_3: string; question_4: string };
type Messages = { day_1: string; day_2: string; day_3: string };
type Contact = {
  user_email: string;
  user_name: string;
  mom_nickname: string;
  mom_name: string;
  mom_email: string;
  delivery_time: string;
  delivery_timezone: string;
};
type DeliveryMode = 'self' | 'mom';
type MediaItem = { day: number; type: 'photo'; url: string; caption?: string };

const LABELS: Array<{ key: keyof Messages; label: string; sub: string }> = [
  { key: 'day_1', label: 'Friday, May 8th', sub: 'The Memory' },
  { key: 'day_2', label: 'Saturday, May 9th', sub: 'What She Does' },
  { key: 'day_3', label: 'Sunday, May 10th', sub: "Mother's Day — The Unsaid" },
];

export default function PreviewPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [language, setLanguage] = useState('English');
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [messages, setMessages] = useState<Messages | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact>({
    user_email: '',
    user_name: '',
    mom_nickname: '',
    mom_name: '',
    mom_email: '',
    delivery_time: '09:00',
    delivery_timezone:
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago' : 'America/Chicago',
  });
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('self');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [personalAudioUrl, setPersonalAudioUrl] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [songUrl, setSongUrl] = useState('');
  const [theme, setTheme] = useState<ThemeKey>('rose');
  const [customHeadline, setCustomHeadline] = useState('');
  const [customSignoff, setCustomSignoff] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Hydrate state from localStorage on mount.
  useEffect(() => {
    try {
      const builderRaw = localStorage.getItem(STORAGE_BUILDER);
      if (builderRaw) {
        const parsed = JSON.parse(builderRaw);
        if (parsed.answers) setAnswers(parsed.answers);
        if (typeof parsed.language === 'string') {
          setLanguage(
            parsed.language === 'Other' && parsed.otherLanguage ? parsed.otherLanguage : parsed.language,
          );
        }
        if (typeof parsed.momNickname === 'string' || typeof parsed.momName === 'string') {
          setContact((c) => ({
            ...c,
            mom_nickname: typeof parsed.momNickname === 'string' ? parsed.momNickname : c.mom_nickname,
            mom_name: typeof parsed.momName === 'string' ? parsed.momName : c.mom_name,
          }));
        }
      }
      const previewRaw = localStorage.getItem(STORAGE_PREVIEW);
      if (previewRaw) {
        const parsed = JSON.parse(previewRaw);
        if (parsed.messages) setMessages(parsed.messages);
        if (parsed.contact) setContact((c) => ({ ...c, ...parsed.contact }));
        if (Array.isArray(parsed.media)) setMedia(parsed.media);
        if (typeof parsed.personalAudioUrl === 'string') setPersonalAudioUrl(parsed.personalAudioUrl);
        if (typeof parsed.personalNote === 'string') setPersonalNote(parsed.personalNote);
        if (typeof parsed.songUrl === 'string') setSongUrl(parsed.songUrl);
        if (typeof parsed.theme === 'string' && parsed.theme in { rose: 1, ocean: 1, sage: 1, sunset: 1, lavender: 1 }) {
          setTheme(parsed.theme as ThemeKey);
        }
        if (typeof parsed.customHeadline === 'string') setCustomHeadline(parsed.customHeadline);
        if (typeof parsed.customSignoff === 'string') setCustomSignoff(parsed.customSignoff);
        if (parsed.deliveryMode === 'mom' || parsed.deliveryMode === 'self') {
          setDeliveryMode(parsed.deliveryMode);
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Save preview state on change.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_PREVIEW,
        JSON.stringify({
          messages,
          contact,
          media,
          personalAudioUrl,
          personalNote,
          songUrl,
          theme,
          customHeadline,
          customSignoff,
          deliveryMode,
        }),
      );
    } catch {}
  }, [
    hydrated,
    messages,
    contact,
    media,
    personalAudioUrl,
    personalNote,
    songUrl,
    theme,
    customHeadline,
    customSignoff,
    deliveryMode,
  ]);

  // If no answers, redirect to builder.
  useEffect(() => {
    if (!hydrated) return;
    if (!answers) router.replace('/builder');
  }, [hydrated, answers, router]);

  // Generate messages on first load (only if not already cached).
  useEffect(() => {
    if (!hydrated || !answers) return;
    if (messages && messages.day_1 && messages.day_2 && messages.day_3) return;
    let cancelled = false;
    (async () => {
      setGenerating(true);
      setGenerateError(null);
      try {
        const r = await fetch('/api/generate-messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...answers,
            language,
            mom_nickname: contact.mom_nickname || undefined,
            mom_name: contact.mom_name || undefined,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'generation failed');
        if (cancelled) return;
        setMessages({
          day_1: data.messages.day_1,
          day_2: data.messages.day_2,
          day_3: data.messages.day_3,
        });
      } catch (e) {
        if (!cancelled) setGenerateError((e as Error).message);
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, answers, language]);

  const isReady = useMemo(() => {
    if (
      !messages ||
      !messages.day_1 ||
      !messages.day_2 ||
      !messages.day_3 ||
      contact.user_email.trim().length <= 3 ||
      !contact.user_email.includes('@')
    ) {
      return false;
    }
    if (deliveryMode === 'mom') {
      const m = contact.mom_email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) return false;
    }
    return true;
  }, [messages, contact.user_email, contact.mom_email, deliveryMode]);

  async function submit() {
    if (!answers || !messages || !isReady || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: 0,
          contact: { ...contact, mom_email: deliveryMode === 'mom' ? contact.mom_email.trim() : (contact.mom_email.trim() || null) },
          answers,
          messages,
          media,
          language,
          delivery_mode: deliveryMode,
          forever_data: {
            language,
            personal_audio_url: personalAudioUrl || undefined,
            personal_note: personalNote.trim() || undefined,
            song_url: songUrl.trim() || undefined,
            theme,
            headline: customHeadline.trim() || undefined,
            signoff: customSignoff.trim() || undefined,
          },
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'failed to create order');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      setSubmitError((e as Error).message);
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <main id="main" className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto p-6 pt-6 pb-12">
          <p className="text-gray-700">Loading…</p>
        </div>
      </main>
    );
  }

  if (!answers) {
    return (
      <main id="main" className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto p-6 pt-6 pb-12">
          <p className="text-gray-700">Redirecting to the builder…</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:outline-2 focus:outline-rose-500"
      >
        Skip to content
      </a>
      <main id="main" className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 pt-6 md:pt-10 pb-12 md:pb-16">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-700 mb-3">
              Answered 4 questions · Here are your messages
            </p>
            <h1 className="font-serif text-3xl md:text-4xl text-gray-950 mb-5 leading-[1.1]">
              Here&rsquo;s what we came up with.{language && language !== 'English' ? ` (in ${language})` : ''}
            </h1>
            <p className="text-lg text-gray-800 leading-relaxed mb-3">
              These are the bones. Read them, tweak them, make them sound like you. Or leave them as-is.
            </p>
            <p className="text-lg text-gray-800 leading-relaxed">
              When you&rsquo;re ready, all you do is copy and paste. Text her. Email her. DM her. Whatever works.
            </p>
          </header>

          {generating ? (
            <section
              aria-live="polite"
              className="bg-white rounded-2xl p-8 mb-6 shadow-sm"
            >
              <p className="font-serif text-lg text-gray-950">Writing your messages…</p>
              <p className="text-sm text-gray-700 mt-2">
                Pulling specific details from your answers. Takes about 10 seconds.
              </p>
            </section>
          ) : null}

          {generateError ? (
            <section className="bg-gray-50 rounded-2xl p-8 mb-6">
              <p className="font-medium text-gray-950">Couldn&rsquo;t generate the messages.</p>
              <p className="text-sm text-gray-800 mt-2">{generateError}</p>
              <button
                type="button"
                onClick={() => {
                  setMessages(null);
                  setGenerateError(null);
                }}
                className="mt-4 inline-flex items-center justify-center px-6 py-3 min-h-[44px] rounded-full border border-gray-200 text-gray-700 text-sm font-medium hover:border-gray-400 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
              >
                Try again
              </button>
            </section>
          ) : null}

          {messages ? (
            <section className="space-y-6 mb-6" aria-label="Your three messages">
              {LABELS.map(({ key, label, sub }) => (
                <article
                  key={key}
                  className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <p className="text-base uppercase tracking-[0.15em] text-gray-700 font-semibold">
                    {label.toUpperCase()} — {sub.toUpperCase()}
                  </p>
                  <label htmlFor={`msg-${key}`} className="sr-only">
                    {label} — edit message
                  </label>
                  <textarea
                    id={`msg-${key}`}
                    value={messages[key]}
                    onChange={(e) =>
                      setMessages((m) => (m ? { ...m, [key]: e.target.value } : m))
                    }
                    rows={5}
                    className="mt-4 w-full font-serif text-lg md:text-xl leading-[1.6] text-gray-950 bg-gray-50 rounded-xl p-4 border-0 focus:bg-white focus:ring-1 focus:ring-rose-600 focus:outline-none resize-none"
                  />
                  <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-gray-700">Tap to edit</p>
                    <MessageActions
                      text={messages[key]}
                      ariaLabelSuffix={`for ${label}`}
                      showCopy
                    />
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          {messages ? (
            <section className="mb-6" aria-label="What happens next">
              <p className="font-serif text-2xl text-gray-950 mb-3">
                That&rsquo;s it. 3 messages, ready to send.
              </p>
              {deliveryMode === 'mom' ? (
                <>
                  <p className="text-gray-800 leading-relaxed mb-1">
                    We&rsquo;ll email each message directly to {contact.mom_nickname || contact.mom_name || 'mom'} on May 8th, May 9th, and May 10th.
                  </p>
                  <p className="text-gray-800 leading-relaxed">You&rsquo;ll get a copy of each one.</p>
                </>
              ) : (
                <>
                  <p className="text-gray-800 leading-relaxed mb-1">
                    We&rsquo;ll email the messages to you on May 8th, May 9th, and May 10th.
                  </p>
                  <p className="text-gray-800 leading-relaxed mb-1">
                    You copy, you paste, you send to {contact.mom_nickname || contact.mom_name || 'mom'}.
                  </p>
                  <p className="text-gray-800 leading-relaxed">Takes 30 seconds each morning.</p>
                </>
              )}
            </section>
          ) : null}

          {messages ? (
            <SummaryCard
              deliveryMode={deliveryMode}
              momEmail={contact.mom_email}
              photoCount={media.filter((m) => m.type === 'photo').length}
              hasSong={!!songUrl.trim()}
              hasVoice={!!personalAudioUrl}
              hasNote={!!personalNote.trim()}
              theme={theme}
              hasCustomHeadline={!!customHeadline.trim()}
              hasCustomSignoff={!!customSignoff.trim()}
              setPhotosOpen={setPhotosOpen}
              setVoiceOpen={setVoiceOpen}
              setCustomizeOpen={setCustomizeOpen}
            />
          ) : null}

          {messages ? (
            <section className="border-t border-gray-100 pt-12 mb-6" aria-label="Make it yours">
              <p className="text-sm text-gray-700 mb-5">
                Use as much or as little as you want. Just want the 3 messages? Great. Skip the photos.
                Either way, your mom gets a private page she can revisit all year.
              </p>
              <PhotoSection
                open={photosOpen}
                setOpen={setPhotosOpen}
                media={media}
                setMedia={setMedia}
              />
              <div className="mt-4">
                <VoiceNoteSection
                  audioUrl={personalAudioUrl}
                  note={personalNote}
                  songUrl={songUrl}
                  setAudioUrl={setPersonalAudioUrl}
                  setNote={setPersonalNote}
                  setSongUrl={setSongUrl}
                  open={voiceOpen}
                  setOpen={setVoiceOpen}
                />
              </div>
              <div className="mt-4">
                <CustomizeSection
                  theme={theme}
                  headline={customHeadline}
                  signoff={customSignoff}
                  momNickname={contact.mom_nickname}
                  momName={contact.mom_name}
                  userName={contact.user_name}
                  setTheme={setTheme}
                  setHeadline={setCustomHeadline}
                  setSignoff={setCustomSignoff}
                  open={customizeOpen}
                  setOpen={setCustomizeOpen}
                />
              </div>
            </section>
          ) : null}

          {messages ? (
            <section id="delivery" className="border-t border-gray-100 pt-12 mb-6 scroll-mt-8" aria-label="Where to send">
              <h2 className="font-serif text-2xl md:text-3xl text-gray-950 mb-6">Where should we email you?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field
                  id="user_email"
                  label="Your email *"
                  value={contact.user_email}
                  onChange={(v) => setContact((c) => ({ ...c, user_email: v }))}
                  type="email"
                  required
                />
                <Field
                  id="user_name"
                  label="Your name (optional)"
                  value={contact.user_name}
                  onChange={(v) => setContact((c) => ({ ...c, user_name: v }))}
                />
                <Field
                  id="delivery_time"
                  label="Delivery time"
                  value={contact.delivery_time}
                  onChange={(v) => setContact((c) => ({ ...c, delivery_time: v }))}
                  type="time"
                />
              </div>
              <p className="mt-4 text-xs text-gray-700">
                Timezone detected: <strong className="text-gray-700">{contact.delivery_timezone}</strong>. Emails go out at
                that time on May 8th, May 9th, and May 10th.
              </p>

              {/* Delivery mode — buyer relays vs. direct-to-mom */}
              <fieldset className="mt-8">
                <legend className="font-serif text-xl md:text-2xl text-gray-950 mb-4">
                  How should we deliver the messages?
                </legend>
                <div className="space-y-3">
                  <label
                    htmlFor="dm-self"
                    className={[
                      'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
                      deliveryMode === 'self'
                        ? 'border-rose-600 bg-rose-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      id="dm-self"
                      name="delivery-mode"
                      value="self"
                      checked={deliveryMode === 'self'}
                      onChange={() => setDeliveryMode('self')}
                      className="mt-1 accent-rose-600"
                    />
                    <span>
                      <span className="block text-base font-medium text-gray-950">
                        Send them to me
                      </span>
                      <span className="block text-sm text-gray-700 mt-1 leading-relaxed">
                        You&rsquo;ll get an email each morning with the message. Copy it, text it to her.
                      </span>
                    </span>
                  </label>
                  <label
                    htmlFor="dm-mom"
                    className={[
                      'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
                      deliveryMode === 'mom'
                        ? 'border-rose-600 bg-rose-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      id="dm-mom"
                      name="delivery-mode"
                      value="mom"
                      checked={deliveryMode === 'mom'}
                      onChange={() => setDeliveryMode('mom')}
                      className="mt-1 accent-rose-600"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-base font-medium text-gray-950">
                        Send directly to Mom
                      </span>
                      <span className="block text-sm text-gray-700 mt-1 leading-relaxed">
                        We email her directly on May 8th, 9th, and 10th &mdash; Mother&rsquo;s Day morning. You&rsquo;ll get a copy of each one. Replies go to you.
                      </span>
                      {deliveryMode === 'mom' ? (
                        <span className="block mt-3">
                          <label htmlFor="mom_email" className="block text-sm font-medium text-gray-700 mb-2">
                            Mom&rsquo;s email *
                          </label>
                          <input
                            id="mom_email"
                            type="email"
                            value={contact.mom_email}
                            onChange={(e) => setContact((c) => ({ ...c, mom_email: e.target.value }))}
                            required
                            placeholder="mom@example.com"
                            className="w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
                          />
                          {contact.mom_email.trim() &&
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.mom_email.trim()) ? (
                            <span className="block mt-2 text-xs text-red-700">
                              That doesn&rsquo;t look like a valid email.
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </div>
              </fieldset>
            </section>
          ) : null}

          {messages ? (
            <section className="border-t border-gray-100 pt-12 pb-12" aria-label="Get your messages">
              <div className="text-center mb-6">
                <p className="font-serif text-2xl md:text-3xl text-gray-950 mb-3">
                  These are yours. It&rsquo;s free.
                </p>
                <p className="text-gray-800 leading-relaxed max-w-xl mx-auto">
                  {deliveryMode === 'mom' ? (
                    <>
                      Hit the button. We&rsquo;ll email each message straight to{' '}
                      {contact.mom_nickname || contact.mom_name || 'Mom'} on May 8th, 9th, and 10th &mdash; and you&rsquo;ll get a copy.
                    </>
                  ) : (
                    <>
                      Hit the button. We&rsquo;ll email each message to you on the right morning.
                      You copy and text {contact.mom_nickname || contact.mom_name || 'mom'}. Done in 30 seconds a day.
                    </>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={!isReady || submitting}
                className="w-full min-h-[56px] bg-rose-600 text-white px-8 py-4 rounded-full text-base md:text-lg font-medium shadow-lg hover:shadow-xl hover:bg-rose-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
              >
                {submitting ? 'Setting up…' : 'Get My Messages →'}
              </button>
              <p className="mt-3 text-xs text-gray-700 text-center">
                {deliveryMode === 'mom'
                  ? <>We&rsquo;ll send the messages to {contact.mom_name || 'Mom'}, and you&rsquo;ll get a copy.</>
                  : 'No payment. No sign-up. We just need an email so we can send the messages to you.'}
              </p>
              {submitError ? (
                <p role="alert" className="mt-4 text-sm text-red-700 text-center">
                  {submitError}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Tip jar — whisper, share-only (they're about to get their messages) */}
          {messages ? <TipJar variant="whisper" showContribute={false} /> : null}
        </div>
      </main>
    </>
  );
}

// Per-row summary of the optional enhancements available on this preview.
// State-driven status updates as the buyer adds things, with each row acting
// as an open-and-scroll trigger for its corresponding section. Solves the
// "buyers don't scroll, so they never discover the optional sections" problem
// by surfacing every option above the fold as a single scannable list.
function SummaryCard(props: {
  deliveryMode: DeliveryMode;
  momEmail: string;
  photoCount: number;
  hasSong: boolean;
  hasVoice: boolean;
  hasNote: boolean;
  theme: ThemeKey;
  hasCustomHeadline: boolean;
  hasCustomSignoff: boolean;
  setPhotosOpen: (b: boolean) => void;
  setVoiceOpen: (b: boolean) => void;
  setCustomizeOpen: (b: boolean) => void;
}) {
  // Anchor click handler: optionally expand the target section, then scroll to
  // its id. Small setTimeout lets React commit the open-state before scroll so
  // the target lives at its post-expand position.
  function go(targetId: string, expand?: () => void) {
    if (expand) expand();
    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  const themeLabel =
    props.theme.charAt(0).toUpperCase() + props.theme.slice(1);
  const isDefaultCustomize =
    props.theme === 'rose' && !props.hasCustomHeadline && !props.hasCustomSignoff;

  const rows: Array<{
    label: string;
    status: string;
    done: boolean;
    onClick: () => void;
  }> = [
    {
      label: 'Delivery',
      status:
        props.deliveryMode === 'mom'
          ? 'To Mom, copy to you'
          : 'Emailed to you',
      done: props.deliveryMode === 'mom',
      onClick: () => go('delivery'),
    },
    {
      label: 'Photos',
      status: `${props.photoCount} of 2 added`,
      done: props.photoCount > 0,
      onClick: () => go('photos', () => props.setPhotosOpen(true)),
    },
    {
      label: 'Song',
      status: props.hasSong ? 'Added' : 'Not added',
      done: props.hasSong,
      onClick: () => go('song', () => props.setVoiceOpen(true)),
    },
    {
      label: 'Voice note',
      status: props.hasVoice ? 'Recorded' : 'Not recorded',
      done: props.hasVoice,
      onClick: () => go('voice', () => props.setVoiceOpen(true)),
    },
    {
      label: 'Personal note',
      status: props.hasNote ? 'Written' : 'Not written',
      done: props.hasNote,
      onClick: () => go('note', () => props.setVoiceOpen(true)),
    },
    {
      label: 'Customize the page',
      status: isDefaultCustomize ? 'Default theme' : `Custom: ${themeLabel}`,
      done: !isDefaultCustomize,
      onClick: () => go('customize', () => props.setCustomizeOpen(true)),
    },
  ];

  return (
    <section
      className="bg-rose-50 rounded-2xl p-6 md:p-8 mb-6"
      aria-label="Optional enhancements summary"
    >
      <h2 className="font-serif text-2xl text-gray-950 mb-1">Make it more personal</h2>
      <p className="text-sm text-gray-700 mb-5">All optional. Tap any to add.</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label}>
            <button
              type="button"
              onClick={r.onClick}
              className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3 py-3 -mx-3 rounded-xl hover:bg-white/60 focus:outline-2 focus:outline-rose-500 focus:outline-offset-2 transition-colors text-left"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden="true"
                  className={[
                    'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs flex-shrink-0',
                    r.done
                      ? 'bg-rose-600 text-white'
                      : 'border border-gray-300 text-transparent',
                  ].join(' ')}
                >
                  ✓
                </span>
                <span className="text-base text-gray-950 font-medium truncate">{r.label}</span>
              </span>
              <span
                className={[
                  'text-sm flex-shrink-0 truncate max-w-[55%] text-right',
                  r.done ? 'text-rose-700 font-medium' : 'text-gray-600',
                ].join(' ')}
              >
                {r.status}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
      />
    </div>
  );
}

function PhotoSection({
  open,
  setOpen,
  media,
  setMedia,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  media: MediaItem[];
  setMedia: React.Dispatch<React.SetStateAction<MediaItem[]>>;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photos = media.filter((m) => m.type === 'photo');
  const canAdd = photos.length < 2;

  async function onFile(rawFile: File) {
    if (!canAdd) return;
    setUploading(true);
    setError(null);
    try {
      const file = await maybeConvertHeic(rawFile);
      const presign = await fetch('/api/upload-presigned', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, day: 0 }),
      });
      const presignData = await presign.json();
      if (!presign.ok) throw new Error(presignData.error || 'presign failed');
      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('upload failed');
      setMedia((m) => [...m, { day: 0, type: 'photo', url: presignData.publicUrl }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  // Lazy-loads heic2any only when an HEIC file is detected. Lets non-HEIC
  // uploads stay on the fast path with no extra bundle weight.
  async function maybeConvertHeic(file: File): Promise<File> {
    const isHeic =
      /image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
    if (!isHeic) return file;
    const mod = await import('heic2any');
    const heic2any = (mod as { default: (opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]> }).default;
    const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    const blob = Array.isArray(result) ? result[0] : result;
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], newName.endsWith('.jpg') ? newName : newName + '.jpg', {
      type: 'image/jpeg',
    });
  }

  return (
    <div id="photos" className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 scroll-mt-8">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="photos-panel"
        className="w-full flex items-center justify-between p-6 md:p-8 text-left focus:outline-2 focus:outline-rose-500 focus:outline-offset-2 rounded-2xl"
      >
        <span className="font-medium text-gray-950">
          {open ? '▾' : '▸'} Add 2 photos (optional)
        </span>
        <span className="text-xs text-gray-700">
          {photos.length}/2 added · +2 min
        </span>
      </button>
      {open ? (
        <div id="photos-panel" className="px-6 md:px-8 pb-6 md:pb-8">
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            Pick up your phone. Open Photos. Search &ldquo;mom.&rdquo; Pick 2 you love. Upload them
            here. They show up on her forever page.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {photos.map((p, i) => (
              <figure
                key={`${p.url}-${i}`}
                className="relative bg-gray-50 rounded-xl overflow-hidden aspect-square"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={`Your uploaded photo ${i + 1} of you and your mom`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setMedia((m) => m.filter((x) => x.url !== p.url))}
                  className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-xs font-semibold focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
                  aria-label={`Remove photo ${i + 1}`}
                >
                  Remove
                </button>
              </figure>
            ))}
            {canAdd ? (
              <label
                className="aspect-square flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-rose-600 transition-colors focus-within:outline-2 focus-within:outline-rose-500 focus-within:outline-offset-2"
              >
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                    e.target.value = '';
                  }}
                  disabled={uploading}
                />
                <span className="text-sm font-medium text-rose-600">
                  {uploading ? 'Uploading…' : '+ Add photo'}
                </span>
              </label>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <p className="hidden md:block mt-3 text-xs text-gray-700">
            iPhone photos not working? Open the photo in Preview → File → Export → save as JPEG.
          </p>
        </div>
      ) : null}
    </div>
  );
}
