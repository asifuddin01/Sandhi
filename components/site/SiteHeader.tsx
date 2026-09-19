import Link from "next/link";

import { BrandLockup } from "@/components/brand/BrandLockup";
import { MoreMenu } from "@/components/site/MoreMenu";
import { MobileMenu } from "@/components/site/MobileMenu";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  commandNavigation,
  memberNavigation,
  moreNavigation,
  primaryNavigation,
} from "@/content/strings";
import { isPathHidden } from "@/lib/site-settings-schema";

export function SiteHeader({
  hiddenPaths = [],
  signedIn = false,
}: {
  /** Sections switched off in site settings. */
  hiddenPaths?: string[];
  /** Whether this request carries a member's session. */
  signedIn?: boolean;
}) {
  const visible = <Item extends { href: string }>(items: readonly Item[]) =>
    items.filter((item) => !isPathHidden(item.href, hiddenPaths));
  // The member's own destinations are part of More, not a second menu: the
  // diagram builder and their projects sit with everything else the site has.
  const more = signedIn
    ? [...visible(moreNavigation), ...memberNavigation]
    : visible(moreNavigation);
  const commands = signedIn
    ? [...visible(commandNavigation), ...memberNavigation]
    : visible(commandNavigation);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-header__brand" href="/" aria-label="SANDHI home">
          <BrandLockup compact />
        </Link>

        <nav className="site-header__nav" aria-label="Primary navigation">
          <ul>
            {primaryNavigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
            <li>
              <MoreMenu items={more} />
            </li>
          </ul>
        </nav>

        <div className="site-header__actions">
          <ThemeToggle />
          <CommandPalette items={commands} />
          {/* A member who is already signed in is not asked to sign in, and
              is not invited to join the lab they are in. */}
          <Link
            className="site-header__signin text-link"
            href={signedIn ? "/portal" : "/portal/sign-in"}
          >
            {signedIn ? "Portal" : "Sign in"}
          </Link>
          {signedIn ? null : (
            <Link
              className="button button-primary site-header__join"
              href="/join"
            >
              Join SANDHI
            </Link>
          )}
          <MobileMenu
            items={[...primaryNavigation, ...more]}
            signedIn={signedIn}
          />
        </div>
      </div>
    </header>
  );
}
