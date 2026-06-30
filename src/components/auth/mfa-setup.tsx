"use client";

import { useState, useTransition } from "react";
import QRCode from "qrcode";
import { ShieldCheck, ShieldOff, Copy, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

type Props = { mfaEnabled: boolean };

export function MfaSetup({ mfaEnabled: initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Setup state
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [totpInput, setTotpInput] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  // Disable state
  const [disablePassword, setDisablePassword] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);

  async function openSetup() {
    setSetupError(null);
    setTotpInput("");
    setBackupCodes([]);
    setSecret("");
    setQrDataUrl("");
    setSetupOpen(true);

    const res = await fetch("/api/mfa/setup");
    if (!res.ok) { setSetupError("Failed to generate setup data."); return; }
    const { secret: s, otpAuthUrl } = await res.json();
    setSecret(s);
    try {
      const url = await QRCode.toDataURL(otpAuthUrl, { width: 200, margin: 1 });
      setQrDataUrl(url);
    } catch {
      setSetupError("Failed to render QR code.");
    }
  }

  function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setSetupError(null);
    startTransition(async () => {
      const res = await fetch("/api/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, totp: totpInput }),
      });
      const data = await res.json();
      if (!res.ok) { setSetupError(data.error ?? "Verification failed."); return; }
      setBackupCodes(data.backupCodes);
      setEnabled(true);
    });
  }

  function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisableError(null);
    startTransition(async () => {
      const res = await fetch("/api/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (!res.ok) { setDisableError(data.error ?? "Failed to disable MFA."); return; }
      setEnabled(false);
      setDisablePassword("");
      setDisableOpen(false);
    });
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {enabled
          ? <ShieldCheck className="h-5 w-5 text-green-600" />
          : <ShieldOff className="h-5 w-5 text-muted-foreground" />
        }
        <div>
          <p className="text-sm font-medium">Two-Factor Authentication (TOTP)</p>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Your account is protected with an authenticator app." : "Add a second layer of security to your account."}
          </p>
        </div>
        <Badge variant={enabled ? "success" : "secondary"}>{enabled ? "Enabled" : "Disabled"}</Badge>
      </div>

      {enabled ? (
        <Button variant="outline" size="sm" onClick={() => { setDisableError(null); setDisablePassword(""); setDisableOpen(true); }}>
          Disable
        </Button>
      ) : (
        <Button size="sm" onClick={openSetup}>Enable MFA</Button>
      )}

      {/* ── MFA Setup Dialog ── */}
      <Dialog open={setupOpen} onOpenChange={(v) => { if (!pending) setSetupOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              {backupCodes.length === 0
                ? "Scan the QR code with Google Authenticator, Authy, or any TOTP app."
                : "MFA is now enabled. Save your backup codes — they will not be shown again."}
            </DialogDescription>
          </DialogHeader>

          {backupCodes.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Backup Codes (one-time use)</p>
                <div className="grid grid-cols-2 gap-1">
                  {backupCodes.map((c) => (
                    <code key={c} className="rounded bg-background px-2 py-1 text-center font-mono text-sm">{c}</code>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Store these in a password manager. Each code can only be used once.</p>
              <Button className="w-full" onClick={() => setSetupOpen(false)}>Done</Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleEnable}>
              <div className="flex justify-center">
                {qrDataUrl
                  ? <img src={qrDataUrl} alt="Scan with authenticator app" width={200} height={200} className="rounded-md border" />
                  : <div className="h-[200px] w-[200px] animate-pulse rounded-md bg-muted" />
                }
              </div>

              {secret && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Can&apos;t scan? Enter this key manually:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded border bg-muted/40 px-2 py-1 font-mono text-xs break-all">
                      {showSecret ? secret : "•".repeat(secret.length)}
                    </code>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setShowSecret(!showSecret)}>
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={copySecret}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="totp-verify">Enter the 6-digit code to confirm</Label>
                <Input
                  id="totp-verify"
                  value={totpInput}
                  onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                  autoComplete="one-time-code"
                />
              </div>

              {setupError && <p className="text-sm text-destructive">{setupError}</p>}

              <Button className="w-full" type="submit" disabled={pending || totpInput.length !== 6 || !secret}>
                {pending ? "Verifying…" : "Verify & Enable"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Disable Confirmation ── */}
      <AlertDialog open={disableOpen} onOpenChange={(v) => { if (!pending) setDisableOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove MFA protection from your account. Enter your password to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={handleDisable} className="space-y-3 pt-1">
            <Input
              type="password"
              placeholder="Current password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              autoFocus
            />
            {disableError && <p className="text-sm text-destructive">{disableError}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending} onClick={() => setDisableOpen(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit" disabled={pending || !disablePassword} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {pending ? "Disabling…" : "Disable MFA"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
