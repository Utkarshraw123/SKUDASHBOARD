"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-lg mx-auto mt-24 text-center">
      <p className="font-serif text-3xl text-charcoal mb-3">Something went wrong</p>
      <p className="text-text-muted text-sm mb-2">
        Usually this is a temporary Google Sheets hiccup — trying again normally fixes it.
      </p>
      {error?.digest && <p className="text-xs text-text-muted mb-6">Ref: {error.digest}</p>}
      <button
        onClick={() => reset()}
        className="bg-copper text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-copper-light transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
