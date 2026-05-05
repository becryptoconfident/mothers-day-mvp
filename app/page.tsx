import Image from 'next/image';
import Link from 'next/link';
import TipJar from './_components/TipJar';
import StandaloneTipForm from './_components/StandaloneTipForm';
import ForeverPreview from './_components/ForeverPreview';

const FIVE_FOUR_THREE: Array<{ n: string; label: string }> = [
  { n: '5', label: 'minutes' },
  { n: '4', label: 'questions' },
  { n: '3', label: 'messages' },
  { n: '2', label: 'photos' },
  { n: '1', label: 'forever page' },
];

const STEPS: Array<{ n: number; text: string }> = [
  { n: 1, text: 'Answer 4 questions about your mom.' },
  { n: 2, text: 'We write 3 messages you can send her.' },
  { n: 3, text: 'She gets a private page she can revisit all year.' },
];

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:outline-2 focus:outline-rose-500"
      >
        Skip to content
      </a>
      <main id="main" className="bg-white">
        {/* Above the fold — three things, lots of air */}
        <section className="max-w-3xl mx-auto px-6 py-16 md:py-24 text-center">
          <h1 className="font-serif text-[48px] md:text-[80px] leading-[1.02] tracking-tight text-gray-950 mb-8">
            5 minutes for you. Mother&rsquo;s Day nailed.
          </h1>
          <p className="text-lg text-gray-700 max-w-xl mx-auto leading-relaxed mb-12">
            Costs nothing. You walk away with something real for your mom.
          </p>
          <Link
            href="/builder"
            className="inline-flex items-center justify-center bg-rose-600 text-white text-lg font-medium rounded-full px-10 py-5 shadow-lg hover:shadow-xl hover:bg-rose-700 transition-all duration-200 focus:outline-2 focus:outline-rose-500 focus:outline-offset-2 min-h-[60px]"
          >
            Give It a Shot →
          </Link>
        </section>

        <div className="max-w-4xl mx-auto px-6 space-y-20 md:space-y-24 pb-24 md:pb-32">
          {/* 5-4-3-2-1 — just the grid, no copy */}
          <section aria-label="What you get">
            <ul role="list" className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {FIVE_FOUR_THREE.map((item) => (
                <li
                  key={item.n}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 p-8 text-center"
                >
                  <div className="font-serif text-5xl text-gray-950 leading-none">
                    {item.n}
                  </div>
                  <div className="mt-4 text-sm text-gray-700">{item.label}</div>
                </li>
              ))}
            </ul>
          </section>

          {/* How it works — 3 steps */}
          <section className="max-w-2xl mx-auto" aria-labelledby="how-h">
            <h2 id="how-h" className="font-serif text-3xl md:text-4xl text-center text-gray-950 mb-10">
              How it works
            </h2>
            <ol className="space-y-6">
              {STEPS.map((step) => (
                <li key={step.n} className="flex items-start gap-5">
                  <span
                    aria-hidden="true"
                    className="flex-none flex items-center justify-center w-9 h-9 rounded-full bg-gray-950 text-white text-sm font-medium"
                  >
                    {step.n}
                  </span>
                  <p className="text-lg text-gray-700 leading-relaxed pt-1.5">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* The truth — pull quote */}
          <section className="max-w-2xl mx-auto" aria-labelledby="truth-h">
            <div className="border-l-4 border-rose-600 pl-8 py-2">
              <h2 id="truth-h" className="font-serif text-3xl md:text-5xl text-gray-950 mb-5">
                I don&rsquo;t forget Mother&rsquo;s Day. I just freeze.
              </h2>
              <p className="text-lg text-gray-800 leading-relaxed mb-3">
                Birthdays. Christmas. Mother&rsquo;s Day. I know what I feel, I just can&rsquo;t get it out.
              </p>
              <p className="text-lg text-gray-800 leading-relaxed">
                So I built something that helps. Maybe you need it too.
              </p>
            </div>
          </section>

          {/* Better than a card — umbrella positioning */}
          <section className="max-w-2xl mx-auto" aria-labelledby="keepsake-h">
            <h2 id="keepsake-h" className="font-serif text-3xl md:text-5xl text-gray-950 mb-3">
              Better than a card.
            </h2>
            <p className="text-base text-rose-700 italic mb-6">
              Tiny AI-assisted keepsakes for the people you should text better.
            </p>
            <p className="text-lg text-gray-800 leading-relaxed mb-3">
              A card gets read once and disappears into a drawer. This gives her three Mother&rsquo;s Day messages and a private page she can revisit for a full year.
            </p>
            <p className="text-lg text-gray-800 leading-relaxed mb-3">
              All 3 messages, your photos, an AI-written letter from you. In her language.
            </p>
            <p className="text-lg text-gray-700 italic">
              Stays online for a full year. Save a copy any time. Next May, come back and make her a new one. Costs nothing.
            </p>
          </section>

          {/* Forever page preview */}
          <section className="max-w-2xl mx-auto" aria-labelledby="preview-h">
            <p id="preview-h" className="font-serif text-3xl md:text-5xl text-gray-950 mb-8 text-center">
              This is what she gets.
            </p>
            <ForeverPreview />
            <p className="text-lg text-gray-800 leading-relaxed mt-8 text-center max-w-xl mx-auto">
              A private page. Her messages. Her photos. A letter from you.
              Stays online for a full year — save a copy any time.
            </p>
          </section>

          {/* Bragging — short list */}
          <section className="max-w-2xl mx-auto" aria-labelledby="brag-h">
            <h2 id="brag-h" className="font-serif text-3xl md:text-5xl text-gray-950 mb-6">
              She&rsquo;s going to brag for days.
            </h2>
            <ul className="space-y-3 text-lg text-gray-700">
              <li><span className="text-gray-950 font-medium">Friday:</span> She&rsquo;s telling her husband Bob.</li>
              <li><span className="text-gray-950 font-medium">Saturday:</span> Her sister knows.</li>
              <li><span className="text-gray-950 font-medium">Sunday:</span> She&rsquo;s calling you crying.</li>
            </ul>
          </section>

          {/* Second CTA — same as the top */}
          <div className="text-center">
            <Link
              href="/builder"
              className="inline-flex items-center justify-center bg-rose-600 text-white text-lg font-medium rounded-full px-10 py-5 shadow-lg hover:shadow-xl hover:bg-rose-700 transition-all duration-200 focus:outline-2 focus:outline-rose-500 focus:outline-offset-2 min-h-[60px]"
            >
              Give It a Shot →
            </Link>
          </div>

          {/* About the creator */}
          <section id="about" className="max-w-2xl mx-auto scroll-mt-12" aria-labelledby="about-h">
            <h2 id="about-h" className="font-serif text-3xl md:text-5xl text-gray-950 mb-8">
              About the creator
            </h2>
            <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-8">
              <Image
                src="/memphis.png"
                alt="Memphis Carter"
                width={96}
                height={96}
                className="rounded-full shadow-md flex-none"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-950">Memphis Carter</p>
                <a
                  href="https://x.com/memphis__carter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-600 hover:text-rose-700 underline underline-offset-4 text-sm"
                >
                  @memphis__carter
                </a>
                <div className="mt-6 space-y-4 text-lg text-gray-800 leading-relaxed">
                  <p>
                    Three years ago I found out I have{' '}
                    <span className="font-semibold text-gray-950">Borderline Personality Disorder</span>.
                  </p>
                  <p>
                    Years of depression, anxiety, and thoughts of self-harm — I was finally
                    able to put a name to it. Now I&rsquo;m learning about myself all over again.
                  </p>
                  <p>
                    This is a tool for people like me. It&rsquo;s also a tool for people not like
                    me. It&rsquo;s a tool to speak kindness and love into the world. We need to
                    produce more of that energy.
                  </p>
                  <p>
                    I spent 15 years in education — two as an assistant principal. I left to
                    find better ways to give people a voice. This is one of them.
                  </p>
                  <p>
                    <a
                      href="#tip-jar"
                      className="text-rose-600 hover:text-rose-700 font-medium"
                    >
                      Share
                    </a>{' '}
                    it with anyone who finds value. It&rsquo;s free. If you can{' '}
                    <a
                      href="#about-amount"
                      className="text-rose-600 hover:text-rose-700 font-medium"
                    >
                      contribute
                    </a>
                    , please do. I&rsquo;m an unemployed teacher trying to put more love in the world.
                  </p>
                </div>

                {/* BPD reveal — collapsed by default, opens in place */}
                <details className="mt-6 group">
                  <summary className="list-none cursor-pointer text-rose-600 hover:text-rose-700 font-medium text-base focus:outline-2 focus:outline-rose-500 focus:outline-offset-2 [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">What is BPD? →</span>
                    <span className="hidden group-open:inline">Close</span>
                  </summary>
                  <div className="mt-6 space-y-6">
                    <div className="space-y-4 text-lg text-gray-800 leading-relaxed">
                      <p>
                        BPD is a mental health condition that affects how you experience emotions,
                        relationships, and your sense of self.
                      </p>
                      <p>It can look like:</p>
                      <ul className="space-y-2">
                        {[
                          'Emotions that hit fast and hard — then disappear',
                          'Wanting to connect but not knowing how',
                          'Freezing when it’s time to express how you feel',
                          'Fear of being too much or not enough',
                          'Struggling with birthdays, holidays, and moments that are supposed to feel easy',
                        ].map((item) => (
                          <li key={item} className="relative pl-6">
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-[0.7em] w-1.5 h-1.5 rounded-full bg-rose-600"
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <p>
                        It&rsquo;s more common than people think. About 1.4% of adults in the US
                        live with it. Most go years without knowing.
                      </p>
                      <p>I went decades.</p>
                    </div>

                    <div className="border-t border-gray-100" />

                    <div className="space-y-4 text-lg text-gray-800 leading-relaxed">
                      <p>If any of this sounds familiar — reach out to me.</p>
                      <p>Not to diagnose you. Not to give advice. Just to talk.</p>
                      <p>
                        If you need help finding resources, I&rsquo;ll help you find them. No cost.
                        No judgment.
                      </p>
                      <p>
                        I&rsquo;m at{' '}
                        <a
                          href="https://x.com/memphis__carter"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-rose-600 hover:text-rose-700 underline underline-offset-4 font-medium"
                        >
                          @memphis__carter
                        </a>{' '}
                        on X. DMs are open.
                      </p>
                    </div>

                    <div className="border-t border-gray-100" />

                    <div className="space-y-5">
                      <p className="text-lg text-gray-800 leading-relaxed">
                        If you&rsquo;re in crisis right now:
                      </p>
                      <div>
                        <p className="text-base text-gray-800">988 Suicide &amp; Crisis Lifeline</p>
                        <p className="mt-1 text-gray-800">
                          Call or text{' '}
                          <a
                            href="tel:988"
                            className="font-semibold text-gray-950 text-xl hover:text-rose-700"
                          >
                            988
                          </a>
                          . Available 24/7.
                        </p>
                      </div>
                      <div>
                        <p className="text-base text-gray-800">Crisis Text Line</p>
                        <p className="mt-1 text-gray-800">
                          Text HOME to{' '}
                          <a
                            href="sms:741741?body=HOME"
                            className="font-semibold text-gray-950 text-xl hover:text-rose-700"
                          >
                            741741
                          </a>
                          .
                        </p>
                      </div>
                      <p className="text-gray-700">
                        You&rsquo;re not alone. These are free and confidential.
                      </p>
                    </div>
                  </div>
                </details>

                <StandaloneTipForm id="about" />
              </div>
            </div>
          </section>

          {/* Tip jar */}
          <div id="tip-jar" className="scroll-mt-12">
            <TipJar variant="normal" />
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-gray-100 bg-white">
          <div className="max-w-2xl mx-auto px-6 py-12 text-center text-sm text-gray-700">
            <p>Built by someone who gets it, for people like me.</p>
            <p className="mt-6 text-xs text-gray-600">
              We email you each message to forward yourself &mdash; or we send them straight to mom with you CC&rsquo;d. Your call.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
