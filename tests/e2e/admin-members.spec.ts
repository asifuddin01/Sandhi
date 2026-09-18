import { expect, test, type Browser, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

const PASSWORD = "fixture-password-2026";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/**
 * Opens a page and waits until it is interactive before the test acts. In
 * development, a route compiling for the first time can reload the page while
 * a test is typing or clicking.
 */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function signIn(page: Page, email: string, next = "/admin") {
  await open(page, `/portal/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`, "u"));
}

async function signedInPage(browser: Browser, email: string, next: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email, next);
  return page;
}

/**
 * The hidden fields that let a server-action form post without JavaScript,
 * read from the server's HTML (React removes them once the page hydrates).
 */
function actionFields(html: string, fieldName: string): Record<string, string> {
  const form = html
    .split("<form")
    .find((segment) => segment.includes(`name="${fieldName}"`));
  if (!form) return {};
  const decode = (value: string) =>
    value.replaceAll("&quot;", '"').replaceAll("&amp;", "&");
  return Object.fromEntries(
    Array.from(
      form.matchAll(
        /<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gu,
      ),
      (match) => [match[1]!, decode(match[2] ?? "")],
    ),
  );
}

async function memberIdFor(email: string): Promise<string> {
  const db = createPrismaClient();
  try {
    const member = await db.member.findFirstOrThrow({
      where: { user: { email } },
      select: { id: true },
    });
    return member.id;
  } finally {
    await db.$disconnect();
  }
}

