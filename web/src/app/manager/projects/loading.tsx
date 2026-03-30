export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <div className="h-8 w-48 rounded bg-muted" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
            <div className="h-4 flex-1 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
