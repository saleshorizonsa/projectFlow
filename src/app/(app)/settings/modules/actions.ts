"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { ensureModuleStorage, saveDisabledModules } from "@/lib/modules";
import { MODULE_KEYS } from "@/lib/navigation";

export async function saveModuleSettings(formData: FormData) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const enabled = new Set(formData.getAll("enabled").map(String));
  const disabledModules = MODULE_KEYS.filter((key) => !enabled.has(key));

  let result = "saved=1";
  try {
    await saveDisabledModules(disabledModules, session.user.id);
    await audit({ userId: session.user.id, action: "UPDATE", entity: "AppSetting", entityId: "disabledModules", detail: { disabledModules } });
    // Menus live in the shared app layout, so refresh every page.
    revalidatePath("/", "layout");
  } catch {
    result = "error=1";
  }
  redirect(`/settings/modules?${result}`);
}

export async function setupModuleStorage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  let result = "setup=1";
  try {
    await ensureModuleStorage();
    await audit({ userId: session.user.id, action: "CREATE", entity: "AppSetting", entityId: "table" });
  } catch {
    result = "error=setup";
  }
  redirect(`/settings/modules?${result}`);
}
