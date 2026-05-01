'use client';

// Edit-mode UI for adding extra photos + captions + a Mother's Day photo.
// Renders only when /forever/{id}?edit=true. Uploads via the existing
// presigned-url flow, then PATCHes the order's forever_data via /api/forever-update.

import { useEffect, useRef, useState } from 'react';

type Extra = { url: string };
type MothersDayPhoto = { url: string; caption?: string };

type Props = {
  orderId: string;
  initialExtras: Extra[];
  initialCaptions: Record<string, string>;
  initialMothersDayPhoto: MothersDayPhoto | null;
  accent: string; // theme accent color
};

const MAX_EXTRAS = 6;
const MAX_CAPTION = 160;

async function maybeConvertHeic(file: File): Promise<File> {
  const isHeic =
    /image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic) return file;
  const mod = await import('heic2any');
  const heic2any = (
    mod as { default: (opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]> }
  ).default;
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const blob = Array.isArray(result) ? result[0] : result;
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([blob], newName.endsWith('.jpg') ? newName : `${newName}.jpg`, {
    type: 'image/jpeg',
  });
}

async function uploadOnePhoto(rawFile: File): Promise<string> {
  const file = await maybeConvertHeic(rawFile);
  const presign = await fetch('/api/upload-presigned', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, day: 0 }),
  });
  const presignData = await presign.json();
  if (!presign.ok) throw new Error(presignData.error || 'presign failed');
  const put = await fetch(presignData.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
  if (!put.ok) throw new Error('upload failed');
  return presignData.publicUrl as string;
}

