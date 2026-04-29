'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StepBreadcrumb, NextLine } from '../_components/StepBreadcrumb';

type Tier = 1 | 2 | 3;

// Soft gate: Days 1-2 always populated. Days 3-7 stay empty until payment.
type Messages = Partial<Record<`day_${1 | 2 | 3 | 4 | 5 | 6 | 7}`, string>>;

type MediaItem = {
  day: number;
  type: 'photo' | 'video' | 'audio' | 'youtube';
  url: string;
  caption?: string;
};

type ForeverData = {
  long_note: string;
  video_url: string;
};

type BuilderData = {
  tier: Tier;
  answers: Record<string, string>;
  contact: {
    user_name: string;
    user_email: string;
    mom_name: string;
    mom_email: string;
    delivery_time: string;
    delivery_timezone: string;
  };
  extraReminders?: boolean;
  wantsMedia: boolean;
  mediaDays: number[];
};

const DAY_DATES = ['May 4th', 'May 5th', 'May 6th', 'May 7th', 'May 8th', 'May 9th', 'May 10th'];

const DAY_THEMES = [
  'What she does for you',
  'Funny memory',
  'What she taught you',
  'Build on themes',
  'Emotional weight',
  'Anticipation',
  'Mother’s Day finale',
];

// Hash answers cheaply so saved /preview state is invalidated when the user
// changes their answers in the builder and comes back.
function hashAnswers(a: Record<string, string>): string {
  return [a.question_1, a.question_2, a.question_3, a.question_4]
    .map((s) => (s || '').slice(0, 60))
    .join('|');
}

const PREVIEW_STORAGE_KEY = 'previewData';

