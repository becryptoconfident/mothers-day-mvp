'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StepBreadcrumb, NextLine } from '../_components/StepBreadcrumb';

type Tier = 1 | 2 | 3;

const QUESTIONS = [
  {
    key: 'question_1',
    text: "What's one thing your mom always does for you?",
    placeholder: "Example: Makes soup when I'm sick, calls every Sunday...",
    examples: [
      "Texts me 'Good morning sunshine' every day",
      'Saves articles about my work and emails them',
      'Makes my favorite meal when I visit',
    ],
    tip: 'Think about PATTERNS, not one-time events. What does she do repeatedly?',
  },
  {
    key: 'question_2',
    text: "What's a memory you two share that makes her laugh?",
    placeholder: 'Example: The time I tried to cook and...',
    examples: [
      'When I tried to parallel park and hit the cone 6 times',
      'The family trip where I got scared on Space Mountain',
      'When I called her panicking about shrinking my clothes',
    ],
    tip: 'Pick a specific story with details. She should remember it immediately.',
  },
  {
    key: 'question_3',
    text: "What's something she taught you that you still use?",
    placeholder: 'Example: How to fold a fitted sheet...',
    examples: [
      'To always keep a granola bar in my bag',
      'How to write thank-you notes within 24 hours',
      "That 'if you're going to do something, do it right'",
    ],
    tip: 'Pick ONE thing. Do you actually still do this?',
  },
  {
    key: 'question_4',
    text: "What would you say to her if you weren't awkward about feelings?",
    placeholder: 'Example: I notice everything you do...',
    examples: [
      "I notice everything you do even when I don't say it",
      "I'm sorry I don't call more. It's not that I don't want to",
      'You taught me how to be a good person just by watching you',
    ],
    tip: "The truth you don't say out loud. If it makes you uncomfortable, that's the one.",
  },
] as const;

type Step = 'q1' | 'q2' | 'q3' | 'q4' | 'contact' | 'media-yn' | 'media-days';

const DAY_LABELS: Record<number, string> = {
  1: 'Day 1 — May 4th — what she does for you',
  2: 'Day 2 — May 5th — funny memory',
  3: 'Day 3 — May 6th — what she taught you',
  4: 'Day 4 — May 7th — extra detail',
  5: 'Day 5 — May 8th — emotional weight',
  6: 'Day 6 — May 9th — anticipation',
  7: 'Day 7 — May 10th — Mother’s Day finale',
};

function BuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tier = clampTier(Number(searchParams.get('tier') || '1'));

  const [step, setStep] = useState<Step>('q1');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({
    user_name: '',
    user_email: '',
    mom_name: '',
    mom_email: '',
    delivery_time: '08:00',
    delivery_timezone: 'America/Chicago',
  });
  const [extraReminders, setExtraReminders] = useState(false);
  const [wantsMedia, setWantsMedia] = useState<boolean | null>(null);
  const [mediaDays, setMediaDays] = useState<Set<number>>(new Set());

  const [restored, setRestored] = useState(false);

  // Restore prior progress on mount.
  useEffect(() => {
    try {
      const tz =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
      setContact((c) => ({ ...c, delivery_timezone: tz }));
    } catch {}
    try {
      const raw = localStorage.getItem('builderData');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.tier === tier) {
          setAnswers(saved.answers || {});
          setContact((c) => ({ ...c, ...(saved.contact || {}) }));
          setExtraReminders(!!saved.extraReminders);
          setWantsMedia(typeof saved.wantsMedia === 'boolean' ? saved.wantsMedia : null);
          setMediaDays(new Set(saved.mediaDays || []));
          if (typeof saved.step === 'string') setStep(saved.step as Step);
        }
      }
    } catch {}
    setRestored(true);
  }, [tier]);

  // Auto-save every keystroke. Lets users close the tab and come back.
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(
        'builderData',
        JSON.stringify({
          tier,
          answers,
          contact,
          extraReminders,
          wantsMedia,
          mediaDays: Array.from(mediaDays).sort(),
          step,
        }),
      );
    } catch {}
  }, [restored, tier, answers, contact, extraReminders, wantsMedia, mediaDays, step]);

  const currentQuestion = useMemo(() => {
    if (step === 'q1') return QUESTIONS[0];
    if (step === 'q2') return QUESTIONS[1];
    if (step === 'q3') return QUESTIONS[2];
    if (step === 'q4') return QUESTIONS[3];
    return null;
  }, [step]);

  const stepIndex = stepToIndex(step, tier);
  const totalSteps = totalStepsForTier(tier);

  function next() {
    if (currentQuestion) {
      const order: Step[] = ['q1', 'q2', 'q3', 'q4', 'contact'];
      setStep(order[order.indexOf(step) + 1] as Step);
      return;
    }
    if (step === 'contact') {
      if (tier === 1) {
        finish(false, []);
        return;
      }
      setStep('media-yn');
      return;
    }
    if (step === 'media-yn') {
      if (wantsMedia) setStep('media-days');
      else finish(false, []);
      return;
    }
    if (step === 'media-days') {
      finish(true, Array.from(mediaDays).sort());
      return;
    }
  }

  function finish(addMedia: boolean, days: number[]) {
    const payload = {
      tier,
      answers,
      contact,
      extraReminders,
      wantsMedia: addMedia,
      mediaDays: days,
      step,
    };
    localStorage.setItem('builderData', JSON.stringify(payload));
    router.push('/preview');
  }

  const canAdvance = (() => {
    if (currentQuestion) {
      const v = answers[currentQuestion.key] || '';
      return v.trim().length >= 20;
    }
    if (step === 'contact') {
      return (
        isEmail(contact.user_email) &&
        /^\d{2}:\d{2}$/.test(contact.delivery_time)
      );
    }
    if (step === 'media-yn') return wantsMedia !== null;
    if (step === 'media-days') return mediaDays.size > 0;
    return false;
  })();

  const stepCopy = describeStep(step, tier, wantsMedia);

  return (
    <div className="min-h-screen flex items-start md:items-center justify-center p-4 bg-gray-50">
      <div className="max-w-2xl w-full py-8">
        <StepBreadcrumb
          done={stepCopy.done}
          current={stepCopy.current}
          progress={Math.round(((stepIndex + 1) / totalSteps) * 100)}
          next={stepCopy.next}
        />

        {currentQuestion ? (
          <QuestionScreen
            q={currentQuestion}
            value={answers[currentQuestion.key] || ''}
            onChange={(v) => setAnswers({ ...answers, [currentQuestion.key]: v })}
          />
        ) : null}

        {step === 'contact' ? (
          <ContactScreen
            contact={contact}
            setContact={setContact}
            extraReminders={extraReminders}
            setExtraReminders={setExtraReminders}
          />
        ) : null}

        {step === 'media-yn' ? (
          <MediaYNScreen wantsMedia={wantsMedia} setWantsMedia={setWantsMedia} />
        ) : null}

        {step === 'media-days' ? (
          <MediaDaysScreen mediaDays={mediaDays} setMediaDays={setMediaDays} />
        ) : null}

        <button
          onClick={next}
          disabled={!canAdvance}
          className="mt-8 w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition"
        >
          {stepCopy.button}
        </button>

        <NextLine text={stepCopy.next} />
      </div>
    </div>
  );
}

function describeStep(
  step: Step,
  tier: Tier,
  wantsMedia: boolean | null,
): { done?: string; current: string; next: string; button: string } {
  if (step === 'q1') {
    return {
      current: 'Question 1 of 5 — what she always does for you',
      next: '4 more questions about your mom',
      button: 'Answer Question 2 →',
    };
  }
  if (step === 'q2') {
    return {
      done: 'Answered Question 1',
      current: 'Question 2 of 5 — a funny memory',
      next: '3 more questions',
      button: 'Answer Question 3 →',
    };
  }
  if (step === 'q3') {
    return {
      done: 'Answered Question 2',
      current: 'Question 3 of 5 — what she taught you',
      next: '2 more questions',
      button: 'Answer Question 4 →',
    };
  }
  if (step === 'q4') {
    return {
      done: 'Answered Question 3',
      current: 'Question 4 of 5 — what you’d say if not awkward',
      next: 'where to send the morning email',
      button: 'Where to send these →',
    };
  }
  if (step === 'contact') {
    if (tier === 1) {
      return {
        done: 'Answered all 4 questions about her',
        current: 'Step 5 of 5 — where to send the morning email',
        next: 'see your 7 messages',
        button: 'See My Messages →',
      };
    }
    return {
      done: 'Answered all 4 questions about her',
      current: 'Step 5 of 7 — where to send the morning email',
      next: 'pick if you want photos / video / audio',
      button: 'Pick Media Options →',
    };
  }
  if (step === 'media-yn') {
    return {
      done: 'Saved your details',
      current: 'Step 6 of 7 — media or skip',
      next: wantsMedia ? 'pick which days get media' : 'see your 7 messages',
      button: wantsMedia === true
        ? 'Pick Which Days →'
        : wantsMedia === false
          ? 'See My Messages →'
          : 'Pick One →',
    };
  }
  if (step === 'media-days') {
    return {
      done: 'Picked yes on media',
      current: 'Step 7 of 7 — which days get media',
      next: 'see your 7 messages',
      button: 'See My Messages →',
    };
  }
  return { current: '', next: '', button: 'Continue →' };
}

