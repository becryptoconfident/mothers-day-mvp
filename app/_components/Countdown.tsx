'use client';

import { useEffect, useState } from 'react';

const MOTHERS_DAY = '2026-05-10T09:00:00';
const EDIT_CLOSE = '2026-05-03T23:59:00';

type Diff = { d: number; h: number; m: number; expired: boolean };

function diffNow(targetISO: string): Diff {
  const target = new Date(targetISO).getTime();
  const now = Date.now();
  const ms = target - now;
  if (ms <= 0) return { d: 0, h: 0, m: 0, expired: true };
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin - d * 60 * 24) / 60);
  const m = totalMin - d * 60 * 24 - h * 60;
  return { d, h, m, expired: false };
}

function format(diff: Diff): string {
  if (diff.expired) return '—';
  if (diff.d > 0) return `${diff.d}d ${diff.h}h`;
  if (diff.h > 0) return `${diff.h}h ${diff.m}m`;
  return `${diff.m}m`;
}

export default function CountdownBar() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000); // refresh every 30s
    return () => clearInterval(id);
  }, []);

  // tick is referenced so the effect's state change re-renders the component
  void tick;

  const mom = diffNow(MOTHERS_DAY);
  const edit = diffNow(EDIT_CLOSE);

  return (
    <div className="grid grid-cols-2 gap-2 max-w-md mx-auto mb-8">
      <Pill
        label="Mother's Day"
        value={format(mom)}
        tone={mom.expired ? 'gray' : mom.d <= 3 ? 'red' : 'blue'}
      />
      <Pill
        label="Edits close"
        value={format(edit)}
        tone={edit.expired ? 'gray' : edit.d <= 1 ? 'red' : edit.d <= 3 ? 'amber' : 'green'}
      />
    </div>
  );
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'gray';
}) {
  const styles: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    gray: 'bg-gray-100 border-gray-200 text-gray-900',
  };
  return (
    <div className={`border rounded-lg px-3 py-2 text-center ${styles[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide font-semibold opacity-75">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
