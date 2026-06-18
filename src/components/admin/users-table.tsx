"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  image: string | null;
  roleId: string;
  roleName: string;
  companies: { id: string; name: string; code: string }[];
  createdAt: string;
};

type RoleOption = { id: string; name: string };
type CompanyOption = { id: string; name: string; code: string };

// ---------------------------------------------------------------------------
// Role badge colors
// ---------------------------------------------------------------------------

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  PROJECT_MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  TEAM_MEMBER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  VIEWER: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

// ---------------------------------------------------------------------------
// UsersTable
// ---------------------------------------------------------------------------

export function UsersTable({
  users,
  roles,
  companies,
  currentUserId,
}: {
  users: UserRow[];
  roles: RoleOption[];
  companies: CompanyOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function safeJson(res: Response, fallback: string): Promise<string> {
    try {
      const j = await res.json();
      return j.error ?? fallback;
    } catch {
      return fallback;
    }
  }

  async function handleCreate(data: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setError(await safeJson(res, "Failed to create user"));
      return false;
    }
    startTransition(() => router.refresh());
    setShowCreate(false);
    return true;
  }

  async function handleEdit(id: string, data: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setError(await safeJson(res, "Failed to save changes"));
      return false;
    }
    startTransition(() => router.refresh());
    setEditUser(null);
    return true;
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await safeJson(res, "Failed to delete user"));
      return false;
    }
    startTransition(() => router.refresh());
    setDeleteUser(null);
    return true;
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        {(["ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER", "VIEWER"] as const).map((role) => {
          const count = users.filter((u) => u.roleName === role).length;
          return (
            <div
              key={role}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium",
                ROLE_STYLES[role],
              )}
            >
              <Users className="h-3.5 w-3.5" />
              {count} {role.replace("_", " ").toLowerCase()}
            </div>
          );
        })}
        <Button className="ml-auto" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add User
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Companies</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm leading-tight">{user.name}</div>
                      {user.phone && (
                        <div className="text-[11px] text-muted-foreground">{user.phone}</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                      ROLE_STYLES[user.roleName],
                    )}
                  >
                    {user.roleName.replace("_", " ")}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.companies.length > 0 ? (
                      user.companies.map((c) => (
                        <Badge key={c.id} variant="outline" className="text-[10px]">
                          {c.code}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditUser(user)}
                      title="Edit user"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      disabled={user.id === currentUserId}
                      onClick={() => setDeleteUser(user)}
                      title="Delete user"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <UserFormDialog
          mode="create"
          roles={roles}
          companies={companies}
          currentUserId={currentUserId}
          isSelf={false}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Edit Dialog */}
      {editUser && (
        <UserFormDialog
          mode="edit"
          initial={editUser}
          roles={roles}
          companies={companies}
          currentUserId={currentUserId}
          isSelf={editUser.id === currentUserId}
          onSubmit={(data) => handleEdit(editUser.id, data)}
          onClose={() => setEditUser(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteUser && (
        <Dialog open onOpenChange={(o) => !o && setDeleteUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete user?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete{" "}
              <strong className="text-foreground">{deleteUser.name}</strong> (
              {deleteUser.email}). This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteUser(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleDelete(deleteUser.id)}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserFormDialog
// ---------------------------------------------------------------------------

function UserFormDialog({
  mode,
  initial,
  roles,
  companies,
  isSelf,
  onSubmit,
  onClose,
}: {
  mode: "create" | "edit";
  initial?: UserRow;
  roles: RoleOption[];
  companies: CompanyOption[];
  currentUserId: string;
  isSelf: boolean;
  onSubmit: (data: Record<string, unknown>) => Promise<boolean | void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [roleId, setRoleId] = useState(initial?.roleId ?? roles[0]?.id ?? "");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(
    initial?.companies.map((c) => c.id) ?? [],
  );
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleCompany(id: string) {
    setSelectedCompanyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSubmit() {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (mode === "create" && !password.trim()) {
      setError("Password is required.");
      return;
    }
    setError(null);

    const data: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      roleId,
      companyIds: selectedCompanyIds,
    };
    if (phone.trim()) data.phone = phone.trim();
    else if (mode === "edit") data.phone = "";
    if (mode === "create") data.password = password;
    if (mode === "edit" && password.trim()) data.password = password.trim();

    startTransition(async () => {
      const ok = await onSubmit(data);
      if (ok === false) {
        // error is shown in parent, but we can also keep the dialog open
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add New User" : `Edit ${initial?.name ?? "User"}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="u-name" className="text-xs">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-sm"
                placeholder="John Doe"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="u-email" className="text-xs">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-sm"
                placeholder="user@example.com"
              />
            </div>

            {/* Phone + Role */}
            <div className="space-y-1">
              <Label htmlFor="u-phone" className="text-xs">
                Phone
              </Label>
              <Input
                id="u-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+966..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select value={roleId} onValueChange={setRoleId} disabled={isSelf}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSelf && (
                <p className="text-[10px] text-muted-foreground">Cannot change your own role</p>
              )}
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <Label htmlFor="u-pw" className="text-xs">
              {mode === "create" ? (
                <>
                  Password <span className="text-destructive">*</span>
                </>
              ) : (
                "New Password (leave blank to keep current)"
              )}
            </Label>
            <Input
              id="u-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-8 text-sm"
              placeholder={mode === "edit" ? "••••••••" : undefined}
              autoComplete={mode === "create" ? "new-password" : "off"}
            />
          </div>

          {/* Companies multi-select */}
          <div className="space-y-1">
            <Label className="text-xs">Companies</Label>
            <div className="max-h-36 overflow-y-auto rounded-md border p-2 space-y-1">
              {companies.length === 0 && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  No active companies found.
                </p>
              )}
              {companies.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedCompanyIds.includes(c.id)}
                    onChange={() => toggleCompany(c.id)}
                    className="rounded accent-primary"
                  />
                  <span className="font-medium">{c.code}</span>
                  <span className="text-muted-foreground">{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={pending}>
            {pending
              ? mode === "create"
                ? "Creating…"
                : "Saving…"
              : mode === "create"
                ? "Create User"
                : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
