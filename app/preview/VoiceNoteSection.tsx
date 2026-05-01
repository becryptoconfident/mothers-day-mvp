'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  audioUrl: string;
  note: string;
  songUrl: string;
  setAudioUrl: (s: string) => void;
  setNote: (s: string) => void;
  setSongUrl: (s: string) => void;
};

const MAX_NOTE = 200;
const MAX_RECORD_SECONDS = 30;

// Optional voice-note OR text-note for the forever page. Both equal — pick
// either, both, or neither. Recording uses MediaRecorder; the audio uploads to
// the same /api/upload-presigned R2 path as photos (audio mime types are allowed).
export default function VoiceNoteSection({
  audioUrl,
  note,
  songUrl,
  setAudioUrl,
  setNote,
  setSongUrl,
}: Props) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      try {
        recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Your browser doesn't support recording. You can write a note instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {}
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
        await uploadAudio(blob);
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      tickRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
      stopTimerRef.current = setTimeout(() => stopRecording(), MAX_RECORD_SECONDS * 1000);
    } catch (e) {
      setError(
        (e as Error).name === 'NotAllowedError'
          ? 'Microphone access blocked. You can write a note instead.'
          : (e as Error).message,
      );
    }
  }

  function stopRecording() {
    setRecording(false);
    if (tickRef.current) clearInterval(tickRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    try {
      recorderRef.current?.stop();
    } catch {}
  }

  async function uploadAudio(blob: Blob) {
    setUploading(true);
    setError(null);
    try {
      // MediaRecorder reports mime as "audio/webm;codecs=opus". S3 presigns
      // sign the exact ContentType, so we strip codec on both ends so
      // signature and PUT header match. R2 stores the base type.
      const guessedType = blob.type || 'audio/webm';
      const fullType = guessedType.startsWith('audio/') ? guessedType : 'audio/webm';
      const baseContentType = fullType.split(';')[0].trim().toLowerCase();
      const presign = await fetch('/api/upload-presigned', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contentType: baseContentType, day: 0 }),
      });
      const data = await presign.json();
      if (!presign.ok) throw new Error(data.error || 'presign failed');
      const put = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': baseContentType },
        body: blob,
      });
      if (!put.ok) throw new Error('upload failed');
      setAudioUrl(data.publicUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="voice-note-panel"
        className="w-full flex items-center justify-between p-6 md:p-8 text-left focus:outline-2 focus:outline-rose-500 focus:outline-offset-2 rounded-2xl"
      >
        <span className="font-medium text-gray-950">
          {open ? '▾' : '▸'} Add music or a message for her (optional)
        </span>
        <span className="text-xs text-gray-700">
          {[songUrl ? '♫' : null, audioUrl ? '🎤' : null, note.trim() ? '✍️' : null]
            .filter(Boolean)
            .join(' ') || '+1 min'}
        </span>
      </button>
      {open ? (
        <div id="voice-note-panel" className="px-6 md:px-8 pb-6 md:pb-8">
          <p className="text-base text-gray-800 leading-relaxed mb-5">
            Pick a song that reminds you of her — or leave her something in your voice — or type a note she can read.
            Whatever feels right.
          </p>

          {/* Song option */}
          <div className="bg-gray-50 rounded-xl p-5 mb-4">
            <p className="font-medium text-gray-950 mb-1">
              <span aria-hidden="true">♫ </span>Pick a song that reminds you of her
            </p>
            <p className="text-sm text-gray-700 mb-3 leading-relaxed">
              Paste a YouTube or Spotify link.
            </p>
            <label htmlFor="song-url" className="sr-only">
              Song URL
            </label>
            <input
              id="song-url"
              type="url"
              value={songUrl}
              onChange={(e) => setSongUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=… or https://open.spotify.com/track/…"
              className="w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
            />
          </div>

          {/* Voice option */}
          <div className="bg-gray-50 rounded-xl p-5 mb-4">
            <p className="font-medium text-gray-950 mb-1">
              <span aria-hidden="true">🎤 </span>Record (30 seconds max)
            </p>
            <p className="text-sm text-gray-700 mb-4 leading-relaxed">
              Just say hi. Say I love you. Whatever comes out. No one hears this except your mom. It doesn&rsquo;t have to be perfect.
            </p>
            {audioUrl ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio controls src={audioUrl} className="w-full" />
                <button
                  type="button"
                  onClick={() => setAudioUrl('')}
                  className="text-sm text-rose-600 hover:text-rose-700 font-medium"
                >
                  Re-record
                </button>
              </div>
            ) : recording ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-full bg-red-600 text-white text-sm font-medium ring-2 ring-red-300 motion-safe:animate-pulse focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
                >
                  ⏹ Stop ({Math.max(0, MAX_RECORD_SECONDS - seconds)}s left)
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={uploading}
                className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-rose-600 hover:text-rose-600 transition-colors disabled:opacity-50 focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
              >
                {uploading ? 'Uploading…' : '🎤 Tap to start'}
              </button>
            )}
            <p className="mt-3 text-xs text-gray-700 italic">
              Tap to start. Tap again to stop.
            </p>
          </div>

          {/* Text option */}
          <div className="bg-gray-50 rounded-xl p-5">
            <p className="font-medium text-gray-950 mb-1">
              <span aria-hidden="true">✍️ </span>Or write a note instead
            </p>
            <p className="text-sm text-gray-700 mb-3 leading-relaxed">
              Whatever feels right.
            </p>
            <label htmlFor="personal-note" className="sr-only">
              Personal note
            </label>
            <textarea
              id="personal-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
              rows={4}
              maxLength={MAX_NOTE}
              placeholder="A line or two from you to her."
              className="w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none resize-none"
            />
            <p className="mt-2 text-xs text-gray-700" aria-live="polite">
              {note.trim().length}/{MAX_NOTE}
            </p>
          </div>

          <p className="mt-5 text-sm text-gray-700 leading-relaxed">
            Everything shows up on her forever page. Skip all of this if you want — the page is already great without it.
          </p>

          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
