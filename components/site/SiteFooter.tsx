import Link from "next/link";

import { BrandMark } from "@/components/brand/BrandMark";
import { ReduceMotionToggle } from "@/components/ui/ReduceMotionToggle";
import { footerNavigation, siteIdentity } from "@/content/strings";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__intro">
          <BrandMark className="site-footer__mark" />
          <p className="site-footer__name">{siteIdentity.name}</p>
          <p>{siteIdentity.tagline}</p>
        </div>

        <nav className="site-footer__navigation" aria-label="Footer navigation">
          {footerNavigation.map((group) => (
            <section
              key={group.heading}
              aria-labelledby={`footer-${group.heading}`}
            >
              <h2 id={`footer-${group.heading}`}>{group.heading}</h2>
              <ul>
                {group.links.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <p className="site-footer__meaning">
          <span lang="sa">{siteIdentity.devanagari}</span>
          <span aria-hidden="true"> — </span>
          <span>joining, connection, junction.</span>
        </p>

        <div className="site-footer__legal">
          <p>© 2026 {siteIdentity.name}</p>
          <nav aria-label="Legal and member links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/portal/sign-in">Member sign in</Link>
          </nav>
          <ReduceMotionToggle />
        </div>
      </div>
    </footer>
  );
}
