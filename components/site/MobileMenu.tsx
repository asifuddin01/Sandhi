"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { NavigationLink } from "@/components/site/MoreMenu";
import { moreNavigation, primaryNavigation } from "@/content/strings";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileMenu({
  items = [...primaryNavigation, ...moreNavigation],
  signedIn = false,
}: {
  items?: readonly NavigationLink[];
  /** Whether this request carries a member's session. */
  signedIn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      const first = focusable.at(0);
      const last = focusable.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="mobile-menu">
      <button
        className="mobile-menu__trigger"
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen(true)}
      >
        <span>Menu</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h16M4 16h16" />
        </svg>
      </button>

      {open && (
        <div
          className="mobile-menu__panel"
          id="mobile-navigation"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-navigation-title"
        >
          <div className="mobile-menu__thread" aria-hidden="true">
            <span />
          </div>
          <div className="mobile-menu__heading">
            <p id="mobile-navigation-title">Explore SANDHI</p>
            <button
              className="icon-button"
              type="button"
              aria-label="Close navigation"
              onClick={closeMenu}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <nav aria-label="Mobile navigation">
            <ul>
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={closeMenu}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mobile-menu__actions">
            <Link
              className="text-link"
              href={signedIn ? "/portal" : "/portal/sign-in"}
              onClick={closeMenu}
            >
              {signedIn ? "Portal" : "Sign in"}
            </Link>
            {signedIn ? null : (
              <Link
                className="button button-primary"
                href="/join"
                onClick={closeMenu}
              >
                Join SANDHI
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
