export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-5 space-y-3">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded bg-muted" />
            <div className="h-8 w-16 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
