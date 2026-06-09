"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

export function CompanyTable({ companies, canManage }: { companies: CompanyRow[]; canManage: boolean }) {
  const router = useRouter();

  async function deleteCompany(company: CompanyRow) {
    if (!window.confirm(`Delete company "${company.name}"?`)) return;
    const response = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      window.alert(body?.error ?? "Company delete failed.");
    }
    router.refresh();
  }

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
                  <Button size="icon" variant="ghost" onClick={() => deleteCompany(company)} aria-label="Delete company"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
