import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PartnerDirectory } from "@/components/partners/PartnerDirectory";
import {
  accessiblePartnerLogo,
  PARTNER_EMPTY_COPY,
  safePartnerUrl,
} from "@/lib/partner-content";
import { publicPartnerWhere } from "@/lib/visibility";

describe("public partners", () => {
  it("queries only records explicitly published by an admin", () => {
    expect(publicPartnerWhere).toEqual({ state: "PUBLISHED" });
  });

  it("renders the exact empty state when no published records exist", () => {
    const html = renderToStaticMarkup(<PartnerDirectory partners={[]} />);

    expect(html).toContain(PARTNER_EMPTY_COPY);
    expect(html).toContain('role="status"');
  });

  it("never renders an uploaded logo without meaningful alt text", () => {
    expect(accessiblePartnerLogo("https://example.test/logo.svg", null)).toBe(
      null,
    );
    expect(accessiblePartnerLogo("https://example.test/logo.svg", "  ")).toBe(
      null,
    );
    expect(
      accessiblePartnerLogo(
        "https://example.test/logo.svg",
        "Example organization logo",
      ),
    ).toEqual({
      src: "https://example.test/logo.svg",
      alt: "Example organization logo",
    });
  });

  it("allows only HTTP(S) partner destinations", () => {
    expect(safePartnerUrl("https://example.test/path")).toBe(
      "https://example.test/path",
    );
    expect(safePartnerUrl("http://example.test")).toBe("http://example.test/");
    expect(safePartnerUrl("javascript:alert(1)")).toBe(null);
    expect(safePartnerUrl("/relative-partner")).toBe(null);
  });
});
