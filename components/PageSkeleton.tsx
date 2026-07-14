export default function PageSkeleton({ kpis = 4, tableRows = 8 }: { kpis?: number; tableRows?: number }) {
  return (
    <div className="max-w-7xl animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-72 bg-cream-dark rounded-lg mb-3" />
        <div className="h-4 w-96 bg-cream-dark/70 rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: kpis }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-4">
            <div className="h-3 w-20 bg-cream-dark/70 rounded mb-3" />
            <div className="h-7 w-16 bg-cream-dark rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e4ddd4] bg-cream">
          <div className="h-3 w-40 bg-cream-dark rounded" />
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: tableRows }).map((_, i) => (
            <div key={i} className="h-4 bg-cream-dark/50 rounded" style={{ width: `${95 - (i % 4) * 8}%` }} />
          ))}
        </div>
      </div>
      <p className="text-center text-text-muted text-xs mt-6">Loading live data from Google Sheets…</p>
    </div>
  );
}
