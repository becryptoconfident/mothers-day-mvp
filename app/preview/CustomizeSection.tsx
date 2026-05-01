'use client';

import { useState } from 'react';
import { FOREVER_THEMES, type ThemeKey } from '@/lib/forever-themes';

export type { ThemeKey };

type Props = {
  theme: ThemeKey;
  headline: string;
  signoff: string;
  momNickname: string;
  momName: string;
  userName: string;
  setTheme: (t: ThemeKey) => void;
  setHeadline: (s: string) => void;
  setSignoff: (s: string) => void;
};

function defaultHeadlineFor(name: string) {
  return `Happy Mother's Day, ${name || 'Mom'}`;
}

function defaultSignoffFor(name: string) {
  return `With love, ${name || ''}`.replace(/, $/, '');
}

export default function CustomizeSection({
  theme,
  headline,
  signoff,
  momNickname,
  momName,
  userName,
  setTheme,
  setHeadline,
  setSignoff,
}: Props) {
  const [open, setOpen] = useState(false);

  // Resolved name used in default copy (first name preferred, then nickname).
  const headlineName = momName.trim() || momNickname.trim() || 'Mom';
  const nick = momNickname.trim() || 'Mom';
  const sender = userName.trim();

  // Headline preset options
  const headlinePresets: Array<{ key: string; value: string; label: string }> = [
    { key: 'default', value: defaultHeadlineFor(headlineName), label: `Happy Mother's Day, ${headlineName}` },
    { key: 'best', value: 'For the best mom ever', label: 'For the best mom ever' },
    { key: 'with_love', value: `To ${nick}, with love`, label: `To ${nick}, with love` },
    { key: 'mama', value: 'For Mama', label: 'For Mama' },
    { key: 'mami', value: 'For Mami', label: 'For Mami' },
  ];

  const signoffPresets: Array<{ key: string; value: string; label: string }> = [
    { key: 'default', value: defaultSignoffFor(sender), label: defaultSignoffFor(sender) || 'With love' },
    { key: 'always', value: `Love always${sender ? `, ${sender}` : ''}`, label: `Love always${sender ? `, ${sender}` : ''}` },
    { key: 'favorite', value: `Your favorite kid${sender ? `, ${sender}` : ''}`, label: `Your favorite kid${sender ? `, ${sender}` : ''}` },
    { key: 'dash', value: sender ? `— ${sender}` : '—', label: sender ? `— ${sender}` : '—' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="customize-panel"
        className="w-full flex items-center justify-between p-6 md:p-8 text-left focus:outline-2 focus:outline-rose-500 focus:outline-offset-2 rounded-2xl"
      >
        <span className="font-medium text-gray-950">
          {open ? '▾' : '▸'} Customize her forever page (optional)
        </span>
        <span
          className="inline-block w-4 h-4 rounded-full border border-gray-200"
          aria-hidden="true"
          style={{ background: FOREVER_THEMES[theme].accent }}
        />
      </button>
      {open ? (
        <div id="customize-panel" className="px-6 md:px-8 pb-6 md:pb-8 space-y-6">
          <p className="text-base text-gray-800 leading-relaxed">
            Her page works great with defaults. Tweak any of these if you want.
          </p>

          {/* Theme */}
          <fieldset>
            <legend className="font-medium text-gray-950 mb-3">Vibe</legend>
            <div role="radiogroup" aria-label="Choose a color theme" className="flex flex-wrap gap-3">
              {(Object.keys(FOREVER_THEMES) as ThemeKey[]).map((key) => {
                const t = FOREVER_THEMES[key];
                const selected = key === theme;
                return (
                  <label
                    key={key}
                    className={`relative flex flex-col items-center gap-1 cursor-pointer rounded-xl px-3 py-2 min-h-[44px] min-w-[44px] focus-within:outline-2 focus-within:outline-rose-500 focus-within:outline-offset-2 ${
                      selected ? 'bg-gray-50' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="forever-theme"
                      value={key}
                      checked={selected}
                      onChange={() => setTheme(key)}
                      className="sr-only"
                      aria-label={t.label}
                    />
                    <span
                      aria-hidden="true"
                      className={`block w-10 h-10 rounded-full ring-offset-2 transition-shadow ${
                        selected ? 'ring-2 ring-gray-950' : 'ring-1 ring-gray-200'
                      }`}
                      style={{ background: t.accent }}
                    />
                    <span className="text-xs text-gray-700">{t.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Headline */}
          <div>
            <label htmlFor="headline-select" className="block font-medium text-gray-950 mb-2">
              Headline
            </label>
            <select
              id="headline-select"
              onChange={(e) => {
                if (e.target.value) setHeadline(e.target.value);
              }}
              defaultValue=""
              className="w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
            >
              <option value="" disabled>
                Pick one or write your own…
              </option>
              {headlinePresets.map((p) => (
                <option key={p.key} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={defaultHeadlineFor(headlineName)}
              aria-label="Headline text"
              className="mt-2 w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-700">Edit freely. Empty falls back to the default.</p>
          </div>

          {/* Sign-off */}
          <div>
            <label htmlFor="signoff-select" className="block font-medium text-gray-950 mb-2">
              Sign-off
            </label>
            <select
              id="signoff-select"
              onChange={(e) => {
                if (e.target.value) setSignoff(e.target.value);
              }}
              defaultValue=""
              className="w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
            >
              <option value="" disabled>
                Pick one or write your own…
              </option>
              {signoffPresets.map((p) => (
                <option key={p.key} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={signoff}
              onChange={(e) => setSignoff(e.target.value)}
              placeholder={defaultSignoffFor(sender)}
              aria-label="Sign-off text"
              className="mt-2 w-full border border-gray-200 rounded-xl p-3 text-base bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-700">Edit freely. Empty falls back to the default.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
