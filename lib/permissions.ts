/**
 * The permission matrix from the specification (Part 8), with the former
 * Editor role named Reviewer. Pure data so it can be tested and shared; every
 * server action and route still enforces it through `lib/authz.ts`.
 */

export const systemRoles = ["OWNER", "ADMIN", "REVIEWER", "MEMBER"] as const;

export type SystemRoleValue = (typeof systemRoles)[number];

const staff = ["OWNER", "ADMIN", "REVIEWER"] as const;
const administrators = ["OWNER", "ADMIN"] as const;

export const capabilityRoles = {
  "portal:access": systemRoles,
  "admin:access": staff,
  "publications:publish": staff,
  "projects:manage": staff,
  // News, events, resources, and insight review.
  "content:manage": staff,
  "research:manage": administrators,
  "partners:manage": administrators,
  "opportunities:manage": administrators,
  "applications:manage": administrators,
  "members:manage": administrators,
  "approvals:manage": administrators,
  "settings:manage": administrators,
  "audit:view": administrators,
  "ownership:transfer": ["OWNER"],
} as const satisfies Record<string, readonly SystemRoleValue[]>;

export type Capability = keyof typeof capabilityRoles;

export function parseSystemRole(value: unknown): SystemRoleValue {
  return systemRoles.includes(value as SystemRoleValue)
    ? (value as SystemRoleValue)
    : "MEMBER";
}

export function can(role: SystemRoleValue, capability: Capability): boolean {
  return (capabilityRoles[capability] as readonly SystemRoleValue[]).includes(
    role,
  );
}

/**
 * Whether an actor may change another person's membership. Only the Owner can
 * change the Owner, and nobody but the Owner can grant the Owner role.
 */
export function canManageMember(
  actor: SystemRoleValue,
  target: SystemRoleValue,
  requestedRole?: SystemRoleValue,
): boolean {
  if (!can(actor, "members:manage")) return false;
  if (target === "OWNER" && actor !== "OWNER") return false;
  if (requestedRole === "OWNER" && actor !== "OWNER") return false;
  return true;
}

/**
 * Keeps post-sign-in redirects inside the portal and admin areas, so a crafted
 * `next` parameter cannot send someone to another site.
 */
export function safeAuthenticatedPath(value: unknown): string {
  if (typeof value !== "string") return "/portal";
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/portal";
  }
  const pathname = value.split(/[?#]/u, 1)[0]!;
  const inArea =
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");
  return inArea ? value : "/portal";
}
