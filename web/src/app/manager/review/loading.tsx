export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="h-5 w-36 rounded bg-muted" />
        <div className="h-4 w-2/3 rounded bg-muted" />
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="h-5 w-48 rounded bg-muted" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded bg-muted" />
        ))}
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="h-5 w-40 rounded bg-muted" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
