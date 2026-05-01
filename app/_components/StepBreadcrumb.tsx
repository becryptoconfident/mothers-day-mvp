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
    <div className="py-4 mb-8">
      {props.done ? (
        <div className="text-xs uppercase tracking-[0.2em] text-gray-700">{props.done}</div>
      ) : null}
      <div className="text-sm text-gray-950 font-medium mt-1">{props.current}</div>
      {typeof props.progress === 'number' ? (
        <div className="w-full bg-gray-100 rounded-full h-1 my-3">
          <div
            className="bg-rose-600 h-1 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, props.progress))}%` }}
          />
        </div>
      ) : null}
      {props.next ? (
        <div className="text-xs text-gray-700 mt-1.5">Next: {props.next}</div>
      ) : null}
    </div>
  );
}

export function NextLine({ text }: { text: string }) {
  return (
    <div className="border-t border-gray-100 py-3 mt-6 text-center">
      <span className="text-xs text-gray-700">Next: {text}</span>
    </div>
  );
}
