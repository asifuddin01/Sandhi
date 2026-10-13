"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import {
  AdminActionError,
  invalidate,
  recordAudit,
  runAdminAction,
  type ActionState,
} from "@/lib/admin/actions";
import { cacheTags } from "@/lib/cache-tags";
import { getDb } from "@/lib/db";
import { intakeTypes, isDay, parseIntake, type Intake } from "@/lib/intake";
import {
  parseSiteSettings,
  readSettingsForm,
  settingKeys,
  storedSettingValues,
} from "@/lib/site-settings-schema";

export async function updateSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("settings:manage", async (viewer) => {
    const { values, problems } = readSettingsForm(
      (name) => {
        const value = formData.get(name);
        return typeof value === "string" ? value : "";
      },
      (name) => formData.get(name) === "on",
    );
    if (problems.length > 0) {
      throw new AdminActionError(
        problems.map((problem) => problem.message).join(" "),
      );
    }

    const db = getDb();
    const before = storedSettingValues(
      parseSiteSettings(
        await db.siteSetting.findMany({ select: { key: true, value: true } }),
      ),
    );
    const changed = Object.entries(values).filter(
      ([key, value]) => JSON.stringify(before[key]) !== JSON.stringify(value),
    );
    if (changed.length === 0) {
      return { status: "success", message: "Nothing changed." };
    }

    await db.$transaction(async (transaction) => {
      for (const [key, value] of changed) {
        const json = value as Prisma.InputJsonValue;
        await transaction.siteSetting.upsert({
          where: { key },
          update: { value: json },
          create: { key, value: json },
        });
      }
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "settings.update",
        entity: "SiteSetting",
        entityId: "site",
        diff: Object.fromEntries(
          changed.map(([key, value]) => [
            key,
            { from: before[key], to: value },
          ]),
        ) as Prisma.InputJsonValue,
      });
    });

    invalidate(cacheTags.settings);
    return { status: "success", message: "Settings saved." };
  });

  // Banners, menus, and hidden sections appear on every page.
  revalidatePath("/", "layout");
  return result;
}

/** Which applications are open and until when, saved from the join page. */
export async function updateIntakeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("settings:manage", async (viewer) => {
    const next = {} as Intake;
    for (const type of intakeTypes) {
      const day = formData.get(`${type}.deadline`);
      const deadline = typeof day === "string" ? day.trim() : "";
      if (deadline && !isDay(deadline)) {
        throw new AdminActionError("A closing day needs a real date.");
      }
      next[type] = {
        open: formData.get(`${type}.open`) === "on",
        deadline: deadline || null,
      };
    }

    const db = getDb();
    const key = settingKeys.intake;
    const before = parseIntake(
      (await db.siteSetting.findUnique({ where: { key } }))?.value,
    );
    if (JSON.stringify(before) === JSON.stringify(next)) {
      return { status: "success", message: "Nothing changed." };
    }

    await db.$transaction(async (transaction) => {
      await transaction.siteSetting.upsert({
        where: { key },
        update: { value: next },
        create: { key, value: next },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "settings.update",
        entity: "SiteSetting",
        entityId: "site",
        diff: { [key]: { from: before, to: next } },
      });
    });

    invalidate(cacheTags.settings);
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/join");
  return result;
}
