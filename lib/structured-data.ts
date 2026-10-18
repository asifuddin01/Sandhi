import { homeCopy, siteIdentity } from "@/content/strings";
import { socialPlatforms, type SiteSettings } from "@/lib/site-settings-schema";

/** The names people search for besides the full one. */
const ALTERNATE_NAMES = [siteIdentity.shortName, "Sandhi Research"];

/**
 * What the home page tells search engines about the lab: the organization
 * (its names, logo, and profiles elsewhere) and the site, whose name Google
 * shows above each result. The profiles are the social links in site
 * settings, so adding one in administration adds it here too.
 */
export function labStructuredData(
  settings: Pick<SiteSettings, "social" | "location">,
) {
  const organizationId = `${siteIdentity.url}/#organization`;
  const sameAs = socialPlatforms.flatMap(({ key }) => {
    const href = settings.social[key];
    return href ? [href] : [];
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ResearchOrganization",
        "@id": organizationId,
        name: siteIdentity.name,
        alternateName: [...ALTERNATE_NAMES, siteIdentity.devanagari],
        url: siteIdentity.url,
        // A PNG of at least 112 pixels a side, as Google asks of a logo.
        logo: `${siteIdentity.url}/apple-icon`,
        description: homeCopy.hero.lead,
        foundingDate: String(siteIdentity.founded),
        ...(settings.location ? { address: settings.location } : {}),
        ...(sameAs.length > 0 ? { sameAs } : {}),
      },
      {
        "@type": "WebSite",
        name: siteIdentity.name,
        alternateName: ALTERNATE_NAMES,
        url: siteIdentity.url,
        publisher: { "@id": organizationId },
      },
    ],
  };
}
