import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { isPathAllowed, MODULE_KEYS, type ModuleKey } from "@/lib/navigation";

const DISABLED_MODULES_KEY = "disabledModules";

/**
 * Modules switched off for this deployment. Stored as a disabled list so that
 * modules added in future releases are on by default. Falls back to "all on"
 * when the AppSetting table has not been migrated yet.
 */
export const readModuleSettings = cache(async (): Promise<{ disabledModules: ModuleKey[]; storageReady: boolean }> => {
  try {
    const row = await getPrisma().appSetting.findUnique({ where: { key: DISABLED_MODULES_KEY } });
    const value = Array.isArray(row?.value) ? row.value : [];
    return { disabledModules: MODULE_KEYS.filter((key) => value.includes(key)), storageReady: true };
  } catch {
    return { disabledModules: [], storageReady: false };
  }
});

export async function getDisabledModules() {
  return (await readModuleSettings()).disabledModules;
}

export async function saveDisabledModules(disabledModules: ModuleKey[], userId?: string) {
  await getPrisma().appSetting.upsert({
    where: { key: DISABLED_MODULES_KEY },
    create: { key: DISABLED_MODULES_KEY, value: disabledModules, updatedBy: userId ?? null },
    update: { value: disabledModules, updatedBy: userId ?? null },
  });
}

// Same DDL as migration 20261117090000_add_app_settings. Vercel builds don't run
// migrations, so admins can create the table from Settings → Modules instead.
const CREATE_APP_SETTING_TABLE = `CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
)`;

export async function ensureModuleStorage() {
  await getPrisma().$executeRawUnsafe(CREATE_APP_SETTING_TABLE);
}

/** Redirects to the dashboard when a section is switched off or above the user's role. */
export async function guardSection(href: string) {
  const session = await auth();
  const disabledModules = await getDisabledModules();
  if (!isPathAllowed(href, { role: session?.user.role ?? "VIEWER", disabledModules })) {
    redirect("/dashboard");
  }
}
