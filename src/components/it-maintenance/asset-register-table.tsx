"use client";

import { useMemo, useState } from "react";
import { differenceInYears } from "date-fns";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AssetQrButton } from "@/components/it-maintenance/asset-qr-button";
import { AssetEditDialog } from "@/components/it-maintenance/asset-edit-dialog";
import { CompanyBadges, type AssetTableRow } from "@/components/it-maintenance/it-maintenance-tables";
import { getAssetRecommendations, topRecommendation, severityVariant, type RecommendationSeverity } from "@/lib/asset-recommendations";
import { formatEnum } from "@/lib/utils";

type AssetRegisterTableProps = {
  assets: AssetTableRow[];
  compact?: boolean;
  canManage?: boolean;
  companies?: { id: string; name: string; code: string }[];
  users?: { id: string; name: string }[];
  employees?: { id: string; name: string; employeeId: string }[];
};

const ALL = "__all__";
const SEVERITY_ORDER: RecommendationSeverity[] = ["critical", "high", "medium", "low"];

type SortKey = "alerts" | "age" | "name" | "tag";

const SORT_LABELS: Record<SortKey, string> = {
  alerts: "Alerts first",
  age: "Oldest first",
  name: "Name A–Z",
  tag: "Asset tag",
};

/** Fields a `key:value` token in the search box can target. */
const FIELD_KEYS = ["tag", "name", "type", "vendor", "model", "location", "status", "custodian", "employee", "company", "alert"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

type SearchTerm = { field: FieldKey | null; value: string };

/** Parse "dell type:laptop location:jeddah" into free-text and field-scoped terms. */
function parseQuery(query: string): SearchTerm[] {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const [maybeField, ...rest] = token.split(":");
      const field = maybeField.toLowerCase() as FieldKey;
      if (rest.length > 0 && FIELD_KEYS.includes(field)) {
        return { field, value: rest.join(":").toLowerCase() };
      }
      return { field: null, value: token.toLowerCase() };
    })
    .filter((term) => term.value.length > 0);
}

function fieldValues(asset: AssetTableRow, recs: ReturnType<typeof getAssetRecommendations>): Record<FieldKey, string[]> {
  return {
    tag: [asset.assetTag],
    name: [asset.name],
    type: [asset.type, formatEnum(asset.type)],
    vendor: [asset.vendor],
    model: [asset.model],
    location: [asset.location],
    status: [asset.status, formatEnum(asset.status)],
    custodian: [asset.assignedTo?.name ?? "unassigned"],
    employee: asset.employee ? [asset.employee.name, asset.employee.employeeId] : ["unassigned"],
    company: asset.companies.flatMap((link) => [link.company.code, link.company.name]),
    alert: recs.length === 0 ? ["ok", "none"] : recs.flatMap((rec) => [rec.severity, rec.label, rec.type]),
  };
}

