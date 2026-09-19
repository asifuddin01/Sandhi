import Link from "next/link";

import { BrandMark } from "@/components/brand/BrandMark";
import { ReduceMotionToggle } from "@/components/ui/ReduceMotionToggle";
import { footerNavigation, siteIdentity } from "@/content/strings";
import {
  isPathHidden,
  socialPlatforms,
  type SiteSettings,
} from "@/lib/site-settings-schema";

export function SiteFooter({
  hiddenPaths = [],
  social = {},
  signedIn = false,
}: {
  /** Sections switched off in site settings. */
  hiddenPaths?: string[];
  social?: SiteSettings["social"];
  /** Whether this request carries a member's session. */
  signedIn?: boolean;
}) {
  const socialLinks = socialPlatforms.flatMap(({ key, label }) => {
    const href = social[key];
    return href ? [{ label, href }] : [];
  });

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
                {group.links
                  .filter((item) => !isPathHidden(item.href, hiddenPaths))
                  .map((item) => (
                    <li key={item.href}>
                      <Link href={item.href}>{item.label}</Link>
                    </li>
                  ))}
                {group.heading === "Connect"
                  ? socialLinks.map((item) => (
                      <li key={item.href}>
                        {/* "me" lets these profiles verify the lab's site. */}
                        <a href={item.href} rel="me noopener">
                          {item.label}
                        </a>
                      </li>
                    ))
                  : null}
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
            <Link href={signedIn ? "/portal" : "/portal/sign-in"}>
              {signedIn ? "Portal" : "Sign in"}
            </Link>
          </nav>
          <ReduceMotionToggle />
        </div>
      </div>
    </footer>
  );
}
