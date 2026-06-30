"use client";

import { useRef, useState } from "react";
import { Download, Upload, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ImportType = "employee" | "asset" | "license";
type CompanyOption = { id: string; name: string; code: string };

const TEMPLATES: Record<ImportType, { label: string; filename: string; headers: string[]; example: string[] }> = {
  employee: {
    label: "Employees",
    filename: "employee-import-template.csv",
    headers: ["employeeId", "name", "email", "phone", "department", "jobTitle", "location", "status", "ipAddress", "vpnUserId", "companyCodes"],
    example: ["EMP-001", "John Smith", "john@example.com", "+966501234567", "IT", "Engineer", "Riyadh", "ACTIVE", "", "", "CO-A;CO-B"],
  },
  asset: {
    label: "IT Assets",
    filename: "asset-import-template.csv",
    headers: ["assetTag", "name", "type", "vendor", "model", "location", "purchaseDate", "lifecycleYears", "status", "notes", "companyCodes"],
    example: ["SRV-001", "ERP Server", "SERVER", "Dell", "PowerEdge R740", "Server Room", "2024-01-15", "5", "ACTIVE", "", "CO-A"],
  },
  license: {
    label: "IT Licenses",
    filename: "license-import-template.csv",
    headers: ["licenseId", "name", "vendor", "seats", "cost", "expiryDate", "owner", "notes"],
    example: ["LIC-001", "Microsoft 365", "Microsoft", "50", "5000", "2025-12-31", "IT Dept", "Annual subscription"],
  },
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

function buildPayload(type: ImportType, data: Record<string, string>, companies: CompanyOption[]) {
  if (type === "employee") {
    const companyIds = (data.companyCodes ?? "")
      .split(";")
      .map((code) => companies.find((c) => c.code === code.trim())?.id)
      .filter(Boolean) as string[];
    return {
      employeeId: data.employeeId,
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      department: data.department,
      jobTitle: data.jobTitle,
      location: data.location || undefined,
      status: data.status || "ACTIVE",
      ipAddress: data.ipAddress || undefined,
      vpnUserId: data.vpnUserId || undefined,
      companyIds,
    };
  }
  if (type === "asset") {
    const companyIds = (data.companyCodes ?? "")
      .split(";")
      .map((code) => companies.find((c) => c.code === code.trim())?.id)
      .filter(Boolean) as string[];
    return {
      assetTag: data.assetTag,
      name: data.name,
      type: data.type,
      vendor: data.vendor,
      model: data.model,
      location: data.location,
      purchaseDate: data.purchaseDate,
      lifecycleYears: parseInt(data.lifecycleYears) || 5,
      status: data.status || "ACTIVE",
      notes: data.notes || undefined,
      companyIds,
    };
  }
  return {
    licenseId: data.licenseId,
    name: data.name,
    vendor: data.vendor,
    seats: parseInt(data.seats) || 1,
    cost: parseFloat(data.cost) || 0,
    expiryDate: data.expiryDate,
    owner: data.owner,
    notes: data.notes || undefined,
  };
}

const API_ENDPOINT: Record<ImportType, string> = {
  employee: "/api/employees",
  asset: "/api/it-assets",
  license: "/api/it-licenses",
};

export function CsvImportDialog({
  type,
  companies = [],
  buttonLabel,
  buttonVariant = "outline",
}: {
  type: ImportType;
  companies?: CompanyOption[];
  buttonLabel?: string;
  buttonVariant?: "default" | "outline" | "secondary";
}) {
  const template = TEMPLATES[type];
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ ok: number; failed: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setHeaders([]);
    setRows([]);
    setParseError(null);
    setResults(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    setOpen(next);
  }

  function downloadTemplate() {
    const csv = [template.headers.join(","), template.example.join(",")].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = template.filename;
    a.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? "";
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setParseError("File must have a header row and at least one data row.");
        return;
      }
      const parsed = parseCSVLine(lines[0]);
      const required = type === "employee" ? ["employeeId", "name", "department", "jobTitle"]
        : type === "asset" ? ["assetTag", "name", "type", "vendor", "model", "location", "purchaseDate"]
        : ["licenseId", "name", "vendor", "seats", "cost", "expiryDate", "owner"];
      const missing = required.filter((h) => !parsed.includes(h));
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.join(", ")}`);
        return;
      }
      setHeaders(parsed);
      setRows(lines.slice(1).map(parseCSVLine));
    };
    reader.readAsText(file);
  }

  async function runImport() {
    setImporting(true);
    setProgress(0);
    setResults(null);
    let ok = 0;
    const failed: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const data = Object.fromEntries(headers.map((h, idx) => [h, row[idx] ?? ""]));
      try {
        const res = await fetch(API_ENDPOINT[type], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(type, data, companies)),
        });
        if (res.ok) { ok++; }
        else {
          const body = await res.json().catch(() => null);
          failed.push(`Row ${i + 2}: ${body?.error ?? "Unknown error"}`);
        }
      } catch {
        failed.push(`Row ${i + 2}: Network error`);
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }
    setResults({ ok, failed });
    setImporting(false);
  }

  const preview = rows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size="sm">
          <Upload className="mr-2 h-4 w-4" />
          {buttonLabel ?? `Import ${template.label}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import {template.label} from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Step 1 — Download the template</p>
              <p className="text-xs text-muted-foreground">Use <code>;</code> to separate multiple company codes (e.g. <code>CO-A;CO-B</code>).</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />Template CSV
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Step 2 — Upload your filled CSV</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
            />
            {parseError && <p className="text-sm text-destructive">{parseError}</p>}
          </div>

          {rows.length > 0 && !results && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Preview ({rows.length} row{rows.length !== 1 ? "s" : ""})</p>
                {rows.length > 5 && <p className="text-xs text-muted-foreground">Showing first 5 rows</p>}
              </div>
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h) => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, idx) => (
                      <TableRow key={idx}>
                        {headers.map((_, col) => (
                          <TableCell key={col} className="max-w-[120px] truncate text-xs">{row[col] ?? ""}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {importing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing… {progress}%
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : (
                <Button onClick={runImport} className="w-full">
                  Import {rows.length} row{rows.length !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          )}

          {results && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">{results.ok} imported successfully</span>
              </div>
              {results.failed.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">{results.failed.length} failed</span>
                  </div>
                  <ul className="max-h-36 overflow-y-auto space-y-1">
                    {results.failed.map((msg, i) => (
                      <li key={i} className="text-xs text-muted-foreground">{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={reset}>Import more</Button>
                <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
              </div>
            </div>
          )}

          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Required columns</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {template.headers.slice(0, type === "employee" ? 4 : type === "asset" ? 7 : 7).map((h) => (
                <Badge key={h} variant="secondary" className="text-xs">{h}</Badge>
              ))}
            </div>
            {(type === "employee" || type === "asset") && (
              <p className="mt-2 text-xs text-muted-foreground">
                <strong>companyCodes</strong>: Use your company codes separated by <code>;</code> (e.g., <code>CO-A;CO-B</code>).
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
