"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RunAutomationButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runAutomation() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/automation/run", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(body?.error ?? "Automation run failed.");
        return;
      }
      const total = body.results?.reduce((sum: number, item: { count: number }) => sum + item.count, 0) ?? 0;
      setMessage(`Automation scan completed. ${total} item(s) evaluated.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button onClick={runAutomation} disabled={pending}>{pending ? "Running..." : "Run automation scan"}</Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
