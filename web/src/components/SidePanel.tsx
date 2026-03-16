import Link from "next/link";

export function SidePanel({
  title,
  description,
  closeHref,
  children,
  widthClassName = "max-w-xl",
}: {
  title: string;
  description?: string;
  closeHref: string;
  children: React.ReactNode;
  widthClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <Link aria-label="Close" href={closeHref} className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <aside className={`va-sidepanel-in absolute right-0 top-0 h-full w-full border-l bg-background ${widthClassName}`}>
        <div className="flex h-full flex-col">
          <div className="border-b p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
              </div>
              <Link className="text-sm underline" href={closeHref}>
                Close
              </Link>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </aside>
    </div>
  );
}
