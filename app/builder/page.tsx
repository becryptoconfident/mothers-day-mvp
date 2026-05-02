'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StepBreadcrumb } from '../_components/StepBreadcrumb';
import VoiceInput from '../_components/VoiceInput';
import TipJar from '../_components/TipJar';

type Step = 'language' | 'names' | 'q1' | 'q2' | 'q3' | 'q4';

const STORAGE_KEY = 'mdmvp_builder_v3';

const QUESTIONS: Array<{
  key: 'question_1' | 'question_2' | 'question_3' | 'question_4';
  step: Step;
  ordinal: string;
  title: string;
  text: string;
  placeholder: string;
}> = [
  {
    key: 'question_1',
    step: 'q1',
    ordinal: '1 of 4',
    title: 'The memory',
    text: "What's a specific moment with your mom you'll never forget?",
    placeholder: "Example: That time we drove three hours just to find that one bakery and got lost twice...",
  },
  {
    key: 'question_2',
    step: 'q2',
    ordinal: '2 of 4',
    title: 'The thing she does',
    text: "What's something your mom does that nobody else does?",
    placeholder: 'Example: Sends me a sunrise photo every Sunday with no caption...',
  },
  {
    key: 'question_3',
    step: 'q3',
    ordinal: '3 of 4',
    title: 'The thing you haven’t said',
    text: "What's something you've never told your mom but she should know?",
    placeholder: 'Example: That I notice every small thing she does, even when I act like I don’t...',
  },
  {
    key: 'question_4',
    step: 'q4',
    ordinal: '4 of 4',
    title: 'The future',
    text: "What's something you're looking forward to doing with your mom?",
    placeholder: 'Example: Taking her on the road trip we always talk about but never plan...',
  },
];

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'Mandarin Chinese',
  'Korean',
  'Vietnamese',
  'Tagalog',
  'Arabic',
  'Portuguese',
  'Hindi',
  'Japanese',
  'German',
  'Italian',
  'Russian',
  'Other',
];

const MIN_CHARS = 20;

type Answers = { question_1: string; question_2: string; question_3: string; question_4: string };

export default function BuilderPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>('language');
  const [language, setLanguage] = useState<string>('English');
  const [otherLanguage, setOtherLanguage] = useState<string>('');
  const [momNickname, setMomNickname] = useState<string>('');
  const [momName, setMomName] = useState<string>('');
  const [answers, setAnswers] = useState<Answers>({
    question_1: '',
    question_2: '',
    question_3: '',
    question_4: '',
  });

  // Restore from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.step) setStep(parsed.step);
        if (typeof parsed.language === 'string') setLanguage(parsed.language);
        if (typeof parsed.otherLanguage === 'string') setOtherLanguage(parsed.otherLanguage);
        if (typeof parsed.momNickname === 'string') setMomNickname(parsed.momNickname);
        if (typeof parsed.momName === 'string') setMomName(parsed.momName);
        if (parsed.answers) setAnswers((a) => ({ ...a, ...parsed.answers }));
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Save on every change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step, language, otherLanguage, momNickname, momName, answers }),
      );
    } catch {}
  }, [hydrated, step, language, otherLanguage, momNickname, momName, answers]);

  const effectiveLanguage = useMemo(
    () => (language === 'Other' && otherLanguage.trim() ? otherLanguage.trim() : language),
    [language, otherLanguage],
  );

  const stepIndex = useMemo(() => {
    const order: Step[] = ['language', 'names', 'q1', 'q2', 'q3', 'q4'];
    return order.indexOf(step);
  }, [step]);
  const progress = ((stepIndex + 1) / 6) * 100;

  function go(next: Step) {
    setStep(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function finish() {
    // Persist all answers in the format the preview page expects.
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step: 'q4', language, otherLanguage, momNickname, momName, answers }),
      );
      // Drop a separate flag preview can read for "ready to generate".
      localStorage.setItem(
        'mdmvp_builder_complete_v3',
        JSON.stringify({
          language: effectiveLanguage,
          momNickname,
          momName,
          answers,
          completedAt: Date.now(),
        }),
      );
    } catch {}
    router.push('/preview');
  }

  if (!hydrated) {
    return (
      <main id="main" className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto p-6 pt-6 pb-12">
          <p className="text-gray-700">Loading…</p>
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
        <div className="max-w-2xl mx-auto px-6 pt-6 md:pt-10 pb-12 md:pb-16">
          <StepBreadcrumb
            done={stepIndex > 0 ? `Step ${stepIndex} of 6 done` : undefined}
            current={
              step === 'language'
                ? 'Pick a language'
                : step === 'names'
                  ? 'About mom'
                  : `Question ${QUESTIONS.find((q) => q.step === step)?.ordinal}`
            }
            progress={progress}
            next={
              step === 'language'
                ? 'About mom'
                : step === 'names'
                  ? 'Question 1 of 4'
                  : step === 'q4'
                    ? 'Preview your messages'
                    : `Question ${stepIndex} of 4`
            }
          />
          <div
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={6}
            aria-label={`Step ${stepIndex + 1} of 6`}
            className="sr-only"
          >
            Step {stepIndex + 1} of 6
          </div>

          {step === 'language' ? (
            <LanguageStep
              language={language}
              otherLanguage={otherLanguage}
              setLanguage={setLanguage}
              setOtherLanguage={setOtherLanguage}
              effectiveLanguage={effectiveLanguage}
              onNext={() => go('names')}
            />
          ) : step === 'names' ? (
            <NamesStep
              momNickname={momNickname}
              momName={momName}
              setMomNickname={setMomNickname}
              setMomName={setMomName}
              onBack={() => go('language')}
              onNext={() => go('q1')}
            />
          ) : (
            <QuestionStep
              key={step}
              spec={QUESTIONS.find((q) => q.step === step)!}
              value={answers[QUESTIONS.find((q) => q.step === step)!.key]}
              setValue={(v) =>
                setAnswers((a) => ({
                  ...a,
                  [QUESTIONS.find((q) => q.step === step)!.key]: v,
                }))
              }
              language={effectiveLanguage}
              onBack={() => {
                const order: Step[] = ['language', 'names', 'q1', 'q2', 'q3', 'q4'];
                const i = order.indexOf(step);
                go(order[i - 1] || 'language');
              }}
              onNext={() => {
                if (step === 'q4') finish();
                else {
                  const order: Step[] = ['q1', 'q2', 'q3', 'q4'];
                  const i = order.indexOf(step);
                  go(order[i + 1]);
                }
              }}
              isLast={step === 'q4'}
            />
          )}

          <p className="mt-6 text-xs text-gray-700 text-center">
            Take your time. Your answer saves automatically.
          </p>

          {/* Tip jar — whisper, share-only on builder (no contribute pre-product) */}
          <TipJar variant="whisper" showContribute={false} />
        </div>
      </main>
    </>
  );
}

