import Link from 'next/link';
import fs from 'node:fs';
import path from 'node:path';
import CountdownBar from './_components/Countdown';

function findPitchAudio(): string | null {
  const candidates = ['pitch.mp3', 'pitch.m4a', 'pitch.webm', 'pitch.wav'];
  for (const name of candidates) {
    const fp = path.join(process.cwd(), 'public', name);
    try {
      if (fs.existsSync(fp)) return `/${name}`;
    } catch {}
  }
  return null;
}

export default function Home() {
  const pitchAudio = findPitchAudio();
  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        {/* Hero */}
        <div className="text-center mb-4">
          <span className="text-3xl">🌷</span>
        </div>
        <h1 className="font-serif text-4xl md:text-6xl text-center mb-4 leading-tight tracking-tight text-gray-900">
          Stop drowning in guilt every year.
        </h1>
        <p className="text-xl md:text-2xl text-center text-gray-800 font-semibold mb-3 italic">
          The only f-up this year is fixin to be the favorite.
        </p>
        <p className="text-base md:text-lg text-center text-gray-600 mb-8">
          Give me a shot.
        </p>

        <CountdownBar />

        {pitchAudio ? (
          <div className="max-w-md mx-auto mb-12 text-center">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              60 seconds from Memphis
            </p>
            <audio controls src={pitchAudio} className="w-full" />
          </div>
        ) : null}

        {/* Pitch */}
        <div className="mb-14 max-w-2xl mx-auto text-lg leading-relaxed text-gray-800 space-y-4">
          <p>
            You&rsquo;re going to come away with an all-encompassing <strong>Mother Lover Package</strong>:
          </p>
          <p>
            A full week of personalized, prewritten messages sent to <em>you</em> daily so you can
            deliver a little mom love every day all week.
          </p>
          <p className="text-gray-600 italic">
            I bet your sister isn&rsquo;t doing that. You&rsquo;re the new favorite.
          </p>
          <p>For just a little more, you can add some sentimental photos or audio.</p>
          <p>
            And for just a <em>liiiitle</em> bit more, you get to customize your own Mother&rsquo;s Day
            digital treasure hunt. You choose the adventure.
          </p>
          <p className="text-sm text-gray-500 italic">Kleenex not provided.</p>
          <p>
            And hey, if it really sucks, shoot me some feedback and you&rsquo;ll get a refund.
          </p>
          <p className="text-gray-600 italic">
            I&rsquo;m just a neurodivergent dude making things for messes.
          </p>
        </div>

        {/* Bragging callout — what she actually buys */}
        <div className="max-w-2xl mx-auto mb-14">
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-6 md:p-8 shadow-sm">
            <p className="font-serif text-2xl md:text-3xl leading-snug mb-4 text-gray-900">
              She&rsquo;s going to get to brag so fucking hard.
            </p>
            <p className="text-base md:text-lg text-gray-800 mb-5">
              That&rsquo;s what you&rsquo;re buying. Mother loving empowerment.
            </p>
            <ul className="space-y-1.5 text-base md:text-lg text-gray-800 mb-5">
              <li><strong>Monday:</strong> She&rsquo;s telling her husband Bob.</li>
              <li><strong>Tuesday:</strong> She&rsquo;s telling her sister.</li>
              <li><strong>Wednesday:</strong> Her church group knows.</li>
              <li><strong>Thursday:</strong> It&rsquo;s a trend. Watch out, people at work.</li>
              <li><strong>By Friday:</strong> You&rsquo;re the best kid a mother could ask for.</li>
            </ul>
            <p className="text-base md:text-lg text-gray-800 mb-4">
              You&rsquo;re cruising into Mother&rsquo;s Day weekend ready to talk shit to your sister who got her flowers. Real original, Sybil.
            </p>
            <p className="text-base md:text-lg text-gray-700 italic">
              All because you spent 5 minutes on the toilet.
            </p>
          </div>

          {/* Primary CTA right after bragging — clear next click */}
          <div className="text-center mt-6">
            <Link
              href="/builder?tier=2"
              className="inline-block bg-rose-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-rose-600 shadow-sm"
            >
              Start Here — See My Messages Free →
            </Link>
            <p className="text-xs text-gray-500 mt-2">No card up front. 5 questions. ~5 minutes.</p>
          </div>
        </div>

        {/* Toilet callout — the sale (now first, before proof) */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 md:p-8 text-center shadow-sm">
            <p className="text-2xl md:text-3xl font-bold leading-snug mb-4">
              Do the whole thing from your phone.<br />
              On the toilet.<br />
              While you&rsquo;re pooping.<br />
              I&rsquo;m not joking.
            </p>
            <p className="text-base md:text-lg text-gray-700">
              This year you&rsquo;re nailing it and your mom gets a whole week.
            </p>
          </div>
        </div>

        {/* Example card — the proof, now after the sale */}
        <div className="max-w-2xl mx-auto mb-14">
          <p className="text-center text-base md:text-lg text-gray-800 mb-5">
            Here&rsquo;s what you&rsquo;ll actually be sent to forward to your mother:
          </p>
          <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-300 via-amber-300 to-rose-300" />
            <div className="text-xs uppercase tracking-widest text-rose-700 font-semibold mb-3">
              Day 1 of 7 · arrives in your inbox May 4th
            </div>
            <p className="font-serif text-lg md:text-xl leading-relaxed text-gray-800">
              Hey Mom — thinking about how you always make that soup when I&rsquo;m
              sick. You drove 2 hours to bring it to me in college. I still use the
              same blue tupperware. Just wanted you to know I notice.
            </p>
          </div>
          <p className="text-center text-sm text-gray-500 mt-4 italic">
            ↑ AI wrote that from the answer: &ldquo;Makes soup when I&rsquo;m sick&rdquo;
          </p>
        </div>

        {/* Email-flow clarity callout — set expectations before pricing */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 md:p-6 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-2 font-semibold">
              How this actually works
            </p>
            <p className="text-base md:text-lg text-gray-800 mb-2">
              We email the messages to <strong>YOU</strong> each morning May 4th–10th.
              You copy/paste and text them to your mom from your phone.
            </p>
            <p className="text-sm text-gray-600">
              We do <strong>not</strong> send anything directly to her. You&rsquo;re in control of every message —
              and the text comes from your real phone number, not a robot.
            </p>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-5 mb-12">
          <TierCard
            name="Mother Lover Package"
            price="$19"
            guilt="Do you remember being born? She does."
            href="/builder?tier=1"
            primary={false}
            features={[
              'Answer 5 questions about your mom',
              'Get 7 prewritten messages (one for each day, May 4th–10th)',
              'We email you one every morning',
              'You copy, paste, send',
              'You&rsquo;re the new favorite',
            ]}
            cta="See My Messages (Free) →"
          />
          <TierCard
            name="+ Feels"
            price="$29"
            guilt="She drove you to soccer practice for 6 years. This takes 15 minutes."
            href="/builder?tier=2"
            primary={true}
            badge="Most people pick this"
            features={[
              'Everything above',
              'Add 2–3 photos, videos, or audio clips',
              'We put them in the messages',
              'She pauses',
              'Maybe cries a little',
            ]}
            cta="See My Messages (Free) →"
          />
          <TierCard
            name="+ Feels + Forever Page"
            price="$49"
            guilt="She still has your finger paintings. Give her something she'll keep forever."
            href="/builder?tier=3"
            primary={false}
            features={[
              'Everything above',
              'A private webpage just for her',
              'All 7 messages, your photos, a timeline of memories',
              'AI-written letter to mom (3–4 paragraphs)',
              'Optional 2-minute video message from you',
              'Lives forever. She can share it with family.',
              'You can update it next year.',
            ]}
            cta="See My Messages (Free) →"
          />
        </div>

        {/* Safety */}
        <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-6 md:p-8 mb-12">
          <h2 className="font-serif text-2xl mb-5 text-gray-900">The safety thing</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="font-semibold mb-2">Before you pay</p>
              <ul className="space-y-1.5 text-gray-700">
                <li>• Read your first 2 messages free</li>
                <li>• Edit them if you want</li>
                <li>• Don&rsquo;t like them? Don&rsquo;t pay.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-2">After you pay</p>
              <ul className="space-y-1.5 text-gray-700">
                <li>• Edit messages until May 3rd</li>
                <li>• Change photos/videos until May 3rd</li>
                <li>
                  • Still don&rsquo;t like it? Email me. I refund you. You tell me what sucked.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* What you actually do */}
        <div className="mb-12">
          <h2 className="font-serif text-2xl md:text-3xl mb-6 text-gray-900">What you actually do</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-base mb-2">TODAY (5–15 minutes)</h3>
              <ul className="space-y-1 text-gray-700">
                <li>• Answer 5 questions</li>
                <li>• See the 7 messages</li>
                <li>• Add photos if you want (optional)</li>
                <li>• Pay if they don&rsquo;t suck</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-base mb-2">MAY 4TH–10TH (30 seconds per day)</h3>
              <ul className="space-y-1 text-gray-700">
                <li>• We email you at 8am</li>
                <li>• You open it</li>
                <li>• You copy the message</li>
                <li>• You paste it in a text to your mom</li>
                <li>• You send it</li>
                <li>• Done</li>
              </ul>
              <p className="text-sm text-gray-600 italic mt-3">
                Make sure you email those to your mom! I&rsquo;ll nudge you tomorrow if you need me to.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            Mother&rsquo;s Day is May 10th. That&rsquo;s 12 days from now.
          </p>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="font-serif text-2xl md:text-3xl mb-5 text-gray-900">FAQ</h2>
          <div className="space-y-5">
            <FaqRow
              q="What if the messages sound dumb?"
              a="Then don&rsquo;t pay. You read the first 2 free first."
            />
            <FaqRow
              q="What if I forget to send one?"
              a="We email you every morning. Hard to forget."
            />
            <FaqRow
              q="What if this is actually stupid?"
              a="Email me. I refund you. You tell me what to fix."
            />
            <FaqRow
              q="Can I do this on my phone?"
              a="Do the whole thing from your phone. On the toilet. While you&rsquo;re pooping. I&rsquo;m not joking."
            />
          </div>
        </div>

        {/* Single CTA */}
        <div className="text-center mb-16">
          <Link
            href="/builder?tier=2"
            className="inline-block bg-rose-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-rose-600 shadow-sm"
          >
            See My Messages (Free) →
          </Link>
          <p className="text-xs text-gray-500 mt-3">No card up front. See the messages first.</p>
        </div>

        <div className="text-center text-gray-600 pt-12 border-t">
          <p className="text-sm italic">
            I&rsquo;m just a neurodivergent dude making things for messes.
          </p>
          <p className="text-sm mt-3">
            I built this for my mom Bonnie. So this year I&rsquo;m the favorite. Now you can be too.
          </p>
          <p className="font-serif text-xl text-rose-700 mt-4 tracking-wide">#doitforbonnie</p>
          <p className="text-xs text-gray-500 mt-2 italic">
            Use the tag with your mom&rsquo;s name. Pass it on.
          </p>
          <p className="text-sm mt-6">
            <a href="https://memphiscarter.com" className="underline">memphiscarter.com</a>
            <span className="mx-2 text-gray-400">|</span>
            <a href="https://twitter.com/memphis__carter" className="underline">@memphis__carter</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function TierCard(props: {
  name: string;
  price: string;
  guilt?: string;
  href: string;
  primary: boolean;
  features: string[];
  cta: string;
  badge?: string;
}) {
  const border = props.primary ? 'border-rose-500' : 'border-gray-200';
  const cardBg = props.primary ? 'bg-white shadow-md' : 'bg-white/70';
  const button = props.primary
    ? 'bg-rose-500 text-white hover:bg-rose-600'
    : 'bg-gray-900 text-white hover:bg-gray-800';
  return (
    <div className={`relative border-2 ${border} ${cardBg} rounded-2xl p-5 md:p-6 flex flex-col`}>
      {props.badge ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-rose-500 text-white px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm">
          {props.badge}
        </div>
      ) : null}
      <h3 className="font-serif text-lg tracking-tight mb-1 text-gray-900">{props.name}</h3>
      <p className="text-3xl font-bold mb-1 text-gray-900">{props.price}</p>
      {props.guilt ? (
        <p className="text-xs italic text-rose-700/90 mb-4 leading-snug">{props.guilt}</p>
      ) : (
        <div className="mb-3" />
      )}
      <ul className="space-y-1.5 mb-5 flex-1 text-sm">
        {props.features.map((f, i) => (
          <li key={i} className="flex items-start">
            <span className="text-rose-500 mr-2 mt-0.5">✓</span>
            <span dangerouslySetInnerHTML={{ __html: f }} />
          </li>
        ))}
      </ul>
      <Link
        href={props.href}
        className={`block w-full text-center py-3.5 rounded-xl font-semibold text-base ${button} transition`}
      >
        {props.cta}
      </Link>
      <p className="text-center text-xs text-gray-500 italic mt-2">
        Works on your phone. Yes, even on the toilet.
      </p>
    </div>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <p className="font-semibold mb-1" dangerouslySetInnerHTML={{ __html: `"${q}"` }} />
      <p className="text-gray-700" dangerouslySetInnerHTML={{ __html: a }} />
    </div>
  );
}
