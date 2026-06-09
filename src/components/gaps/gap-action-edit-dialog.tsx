"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { gapActionUpdateSchema } from "@/lib/validators";

type GapActionEditValues = z.infer<typeof gapActionUpdateSchema>;

export type EditableGapAction = {
  id: string;
  actionId: string;
  correctiveAction: string;
  status: NonNullable<GapActionEditValues["status"]>;
  progress: number;
  dueDate: string;
  responsiblePerson?: { name: string };
};

const statuses: NonNullable<GapActionEditValues["status"]>[] = ["PLANNED", "IN_PROGRESS", "COMPLETED"];

export function GapActionEditDialog({ action }: { action: EditableGapAction }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<GapActionEditValues>({
    resolver: zodResolver(gapActionUpdateSchema),
    defaultValues: {
      actionId: action.actionId,
      correctiveAction: action.correctiveAction,
      status: action.status,
      progress: action.progress,
      dueDate: new Date(action.dueDate),
    },
  });

  async function onSubmit(values: GapActionEditValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/gap-actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Action plan update failed.");
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit action plan"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Action Plan</DialogTitle>
          <DialogDescription>Update the corrective action, progress, due date, and completion status.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <Field label="Action ID" id="actionId"><Input id="actionId" {...form.register("actionId")} /></Field>
          <Field label="Due Date" id="dueDate"><Input id="dueDate" type="date" defaultValue={action.dueDate.slice(0, 10)} {...form.register("dueDate")} /></Field>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select defaultValue={action.status} onValueChange={(value) => form.setValue("status", value as GapActionEditValues["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Field label="Progress %" id="progress"><Input id="progress" type="number" min="0" max="100" {...form.register("progress")} /></Field>
          <Field className="md:col-span-2" label="Corrective Action" id="correctiveAction"><Input id="correctiveAction" {...form.register("correctiveAction")} /></Field>
          {message && <p className="text-sm text-destructive md:col-span-2">{message}</p>}
          <Button className="md:col-span-2" type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return <div className={className ? `space-y-2 ${className}` : "space-y-2"}><Label htmlFor={id}>{label}</Label>{children}</div>;
}