function LanguageStep({
  language,
  otherLanguage,
  setLanguage,
  setOtherLanguage,
  effectiveLanguage,
  onNext,
}: {
  language: string;
  otherLanguage: string;
  setLanguage: (s: string) => void;
  setOtherLanguage: (s: string) => void;
  effectiveLanguage: string;
  onNext: () => void;
}) {
  const ready = language !== 'Other' || otherLanguage.trim().length > 0;
  return (
    <section aria-labelledby="lang-h">
      <h1 id="lang-h" className="font-serif text-3xl md:text-4xl text-gray-950 mb-3">
        What language does your mom prefer?
      </h1>
      <p id="lang-help" className="text-gray-700 mb-8 text-lg">
        We&rsquo;ll write the messages in her language. Pick whatever feels most like home.
      </p>
      <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-2">
        Language
      </label>
      <select
        id="language-select"
        aria-describedby="lang-help"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      {language === 'Other' ? (
        <div className="mt-4">
          <label htmlFor="language-other" className="block text-sm font-medium text-gray-700 mb-2">
            Type the language
          </label>
          <input
            id="language-other"
            type="text"
            value={otherLanguage}
            onChange={(e) => setOtherLanguage(e.target.value)}
            placeholder="e.g. Polish, Swahili, Tamil"
            className="w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
          />
        </div>
      ) : null}
      {effectiveLanguage && effectiveLanguage !== 'English' ? (
        <p className="mt-4 text-sm text-rose-600">
          Messages will be written in {effectiveLanguage}.
        </p>
      ) : null}
      <div className="mt-6">
        <button
          type="button"
          disabled={!ready}
          onClick={onNext}
          className="w-full min-h-[56px] bg-rose-600 text-white px-8 py-4 rounded-full text-base md:text-lg font-medium shadow-lg hover:shadow-xl hover:bg-rose-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          Start the questions →
        </button>
      </div>
    </section>
  );
}

