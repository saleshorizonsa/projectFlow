"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { projectCurrentStateSchema } from "@/lib/validators";

type CurrentStateValues = z.infer<typeof projectCurrentStateSchema>;

type CurrentState = {
  summary: string;
  currentProcess: string;
  tools: string;
  resources: string;
  painPoints: string;
  risks: string;
  constraints: string;
  assessmentDate: string;
  assessedById: string;
  confidenceLevel: number;
} | null;

type UserOption = { id: string; name: string };

export function ProjectCurrentStateForm({ projectId, currentState, users, defaultAssessorId }: { projectId: string; currentState: CurrentState; users: UserOption[]; defaultAssessorId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<CurrentStateValues>({
    resolver: zodResolver(projectCurrentStateSchema),
    defaultValues: {
      summary: currentState?.summary ?? "",
      currentProcess: currentState?.currentProcess ?? "",
      tools: currentState?.tools ?? "",
      resources: currentState?.resources ?? "",
      painPoints: currentState?.painPoints ?? "",
      risks: currentState?.risks ?? "",
      constraints: currentState?.constraints ?? "",
      assessmentDate: currentState ? new Date(currentState.assessmentDate) : new Date(),
      assessedById: currentState?.assessedById ?? defaultAssessorId,
      confidenceLevel: currentState?.confidenceLevel ?? 3,
    },
  });

  async function onSubmit(values: CurrentStateValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/current-state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const firstFieldError = body?.details?.fieldErrors ? Object.values(body.details.fieldErrors).flat()[0] : null;
        setMessage(firstFieldError ? `${body?.error}: ${firstFieldError}` : body?.error ?? "Current state could not be saved.");
        return;
      }

      setMessage("Current state assessment saved.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current State Assessment</CardTitle>
        <CardDescription>Capture the current process, tools, resources, pain points, risks, and constraints before gap analysis.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <Field className="md:col-span-2" label="Current State Summary" id="summary"><Input id="summary" {...form.register("summary")} /></Field>
          <Field className="md:col-span-2" label="Current Process / Situation" id="currentProcess"><Input id="currentProcess" {...form.register("currentProcess")} /></Field>
          <Field label="Current Tools / Systems" id="tools"><Input id="tools" placeholder="0 or None if not applicable" {...form.register("tools")} /></Field>
          <Field label="Current Resources" id="resources"><Input id="resources" placeholder="0 or None if not applicable" {...form.register("resources")} /></Field>
          <Field className="md:col-span-2" label="Current Pain Points" id="painPoints"><Input id="painPoints" {...form.register("painPoints")} /></Field>
          <Field className="md:col-span-2" label="Current Risks" id="risks"><Input id="risks" {...form.register("risks")} /></Field>
          <Field className="md:col-span-2" label="Current Constraints" id="constraints"><Input id="constraints" {...form.register("constraints")} /></Field>
          <Field label="Assessment Date" id="assessmentDate"><Input id="assessmentDate" type="date" {...form.register("assessmentDate")} /></Field>
          <div className="space-y-2">
            <Label>Assessed By</Label>
            <Select value={form.watch("assessedById")} onValueChange={(value) => form.setValue("assessedById", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Confidence Level</Label>
            <Select value={String(form.watch("confidenceLevel"))} onValueChange={(value) => form.setValue("confidenceLevel", Number(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4, 5].map((level) => <SelectItem key={level} value={String(level)}>{level} / 5</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {Object.values(form.formState.errors).length > 0 && <p className="text-sm text-destructive md:col-span-2">Complete all current state fields before saving.</p>}
          {message && <p className="text-sm text-muted-foreground md:col-span-2">{message}</p>}
          <Button className="md:col-span-2" type="submit" disabled={pending}>{pending ? "Saving..." : "Save current state"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return <div className={className ? `space-y-2 ${className}` : "space-y-2"}><Label htmlFor={id}>{label}</Label>{children}</div>;
}
