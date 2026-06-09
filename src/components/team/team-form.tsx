"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { teamMemberSchema } from "@/lib/validators";

type TeamMemberValues = z.infer<typeof teamMemberSchema>;
type CompanyOption = { id: string; name: string; code: string };

const roles: TeamMemberValues["role"][] = ["PROJECT_MANAGER", "TEAM_MEMBER", "VIEWER", "ADMIN"];

export function TeamForm({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<TeamMemberValues>({
    resolver: zodResolver(teamMemberSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "Password123!",
      role: "TEAM_MEMBER",
      companyIds: [],
    },
  });
  const selectedCompanyIds = form.watch("companyIds") ?? [];

  function toggleCompany(companyId: string, checked: boolean) {
    const nextCompanyIds = checked
      ? Array.from(new Set([...selectedCompanyIds, companyId]))
      : selectedCompanyIds.filter((id) => id !== companyId);
    form.setValue("companyIds", nextCompanyIds, { shouldDirty: true, shouldValidate: true });
  }

  async function onSubmit(values: TeamMemberValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Team member could not be created.");
        return;
      }

      form.reset({ name: "", email: "", password: "Password123!", role: "TEAM_MEMBER", companyIds: [] });
      setMessage("Team member created and available for task assignment.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create Team Member</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Initial Password</Label>
            <Input id="password" type="password" {...form.register("password")} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select defaultValue="TEAM_MEMBER" onValueChange={(value) => form.setValue("role", value as TeamMemberValues["role"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>{role.replaceAll("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3 md:col-span-2 xl:col-span-4">
            <Label>Supported Companies</Label>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {companies.map((company) => (
                <label key={company.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium">
                  <input
                    className="h-4 w-4 shrink-0 rounded border-input"
                    type="checkbox"
                    checked={selectedCompanyIds.includes(company.id)}
                    onChange={(event) => toggleCompany(company.id, event.target.checked)}
                  />
                  <span className="min-w-0 truncate">{company.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{company.code}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Leave blank only for group-wide users such as admins.</p>
          </div>
          {message && <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-4">{message}</p>}
          <Button className="md:col-span-2 xl:col-span-4" type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create team member"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
