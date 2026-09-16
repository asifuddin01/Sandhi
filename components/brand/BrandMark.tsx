type BrandMarkProps = {
  className?: string;
  title?: string;
};

export function BrandMark({ className, title }: BrandMarkProps) {
  const labelled = Boolean(title);

  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={title}
    >
      <path
        d="M5 12C14 12 18 16 24 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M43 36C34 36 30 32 24 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5 36C14 36 18 32 24 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M43 12C34 12 30 16 24 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="3" fill="var(--lamplight)" />
      <circle
        cx="24"
        cy="24"
        r="6"
        stroke="var(--lamplight)"
        strokeOpacity="0.32"
      />
    </svg>
  );
}
