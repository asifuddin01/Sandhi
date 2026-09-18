import { describe, expect, it } from "vitest";

import {
  can,
  canManageMember,
  capabilityRoles,
  parseSystemRole,
  requiresTwoFactor,
  safeAuthenticatedPath,
  systemRoles,
  type Capability,
  type SystemRoleValue,
} from "@/lib/permissions";

// Specification Part 8, with Editor renamed Reviewer.
const expected: Record<Capability, SystemRoleValue[]> = {
  "portal:access": ["OWNER", "ADMIN", "REVIEWER", "MEMBER"],
  "admin:access": ["OWNER", "ADMIN", "REVIEWER"],
  "publications:publish": ["OWNER", "ADMIN", "REVIEWER"],
  "projects:manage": ["OWNER", "ADMIN", "REVIEWER"],
  "content:manage": ["OWNER", "ADMIN", "REVIEWER"],
  "research:manage": ["OWNER", "ADMIN"],
  "partners:manage": ["OWNER", "ADMIN"],
  "opportunities:manage": ["OWNER", "ADMIN"],
  "applications:manage": ["OWNER", "ADMIN"],
  "members:manage": ["OWNER", "ADMIN"],
  "approvals:manage": ["OWNER", "ADMIN"],
  "settings:manage": ["OWNER", "ADMIN"],
  "audit:view": ["OWNER", "ADMIN"],
  "ownership:transfer": ["OWNER"],
};

describe("permission matrix", () => {
  it("grants every capability to exactly the specified roles", () => {
    expect(Object.keys(capabilityRoles).sort()).toEqual(
      Object.keys(expected).sort(),
    );
    for (const [capability, roles] of Object.entries(expected) as Array<
      [Capability, SystemRoleValue[]]
    >) {
      for (const role of systemRoles) {
        expect(can(role, capability), `${role} ${capability}`).toBe(
          roles.includes(role),
        );
      }
    }
  });

  it("never gives a member any administrative capability", () => {
    const memberCapabilities = (Object.keys(expected) as Capability[]).filter(
      (capability) => can("MEMBER", capability),
    );
    expect(memberCapabilities).toEqual(["portal:access"]);
  });

  it("treats unknown or missing roles as members", () => {
    expect(parseSystemRole("ADMIN")).toBe("ADMIN");
    expect(parseSystemRole("admin")).toBe("MEMBER");
    expect(parseSystemRole("SUPERUSER")).toBe("MEMBER");
    expect(parseSystemRole(undefined)).toBe("MEMBER");
  });
});

describe("member management", () => {
  it("protects the Owner from Admins and reserves the Owner role", () => {
    expect(canManageMember("ADMIN", "MEMBER", "REVIEWER")).toBe(true);
    expect(canManageMember("ADMIN", "OWNER")).toBe(false);
    expect(canManageMember("ADMIN", "MEMBER", "OWNER")).toBe(false);
    expect(canManageMember("OWNER", "ADMIN", "OWNER")).toBe(true);
    expect(canManageMember("REVIEWER", "MEMBER")).toBe(false);
    expect(canManageMember("MEMBER", "MEMBER")).toBe(false);
  });
});

describe("post-sign-in redirects", () => {
  it("keeps destinations inside the portal and administration", () => {
    expect(safeAuthenticatedPath("/admin")).toBe("/admin");
    expect(safeAuthenticatedPath("/admin/members?page=2")).toBe(
      "/admin/members?page=2",
    );
    expect(safeAuthenticatedPath("/portal/profile")).toBe("/portal/profile");
  });

  it("refuses other sites, protocol-relative URLs, and public pages", () => {
    for (const value of [
      "https://evil.example/",
      "//evil.example/admin",
      "/\\evil.example",
      "javascript:alert(1)",
      "/administrator",
      "/portalx",
      "/research",
      "",
      undefined,
      ["/admin"],
    ]) {
      expect(safeAuthenticatedPath(value)).toBe("/portal");
    }
  });
});

describe("requiresTwoFactor", () => {
  it("guards every capability beyond the member portal", () => {
    for (const capability of Object.keys(capabilityRoles) as Capability[]) {
      expect(requiresTwoFactor(capability), capability).toBe(
        capability !== "portal:access",
      );
    }
  });
});