function QuestionScreen(props: {
  q: (typeof QUESTIONS)[number];
  value: string;
  onChange: (v: string) => void;
}) {
  const len = props.value.trim().length;
  const enough = len >= 20;
  const isFirst = props.q.key === 'question_1';
  return (
    <>
      {isFirst ? (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-5 text-xs text-rose-900">
          <strong>Quick reminder:</strong> we send messages to YOUR email. You forward them to mom.
          You&rsquo;ll see each one before it goes out.
        </div>
      ) : null}
      <h2 className="text-2xl md:text-3xl font-bold mb-2">{props.q.text}</h2>
      <p className="text-sm text-gray-500 mb-4">
        At least 20 characters — this helps AI write better messages.
      </p>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full p-4 border-2 border-gray-300 rounded-lg text-base min-h-32 focus:border-blue-600 focus:outline-none mb-2 bg-white"
        placeholder={props.q.placeholder}
      />
      <div className="flex justify-between items-center mb-4 text-sm">
        <span className={enough ? 'text-green-700' : 'text-gray-500'}>
          {enough ? '✓ Looks good' : 'Keep typing…'}
        </span>
        <span className={`tabular-nums ${enough ? 'text-green-700' : 'text-gray-500'}`}>
          {len}/20 minimum
        </span>
      </div>
      <p className="text-xs text-gray-500 italic mb-4">
        Take your time. Your answer saves automatically.
      </p>
      <div className="bg-white border rounded-lg p-4 mb-2">
        <p className="text-sm font-semibold text-gray-700 mb-2">💡 {props.q.tip}</p>
        {props.q.examples.length ? (
          <>
            <p className="text-sm text-gray-600 mb-1">Examples:</p>
            <ul className="space-y-1">
              {props.q.examples.map((ex, i) => (
                <li key={i} className="text-sm text-gray-700">• {ex}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </>
  );
}

function ContactScreen(props: {
  contact: {
    user_name: string;
    user_email: string;
    mom_name: string;
    mom_email: string;
    delivery_time: string;
    delivery_timezone: string;
  };
  setContact: React.Dispatch<React.SetStateAction<typeof props.contact>>;
  extraReminders: boolean;
  setExtraReminders: (v: boolean) => void;
}) {
  const { contact, setContact, extraReminders, setExtraReminders } = props;
  return (
    <>
      <h2 className="text-2xl md:text-3xl font-bold mb-2">Where do we send the morning email?</h2>
      <p className="text-gray-600 mb-6">
        We email <strong>you</strong> the message every morning at the time you pick. You copy/paste
        and text it to mom from your phone. Takes 30 seconds.
      </p>
      <div className="space-y-4">
        <Field label="Your email (we send the daily message here)">
          <input
            type="email"
            value={contact.user_email}
            onChange={(e) => setContact({ ...contact, user_email: e.target.value })}
            placeholder="you@example.com"
            className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white"
          />
        </Field>
        <Field label="Your name (optional — used in the messages)">
          <input
            value={contact.user_name}
            onChange={(e) => setContact({ ...contact, user_name: e.target.value })}
            placeholder="Memphis"
            className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white"
          />
        </Field>
        <Field label="Her name (optional — used in the email subject)">
          <input
            value={contact.mom_name}
            onChange={(e) => setContact({ ...contact, mom_name: e.target.value })}
            placeholder="Mom"
            className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white"
          />
        </Field>
        <Field label="What time should you get the morning email?">
          <input
            type="time"
            value={contact.delivery_time}
            onChange={(e) => setContact({ ...contact, delivery_time: e.target.value })}
            className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white"
          />
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700">
            <p>
              Sent at <strong>{contact.delivery_time || '08:00'}</strong> in <strong>{contact.delivery_timezone}</strong>.
            </p>
            <p className="text-gray-500 mt-1 italic">
              We auto-detected your timezone from your browser. If that&rsquo;s wrong, the time shown
              above will be off — message us and we&rsquo;ll fix it.
            </p>
          </div>
        </Field>
        <hr className="my-2" />
        <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-green-200 bg-green-50/50 cursor-pointer">
          <input
            type="checkbox"
            checked={extraReminders}
            onChange={(e) => setExtraReminders(e.target.checked)}
            className="mt-1"
          />
          <div>
            <div className="font-semibold text-sm">Add a gentle 1pm nudge</div>
            <div className="text-xs text-gray-600 mt-1">
              For ADHD / neurodivergent folks: a soft afternoon reminder with the message again — no
              shame if you missed the morning. Calm tone, no pressure. Free.
            </div>
          </div>
        </label>
      </div>
    </>
  );
}

function MediaYNScreen(props: {
  wantsMedia: boolean | null;
  setWantsMedia: (v: boolean) => void;
}) {
  return (
    <>
      <h2 className="text-2xl md:text-3xl font-bold mb-3">
        Want to make 2–3 days extra special?
      </h2>
      <p className="text-gray-600 mb-6">
        Photos, video, or audio on the days you pick. Don&rsquo;t put media on every day — it&rsquo;ll
        feel like work for you and look the same to her.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={() => props.setWantsMedia(true)}
          className={`p-5 rounded-lg border-2 text-left transition ${
            props.wantsMedia === true ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-white'
          }`}
        >
          <div className="font-bold mb-1">Yes, add media</div>
          <div className="text-sm text-gray-600">I&rsquo;ll pick which days</div>
        </button>
        <button
          onClick={() => props.setWantsMedia(false)}
          className={`p-5 rounded-lg border-2 text-left transition ${
            props.wantsMedia === false ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-white'
          }`}
        >
          <div className="font-bold mb-1">Skip — messages only</div>
          <div className="text-sm text-gray-600">She&rsquo;ll never know</div>
        </button>
      </div>
    </>
  );
}

function MediaDaysScreen(props: {
  mediaDays: Set<number>;
  setMediaDays: (v: Set<number>) => void;
}) {
  function toggle(n: number) {
    const next = new Set(props.mediaDays);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    props.setMediaDays(next);
  }
  return (
    <>
      <h2 className="text-2xl md:text-3xl font-bold mb-2">Which days?</h2>
      <p className="text-gray-600 mb-6">
        Pick 2–3. You&rsquo;ll upload the photos/videos/audio after generating the messages.
      </p>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <label
            key={n}
            className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition ${
              props.mediaDays.has(n) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={props.mediaDays.has(n)}
              onChange={() => toggle(n)}
              className="mr-3"
            />
            <span className="text-sm">{DAY_LABELS[n]}</span>
          </label>
        ))}
      </div>
      {props.mediaDays.size > 4 ? (
        <p className="text-sm text-amber-700 mt-3">
          That&rsquo;s a lot of media. 2–3 days hits harder than 5+ — but your call.
        </p>
      ) : null}
    </>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1">{props.label}</label>
      {props.children}
    </div>
  );
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function clampTier(n: number): Tier {
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

function tierPrice(t: Tier) {
  return t === 1 ? 19 : t === 2 ? 29 : 39;
}

function stepToIndex(step: Step, tier: Tier) {
  const order: Step[] = ['q1', 'q2', 'q3', 'q4', 'contact', 'media-yn', 'media-days'];
  const idx = order.indexOf(step);
  if (tier === 1) return Math.min(idx, 4);
  return idx;
}

function totalStepsForTier(tier: Tier) {
  return tier === 1 ? 5 : 7;
}

export default function Builder() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <BuilderInner />
    </Suspense>
  );
}
