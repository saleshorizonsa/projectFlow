import { redirect } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { readModuleSettings } from "@/lib/modules";
import { MODULES, NAV_GROUPS } from "@/lib/navigation";
import { saveModuleSettings, setupModuleStorage } from "./actions";

export const metadata = { title: "Modules" };

export default async function ModulesSettingsPage({ searchParams }: { searchParams?: Promise<{ saved?: string; error?: string; setup?: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const { disabledModules, storageReady } = await readModuleSettings();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Modules</CardTitle>
            <CardDescription>
              Turn sections on or off for this workspace. Switched-off sections disappear from the menu and their pages can no longer be opened. No data is deleted.
            </CardDescription>
          </div>
          <LayoutGrid className="h-5 w-5 shrink-0 text-primary" />
        </CardHeader>
      </Card>

      {!storageReady && (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">One-time setup needed</div>
            <div className="text-muted-foreground">
              Module settings need a small settings table in the database. Until it&apos;s set up, every module stays on. Existing data is not changed.
            </div>
          </div>
          <form action={setupModuleStorage}>
            <Button type="submit" className="shrink-0">Set up module settings</Button>
          </form>
        </div>
      )}
      {params.setup && storageReady && <div role="status" className="rounded-md border border-primary/30 bg-primary/10 p-4 text-sm">Setup complete. You can now turn modules on or off.</div>}
      {params.saved && <div role="status" className="rounded-md border border-primary/30 bg-primary/10 p-4 text-sm">Module settings saved.</div>}
      {params.error === "setup" && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">Setup failed. Please try again, or contact support if it keeps failing.</div>}
      {params.error && params.error !== "setup" && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">Module settings could not be saved. Please try again.</div>}

      <form action={saveModuleSettings}>
        <Card>
          <CardContent className="divide-y p-0">
            {MODULES.map((module) => {
              const group = NAV_GROUPS.find((candidate) => candidate.module === module.key);
              const Icon = group?.icon ?? LayoutGrid;
              const inputId = `module-${module.key}`;
              return (
                <label key={module.key} htmlFor={inputId} className="flex cursor-pointer items-start gap-4 p-4 hover:bg-accent/50">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{module.label}</div>
                    <div className="text-sm text-muted-foreground">{module.description}</div>
                    {group && <div className="mt-1 text-xs text-muted-foreground">Pages: {group.items.map((item) => item.label).join(", ")}</div>}
                  </div>
                  <input
                    id={inputId}
                    type="checkbox"
                    name="enabled"
                    value={module.key}
                    defaultChecked={!disabledModules.includes(module.key)}
                    disabled={!storageReady}
                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-primary"
                  />
                </label>
              );
            })}
          </CardContent>
        </Card>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Home, Notifications, Calendar and Settings are always available.</p>
          <Button type="submit" disabled={!storageReady}>Save changes</Button>
        </div>
      </form>
    </div>
  );
}
