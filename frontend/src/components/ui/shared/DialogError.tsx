interface DialogErrorProps {
  error: string | null;
  className?: string;
}

export function DialogError({ error, className = 'px-5 pb-2' }: DialogErrorProps) {
  if (!error) return null;

  return (
    <div className={className}>
      <div className="rounded-xl border border-border p-3 dark:border-border-dark">
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">{error}</p>
      </div>
    </div>
  );
}
