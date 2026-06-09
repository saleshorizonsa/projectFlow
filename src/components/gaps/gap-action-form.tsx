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
import { gapActionSchema } from "@/lib/validators";

type GapActionValues = z.infer<typeof gapActionSchema>;
type GapOption = { id: string; label: string };
type UserOption = { id: string; name: string };

const statuses: GapActionValues["status"][] = ["PLANNED", "IN_PROGRESS", "COMPLETED"];

export function GapActionForm({ gaps, users }: { gaps: GapOption[]; users: UserOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<GapActionValues>({
    resolver: zodResolver(gapActionSchema),
    defaultValues: {
      actionId: "",
      gapId: gaps[0]?.id ?? "",
      correctiveAction: "",
      responsibleId: users[0]?.id ?? "",
      dueDate: new Date(),
      status: "PLANNED",
      progress: 0,
    },
  });

  async function onSubmit(values: GapActionValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/gap-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const firstFieldError = body?.details?.fieldErrors ? Object.values(body.details.fieldErrors).flat()[0] : null;
        setMessage(firstFieldError ? `${body?.error}: ${firstFieldError}` : body?.error ?? "Action plan could not be created.");
        return;
      }

      form.reset({
        actionId: "",
        gapId: values.gapId,
        correctiveAction: "",
        responsibleId: values.responsibleId,
        status: "PLANNED",
        progress: 0,
        dueDate: new Date(),
      });
      setMessage("Action plan created and linked to the gap.");
      router.push("/gaps");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create Action Plan</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={form.handleSubmit(onSubmit)}>
          {gaps.length === 0 && <p className="text-sm text-destructive md:col-span-2 xl:col-span-4">Create a gap first. Action plans must be linked to an existing gap.</p>}
          <Field label="Action ID" id="actionId"><Input id="actionId" placeholder="ACT-002" {...form.register("actionId")} /></Field>
          <Picker label="Gap" value={form.watch("gapId")} onValueChange={(value) => form.setValue("gapId", value)} items={gaps.map((gap) => ({ value: gap.id, label: gap.label }))} />
          <Picker label="Responsible" value={form.watch("responsibleId")} onValueChange={(value) => form.setValue("responsibleId", value)} items={users.map((user) => ({ value: user.id, label: user.name }))} />
          <Picker label="Status" value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as GapActionValues["status"])} items={statuses.map((status) => ({ value: status, label: status.replaceAll("_", " ") }))} />
          <Field className="md:col-span-2" label="Corrective Action" id="correctiveAction"><Input id="correctiveAction" {...form.register("correctiveAction")} /></Field>
          <Field label="Due Date" id="dueDate"><Input id="dueDate" type="date" {...form.register("dueDate")} /></Field>
          <Field label="Progress %" id="progress"><Input id="progress" type="number" min="0" max="100" {...form.register("progress")} /></Field>
          {Object.values(form.formState.errors).length > 0 && (
            <p className="text-sm text-destructive md:col-span-2 xl:col-span-4">Complete all required action plan fields before submitting.</p>
          )}
          {message && <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-4">{message}</p>}
          <Button className="md:col-span-2 xl:col-span-4" type="submit" disabled={pending || gaps.length === 0 || users.length === 0}>{pending ? "Creating..." : "Create action plan"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return <div className={className ? `space-y-2 ${className}` : "space-y-2"}><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function Picker({ label, value, onValueChange, items }: { label: string; value: string; onValueChange: (value: string) => void; items: { value: string; label: string }[] }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
        <SelectContent>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
