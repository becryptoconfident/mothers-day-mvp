// Static visual mockup of the forever page collage. Used on the landing page
// so visitors can see what they're building toward before they start.
// Not interactive — a poster-style preview.

export default function ForeverPreview() {
  return (
    <div
      className="bg-white rounded-2xl shadow-md max-w-2xl mx-auto p-5 md:p-7"
      role="img"
      aria-label="Sample forever page — what your mom receives"
    >
      {/* Headline */}
      <p className="text-center font-serif text-xl md:text-2xl text-gray-950 mb-4 md:mb-5">
        Happy Mother&rsquo;s Day, Mom
      </p>

      {/* Row 1: Photo + Message 1 */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-2 md:mb-3">
        <div
          aria-hidden="true"
          className="aspect-square rounded-xl bg-gradient-to-br from-rose-100 via-amber-100 to-rose-200"
        />
        <div className="col-span-2 bg-gray-50 rounded-xl p-3 md:p-4">
          <p className="text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-gray-700 font-semibold mb-1">
            Friday
          </p>
          <p className="font-serif text-[11px] md:text-sm leading-snug text-gray-950">
            Hey Mom — I&rsquo;ve been thinking about that drive we took to the bakery and got
            lost twice. You weren&rsquo;t mad. You laughed.
          </p>
        </div>
      </div>

      {/* Row 2: Message 2 + Photo */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-2 md:mb-3">
        <div className="col-span-2 bg-gray-50 rounded-xl p-3 md:p-4">
          <p className="text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-gray-700 font-semibold mb-1">
            Saturday
          </p>
          <p className="font-serif text-[11px] md:text-sm leading-snug text-gray-950">
            Nobody else sends me a sunrise photo every Sunday. No caption. Just the sky. I keep
            every one of them.
          </p>
        </div>
        <div
          aria-hidden="true"
          className="aspect-square rounded-xl bg-gradient-to-br from-rose-200 via-rose-100 to-amber-100"
        />
      </div>

      {/* Row 3: Message 3 (the big one) */}
      <div className="bg-gray-50 rounded-xl p-3 md:p-4 mb-2 md:mb-3 relative">
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-0.5 bg-rose-600 rounded-t-xl"
        />
        <p className="text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-gray-700 font-semibold mb-1">
          Sunday — Mother&rsquo;s Day
        </p>
        <p className="font-serif text-[11px] md:text-sm leading-snug text-gray-950">
          I never told you this. The way you laugh when nothing&rsquo;s funny — that&rsquo;s the
          sound I&rsquo;ll miss most one day. Happy Mother&rsquo;s Day. I love you.
        </p>
      </div>

      {/* Pull quote */}
      <div className="bg-gray-50 rounded-xl p-3 md:p-4 mb-3 md:mb-4">
        <p className="font-serif italic text-center text-[11px] md:text-sm text-gray-700 leading-snug">
          &ldquo;The best part is knowing we still have so much ahead of us.&rdquo;
        </p>
      </div>

      {/* Sign-off */}
      <p className="text-center font-serif italic text-rose-600 text-xs md:text-sm">
        With love, Memphis
      </p>
    </div>
  );
}
