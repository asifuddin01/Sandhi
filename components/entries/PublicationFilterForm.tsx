"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";

export function publicationFilterHref(formData: FormData): string {
  const search = new URLSearchParams();

  for (const [name, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const cleaned = value.trim();
    if (cleaned) search.append(name, cleaned);
  }

  const query = search.toString();
  return query ? `/publications?${query}` : "/publications";
}

export function PublicationFilterForm({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(publicationFilterHref(new FormData(event.currentTarget)), {
      scroll: false,
      transitionTypes: ["publication-filter"],
    });
  }

  return (
    <form
      className={className}
      action="/publications"
      method="get"
      onSubmit={submitFilters}
    >
      {children}
    </form>
  );
}
