"use client";

import { AlertTriangle, Building2, Pencil, PowerOff, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  logoUrl: string | null;
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
              <div className="flex items-center gap-3">
                <CompanyLogo logoUrl={company.logoUrl} name={company.name} size={36} />
                <div>
                  <div className="font-medium">{company.name}</div>
                  {company.description && <div className="text-xs text-muted-foreground">{company.description}</div>}
                </div>
              </div>
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

// ── Logo avatar ───────────────────────────────────────────────────────────────

function CompanyLogo({ logoUrl, name, size = 36 }: { logoUrl: string | null; name: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  if (logoUrl && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        className="rounded object-contain"
        style={{ width: size, height: size }}
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary"
      style={{ width: size, height: size }}
    >
      {initials || <Building2 className="h-4 w-4" />}
    </div>
  );
}

// ── Logo uploader (used inside edit dialog) ───────────────────────────────────

function LogoUploader({ company, onUpdate }: { company: CompanyRow; onUpdate: (url: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(company.logoUrl);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/companies/${company.id}/logo`, { method: "POST", body: fd });
    const body = await res.json().catch(() => null);
    setUploading(false);
    if (!res.ok) { toast.error(body?.error ?? "Logo upload failed."); return; }
    setPreview(body.logoUrl);
    onUpdate(body.logoUrl);
    toast.success("Logo uploaded");
  }

  async function removeLogo() {
    setUploading(true);
    const res = await fetch(`/api/companies/${company.id}/logo`, { method: "DELETE" });
    setUploading(false);
    if (!res.ok) { toast.error("Failed to remove logo."); return; }
    setPreview(null);
    onUpdate(null);
    toast.success("Logo removed");
  }

  return (
    <div className="space-y-2">
      <Label>Logo</Label>
      <div className="flex items-center gap-3">
        <CompanyLogo logoUrl={preview} name={company.name} size={56} />
        <div className="flex flex-col gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : preview ? "Replace" : "Upload"}
          </Button>
          {preview && (
            <Button type="button" size="sm" variant="ghost" disabled={uploading} onClick={removeLogo} className="text-destructive hover:text-destructive">
              <X className="h-4 w-4" /> Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, SVG or GIF · max 2 MB</p>
    </div>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function CompanyEditDialog({ company }: { company: CompanyRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(company.active);

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v) { setActive(company.active); setMessage(null); }
  }

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
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="h-4 w-4" /> Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Company</DialogTitle>
          <DialogDescription>Update the company name, code, logo, and availability for new project selection.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <LogoUploader company={company} onUpdate={() => router.refresh()} />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete dialog ─────────────────────────────────────────────────────────────

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

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
