"use client";

import { AlertTriangle, Pencil, PowerOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CompanyRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  _count: { projects: number };
};

type LinkedCounts = {
  projects: number;
  employees: number;
  users: number;
  assets: number;
  tickets: number;
  incidents: number;
  playbooks: number;
};

export function CompanyTable({ companies, canManage }: { companies: CompanyRow[]; canManage: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Projects</TableHead>
          {canManage && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company) => (
          <TableRow key={company.id}>
            <TableCell className="font-medium">{company.code}</TableCell>
            <TableCell>
              <div className="font-medium">{company.name}</div>
              {company.description && <div className="text-xs text-muted-foreground">{company.description}</div>}
            </TableCell>
            <TableCell><Badge variant={company.active ? "success" : "secondary"}>{company.active ? "Active" : "Inactive"}</Badge></TableCell>
            <TableCell>{company._count.projects}</TableCell>
            {canManage && (
              <TableCell>
                <div className="flex justify-end gap-2">
                  <CompanyEditDialog company={company} />
                  <CompanyDeleteDialog company={company} />
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CompanyDeleteDialog({ company }: { company: CompanyRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<LinkedCounts | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpen(v: boolean) {
    setOpen(v);
    if (!v) setLinks(null);
  }

  function tryDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`"${company.name}" deleted`);
        setOpen(false);
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      if (res.status === 409 && body?.links) {
        setLinks(body.links as LinkedCounts);
      } else {
        toast.error(body?.error ?? "Delete failed.");
        setOpen(false);
      }
    });
  }

  function deactivate() {
    startTransition(async () => {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      if (res.ok) {
        toast.success(`"${company.name}" deactivated — data preserved`);
        setOpen(false);
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Deactivation failed.");
      }
    });
  }

  function forceDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/companies/${company.id}?force=true`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`"${company.name}" and all linked data deleted`);
        setOpen(false);
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Force delete failed.");
      }
    });
  }

  const hasLinks = links !== null;
  const linkSummary = hasLinks
    ? [
        links.projects > 0 && `${links.projects} project${links.projects !== 1 ? "s" : ""}`,
        links.employees > 0 && `${links.employees} employee${links.employees !== 1 ? "s" : ""}`,
        links.users > 0 && `${links.users} team member${links.users !== 1 ? "s" : ""}`,
        links.assets > 0 && `${links.assets} IT asset${links.assets !== 1 ? "s" : ""}`,
        links.tickets > 0 && `${links.tickets} support ticket${links.tickets !== 1 ? "s" : ""}`,
        links.incidents > 0 && `${links.incidents} incident${links.incidents !== 1 ? "s" : ""}`,
        links.playbooks > 0 && `${links.playbooks} playbook${links.playbooks !== 1 ? "s" : ""}`,
      ].filter(Boolean)
    : [];

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Delete company"><Trash2 className="h-4 w-4" /></Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {!hasLinks ? (
          <>
            <DialogHeader>
              <DialogTitle>Delete &ldquo;{company.name}&rdquo;?</DialogTitle>
              <DialogDescription>This will permanently delete the company. This cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button variant="destructive" onClick={tryDelete} disabled={pending}>
                {pending ? "Checking…" : "Delete"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                &ldquo;{company.name}&rdquo; has linked data
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 pt-1">
                  <p>This company is linked to:</p>
                  <ul className="ml-4 list-disc space-y-0.5 text-sm">
                    {linkSummary.map((item) => <li key={String(item)}>{item}</li>)}
                  </ul>
                  <p className="text-sm">Choose how to proceed:</p>
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-sm font-medium flex items-center gap-2"><PowerOff className="h-4 w-4 text-muted-foreground" />Deactivate (recommended)</p>
                <p className="text-xs text-muted-foreground">Hides the company from selection in new projects and forms. All linked data stays intact.</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={deactivate} disabled={pending || !company.active}>
                  {pending ? "Deactivating…" : company.active ? "Deactivate company" : "Already inactive"}
                </Button>
              </div>

              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                <p className="text-sm font-medium flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" />Force Delete</p>
                <p className="text-xs text-muted-foreground">
                  Permanently deletes the company and removes all linked records.
                  {links.tickets > 0 && <span className="font-semibold text-destructive"> Support tickets will be permanently deleted.</span>}
                  {" "}Projects, employees, assets and team members will be unlinked from this company.
                </p>
                <Button size="sm" variant="destructive" className="mt-2" onClick={forceDelete} disabled={pending}>
                  {pending ? "Deleting…" : "Force delete everything"}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompanyEditDialog({ company }: { company: CompanyRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(company.active);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.get("code"),
          name: formData.get("name"),
          description: formData.get("description"),
          active,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Company update failed.");
        return;
      }

      toast.success("Company updated");
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
          <DialogTitle>Edit Company</DialogTitle>
          <DialogDescription>Update the company name, code, and availability for new project selection.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <Field label="Code" id="code"><Input id="code" name="code" defaultValue={company.code} /></Field>
          <Field label="Name" id="name"><Input id="name" name="name" defaultValue={company.name} /></Field>
          <Field label="Description" id="description"><Input id="description" name="description" defaultValue={company.description ?? ""} /></Field>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input className="h-4 w-4 rounded border-input" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            Active for project selection
          </label>
          {message && <p className="text-sm text-destructive">{message}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
