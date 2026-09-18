import Link from "next/link";

import { BrandLockup } from "@/components/brand/BrandLockup";
import { MoreMenu } from "@/components/site/MoreMenu";
import { MobileMenu } from "@/components/site/MobileMenu";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  commandNavigation,
  moreNavigation,
  primaryNavigation,
} from "@/content/strings";
import { isPathHidden } from "@/lib/site-settings-schema";

export function SiteHeader({
  hiddenPaths = [],
}: {
  /** Sections switched off in site settings. */
  hiddenPaths?: string[];
}) {
  const visible = <Item extends { href: string }>(items: readonly Item[]) =>
    items.filter((item) => !isPathHidden(item.href, hiddenPaths));
  const more = visible(moreNavigation);

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
          <CommandPalette items={visible(commandNavigation)} />
          <Link
            className="site-header__signin text-link"
            href="/portal/sign-in"
          >
            Sign in
          </Link>
          <Link
            className="button button-primary site-header__join"
            href="/join"
          >
            Join SANDHI
          </Link>
          <MobileMenu items={[...primaryNavigation, ...more]} />
        </div>
      </div>
    </header>
  );
}
