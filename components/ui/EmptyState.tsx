import Link from "next/link";

type EmptyStateProps = {
  message: string;
  action?: { href: string; label: string };
};

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__thread" aria-hidden="true">
        <span className="empty-state__node" />
      </span>
      <p>{message}</p>
      {action ? (
        <Link className="text-link" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