export default function ExtraMediaEditor({
  orderId,
  initialExtras,
  initialCaptions,
  initialMothersDayPhoto,
  accent,
}: Props) {
  const [extras, setExtras] = useState<Extra[]>(initialExtras);
  const [captions, setCaptions] = useState<Record<string, string>>(initialCaptions);
  const [mdPhoto, setMdPhoto] = useState<MothersDayPhoto | null>(initialMothersDayPhoto);
  const [uploading, setUploading] = useState<'extra' | 'mothers' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingFlash, setSavingFlash] = useState(false);
  const captionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function pushUpdate(payload: Record<string, unknown>) {
    setSavingFlash(true);
    try {
      const r = await fetch('/api/forever-update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, ...payload }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || 'save failed');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTimeout(() => setSavingFlash(false), 600);
    }
  }

  async function onExtraFile(file: File) {
    if (extras.length >= MAX_EXTRAS) return;
    setUploading('extra');
    setError(null);
    try {
      const url = await uploadOnePhoto(file);
      const newExtras = [...extras, { url }];
      setExtras(newExtras);
      await pushUpdate({ extra_media: newExtras });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  async function removeExtra(index: number) {
    const newExtras = extras.filter((_, i) => i !== index);
    // Re-index captions (keys are positional)
    const newCaptions: Record<string, string> = {};
    Object.entries(captions).forEach(([k, v]) => {
      const i = Number(k);
      if (i < index) newCaptions[k] = v;
      else if (i > index) newCaptions[String(i - 1)] = v;
    });
    setExtras(newExtras);
    setCaptions(newCaptions);
    await pushUpdate({ extra_media: newExtras, captions: newCaptions });
  }

  function setCaption(index: number, value: string) {
    const v = value.slice(0, MAX_CAPTION);
    const next = { ...captions, [String(index)]: v };
    setCaptions(next);
    if (captionDebounceRef.current) clearTimeout(captionDebounceRef.current);
    captionDebounceRef.current = setTimeout(() => {
      pushUpdate({ captions: next });
    }, 600);
  }

  async function onMothersDayFile(file: File) {
    setUploading('mothers');
    setError(null);
    try {
      const url = await uploadOnePhoto(file);
      const photo: MothersDayPhoto = { url, caption: mdPhoto?.caption || 'Mother’s Day 2026' };
      setMdPhoto(photo);
      await pushUpdate({ mothers_day_photo: photo });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  function setMdCaption(value: string) {
    if (!mdPhoto) return;
    const next = { ...mdPhoto, caption: value.slice(0, MAX_CAPTION) };
    setMdPhoto(next);
    if (captionDebounceRef.current) clearTimeout(captionDebounceRef.current);
    captionDebounceRef.current = setTimeout(() => {
      pushUpdate({ mothers_day_photo: next });
    }, 600);
  }

  async function removeMothersDay() {
    setMdPhoto(null);
    await pushUpdate({ mothers_day_photo: null });
  }

  // Visible empty slots for adding more extras (up to MAX_EXTRAS total).
  const remainingSlots = Math.max(0, MAX_EXTRAS - extras.length);
  const slotsToShow = Math.min(remainingSlots, 3);

  return (
    <section className="px-6 py-12 max-w-2xl mx-auto" aria-label="Add more photos">
      <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
        <p className="text-base text-gray-800 leading-relaxed mb-1">
          <span className="font-medium text-gray-950">Want to add more?</span> You can come back anytime.
        </p>
        {savingFlash ? (
          <p className="mt-1 text-xs" aria-live="polite" style={{ color: accent }}>
            ✓ Saved
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {extras.map((extra, i) => (
            <figure key={extra.url} className="space-y-2">
              <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={extra.url}
                  alt={captions[String(i)] || `Extra photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeExtra(i)}
                  aria-label={`Remove extra photo ${i + 1}`}
                  className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-xs font-semibold focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
                >
                  Remove
                </button>
              </div>
              <label className="sr-only" htmlFor={`caption-${i}`}>
                Caption for photo {i + 1}
              </label>
              <input
                id={`caption-${i}`}
                type="text"
                value={captions[String(i)] || ''}
                onChange={(e) => setCaption(i, e.target.value)}
                maxLength={MAX_CAPTION}
                placeholder="Add a caption (optional)"
                className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
              />
            </figure>
          ))}

          {Array.from({ length: slotsToShow }).map((_, k) => (
            <label
              key={`slot-${k}`}
              className="aspect-square flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-rose-600 transition-colors focus-within:outline-2 focus-within:outline-rose-500 focus-within:outline-offset-2 min-h-[44px]"
            >
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className="sr-only"
                disabled={uploading !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onExtraFile(f);
                  e.target.value = '';
                }}
              />
              <span className="text-xs font-medium text-gray-700">
                {uploading === 'extra' && k === 0 ? 'Uploading…' : '+ Add photo'}
              </span>
            </label>
          ))}
        </div>

        {/* Mother's Day photo — separate slot, slightly larger, solid border */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-base text-gray-800 leading-relaxed mb-3">
            <span className="font-medium text-gray-950">
              Add a photo from Mother&rsquo;s Day — if you want.
            </span>{' '}
            It&rsquo;s a nice way to finish the page.
          </p>
          {mdPhoto ? (
            <figure className="space-y-2">
              <div className="relative rounded-xl overflow-hidden bg-gray-50 shadow-md aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mdPhoto.url}
                  alt={mdPhoto.caption || "A photo from Mother's Day"}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeMothersDay}
                  aria-label="Remove Mother's Day photo"
                  className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-xs font-semibold focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
                >
                  Remove
                </button>
              </div>
              <label htmlFor="md-caption" className="sr-only">
                Mother&rsquo;s Day photo caption
              </label>
              <input
                id="md-caption"
                type="text"
                value={mdPhoto.caption || ''}
                onChange={(e) => setMdCaption(e.target.value)}
                maxLength={MAX_CAPTION}
                placeholder="Mother's Day 2026"
                className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
              />
            </figure>
          ) : (
            <label className="block aspect-[4/3] flex items-center justify-center border-2 border-solid border-gray-300 rounded-xl cursor-pointer hover:border-rose-600 transition-colors focus-within:outline-2 focus-within:outline-rose-500 focus-within:outline-offset-2 min-h-[44px]">
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className="sr-only"
                disabled={uploading !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onMothersDayFile(f);
                  e.target.value = '';
                }}
              />
              <span className="text-sm font-medium text-gray-700">
                {uploading === 'mothers' ? 'Uploading…' : '+ Add a Mother’s Day photo'}
              </span>
            </label>
          )}
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
