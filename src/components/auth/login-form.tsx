"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ArrowLeft } from "lucide-react";

type Step = "credentials" | "totp";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function handleCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const email = emailRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";

    startTransition(async () => {
      // Check if this account requires MFA before creating the session
      const res = await fetch("/api/auth/check-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.status === 423) {
        setError("Account is temporarily locked. Please try again in 30 minutes.");
        return;
      }

      if (!res.ok) {
        setError("Invalid email or password.");
        return;
      }

      const data = await res.json();

      if (data.mfaRequired) {
        // Keep credentials in refs (they're still in the DOM) and show TOTP step
        setStep("totp");
        return;
      }

      // No MFA — sign in directly
      const result = await signIn("credentials", {
        email,
        password,
        ip: "client",
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  function handleTotp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const email = emailRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";
    const formData = new FormData(event.currentTarget);
    const totp = formData.get("totp") as string;

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        totp,
        ip: "client",
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid authenticator code. Try again or use a backup code.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  if (step === "totp") {
    return (
      <form className="space-y-4" onSubmit={handleTotp}>
        {/* Hidden — keep in DOM so refs remain valid */}
        <input ref={emailRef} type="hidden" name="email" />
        <input ref={passwordRef} type="hidden" name="password" />

        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
          <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-700 dark:text-blue-300">Enter the 6-digit code from your authenticator app, or a backup code.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="totp">Authenticator Code</Label>
          <Input
            id="totp"
            name="totp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={12}
            required
            autoFocus
            className="text-center text-lg tracking-widest"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button className="w-full" type="submit" disabled={pending}>
          {pending ? "Verifying…" : "Verify & Sign in"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => { setStep("credentials"); setError(null); }}
          disabled={pending}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-4" method="post" onSubmit={handleCredentials}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" ref={emailRef} defaultValue="admin@pegms.local" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" ref={passwordRef} defaultValue="Password123!" required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