export function AssetRegisterTable({ assets, compact = false, canManage = false, companies = [], users = [], employees = [] }: AssetRegisterTableProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [locationFilter, setLocationFilter] = useState(ALL);
  const [severityFilter, setSeverityFilter] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("alerts");

  const now = new Date();

  const rows = useMemo(
    () =>
      assets.map((asset) => {
        const recs = getAssetRecommendations(asset);
        const values = fieldValues(asset, recs);
        return {
          asset,
          recs,
          top: topRecommendation(recs),
          values,
          haystack: Object.values(values).flat().join(" ").toLowerCase(),
        };
      }),
    [assets],
  );

  const typeOptions = useMemo(() => [...new Set(assets.map((a) => a.type))].sort(), [assets]);
  const statusOptions = useMemo(() => [...new Set(assets.map((a) => a.status))].sort(), [assets]);
  const locationOptions = useMemo(() => [...new Set(assets.map((a) => a.location))].sort(), [assets]);

  const filtered = useMemo(() => {
    const terms = parseQuery(query);

    const matches = rows.filter(({ asset, top, values, haystack }) => {
      if (typeFilter !== ALL && asset.type !== typeFilter) return false;
      if (statusFilter !== ALL && asset.status !== statusFilter) return false;
      if (locationFilter !== ALL && asset.location !== locationFilter) return false;
      if (severityFilter === "ok" && top) return false;
      if (severityFilter !== ALL && severityFilter !== "ok" && top?.severity !== severityFilter) return false;

      return terms.every((term) =>
        term.field
          ? values[term.field].some((value) => value.toLowerCase().includes(term.value))
          : haystack.includes(term.value),
      );
    });

    if (compact) return matches; // dashboard preview keeps the server's ordering

    return [...matches].sort((a, b) => {
      switch (sortKey) {
        case "alerts": {
          const rank = (row: (typeof matches)[number]) => (row.top ? SEVERITY_ORDER.indexOf(row.top.severity) : SEVERITY_ORDER.length);
          return rank(a) - rank(b) || a.asset.assetTag.localeCompare(b.asset.assetTag);
        }
        case "age":
          return a.asset.purchaseDate.getTime() - b.asset.purchaseDate.getTime();
        case "name":
          return a.asset.name.localeCompare(b.asset.name);
        default:
          return a.asset.assetTag.localeCompare(b.asset.assetTag);
      }
    });
  }, [rows, query, typeFilter, statusFilter, locationFilter, severityFilter, sortKey, compact]);

  const isFiltered = query.trim().length > 0 || [typeFilter, statusFilter, locationFilter, severityFilter].some((f) => f !== ALL);

  const clearAll = () => {
    setQuery("");
    setTypeFilter(ALL);
    setStatusFilter(ALL);
    setLocationFilter(ALL);
    setSeverityFilter(ALL);
  };

  const quickFilters: { label: string; apply: () => void }[] = [
    { label: "Needs attention", apply: () => { clearAll(); setSeverityFilter("critical"); } },
    { label: "Unassigned", apply: () => { clearAll(); setQuery("custodian:unassigned employee:unassigned"); } },
    { label: "End of life", apply: () => { clearAll(); setQuery("alert:REPLACE"); } },
    { label: "No maintenance", apply: () => { clearAll(); setQuery("alert:NO_MAINTENANCE"); } },
  ];

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Asset Register</CardTitle>
          <span className="text-xs text-muted-foreground">
            {isFiltered ? `${filtered.length} of ${assets.length} assets` : `${assets.length} assets`}
          </span>
        </div>

        {!compact && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search assets — try “lenovo”, “type:laptop”, “location:jeddah”, “custodian:unassigned”"
                aria-label="Search assets"
                className="pl-9 pr-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect value={typeFilter} onChange={setTypeFilter} placeholder="All types" options={typeOptions} />
              <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="All statuses" options={statusOptions} />
              <FilterSelect value={locationFilter} onChange={setLocationFilter} placeholder="All locations" options={locationOptions} format={false} />
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All alerts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All alerts</SelectItem>
                  {SEVERITY_ORDER.map((severity) => (
                    <SelectItem key={severity} value={severity}>{formatEnum(severity)}</SelectItem>
                  ))}
                  <SelectItem value="ok">No alerts</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                    <SelectItem key={key} value={key}>{SORT_LABELS[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isFiltered && (
                <Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {quickFilters.map((filter) => (
                <button
                  key={filter.label}
                  type="button"
                  onClick={filter.apply}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className={compact ? "max-h-[520px] overflow-auto rounded-md border" : "overflow-auto rounded-md border"}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Alerts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(({ asset, recs, top }) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="font-medium">{asset.assetTag} / {asset.name}</div>
                    <div className="text-xs text-muted-foreground">{asset.vendor} / {asset.model}</div>
                    <div className="text-xs text-muted-foreground">Custodian: {asset.assignedTo?.name ?? "Unassigned"}</div>
                    <div className="text-xs text-muted-foreground">Employee: {asset.employee ? `${asset.employee.employeeId} / ${asset.employee.name}` : "Unassigned"}</div>
                    <CompanyBadges companies={asset.companies.map((link) => link.company)} />
                  </TableCell>
                  <TableCell>{formatEnum(asset.type)}</TableCell>
                  <TableCell>{asset.location}</TableCell>
                  <TableCell>{differenceInYears(now, asset.purchaseDate)} yr</TableCell>
                  <TableCell>
                    {top ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant={severityVariant(top.severity)}>{top.label}</Badge>
                        {recs.length > 1 && <span className="text-xs text-muted-foreground">+{recs.length - 1} more</span>}
                      </div>
                    ) : (
                      <Badge variant="success">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={asset.status === "ACTIVE" ? "success" : "secondary"}>{formatEnum(asset.status)}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {canManage && <AssetEditDialog asset={asset} companies={companies} users={users} employees={employees} />}
                      <AssetQrButton id={asset.id} assetTag={asset.assetTag} name={asset.name} type={asset.type} vendor={asset.vendor} location={asset.location} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {assets.length === 0
                      ? "Add servers, routers, applications, databases, or cloud services to begin maintenance planning."
                      : "No assets match this search. Try a broader term or clear the filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  format = true,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
  format?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>{format ? formatEnum(option) : option}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
