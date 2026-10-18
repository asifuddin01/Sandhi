import { describe, expect, it } from "vitest";

import { labStructuredData } from "@/lib/structured-data";

describe("labStructuredData", () => {
  it("names the lab and the site, and lists only the profiles that are set", () => {
    const data = labStructuredData({
      social: { github: "https://github.com/sandhi", x: "" },
      location: null,
    });
    const [organization, website] = data["@graph"];

    expect(organization).toMatchObject({
      "@type": "ResearchOrganization",
      name: "SANDHI Research Lab",
      url: "https://sandhiresearch.org",
      sameAs: ["https://github.com/sandhi"],
    });
    expect(organization).not.toHaveProperty("address");
    expect(website).toMatchObject({
      "@type": "WebSite",
      name: "SANDHI Research Lab",
      alternateName: ["SANDHI", "Sandhi Research"],
      publisher: { "@id": "https://sandhiresearch.org/#organization" },
    });
  });

  it("leaves sameAs out until a profile is added", () => {
    const [organization] = labStructuredData({
      social: {},
      location: "Dhaka, Bangladesh",
    })["@graph"];

    expect(organization).not.toHaveProperty("sameAs");
    expect(organization).toHaveProperty("address", "Dhaka, Bangladesh");
  });
});
