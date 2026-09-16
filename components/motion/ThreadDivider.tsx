export function ThreadDivider({ className }: { className?: string }) {
  return (
    <div
      className={["thread-divider", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1280 28" preserveAspectRatio="none">
        <path d="M0 15C360 15 452 8 640 14C828 20 930 13 1280 13" />
        <circle cx="640" cy="14" r="3" />
        <circle className="thread-divider__ring" cx="640" cy="14" r="6" />
      </svg>
    </div>
  );
}
