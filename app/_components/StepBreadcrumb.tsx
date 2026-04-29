// ND-safe step breadcrumb. Three lines: ✓ what you did, → where you are,
// Next: what's next. Designed to be used at the top (full version) or as a
// "Next:" footer (compact). Mobile-first; doesn't crowd the screen.

export function StepBreadcrumb(props: {
  done?: string;
  current: string;
  progress?: number; // 0-100
  next?: string;
}) {
  return (
    <div className="border-y border-gray-200 py-4 mb-6">
      {props.done ? (
        <div className="text-sm text-green-700 font-medium">✓ {props.done}</div>
      ) : null}
      <div className="text-base text-gray-900 font-semibold mt-1">→ {props.current}</div>
      {typeof props.progress === 'number' ? (
        <div className="w-full bg-gray-200 rounded-full h-1.5 my-2.5">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, props.progress))}%` }}
          />
        </div>
      ) : null}
      {props.next ? (
        <div className="text-xs text-gray-500 italic mt-1.5">Next: {props.next}</div>
      ) : null}
    </div>
  );
}

export function NextLine({ text }: { text: string }) {
  return (
    <div className="border-y border-gray-200 py-3 mt-6 text-center">
      <span className="text-xs text-gray-500 italic">Next: {text}</span>
    </div>
  );
}
