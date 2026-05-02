'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  // Current textarea value. Used so transcripts append rather than overwrite.
  currentValue: string;
  // Called with the full new value (existing + transcript).
  onTranscript: (text: string) => void;
  // Friendly language name from the selector ("English", "Spanish", etc.)
  language?: string;
  disabled?: boolean;
};

const LOCALE_MAP: Record<string, string> = {
  English: 'en-US',
  Spanish: 'es-ES',
  French: 'fr-FR',
  'Mandarin Chinese': 'zh-CN',
  Korean: 'ko-KR',
  Vietnamese: 'vi-VN',
  Tagalog: 'tl-PH',
  Arabic: 'ar-SA',
  Portuguese: 'pt-BR',
  Hindi: 'hi-IN',
  Japanese: 'ja-JP',
  German: 'de-DE',
  Italian: 'it-IT',
  Russian: 'ru-RU',
};

function getLocale(language?: string): string {
  if (!language) return 'en-US';
  return LOCALE_MAP[language] || 'en-US';
}

// Web Speech API has a quirk on Chrome where it auto-stops after a short
// silence even with continuous=true. We give the user the full 30 seconds by
// auto-restarting recognition on onend until either:
//   - 30 seconds have elapsed (max session)
//   - The user manually taps stop
// Across restarts we promote the latest interim transcript into the baseline
// so nothing the user said gets lost when the API resets its result buffer.
const MAX_SESSION_MS = 30_000;

type RecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type RecognitionErrorEvent = { error?: string };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export default function VoiceInput({ currentValue, onTranscript, language, disabled }: Props) {
  const [supported, setSupported] = useState<boolean>(true);
  const [listening, setListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  // Text already in the textarea when the user tapped record. Anything
  // transcribed during the session gets concatenated onto this baseline.
  const baselineRef = useRef<string>('');
  // Captures the most recent interim transcript so we can promote it into
  // the baseline if the API auto-stops mid-session.
  const interimRef = useRef<string>('');
  // Whether the user explicitly stopped (true) vs API auto-stopped (false).
  const manualStopRef = useRef<boolean>(false);
  // Session-wide hard-stop timer.
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest onTranscript held in a ref so the parent's inline arrow doesn't
  // churn the recognition lifecycle and fire spurious 'aborted' errors.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });
  // True when an abort was triggered by us (cleanup) — swallow that error.
  const internalAbortRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getLocale(language);

    recognition.onresult = (event) => {
      let transcript = '';
      const results = event.results;
      for (let i = 0; i < results.length; i++) {
        const alt = results[i]?.[0];
        if (alt?.transcript) transcript += alt.transcript;
      }
      interimRef.current = transcript;
      const baseline = baselineRef.current;
      const joiner = baseline && !baseline.endsWith(' ') ? ' ' : '';
      onTranscriptRef.current(baseline ? baseline + joiner + transcript : transcript);
    };

    recognition.onerror = (e) => {
      const code = e.error || '';
      // If we caused the abort (cleanup, language change, restart), swallow it.
      if (code === 'aborted' && internalAbortRef.current) {
        internalAbortRef.current = false;
        return;
      }
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setErrorMsg("Microphone access blocked. You can type instead.");
      } else if (code === 'no-speech') {
        // benign — user didn't speak yet; the auto-restart in onend handles it
        return;
      } else if (code === 'audio-capture') {
        setErrorMsg('No microphone detected. You can type instead.');
      } else if (code === 'network') {
        setErrorMsg('Network issue with speech service. Try again.');
      } else if (code) {
        setErrorMsg(`Mic error: ${code}. You can type instead.`);
      }
      manualStopRef.current = true;
      setListening(false);
    };

    recognition.onend = () => {
      // Decide: did the user stop, did we time out, or did the API auto-stop?
      if (manualStopRef.current) {
        // Final stop — clean up.
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
        manualStopRef.current = false;
        interimRef.current = '';
        setListening(false);
        return;
      }
      // API auto-stopped (silence or other). Promote the latest interim
      // transcript into the baseline so the next session continues from there,
      // and restart recognition.
      const carry = interimRef.current;
      if (carry) {
        const baseline = baselineRef.current;
        const joiner = baseline && !baseline.endsWith(' ') ? ' ' : '';
        baselineRef.current = baseline ? baseline + joiner + carry : carry;
      }
      interimRef.current = '';
      try {
        recognition.start();
      } catch {
        // Couldn't restart — fall through to fully stopped.
        setListening(false);
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    return () => {
      internalAbortRef.current = true;
      try {
        recognition.abort();
      } catch {}
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      recognitionRef.current = null;
    };
  }, [language]);

  const start = () => {
    const r = recognitionRef.current;
    if (!r) return;
    setErrorMsg(null);
    baselineRef.current = currentValue;
    interimRef.current = '';
    manualStopRef.current = false;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      // 30s hard cap — gracefully stop. The onend handler will run, see
      // manualStopRef=true, and finalize.
      manualStopRef.current = true;
      try {
        r.stop();
      } catch {}
    }, MAX_SESSION_MS);
    try {
      r.start();
      setListening(true);
    } catch {
      // Already started or browser refused — try again on next click.
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  };

  const stop = () => {
    const r = recognitionRef.current;
    if (!r) return;
    manualStopRef.current = true;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    try {
      r.stop();
    } catch {}
    setListening(false);
  };

  const toggle = () => (listening ? stop() : start());

  if (!supported) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? 'Stop recording' : 'Start recording — speak your answer (30 seconds)'}
        className={[
          'p-3 rounded-full min-w-[44px] min-h-[44px] transition-colors',
          listening
            ? 'bg-red-100 text-red-600 ring-2 ring-red-400 motion-safe:animate-pulse'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          'focus:outline-2 focus:outline-rose-500 focus:outline-offset-2',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {listening ? '⏹' : '🎤'}
      </button>
      {/* Screen-reader announcements for state changes */}
      <span aria-live="assertive" className="sr-only">
        {listening ? 'Recording. Speak your answer. 30 seconds max.' : ''}
      </span>
      <span aria-live="polite" className="sr-only">
        {!listening && errorMsg ? errorMsg : ''}
      </span>
      {listening ? (
        <p className="text-xs text-red-700">Recording…</p>
      ) : errorMsg ? (
        <p className="text-xs text-red-700 max-w-[200px] text-right">{errorMsg}</p>
      ) : null}
    </div>
  );
}
