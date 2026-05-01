// Forever-page theme palette. Shared by the customize picker (client) and
// the forever page (server) so they can't drift.
// Each theme passes 4.5:1 contrast for body text on bg.

export const FOREVER_THEMES = {
  rose: { bg: '#fef2f2', accent: '#e11d48', text: '#1c1917', card: '#fff1f2', label: 'Rose' },
  ocean: { bg: '#eff6ff', accent: '#2563eb', text: '#1e293b', card: '#dbeafe', label: 'Ocean' },
  sage: { bg: '#f0fdf4', accent: '#16a34a', text: '#1a2e1a', card: '#dcfce7', label: 'Sage' },
  sunset: { bg: '#fffbeb', accent: '#d97706', text: '#1c1917', card: '#fef3c7', label: 'Sunset' },
  lavender: { bg: '#faf5ff', accent: '#9333ea', text: '#1e1b2e', card: '#f3e8ff', label: 'Lavender' },
} as const;

export type ThemeKey = keyof typeof FOREVER_THEMES;
