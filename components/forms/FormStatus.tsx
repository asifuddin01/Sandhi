import type { FieldErrors } from "@/lib/forms";

export function ErrorSummary({
  errors,
  title = "Please check the highlighted fields.",
  className,
}: {
  errors: FieldErrors;
  title?: string;
  className?: string;
}) {
  const entries = Object.entries(errors);
  if (entries.length === 0) return null;

  return (
    <div className={className} role="alert" tabIndex={-1}>
      <p>{title}</p>
      <ul>
        {entries.map(([field, message]) => (
          <li key={field}>
            <a href={`#${field}`}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FieldError({
  id,
  message,
  className,
}: {
  id: string;
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} className={className} role="alert">
      {message}
    </p>
  );
}

export function describedBy(
  id: string,
  error?: string,
  hint?: string,
): string | undefined {
  return (
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined
  );
}
