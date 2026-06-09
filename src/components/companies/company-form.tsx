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
import { companySchema } from "@/lib/validators";

type CompanyFormValues = z.infer<typeof companySchema>;

export function CompanyForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { code: "", name: "", description: "", active: true },
  });

  async function onSubmit(values: CompanyFormValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Company could not be created.");
        return;
      }

      form.reset({ code: "", name: "", description: "", active: true });
      setMessage("Company created.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Add Group Company</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <Field label="Company Code" id="code"><Input id="code" placeholder="CO-A" {...form.register("code")} /></Field>
          <Field label="Company Name" id="name"><Input id="name" placeholder="Group Company A" {...form.register("name")} /></Field>
          <Field className="md:col-span-2" label="Description" id="description"><Input id="description" {...form.register("description")} /></Field>
          {message && <p className="text-sm text-muted-foreground md:col-span-2">{message}</p>}
          <Button className="md:col-span-2" type="submit" disabled={pending}>{pending ? "Creating..." : "Create company"}</Button>
        </form>
      </CardContent>
    </Card>
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
