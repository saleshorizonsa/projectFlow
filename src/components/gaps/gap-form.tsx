"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateGapImpact } from "@/lib/gap-impact";
import { gapSchema } from "@/lib/validators";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";

type GapValues = z.infer<typeof gapSchema>;

type ProjectOption = {
  id: string;
  name: string;
  currentState: {
    summary: string;
    currentProcess: string;
    painPoints: string;
    risks: string;
    constraints: string;
    confidenceLevel: number;
  } | null;
  layers: {
    id: string;
    name: string;
    subLayers: { id: string; name: string }[];
  }[];
};

type UserOption = { id: string; name: string };

const severities: GapValues["severity"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: GapValues["status"][] = ["OPEN", "INVESTIGATING", "ACTION_PLANNED", "IN_PROGRESS", "CLOSED"];

export function GapForm({ projects, users }: { projects: ProjectOption[]; users: UserOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const firstProject = projects[0];
  const firstLayer = firstProject?.layers[0];
  const firstSubLayer = firstLayer?.subLayers[0];
  const firstUser = users[0];

  const form = useForm<GapValues>({
    resolver: zodResolver(gapSchema),
    defaultValues: {
      gapId: "",
      title: "",
      description: "",
      projectId: firstProject?.id ?? "",
      layerId: firstLayer?.id ?? "",
      subLayerId: firstSubLayer?.id ?? "",
      severity: "MEDIUM",
      rootCause: "",
      ownerId: firstUser?.id ?? "",
      targetClosureDate: new Date(),
      status: "OPEN",
    },
  });

  useUnsavedChangesWarning(form.formState.isDirty);
  const projectId = form.watch("projectId");
  const layerId = form.watch("layerId");
  const severity = form.watch("severity");
  const calculatedImpact = calculateGapImpact(severity);
  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId), [projectId, projects]);
  const selectedLayer = useMemo(() => selectedProject?.layers.find((layer) => layer.id === layerId), [layerId, selectedProject]);

  function selectProject(id: string) {
    const project = projects.find((item) => item.id === id);
    const layer = project?.layers[0];
    const subLayer = layer?.subLayers[0];
    form.setValue("projectId", id);
    form.setValue("layerId", layer?.id ?? "");
    form.setValue("subLayerId", subLayer?.id ?? "");
  }

  function selectLayer(id: string) {
    const layer = selectedProject?.layers.find((item) => item.id === id);
    form.setValue("layerId", id);
    form.setValue("subLayerId", layer?.subLayers[0]?.id ?? "");
  }

  async function onSubmit(values: GapValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const firstFieldError = body?.details?.fieldErrors ? Object.values(body.details.fieldErrors).flat()[0] : null;
        setMessage(firstFieldError ? `${body?.error}: ${firstFieldError}` : body?.error ?? "Gap could not be created.");
        return;
      }

      form.reset({ ...values, gapId: "", title: "", description: "", rootCause: "", status: "OPEN" });
      setMessage("Gap created. You can now create an action plan for it.");
      router.push("/gaps");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create Gap</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={form.handleSubmit(onSubmit)}>
          <CurrentStateContext currentState={selectedProject?.currentState ?? null} />
          <Field label="Gap ID" id="gapId"><Input id="gapId" placeholder="GAP-002" {...form.register("gapId")} /></Field>
          <Field label="Title" id="title"><Input id="title" {...form.register("title")} /></Field>
          <Picker label="Project" value={projectId} onValueChange={selectProject} items={projects.map((project) => ({ value: project.id, label: project.name }))} />
          <Picker label="Layer" value={layerId} onValueChange={selectLayer} items={(selectedProject?.layers ?? []).map((layer) => ({ value: layer.id, label: layer.name }))} />
          <Picker label="Sub Layer" value={form.watch("subLayerId") ?? ""} onValueChange={(value) => form.setValue("subLayerId", value)} items={(selectedLayer?.subLayers ?? []).map((subLayer) => ({ value: subLayer.id, label: subLayer.name }))} />
          <Picker label="Owner" value={form.watch("ownerId")} onValueChange={(value) => form.setValue("ownerId", value)} items={users.map((user) => ({ value: user.id, label: user.name }))} />
          <Picker label="Severity" value={form.watch("severity")} onValueChange={(value) => form.setValue("severity", value as GapValues["severity"])} items={severities.map((severity) => ({ value: severity, label: severity }))} />
          <Picker label="Status" value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as GapValues["status"])} items={statuses.map((status) => ({ value: status, label: status.replaceAll("_", " ") }))} />
          <Field className="md:col-span-2" label="Description" id="description"><Input id="description" {...form.register("description")} /></Field>
          <Field label="Target Closure" id="targetClosureDate"><Input id="targetClosureDate" type="date" {...form.register("targetClosureDate")} /></Field>
          <CalculatedImpact impact={calculatedImpact} />
          <Field className="md:col-span-2" label="Root Cause" id="rootCause"><Input id="rootCause" {...form.register("rootCause")} /></Field>
          {Object.values(form.formState.errors).length > 0 && <p className="text-sm text-destructive md:col-span-2 xl:col-span-4">Complete all required gap fields before submitting.</p>}
          {message && <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-4">{message}</p>}
          <Button className="md:col-span-2 xl:col-span-4" type="submit" disabled={pending || projects.length === 0 || users.length === 0}>{pending ? "Creating..." : "Create gap"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CurrentStateContext({ currentState }: { currentState: ProjectOption["currentState"] }) {
  return (
    <div className="rounded-md border bg-muted/30 p-4 text-sm md:col-span-2 xl:col-span-4">
      <div className="font-medium">Project Current State Context</div>
      {currentState ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Info label="Summary" value={currentState.summary} />
          <Info label="Current Process" value={currentState.currentProcess} />
          <Info label="Pain Points" value={currentState.painPoints} />
          <Info label="Risks" value={currentState.risks} />
          <Info label="Constraints" value={currentState.constraints} />
          <Info label="Confidence" value={`${currentState.confidenceLevel} / 5`} />
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">No current state assessment is available for this project yet. Capture it from the project detail page for better gap analysis.</p>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><div className="text-xs text-muted-foreground">{label}</div><div className="break-words font-medium leading-6">{value}</div></div>;
}

function Field({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return <div className={className ? `space-y-2 ${className}` : "space-y-2"}><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function CalculatedImpact({ impact }: { impact: string }) {
  return (
    <div className="space-y-2">
      <Label>Calculated Impact</Label>
      <div className="min-h-10 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm leading-5 text-muted-foreground">
        {impact}
      </div>
    </div>
  );
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