export default function PreviewPage() {
  const router = useRouter();
  const [data, setData] = useState<BuilderData | null>(null);
  const [messages, setMessages] = useState<Messages | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [foreverData, setForeverData] = useState<ForeverData>({ long_note: '', video_url: '' });
  const [submitting, setSubmitting] = useState(false);
  const [restored, setRestored] = useState(false);
  const generatedOnceRef = useRef(false);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('builderData') : null;
    if (!raw) {
      router.replace('/builder');
      return;
    }
    try {
      setData(JSON.parse(raw) as BuilderData);
    } catch {
      router.replace('/builder');
    }
  }, [router]);

  // Restore prior /preview state if the user is returning (mobile tab reaped, accidental refresh, etc).
  useEffect(() => {
    if (!data || restored) return;
    try {
      const saved = localStorage.getItem(PREVIEW_STORAGE_KEY);
      if (!saved) {
        setRestored(true);
        return;
      }
      const parsed = JSON.parse(saved);
      // Invalidate if the underlying builder answers changed.
      if (parsed.answersHash === hashAnswers(data.answers)) {
        if (parsed.messages) setMessages(parsed.messages);
        if (Array.isArray(parsed.media)) setMedia(parsed.media);
        if (parsed.foreverData) setForeverData(parsed.foreverData);
        if (parsed.messages) generatedOnceRef.current = true; // skip auto-regen
      }
    } catch {}
    setRestored(true);
  }, [data, restored]);

  useEffect(() => {
    if (!data || !restored || generatedOnceRef.current) return;
    generatedOnceRef.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, restored]);

  // Persist /preview edits as the user makes them.
  useEffect(() => {
    if (!data || !restored) return;
    try {
      localStorage.setItem(
        PREVIEW_STORAGE_KEY,
        JSON.stringify({
          answersHash: hashAnswers(data.answers),
          messages,
          media,
          foreverData,
        }),
      );
    } catch {}
  }, [data, restored, messages, media, foreverData]);

  async function generate() {
    if (!data) return;
    setGenerating(true);
    setError(null);
    try {
      const r = await fetch('/api/generate-messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data.answers, preview: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'generation failed');
      // API returns { day_1, day_2 } in preview mode. Days 3-7 are sealed
      // until payment — webhook generates them server-side.
      setMessages(j.messages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function setMessage(day: number, text: string) {
    if (!messages) return;
    setMessages({ ...messages, [`day_${day}` as keyof Messages]: text });
  }

  async function checkout() {
    if (!data || !messages) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tier: data.tier,
          contact: data.contact,
          answers: data.answers,
          messages,
          media,
          extra_reminders: !!data.extraReminders,
          forever_data: data.tier === 3 ? foreverData : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || 'checkout failed');
      window.location.href = j.url;
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  if (!data) return <div className="p-8 text-center text-gray-800">Loading…</div>;

  if (generating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">Writing your samples…</div>
          <p className="text-gray-600">~10 seconds. Don&rsquo;t close the tab.</p>
        </div>
      </div>
    );
  }

  if (error && !messages) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="text-2xl font-bold mb-2">Something broke.</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={generate} className="px-6 py-3 bg-blue-600 text-white rounded-lg">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!messages) return null;

  const totalMediaDays = data.tier >= 2 && data.wantsMedia ? data.mediaDays : [];
  const tierAmount = data.tier === 1 ? 19 : data.tier === 2 ? 29 : 39;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <StepBreadcrumb
          done="Answered all 5 questions"
          current="Your first 2 days — read and edit"
          next="pick a package and pay to unlock the other 5 (or close this tab — your edits are saved)"
        />
        <h1 className="text-3xl font-bold mb-2">Read the first 2. Then decide.</h1>
        <p className="text-gray-600 mb-1">
          Days 1 and 2 are yours to read free. If they sound right, the other 5 are coming. Don&rsquo;t like them? Don&rsquo;t pay.
        </p>
        <p className="text-xs text-gray-800 italic mb-1">Changes save automatically.</p>
        <p className="text-sm text-gray-800 mb-8">
          For: {data.contact.mom_name || 'mom'}
          {data.extraReminders ? ' · gentle 1pm nudges enabled' : ''}
        </p>

        {totalMediaDays.length > 0 ? (
          <div className="border-y border-rose-200 bg-rose-50/40 py-4 px-4 mb-6 rounded-lg">
            <p className="text-xs uppercase tracking-wide text-rose-700 font-semibold mb-2">
              Your media instructions
            </p>
            <ol className="space-y-1 text-sm text-gray-800">
              <li>1. Pick up your phone.</li>
              <li>2. Open Photos.</li>
              <li>3. Search &ldquo;mom&rdquo;</li>
              <li>4. Pick 2–3 you love.</li>
              <li>5. Upload them here.</li>
            </ol>
          </div>
        ) : null}

        <div className="space-y-4 mb-12">
          {([1, 2] as const).map((day) => {
            const text = messages[`day_${day}`] || '';
            return (
              <div
                key={day}
                className="bg-white rounded-2xl border-2 border-rose-200 p-5 shadow-sm"
              >
                <div className="flex justify-between items-baseline mb-3">
                  <div>
                    <div className="text-xs text-rose-700 uppercase tracking-widest font-semibold">
                      Day {day} · {DAY_DATES[day - 1]} · sample
                    </div>
                    <div className="text-sm font-semibold mt-1">{DAY_THEMES[day - 1]}</div>
                  </div>
                  <div className="text-xs text-gray-700">{text.length} chars</div>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setMessage(day, e.target.value)}
                  className="w-full p-3 border rounded font-serif text-base leading-relaxed bg-gray-50 focus:bg-white focus:border-rose-400"
                  rows={4}
                />
                {totalMediaDays.includes(day) ? (
                  <MediaUploader
                    day={day}
                    current={media.filter((m) => m.day === day)}
                    onAdd={(item) => setMedia((prev) => [...prev, item])}
                    onRemove={(idx) =>
                      setMedia((prev) => {
                        const dayItems = prev.filter((m) => m.day === day);
                        const target = dayItems[idx];
                        return prev.filter((m) => m !== target);
                      })
                    }
                  />
                ) : null}
              </div>
            );
          })}

          {/* Locked Days 3-7 */}
          <div className="pt-4 pb-2">
            <div className="text-center text-xs uppercase tracking-widest text-gray-800 mb-3">
              🔒 The other 5 unlock after you pay
            </div>
          </div>

          {([3, 4, 5, 6, 7] as const).map((day) => {
            const isMediaDay = totalMediaDays.includes(day);
            return (
              <div
                key={day}
                className="bg-white/60 rounded-2xl border border-gray-200 p-5 relative overflow-hidden"
              >
                <div className="flex justify-between items-baseline">
                  <div>
                    <div className="text-xs text-gray-800 uppercase tracking-wide">
                      Day {day} · {DAY_DATES[day - 1]}
                      {day === 7 ? ' · Mother’s Day' : ''}
                    </div>
                    <div className="text-sm font-semibold mt-1 text-gray-600">
                      {DAY_THEMES[day - 1]}
                    </div>
                  </div>
                  <div className="text-gray-700">🔒</div>
                </div>
                <p
                  className="font-serif text-base leading-relaxed text-gray-600 mt-3 select-none"
                  style={{ filter: 'blur(4px)', userSelect: 'none' }}
                  aria-hidden
                >
                  Day {day} is written and waiting. Same voice as Day 1 and Day 2 —
                  AI pulled from the rest of your answers. Unlocks the moment you pay.
                </p>
                {isMediaDay ? (
                  <p className="text-xs text-rose-700 mt-3 italic">
                    📎 You picked this day for media — you&rsquo;ll upload after paying.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {data.tier === 3 ? (
          <ForeverSetup data={foreverData} setData={setForeverData} />
        ) : null}

        <SaveMyWorkBanner data={data} messages={messages} media={media} foreverData={foreverData} />

        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-4 text-sm text-rose-900">
          <p className="font-semibold mb-2">After you pay:</p>
          <ul className="space-y-1 text-xs">
            <li>• We email <strong>YOU</strong> daily May 4th–10th at {data.contact.delivery_time || '8:00'}</li>
            <li>• You copy the message</li>
            <li>• You text or email it to your mom — your choice</li>
            <li>• Takes ~30 seconds per day</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border-2 border-rose-500 p-6 mb-6 shadow-md">
          <div className="flex justify-between items-baseline mb-2">
            <div>
              <div className="text-sm text-gray-700 font-semibold">Like them? Unlock the other 5.</div>
              <div className="text-xs text-gray-800">Edit until May 3rd. Refunds if it sucks.</div>
            </div>
            <div className="text-3xl font-bold">${tierAmount}</div>
          </div>
          {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
          <button
            onClick={checkout}
            disabled={submitting}
            className="w-full bg-rose-500 text-white py-4 rounded-xl text-lg font-semibold hover:bg-rose-600 disabled:bg-gray-300 mt-4 shadow-sm"
          >
            {submitting ? 'Loading…' : `Unlock all 7 — Pay $${tierAmount} →`}
          </button>
          <button
            onClick={() => router.push(`/builder?tier=${data.tier}`)}
            className="w-full mt-2 text-sm text-gray-600 underline"
          >
            ← Edit Question Answers
          </button>
        </div>

        <NextLine text="confirmation email, then nothing until May 4th at 8am" />
      </div>
    </div>
  );
}

function SaveMyWorkBanner(props: {
  data: BuilderData;
  messages: Messages | null;
  media: MediaItem[];
  foreverData: ForeverData;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(props.data.contact.user_email || '');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Need a real email to send the link to');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/save-progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          tier: props.data.tier,
          contact: props.data.contact,
          answers: props.data.answers,
          extra_reminders: !!props.data.extraReminders,
          wantsMedia: props.data.wantsMedia,
          mediaDays: props.data.mediaDays,
          messages: props.messages || {},
          media: props.media,
          forever_data: props.foreverData,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'send failed');
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 mb-6 text-center">
        <p className="font-serif text-xl text-gray-900 mb-1">Check your inbox.</p>
        <p className="text-sm text-gray-700">
          Your workspace link just landed at <strong>{email}</strong>. Open it from anywhere — phone, laptop, your work computer at lunch.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <p className="font-serif text-lg text-gray-900">
          I&rsquo;m not crying. You&rsquo;re crying.
        </p>
        {!open ? (
          <button onClick={() => setOpen(true)} className="text-xs underline text-rose-700">
            email me my workspace →
          </button>
        ) : null}
      </div>
      <p className="text-sm text-gray-700 mb-3">
        Want to come back later to add photos, swap a video in, or bump up to a bigger package?
        Drop your email and we&rsquo;ll send you the link to your workspace. It lives forever.
        Open it from any device.
      </p>
      {open ? (
        <div className="space-y-2 mt-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white text-base"
          />
          <button
            onClick={send}
            disabled={submitting}
            className="w-full bg-rose-500 text-white py-3 rounded-xl font-semibold hover:bg-rose-600 disabled:bg-gray-300"
          >
            {submitting ? 'Sending…' : 'Send me the link →'}
          </button>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <p className="text-xs text-gray-800 italic">
            We won&rsquo;t spam you. One email with one link. That&rsquo;s it.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ForeverSetup(props: {
  data: ForeverData;
  setData: (d: ForeverData) => void;
}) {
  const [showNote, setShowNote] = useState<boolean>(props.data.long_note.length > 0);
  const [showVideo, setShowVideo] = useState<boolean>(props.data.video_url.length > 0);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const noteLen = props.data.long_note.length;

  async function handleVideo(file: File) {
    if (file.size > 200 * 1024 * 1024) {
      setUploadError('Video too big — max ~200 MB');
      return;
    }
    setUploadingVideo(true);
    setUploadError(null);
    try {
      const r = await fetch('/api/upload-presigned', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ day: 0, contentType: file.type, filename: file.name }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'upload prepare failed');
      const put = await fetch(j.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`upload failed (${put.status})`);
      props.setData({ ...props.data, video_url: j.publicUrl });
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploadingVideo(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-rose-200 p-5 md:p-6 mb-6">
      <h2 className="font-serif text-2xl mb-2 text-gray-900">Your Forever Page</h2>
      <p className="text-gray-600 text-sm mb-6">
        After May 4th, mom gets a private webpage with all 7 messages, your photos,
        an AI-written letter, and your video. Two optional extras to make it hers:
      </p>

      <div className="space-y-5">
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <div className="text-sm font-semibold">📝 A longer note (optional)</div>
            {!showNote ? (
              <button onClick={() => setShowNote(true)} className="text-xs underline text-rose-700">
                add a note →
              </button>
            ) : (
              <span className={`text-xs ${noteLen > 500 ? 'text-red-600' : 'text-gray-800'}`}>
                {noteLen}/500
              </span>
            )}
          </div>
          {showNote ? (
            <>
              <textarea
                value={props.data.long_note}
                onChange={(e) => props.setData({ ...props.data, long_note: e.target.value.slice(0, 500) })}
                placeholder="Anything you want her to read in your own words. We'll weave it into the AI letter. Skip and AI writes it all."
                rows={4}
                className="w-full p-3 border rounded-xl font-serif text-base bg-gray-50 focus:bg-white focus:border-rose-400"
              />
              <button
                onClick={() => { props.setData({ ...props.data, long_note: '' }); setShowNote(false); }}
                className="text-xs underline text-gray-800 mt-1"
              >
                skip — let AI write the whole letter
              </button>
            </>
          ) : (
            <p className="text-xs text-gray-800 italic">
              Skip if you want AI to write it all. Adding a note makes it more &ldquo;you.&rdquo;
            </p>
          )}
        </div>

        <hr />

        <div>
          <div className="flex justify-between items-baseline mb-2">
            <div className="text-sm font-semibold">🎥 A video message (optional, up to 2 minutes)</div>
            {!showVideo ? (
              <button onClick={() => setShowVideo(true)} className="text-xs underline text-rose-700">
                add a video →
              </button>
            ) : null}
          </div>
          {showVideo ? (
            props.data.video_url ? (
              <div className="bg-gray-50 rounded-lg p-3 text-sm flex items-center gap-3">
                <span className="text-green-700">✓ video uploaded</span>
                <span className="text-gray-800 truncate flex-1">{props.data.video_url}</span>
                <button
                  onClick={() => props.setData({ ...props.data, video_url: '' })}
                  className="text-xs text-red-600 underline"
                >
                  remove
                </button>
              </div>
            ) : (
              <>
                <label
                  htmlFor="forever-video"
                  className="block w-full bg-rose-500 text-white text-center py-4 rounded-xl font-semibold text-base cursor-pointer hover:bg-rose-600 transition shadow-sm"
                >
                  {uploadingVideo ? 'Uploading…' : 'Pick a video →'}
                </label>
                <input
                  id="forever-video"
                  type="file"
                  accept="video/mp4,video/quicktime"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleVideo(f);
                  }}
                  className="sr-only"
                />
                <p className="text-xs text-gray-800 mt-2">
                  Record on your phone. Lands at the bottom of her page. MP4/MOV, ~200 MB max.
                </p>
                {uploadError ? <p className="text-xs text-red-600 mt-1">{uploadError}</p> : null}
                <button
                  onClick={() => { props.setData({ ...props.data, video_url: '' }); setShowVideo(false); }}
                  className="text-xs underline text-gray-800 mt-2"
                >
                  skip — page works fine without one
                </button>
              </>
            )
          ) : (
            <p className="text-xs text-gray-800 italic">
              Skip if you don&rsquo;t want to be on camera. The page is still beautiful.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaUploader(props: {
  day: number;
  current: MediaItem[];
  onAdd: (m: MediaItem) => void;
  onRemove: (idx: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedType, setPickedType] = useState<'photo' | 'video' | 'audio' | 'youtube' | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!pickedType || pickedType === 'youtube') return;
    setUploading(true);
    setUploadError(null);
    try {
      const r = await fetch('/api/upload-presigned', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ day: props.day, contentType: file.type, filename: file.name }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'upload prepare failed');
      const put = await fetch(j.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`upload failed (${put.status})`);
      props.onAdd({ day: props.day, type: pickedType, url: j.publicUrl });
      setPickedType(null);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="text-xs uppercase tracking-wide text-gray-800 mb-2">Media for this day</div>
      {props.current.length ? (
        <div className="space-y-2 mb-3">
          {props.current.map((m, idx) => (
            <div
              key={`${m.url}-${idx}`}
              className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm"
            >
              <span className="capitalize text-gray-700">{m.type}</span>
              <span className="text-gray-800 truncate flex-1">{m.url}</span>
              <button onClick={() => props.onRemove(idx)} className="text-red-600 text-xs">remove</button>
            </div>
          ))}
        </div>
      ) : null}

      {pickedType === null ? (
        <div className="flex flex-wrap gap-2">
          <SmallBtn onClick={() => setPickedType('photo')}>📸 Photo</SmallBtn>
          <SmallBtn onClick={() => setPickedType('video')}>🎥 Video</SmallBtn>
          <SmallBtn onClick={() => setPickedType('audio')}>🎙️ Audio</SmallBtn>
          <SmallBtn onClick={() => setPickedType('youtube')}>▶ YouTube link</SmallBtn>
        </div>
      ) : pickedType === 'youtube' ? (
        <div className="space-y-2">
          <input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full p-3 border rounded text-base"
          />
          <div className="flex gap-2">
            <SmallBtn
              onClick={() => {
                if (!/youtu/.test(youtubeUrl)) {
                  setUploadError('Not a YouTube URL');
                  return;
                }
                props.onAdd({ day: props.day, type: 'youtube', url: youtubeUrl });
                setYoutubeUrl('');
                setPickedType(null);
              }}
            >
              Add
            </SmallBtn>
            <SmallBtn onClick={() => setPickedType(null)}>cancel</SmallBtn>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label
            htmlFor={`file-${props.day}`}
            className="block w-full bg-rose-500 text-white text-center py-4 rounded-xl font-semibold text-base cursor-pointer hover:bg-rose-600 transition shadow-sm"
          >
            {uploading ? 'Uploading…' : `Pick a ${pickedType} →`}
          </label>
          <input
            id={`file-${props.day}`}
            ref={fileInputRef}
            type="file"
            accept={accept(pickedType)}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="sr-only"
          />
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 space-y-1.5">
            <div><strong>📱 On phone:</strong> Tap the button. Pick from Camera Roll / Photos.</div>
            <div><strong>💻 On Mac:</strong> Click the button. Select from Photos app or Finder.</div>
            <div><strong>🖥️ On PC:</strong> Click the button. Pick from your Pictures folder.</div>
            <div className="pt-1 italic text-gray-600">
              Can&rsquo;t find a {pickedType}? Text someone to send you a few, save them, then come back.
            </div>
          </div>
          <div className="text-xs text-gray-800">
            {pickedType === 'photo'
              ? 'JPG / PNG / GIF up to 10 MB'
              : pickedType === 'video'
                ? 'MP4 / MOV up to 100 MB'
                : 'MP3 / M4A up to 10 MB'}
          </div>
          {pickedType === 'video' ? (
            <p className="text-xs text-gray-600 italic">
              💡 Tip: if you&rsquo;re recording multiple days, change your shirt between recordings. She&rsquo;ll never know.
            </p>
          ) : null}
          {uploading ? <div className="text-sm text-rose-700 font-semibold">Uploading… don&rsquo;t close the tab.</div> : null}
          <button
            onClick={() => setPickedType(null)}
            className="text-xs text-gray-600 underline"
          >
            cancel — pick a different type
          </button>
        </div>
      )}
      {uploadError ? <p className="text-xs text-red-600 mt-2">{uploadError}</p> : null}
    </div>
  );
}

// HuntSetup removed — Tier 3 is now the Forever Page (see ForeverSetup above).

function SmallBtn(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className="px-3 py-2 text-sm border rounded hover:bg-gray-50 bg-white"
    >
      {props.children}
    </button>
  );
}

function accept(t: 'photo' | 'video' | 'audio'): string {
  if (t === 'photo') return 'image/jpeg,image/png,image/gif,image/webp';
  if (t === 'video') return 'video/mp4,video/quicktime';
  return 'audio/mpeg,audio/mp4,audio/x-m4a,audio/wav';
}
