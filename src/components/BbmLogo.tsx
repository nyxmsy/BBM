export function BbmLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="inline-grid h-9 w-9 place-items-center rounded-2xl bg-primary text-primary-foreground font-display text-lg font-bold shadow-sm"
      >
        B
      </span>
      <span className="font-display text-xl font-bold tracking-tight text-foreground">BBM</span>
    </span>
  );
}
