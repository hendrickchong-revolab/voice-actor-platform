export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="h-5 w-44 rounded bg-muted" />
        <div className="h-4 w-1/3 rounded bg-muted" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 flex items-center gap-4">
          <div className="h-4 flex-1 rounded bg-muted" />
          <div className="h-8 w-28 rounded bg-muted" />
          <div className="h-8 w-20 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
