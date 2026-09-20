import { createHash, randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { PASSWORD } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/** WebAuthn refuses IP addresses, so these pages load from localhost. */
function localOrigin(baseURL: string | undefined): string {
  const url = new URL(baseURL ?? "http://127.0.0.1:3100");
  url.hostname = "localhost";
  return url.origin;
}

/**
 * A platform authenticator, like Touch ID, that Chrome simulates. Its
 * credentials can move to a device that cannot verify the person, to test
 * that the server refuses an unverified sign-in.
 */
async function addAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const create = async (hasUserVerification: boolean) =>
    (
      await cdp.send("WebAuthn.addVirtualAuthenticator", {
        options: {
          protocol: "ctap2",
          transport: "internal",
          hasResidentKey: true,
          hasUserVerification,
          isUserVerified: hasUserVerification,
          automaticPresenceSimulation: true,
        },
      })
    ).authenticatorId;
  let authenticatorId = await create(true);

  const moveTo = async (hasUserVerification: boolean) => {
    const { credentials } = await cdp.send("WebAuthn.getCredentials", {
      authenticatorId,
    });
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    authenticatorId = await create(hasUserVerification);
    for (const credential of credentials) {
      await cdp.send("WebAuthn.addCredential", { authenticatorId, credential });
    }
  };
  return {
    withoutUserVerification: () => moveTo(false),
    withUserVerification: () => moveTo(true),
  };
}

async function signOut(page: Page, origin: string) {
  await page.goto(`${origin}/portal`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/portal/security"));
}

async function passkeySignIn(page: Page, origin: string) {
  await page.goto(`${origin}/portal/sign-in`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
}

test("a passkey signs in only with the person verified, and can be removed", async ({
  page,
  baseURL,
}) => {
  test.slow();
  const origin = localOrigin(baseURL);
  const db = createPrismaClient();
  const token = randomBytes(32).toString("base64url");
  const email = `passkey-${Date.now()}@sandhi.test`;

  try {
    const inviter = await db.user.findUniqueOrThrow({
      where: { email: "fixture-owner@sandhi.test" },
    });
    await db.invitation.create({
      data: {
        email,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        role: "MEMBER",
        rank: "RESEARCHER",
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await page.goto(`${origin}/portal/accept-invite/${token}`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Full name").fill("Passkey Tester");
    await page.getByLabel("New password").fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    // A new account has no second factor yet, so the portal waits behind
    // setting one up. A passkey is one, which is what this test then adds.
    await expect(page).toHaveURL(/\/portal(\/security)?(\?|$)/u, {
      timeout: 30_000,
    });

    // The portal also asks a new member to write their profile. That gate has
    // its own test; this one is about passkeys, so the profile is filled in
    // directly and stays out of the way.
    await db.member.update({
      where: {
        userId: (await db.user.findUniqueOrThrow({ where: { email } })).id,
      },
      data: {
        bio: "Fixture content used only by automated tests. This paragraph exists so the portal counts the profile as written.",
        interests: ["Fixture interest"],
        profileCompletedAt: new Date(),
      },
    });

    const authenticator = await addAuthenticator(page);

    // Adding a passkey needs the password.
    await page.goto(`${origin}/portal/security`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name for this passkey").fill("Test laptop");
    const passkeys = page.getByRole("region", { name: "Passkeys" });
    await passkeys.getByLabel("Your password").fill("not-the-password-at-all");
    await page.getByRole("button", { name: "Add a passkey" }).click();
    await expect(page.getByText("That password is not correct.")).toBeVisible();
    await passkeys.getByLabel("Your password").fill(PASSWORD);
    await page.getByRole("button", { name: "Add a passkey" }).click();
    await expect(page.getByText("Passkey “Test laptop” added.")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page
        .getByRole("list", { name: "Your passkeys" })
        .getByText("Test laptop", { exact: true }),
    ).toBeVisible();

    // It signs in with no password or code.
    await signOut(page, origin);
    await passkeySignIn(page, origin);
    await expect(page).toHaveURL(`${origin}/portal`, { timeout: 30_000 });

    // A device that cannot verify the person (no fingerprint or PIN) cannot
    // sign in: the device withholds the passkey, and the server would refuse
    // an unverified one anyway (tests/unit/passkey-policy.test.ts).
    await signOut(page, origin);
    await authenticator.withoutUserVerification();
    await passkeySignIn(page, origin);
    await expect(page.getByRole("alert").first()).toHaveText(
      /did not confirm it was you|cancelled/u,
    );
    await expect(page).toHaveURL(/\/portal\/sign-in/u);
    await authenticator.withUserVerification();

    // Removed, it no longer works.
    await passkeySignIn(page, origin);
    await expect(page).toHaveURL(`${origin}/portal`, { timeout: 30_000 });
    await page.goto(`${origin}/portal/security`);
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("button", { name: "Remove passkey Test laptop" })
      .click();
    await expect(page.getByText("You have no passkeys yet.")).toBeVisible();
    await signOut(page, origin);
    await passkeySignIn(page, origin);
    await expect(page.getByRole("alert").first()).toHaveText(
      /not registered for SANDHI/u,
    );

    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const actions = (
      await db.auditLog.findMany({
        where: { entityId: user.id, action: { startsWith: "auth.passkey" } },
        select: { action: true },
      })
    ).map(({ action }) => action);
    expect(actions.sort()).toEqual([
      "auth.passkey_added",
      "auth.passkey_removed",
    ]);
  } finally {
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      await db.auditLog.deleteMany({
        where: { OR: [{ actorId: user.id }, { entityId: user.id }] },
      });
      await db.member.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
    await db.invitation.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});

test("passkey endpoints cannot be reached over HTTP", async ({ request }) => {
  for (const [method, endpoint] of [
    ["GET", "/api/auth/passkey/generate-register-options"],
    ["POST", "/api/auth/passkey/verify-registration"],
    ["GET", "/api/auth/passkey/generate-authenticate-options"],
    ["POST", "/api/auth/passkey/verify-authentication"],
    ["GET", "/api/auth/passkey/list-user-passkeys"],
    ["POST", "/api/auth/passkey/delete-passkey"],
  ] as const) {
    const response =
      method === "GET"
        ? await request.get(endpoint)
        : await request.post(endpoint, { data: {} });
    expect(response.status(), endpoint).toBe(404);
  }
});
