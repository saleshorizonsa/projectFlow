"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DiscardChangesDialog } from "@/components/ui/discard-changes-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateGapImpact } from "@/lib/gap-impact";
import { gapUpdateSchema } from "@/lib/validators";

type GapEditValues = z.infer<typeof gapUpdateSchema>;

export type EditableGap = {
  id: string;
  gapId: string;
  title: string;
  description: string;
  severity: NonNullable<GapEditValues["severity"]>;
  impact: string;
  rootCause: string;
  targetClosureDate: string;
  status: NonNullable<GapEditValues["status"]>;
};

const severities: NonNullable<GapEditValues["severity"]>[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: NonNullable<GapEditValues["status"]>[] = ["OPEN", "INVESTIGATING", "ACTION_PLANNED", "IN_PROGRESS", "CLOSED"];

export function GapEditDialog({ gap, compact = false }: { gap: EditableGap; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<GapEditValues>({
    resolver: zodResolver(gapUpdateSchema),
    defaultValues: {
      gapId: gap.gapId,
      title: gap.title,
      description: gap.description,
      severity: gap.severity,
      rootCause: gap.rootCause,
      targetClosureDate: new Date(gap.targetClosureDate),
      status: gap.status,
    },
  });
  const severity = form.watch("severity") ?? gap.severity;
  const status = form.watch("status") ?? gap.status;
  const calculatedImpact = calculateGapImpact(severity);

  function handleOpenChange(next: boolean) {
    if (!next && form.formState.isDirty) {
      setDiscardOpen(true);
    } else {
      setOpen(next);
    }
  }

  async function onSubmit(values: GapEditValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/gaps/${gap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Gap update failed.");
        return;
      }

      form.reset(values);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button size={compact ? "icon" : "sm"} variant={compact ? "ghost" : "outline"} className={compact ? "h-8 w-8" : undefined} aria-label="Edit gap">
            <Pencil className={compact ? "h-4 w-4" : "h-4 w-4"} />
            {!compact && "Edit"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Gap</DialogTitle>
            <DialogDescription>Update severity, status, root cause, and target closure date. Impact is calculated automatically.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
            <Field label="Gap ID" id="gapId"><Input id="gapId" {...form.register("gapId")} /></Field>
            <Field label="Target Closure" id="targetClosureDate"><Input id="targetClosureDate" type="date" defaultValue={gap.targetClosureDate.slice(0, 10)} {...form.register("targetClosureDate")} /></Field>
            <Field className="md:col-span-2" label="Title" id="title"><Input id="title" {...form.register("title")} /></Field>
            <Field className="md:col-span-2" label="Description" id="description"><Input id="description" {...form.register("description")} /></Field>
            <SelectField label="Severity" value={severity} values={severities} onValueChange={(value) => form.setValue("severity", value as GapEditValues["severity"])} />
            <SelectField label="Status" value={status} values={statuses} onValueChange={(value) => form.setValue("status", value as GapEditValues["status"])} />
            <CalculatedImpact impact={calculatedImpact} />
            <Field className="md:col-span-2" label="Root Cause" id="rootCause"><Input id="rootCause" {...form.register("rootCause")} /></Field>
            {message && <p className="text-sm text-destructive md:col-span-2">{message}</p>}
            <Button className="md:col-span-2" type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog
        open={discardOpen}
        onKeep={() => setDiscardOpen(false)}
        onDiscard={() => { setDiscardOpen(false); form.reset(); setOpen(false); }}
      />
    </>
  );
}

function Field({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function CalculatedImpact({ impact }: { impact: string }) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label>Calculated Impact</Label>
      <div className="min-h-10 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm leading-5 text-muted-foreground">
        {impact}
      </div>
    </div>
  );
}

function SelectField({ label, value, values, onValueChange }: { label: string; value: string; values: string[]; onValueChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
