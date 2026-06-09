"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEnum } from "@/lib/utils";

type CompanyOption = { id: string; name: string; code: string };
type AssetRow = { id: string; assetTag: string; name: string; type: string; companies: CompanyOption[] };

export type TeamRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedTasks: number;
  gapActions: number;
  ownedGaps: number;
  companies: CompanyOption[];
  assets: AssetRow[];
};

const roles = ["PROJECT_MANAGER", "TEAM_MEMBER", "VIEWER", "ADMIN"] as const;

export function TeamTable({ users, companies, canManage }: { users: TeamRow[]; companies: CompanyOption[]; canManage: boolean }) {
  const router = useRouter();

  async function deleteUser(user: TeamRow) {
    if (!window.confirm(`Delete team member "${user.name}"?`)) return;
    const response = await fetch(`/api/team/${user.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null);
    if (!response.ok) window.alert(body?.error ?? "Team member delete failed.");
    if (response.ok && body?.reassignedTo) window.alert("Team member deleted. Existing responsibilities were reassigned to your admin account.");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Companies</TableHead>
                <TableHead>Assets Provided</TableHead>
                <TableHead>Workload</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{formatEnum(user.role)}</Badge></TableCell>
                  <TableCell><CompanyBadges companies={user.companies} fallback="Group-wide" /></TableCell>
                  <TableCell><AssetSummary assets={user.assets} /></TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">
                      {user.assignedTasks} tasks / {user.gapActions} actions / {user.ownedGaps} gaps
                    </div>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <TeamEditDialog user={user} companies={companies} />
                        <Button size="icon" variant="ghost" onClick={() => deleteUser(user)} aria-label="Delete team member"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-3 md:hidden">
          {users.map((user) => (
            <div key={user.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </div>
                <Badge className="shrink-0" variant="secondary">{formatEnum(user.role)}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                <CompanyBadges companies={user.companies} fallback="Group-wide" />
                <AssetSummary assets={user.assets} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                <div><div className="text-base font-semibold text-foreground">{user.assignedTasks}</div>Tasks</div>
                <div><div className="text-base font-semibold text-foreground">{user.gapActions}</div>Actions</div>
                <div><div className="text-base font-semibold text-foreground">{user.ownedGaps}</div>Gaps</div>
              </div>
              {canManage && (
                <div className="mt-3 flex justify-end gap-2">
                  <TeamEditDialog user={user} companies={companies} />
                  <Button size="sm" variant="outline" onClick={() => deleteUser(user)}><Trash2 className="h-4 w-4" /> Delete</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamEditDialog({ user, companies }: { user: TeamRow; companies: CompanyOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(user.role);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(user.companies.map((company) => company.id));

  function toggleCompany(companyId: string, checked: boolean) {
    setSelectedCompanyIds((current) => checked ? Array.from(new Set([...current, companyId])) : current.filter((id) => id !== companyId));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/team/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
          role,
          companyIds: selectedCompanyIds,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Team member update failed.");
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="h-4 w-4" /> Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Team Member</DialogTitle>
          <DialogDescription>Update user details, role, and company support scope.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <Field label="Name" id="name"><Input id="name" name="name" defaultValue={user.name} /></Field>
          <Field label="Email" id="email"><Input id="email" name="email" type="email" defaultValue={user.email} /></Field>
          <Field label="New Password" id="password"><Input id="password" name="password" type="password" placeholder="Leave blank to keep current password" /></Field>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roles.map((item) => <SelectItem key={item} value={item}>{formatEnum(item)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label>Supported Companies</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {companies.map((company) => (
                <label key={company.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium">
                  <input className="h-4 w-4 shrink-0 rounded border-input" type="checkbox" checked={selectedCompanyIds.includes(company.id)} onChange={(event) => toggleCompany(company.id, event.target.checked)} />
                  <span className="min-w-0 truncate">{company.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{company.code}</span>
                </label>
              ))}
            </div>
          </div>
          {message && <p className="text-sm text-destructive">{message}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CompanyBadges({ companies, fallback }: { companies: CompanyOption[]; fallback?: string }) {
  if (companies.length === 0) return <span className="text-xs text-muted-foreground">{fallback ?? "Not assigned"}</span>;
  return (
    <div className="flex max-w-80 flex-wrap gap-1">
      {companies.map((company) => <Badge key={company.id} variant="outline">{company.code}</Badge>)}
    </div>
  );
}

function AssetSummary({ assets }: { assets: AssetRow[] }) {
  if (assets.length === 0) return <span className="text-xs text-muted-foreground">No assets assigned</span>;
  return (
    <div className="flex max-w-96 flex-wrap gap-1">
      {assets.slice(0, 4).map((asset) => <Badge key={asset.id} variant="secondary">{asset.assetTag}</Badge>)}
      {assets.length > 4 && <Badge variant="outline">+{assets.length - 4}</Badge>}
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
