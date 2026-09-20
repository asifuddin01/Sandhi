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
  // Reading the queue, taking a proposal, queueing it or sending it back.
  "proposals:review": staff,
  // The decision that turns a proposal into a project with a team.
  "proposals:approve": administrators,
  "members:manage": administrators,
  "approvals:manage": administrators,
  "settings:manage": administrators,
  "audit:view": administrators,
  "ownership:transfer": ["OWNER"],
} as const satisfies Record<string, readonly SystemRoleValue[]>;

export type Capability = keyof typeof capabilityRoles;

/**
 * Every account needs two-factor authentication, members included. The lab's
 * unpublished work, its people's addresses and its files all sit behind a
 * password otherwise, and a password is one phishing email from being
 * someone else's.
 */
export function requiresTwoFactor(): boolean {
  return true;
}

/**
 * Administration also expires its own sessions early, which two-factor
 * authentication does not: a member who is signed in on their own laptop has
 * no reason to be thrown out twice a day. The two rules were once the same
 * condition, and separating them is what keeps the short session on the
 * screens that warrant it.
 */
export function requiresFreshStaffSession(capability: Capability): boolean {
  return capability !== "portal:access";
}

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
