"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Recycle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DISPOSAL_METHODS = [
  { id: "RECYCLED", label: "Recycled (certified e-waste)" },
  { id: "DESTROYED", label: "Physically destroyed" },
  { id: "RESOLD", label: "Resold / traded in" },
  { id: "RETURNED_TO_VENDOR", label: "Returned to vendor / lease" },
  { id: "DONATED", label: "Donated" },
  { id: "LOST", label: "Lost / stolen" },
  { id: "OTHER", label: "Other" },
];

// NIST SP 800-88 media sanitization categories
const SANITIZATION_METHODS = [
  { id: "CLEAR", label: "Clear (logical wipe / overwrite)" },
  { id: "PURGE", label: "Purge (crypto-erase / degauss)" },
  { id: "DESTROY", label: "Destroy (shred / incinerate)" },
  { id: "NOT_APPLICABLE", label: "Not applicable (no storage media)" },
];

const SANITIZATION_STATUSES = [
  { id: "COMPLETED", label: "Completed" },
  { id: "PENDING", label: "Pending" },
  { id: "NOT_REQUIRED", label: "Not required" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm";

export function AssetDecommissionDialog({ asset }: { asset: { id: string; assetTag: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [disposalDate, setDisposalDate] = useState(today);
  const [disposalMethod, setDisposalMethod] = useState("RECYCLED");
  const [sanitizationMethod, setSanitizationMethod] = useState("PURGE");
  const [sanitizationStatus, setSanitizationStatus] = useState("COMPLETED");
  const [disposalCertificate, setDisposalCertificate] = useState("");
  const [decommissionedBy, setDecommissionedBy] = useState("");
  const [disposalNotes, setDisposalNotes] = useState("");

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/it-assets/${asset.id}/decommission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposalDate,
          disposalMethod,
          sanitizationMethod,
          sanitizationStatus,
          disposalCertificate: disposalCertificate || null,
          decommissionedBy: decommissionedBy || null,
          disposalNotes: disposalNotes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to record decommission");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Recycle className="h-3.5 w-3.5 mr-1.5" />
        Decommission
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Decommission {asset.assetTag}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Record end-of-life disposal and media sanitization for <span className="font-medium">{asset.name}</span>. This retires the asset and adds an entry to its lifecycle history.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Disposal Date">
                <Input type="date" value={disposalDate} onChange={e => setDisposalDate(e.target.value)} />
              </Field>
              <Field label="Disposal Method">
                <select className={selectClass} value={disposalMethod} onChange={e => setDisposalMethod(e.target.value)}>
                  {DISPOSAL_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Sanitization Method (NIST 800-88)">
                <select className={selectClass} value={sanitizationMethod} onChange={e => setSanitizationMethod(e.target.value)}>
                  {SANITIZATION_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Sanitization Status">
                <select className={selectClass} value={sanitizationStatus} onChange={e => setSanitizationStatus(e.target.value)}>
                  {SANITIZATION_STATUSES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Certificate of Destruction / Disposal Reference">
              <Input value={disposalCertificate} onChange={e => setDisposalCertificate(e.target.value)} placeholder="e.g. CoD-2026-0142 or vendor reference" />
            </Field>
            <Field label="Decommissioned By">
              <Input value={decommissionedBy} onChange={e => setDecommissionedBy(e.target.value)} placeholder="Name / role of person who performed disposal" />
            </Field>
            <Field label="Notes">
              <textarea
                className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={disposalNotes}
                onChange={e => setDisposalNotes(e.target.value)}
                placeholder="Disposal vendor, chain-of-custody reference, data-bearing components handled…"
              />
            </Field>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Decommission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
