"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { commandNavigation } from "@/content/strings";
import type { PublicSearchResult } from "@/lib/search";

type SearchResponse = { results: PublicSearchResult[] };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<{
    query: string;
    results: PublicSearchResult[];
  }>({ query: "", results: [] });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!open || normalizedQuery.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;

        const data = (await response.json()) as SearchResponse;
        setRemote({ query: normalizedQuery, results: data.results });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRemote({ query: normalizedQuery, results: [] });
        }
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return commandNavigation;

    if (normalizedQuery.length >= 2 && remote.query === query.trim()) {
      return remote.results.map((item) => ({
        label: item.title,
        href: item.href,
        context: item.kind,
      }));
    }

    return commandNavigation.filter((item) =>
      item.label.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [query, remote]);

  function closePalette() {
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        className="command-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="command-palette"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="m15 15 4.5 4.5" />
        </svg>
        <span className="command-trigger__label">Search</span>
      </button>

      <dialog
        className="command-palette"
        id="command-palette"
        ref={dialogRef}
        aria-labelledby="command-palette-title"
        onCancel={() => closePalette()}
        onClose={() => closePalette()}
      >
        <div className="command-palette__header">
          <div>
            <h2 id="command-palette-title">Find your way</h2>
            <p>Search the public sections of SANDHI.</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close search"
            onClick={closePalette}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <label className="visually-hidden" htmlFor="command-query">
          Search sections
        </label>
        <div className="command-palette__input">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="m15 15 4.5 4.5" />
          </svg>
          <input
            id="command-query"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sections"
            autoComplete="off"
          />
        </div>

        <nav className="command-palette__results" aria-label="Search results">
          {results.length > 0 ? (
            <ul>
              {results.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={closePalette}>
                    <span>{item.label}</span>
                    <span className="command-palette__path">
                      {"context" in item ? item.context : item.href}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="command-palette__empty">No matching section.</p>
          )}
        </nav>
      </dialog>
    </>
  );
}