test("an administrator invites someone and can withdraw the invitation", async ({
  page,
}) => {
  const email = `invite-${Date.now()}@sandhi.test`;
  const db = createPrismaClient();

  try {
    await signIn(page, "fixture-admin@sandhi.test", "/admin/members");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Role").selectOption("REVIEWER");
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();

    const invitation = await db.invitation.findFirstOrThrow({
      where: { email, revokedAt: null },
    });
    expect(invitation.role).toBe("REVIEWER");
    expect(invitation.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(
      await db.auditLog.count({
        where: { action: "invitation.create", entityId: invitation.id },
      }),
    ).toBe(1);

    await page
      .getByRole("button", { name: `Withdraw invitation for ${email}` })
      .click();
    await expect(page.getByText("Invitation withdrawn.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: email })).toHaveCount(
      0,
    );

    const withdrawn = await db.invitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    expect(withdrawn.revokedAt).not.toBeNull();
  } finally {
    const invitations = await db.invitation.findMany({
      where: { email },
      select: { id: true },
    });
    await db.auditLog.deleteMany({
      where: { entityId: { in: invitations.map(({ id }) => id) } },
    });
    await db.invitation.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});

test("a member cannot invite or promote anyone, even by posting admin actions directly", async ({
  browser,
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const attackEmail = `escalation-${Date.now()}@sandhi.test`;
  const memberId = await memberIdFor("fixture-member@sandhi.test");
  const staffId = await memberIdFor("fixture-staff@sandhi.test");

  // Collect genuine action references from an administrator's pages.
  await signIn(page, "fixture-admin@sandhi.test", "/admin/members");
  const inviteFields = actionFields(
    await (await page.request.get("/admin/members")).text(),
    "email",
  );
  const accessFields = actionFields(
    await (await page.request.get(`/admin/members/${staffId}`)).text(),
    "rank",
  );
  expect(Object.keys(inviteFields).length).toBeGreaterThan(0);
  expect(Object.keys(accessFields).length).toBeGreaterThan(0);

  const member = await signedInPage(
    browser,
    "fixture-member@sandhi.test",
    "/portal",
  );
  const post = (path: string, fields: Record<string, string>) =>
    member.request.post(path, {
      headers: { Origin: origin },
      multipart: fields,
    });

  await post("/admin/members", {
    ...inviteFields,
    email: attackEmail,
    role: "ADMIN",
    rank: "DIRECTOR",
  });
  // Try to make themselves an administrator.
  await post(`/admin/members/${staffId}`, {
    ...accessFields,
    memberId,
    role: "ADMIN",
    rank: "DIRECTOR",
  });

  const db = createPrismaClient();
  try {
    expect(await db.invitation.count({ where: { email: attackEmail } })).toBe(
      0,
    );
    const self = await db.member.findUniqueOrThrow({
      where: { id: memberId },
      select: { rank: true, user: { select: { id: true, role: true } } },
    });
    expect(self.user?.role).toBe("MEMBER");
    expect(self.rank).toBe("RESEARCHER");
    expect(await db.auditLog.count({ where: { actorId: self.user!.id } })).toBe(
      0,
    );
  } finally {
    await db.$disconnect();
    await member.context().close();
  }
});

test("the Owner is protected and people cannot change their own access", async ({
  page,
}) => {
  const ownerId = await memberIdFor("fixture-owner@sandhi.test");
  const adminId = await memberIdFor("fixture-admin@sandhi.test");
  const staffId = await memberIdFor("fixture-staff@sandhi.test");

  await signIn(page, "fixture-admin@sandhi.test", `/admin/members/${ownerId}`);
  await expect(
    page.getByText("Only the Owner can change the Owner."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save access" })).toHaveCount(
    0,
  );

  await open(page, `/admin/members/${adminId}`);
  await expect(page.getByText(/This is your own account/u)).toBeVisible();

  // Only the Owner is offered ownership transfer.
  await open(page, `/admin/members/${staffId}`);
  await expect(
    page.getByRole("button", { name: /Transfer ownership/u }),
  ).toHaveCount(0);
});

test("suspending a member signs them out at once, and every change is audited", async ({
  browser,
  page,
}) => {
  // Two signed-in browsers and three saves in a row.
  test.slow();
  const staffId = await memberIdFor("fixture-staff@sandhi.test");
  const staff = await signedInPage(
    browser,
    "fixture-staff@sandhi.test",
    "/portal",
  );
  const db = createPrismaClient();

  try {
    await signIn(
      page,
      "fixture-admin@sandhi.test",
      `/admin/members/${staffId}`,
    );
    await page.getByRole("button", { name: "Suspend and sign out" }).click();
    await expect(
      page.getByText("Fixture Staff is suspended and has been signed out."),
    ).toBeVisible();

    await open(staff, "/portal");
    await expect(staff).toHaveURL(/\/portal\/sign-in/u);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Make active" }).click();
    await expect(
      page.getByText("Fixture Staff is active again."),
    ).toBeVisible();

    await page.getByLabel("Rank").selectOption("INTERN");
    await page.getByRole("button", { name: "Save access" }).click();
    await expect(page.getByText("Access updated.")).toBeVisible();

    const actions = await db.auditLog.findMany({
      where: { entity: "Member", entityId: staffId },
      orderBy: { createdAt: "asc" },
      select: { action: true, diff: true },
    });
    expect(actions.map(({ action }) => action)).toEqual([
      "member.status",
      "member.status",
      "member.access",
    ]);
    expect(actions[2]?.diff).toMatchObject({
      rank: { from: "RESEARCHER", to: "INTERN" },
    });
  } finally {
    await db.auditLog.deleteMany({
      where: { entity: "Member", entityId: staffId },
    });
    await db.member.update({
      where: { id: staffId },
      data: { status: "ACTIVE", rank: "RESEARCHER", leftAt: null },
    });
    await db.$disconnect();
    await staff.context().close();
  }
});

test("credited members keep their record; others are removed only by name", async ({
  page,
}) => {
  const db = createPrismaClient();
  const credited = await db.member.findUniqueOrThrow({
    where: { slug: "fixture-researcher-a" },
    select: { id: true },
  });
  const temporary = await db.member.create({
    data: {
      slug: `fixture-temporary-${Date.now()}`,
      name: "Fixture Temporary",
      rank: "INTERN",
      status: "ACTIVE",
    },
  });

  try {
    await signIn(
      page,
      "fixture-admin@sandhi.test",
      `/admin/members/${credited.id}`,
    );
    await expect(page.getByText(/is credited on lab work/u)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);

    await open(page, `/admin/members/${temporary.id}`);
    await page
      .getByRole("button", { name: "Remove Fixture Temporary" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Remove Fixture Temporary?",
    });
    await expect(
      dialog.getByRole("button", { name: "Remove member" }),
    ).toBeDisabled();
    await dialog
      .getByLabel(/Type Fixture Temporary to confirm/u)
      .fill("Fixture Temporary");
    await dialog.getByRole("button", { name: "Remove member" }).click();

    await expect(page).toHaveURL(/\/admin\/members$/u);
    expect(await db.member.count({ where: { id: temporary.id } })).toBe(0);
    expect(
      await db.auditLog.count({
        where: { action: "member.remove", entityId: temporary.id },
      }),
    ).toBe(1);
  } finally {
    await db.auditLog.deleteMany({ where: { entityId: temporary.id } });
    await db.member.deleteMany({ where: { id: temporary.id } });
    await db.$disconnect();
  }
});
