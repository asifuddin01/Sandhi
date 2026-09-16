import Link from "next/link";

import { BrandLockup } from "@/components/brand/BrandLockup";
import { MoreMenu } from "@/components/site/MoreMenu";
import { MobileMenu } from "@/components/site/MobileMenu";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { primaryNavigation } from "@/content/strings";

export function SiteHeader() {
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
              <MoreMenu />
            </li>
          </ul>
        </nav>

        <div className="site-header__actions">
          <ThemeToggle />
          <CommandPalette />
          <Link
            className="button button-primary site-header__join"
            href="/join"
          >
            Join SANDHI
          </Link>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