function NamesStep({
  momNickname,
  momName,
  setMomNickname,
  setMomName,
  onBack,
  onNext,
}: {
  momNickname: string;
  momName: string;
  setMomNickname: (s: string) => void;
  setMomName: (s: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const ready = momNickname.trim().length > 0;
  return (
    <section aria-labelledby="names-h">
      <h1 id="names-h" className="font-serif text-2xl md:text-3xl text-gray-950 mb-3">
        About mom
      </h1>
      <p className="text-gray-700 mb-8 text-lg">
        Two quick things so the messages sound like they came from you.
      </p>

      <label htmlFor="mom-nickname" className="block text-sm font-medium text-gray-700 mb-2">
        What do you call her?
      </label>
      <input
        id="mom-nickname"
        type="text"
        value={momNickname}
        onChange={(e) => setMomNickname(e.target.value)}
        placeholder="Mom, Mama, Mami, Ma, Mother..."
        className="w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
      />
      <p className="mt-2 text-xs text-gray-700">
        Goes in the messages: &ldquo;Hey {momNickname.trim() || 'Mama'}, I&rsquo;ve been thinking about…&rdquo;
      </p>

      <label htmlFor="mom-firstname" className="mt-6 block text-sm font-medium text-gray-700 mb-2">
        What&rsquo;s her first name? <span className="text-gray-700 font-normal">(optional)</span>
      </label>
      <input
        id="mom-firstname"
        type="text"
        value={momName}
        onChange={(e) => setMomName(e.target.value)}
        placeholder="For the forever page headline"
        className="w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
      />
      <p className="mt-2 text-xs text-gray-700">
        Goes on her page: &ldquo;Happy Mother&rsquo;s Day, {momName.trim() || momNickname.trim() || 'Mom'}.&rdquo;
      </p>

      <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 min-h-[56px] border border-gray-200 text-gray-700 px-6 py-3 rounded-full font-medium hover:border-gray-400 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={onNext}
          className="flex-1 min-h-[56px] bg-rose-600 text-white px-8 py-4 rounded-full text-base md:text-lg font-medium shadow-lg hover:shadow-xl hover:bg-rose-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          Start the questions →
        </button>
      </div>
    </section>
  );
}

function QuestionStep({
  spec,
  value,
  setValue,
  language,
  onBack,
  onNext,
  isLast,
}: {
  spec: { key: string; ordinal: string; title: string; text: string; placeholder: string };
  value: string;
  setValue: (v: string) => void;
  language: string;
  onBack: () => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const trimmed = value.trim();
  const ready = trimmed.length >= MIN_CHARS;
  const counterText = ready ? `✓ ${trimmed.length}/${MIN_CHARS} minimum` : `${trimmed.length}/${MIN_CHARS} minimum`;
  const isFirst = spec.ordinal === '1 of 4';
  return (
    <section aria-labelledby={`${spec.key}-h`}>
      <p className="text-xs uppercase tracking-[0.2em] text-gray-700 mb-3">
        Question {spec.ordinal} · {spec.title}
      </p>
      <h1 id={`${spec.key}-h`} className="font-serif text-2xl md:text-3xl text-gray-950 mb-3">
        {spec.text}
      </h1>
      <p className="text-gray-700 mb-6">
        Specific is better than poetic. Quote actual moments. Mom will know it&rsquo;s real.
      </p>
      {isFirst ? (
        <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-base text-gray-800 leading-relaxed">
          <p className="font-medium text-gray-950 mb-3">Answer however works for you.</p>
          <ul className="space-y-2">
            <li>
              <span aria-hidden="true">🎤 </span>
              <span className="font-medium text-gray-950">Talk</span> — tap the mic and just say it
            </li>
            <li>
              <span aria-hidden="true">⌨️ </span>
              <span className="font-medium text-gray-950">Type</span> — write it out
            </li>
            <li>
              <span aria-hidden="true">🤏 </span>
              <span className="font-medium text-gray-950">Short is fine</span> — even a few words work
            </li>
          </ul>
          <p className="mt-3 italic text-gray-700">There&rsquo;s no wrong way to do this.</p>
        </div>
      ) : null}
      <label htmlFor={spec.key} className="sr-only">
        {spec.text}
      </label>
      <div className="relative">
        <textarea
          id={spec.key}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={spec.placeholder}
          rows={6}
          className="w-full border border-gray-200 rounded-xl p-4 pr-16 text-base leading-relaxed bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
        />
        <div className="absolute bottom-3 right-3">
          <VoiceInput currentValue={value} onTranscript={setValue} language={language} />
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-700">
        Talk it, type it, whatever works. Even a few words gives us enough.
      </p>
      <p
        aria-live="polite"
        aria-label={`${trimmed.length} of ${MIN_CHARS} minimum characters`}
        className={`mt-2 text-sm ${ready ? 'text-rose-600 font-medium' : 'text-gray-700'}`}
      >
        {counterText}
      </p>
      <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 min-h-[56px] border border-gray-200 text-gray-700 px-6 py-3 rounded-full font-medium hover:border-gray-400 transition-colors focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={onNext}
          className="flex-1 min-h-[56px] bg-rose-600 text-white px-8 py-4 rounded-full text-base md:text-lg font-medium shadow-lg hover:shadow-xl hover:bg-rose-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg focus:outline-2 focus:outline-rose-500 focus:outline-offset-2"
        >
          {isLast ? 'See my messages →' : `Answer ${spec.ordinal === '4 of 4' ? 'last question' : 'next question'} →`}
        </button>
      </div>
    </section>
  );
}
